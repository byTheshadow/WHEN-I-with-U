// src/apps/snapshots/services/snapshotAiService.js
//
// 【整体替换说明】
// 相对旧版的改动：
// 1. 新增 buildRecentPlotContext(chatId)：抽出原来 generateCharacterPost 里读取
//    最近消息的逻辑，做成共享函数，供 generateCharacterPost / generateNpcPost 复用，
//    让 NPC 发帖也能感知消息框的剧情氛围（不引用用户私聊原文，只感知氛围与事件）。
// 2. generateNpcPost 新增 chatId 参数，用于获取剧情上下文。
// 3. 新增 buildRelationshipNarrative()：基于"官配"（chat 绑定角色默认是 user 的伴侣）
//    与 snapshotRelationService 里配置的任意关系（角色↔角色/角色↔NPC/NPC↔NPC），
//    生成给 AI 的关系叙述文本，替代旧的"非情侣不得暧昧"硬性统一限制。
// 4. generateSnapshotComment / generateSnapshotReply 新增 chatId 参数，接入新关系服务。
//
import db from '../../../db';
import { getOfficialCoupleCharacterId, findRelation } from './snapshotRelationService';
import { buildAffinityHint, rollMentionUser } from './snapshotAffinityService';

// 严格零 Emoji 过滤器
export const removeEmoji = (text) =>
  String(text || '')
    .replace(/[-]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]/g, '')
    .trim();

// 统一双通道读取 API 配置 (优先读取 apiConfig 对象，回退到散落项)
export const getApiConfig = async () => {
  const settingObj = await db.settings.get('apiConfig');
  const apiConfig = settingObj?.value || {};

  let apiKey = String(apiConfig.apiKey || '').trim();
  let baseUrl = String(apiConfig.baseUrl || '').trim();
  let model = String(apiConfig.model || '').trim();

  // 若 apiConfig 为空，尝试回退到单项
  if (!apiKey) {
    const k = await db.settings.get('apiKey');
    apiKey = String(k?.value || '').trim();
  }
  if (!baseUrl) {
    const b = await db.settings.get('baseUrl');
    baseUrl = String(b?.value || '').trim();
  }
  if (!model) {
    const m = await db.settings.get('model');
    model = String(m?.value || '').trim();
  }

  baseUrl = baseUrl.replace(/\/+$/, '');
  if (!apiKey || !baseUrl) {
    throw new Error('未检测到有效的 API Key 与 Base URL，请在系统设置中配置。');
  }

  return {
    apiKey,
    baseUrl,
    model: model || 'gpt-4o-mini'
  };
};

const callAi = async (messages, temperature = 0.75, maxTokens = 400) => {
  const { apiKey, baseUrl, model } = await getApiConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || errJson?.message || detail;
    } catch {}
    throw new Error(`AI 请求失败 (HTTP ${response.status}): ${detail}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  return removeEmoji(raw);
};

// ==========================================
// 0. 共享工具：剧情上下文 & 关系叙述
// ==========================================

/**
 * 读取某个 chat 最近的对话片段，作为"当下氛围"的感知依据。
 * 仅用于让角色/NPC 的动态更贴近剧情当下语境，不是逐字引用用户隐私对话。
 */
export const buildRecentPlotContext = async (chatId, limit = 6) => {
  if (!chatId) return '';

  try {
    const recentMsgs = await db.messages
      .where('chatId')
      .equals(Number(chatId))
      .reverse()
      .limit(limit)
      .toArray();

    if (recentMsgs.length === 0) return '';

    return '【近期剧情氛围片段（仅供感知当下语境，不要逐字引用）】:\n' +
      recentMsgs.reverse().map((m) => `${m.sender}: ${m.content}`).join('\n');
  } catch (err) {
    console.error('[snapshotAiService] 获取剧情上下文失败:', err);
    return '';
  }
};

/**
 * 根据"官配关系"（chat 绑定角色默认是 user 的伴侣）与已配置的任意关系
 * （角色↔角色 / 角色↔NPC / NPC↔NPC），生成一段关系叙述文本，供 AI 生成时判断语气边界。
 *
 * entity: { type: 'character'|'npc', id, name } —— 当前要生成内容的这个角色/NPC
 * author: { type: 'user'|'character'|'npc', id, name } —— 动态或评论的原作者
 *
 * 返回: { text: string, allowIntimate: boolean }
 */
export const buildRelationshipNarrative = async (chatId, entity, author) => {
  const fallback = {
    text: '你与对方是同城生活圈里的普通熟人或路过邻里，保持自然、克制、非暧昧的社交距离。',
    allowIntimate: false
  };

  if (!chatId || !entity || !author) return fallback;

  try {
    const officialId = await getOfficialCoupleCharacterId(chatId);

    const isEntityOfficial =
      entity.type === 'character' && officialId !== null && Number(entity.id) === officialId;
    const isAuthorOfficial =
      author.type === 'character' && officialId !== null && Number(author.id) === officialId;
    const isAuthorUser = author.type === 'user';

    // 情形 1：作者是 user，评论/发帖者正是官配角色本人 —— 官方情侣关系，允许亲密表达
    if (isAuthorUser && isEntityOfficial) {
      return {
        text: '你是动态作者（User）的男/女朋友，这是被认可的官方情侣关系，可以自然、真实地表达亲密与关心。',
        allowIntimate: true
      };
    }

    // 情形 2：作者是 user，但评论/发帖者不是官配角色 —— 明确知道作者已有固定伴侣，避免越界
    if (isAuthorUser && !isEntityOfficial) {
      return {
        text: '动态作者（User）已经有固定的另一半（与本世界线绑定的角色是官方情侣关系），你只是作者生活圈里的熟人、邻里或朋友，不应对作者表达暧昧或越界的情感，保持自然得体的社交距离。',
        allowIntimate: false
      };
    }

    // 情形 3：作者是官配角色本人，评论/发帖者是别的角色或 NPC —— 检查是否配置了显式关系
    if (isAuthorOfficial && !isEntityOfficial) {
      const rel = officialId
        ? await findRelation(chatId, entity.type, entity.id, 'character', officialId)
        : null;

      if (rel?.relation) {
        return {
          text: `你与动态作者的关系是: ${rel.relation}。同时要清楚，动态作者目前与 User 处于官方情侣关系中，请依据你们之间配置的这段关系自然表达，若关系设定本身带有暧昧或情感色彩可以自然呈现，但不要越权干涉作者与 User 的官配关系。`,
          allowIntimate: true
        };
      }

      return {
        text: '动态作者是 User 的固定伴侣（官方情侣关系），你只是作者生活圈里的朋友、同事或邻里等社交关系，不应对作者表达暧昧或越界情感。',
        allowIntimate: false
      };
    }

    // 情形 4：双方都不是"user 的官配"这条线，走普通的显式关系查询
    // （这里天然支持 角色↔角色 / 角色↔NPC / NPC↔NPC 的任意 CP/暧昧配置）
    const rel = await findRelation(chatId, entity.type, entity.id, author.type, author.id);
    if (rel?.relation) {
      return {
        text: `你与动态作者的关系是: ${rel.relation}。请依据这段关系自然表达，若关系设定本身带有暧昧、CP 或情感色彩，可以自然呈现。`,
        allowIntimate: true
      };
    }

    return fallback;
  } catch (err) {
    console.error('[snapshotAiService] 构建关系叙述失败:', err);
    return fallback;
  }
};

// ==========================================
// 1. 动态生成: Char 伴侣发布拍立得动态
// ==========================================
export const generateCharacterPost = async (characterId, chatId = null, topicHint = '') => {
  const char = await db.characters.get(Number(characterId));
  if (!char) throw new Error('找不到指定的陪伴角色');

  const memoryContext = await buildRecentPlotContext(chatId);

  const systemPrompt = `你正在扮演角色 [${char.name}]，在个人拍立得生活动态圈发布一条即时生活随笔。

【角色人设】
姓名: ${char.name}
简介: ${char.bio || '无'}
性格/习惯: ${char.extraNotes || '无'}

${memoryContext}

【绝对规则】
1. 输出必须是合法的纯 JSON 字符串，绝不要使用 Markdown 语法包装，包含以下三个字段：
   - "imagePrompt": 照片画面的微观细节描摹，包含光影、色调、具体物件，80字以内，文学质感；
   - "content": 配合相片的随笔文字，不超过100字，带有生活温度；
   - "location": 简短地点名称（例如：晨光窗台、旧书店街角、转角长椅）。
2. 绝对禁止使用任何 Emoji 字符。
3. 严格符合你的角色人设口吻。
4. 如果上方提供了近期剧情氛围片段，可以让这条动态自然呼应当下的情绪或事件，但不要逐字引用对话内容。`;

  const userPrompt = topicHint
    ? `请围绕心境或灵感：“${topicHint}” 创作这条拍立得生活随笔。`
    : `请根据此刻的心境与生活状态，创作一条自然的拍立得生活动态。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        imagePrompt: removeEmoji(parsed.imagePrompt || ''),
        content: removeEmoji(parsed.content || ''),
        location: removeEmoji(parsed.location || '某处光影')
      };
    } catch {}
  }

  return {
    imagePrompt: `[微观镜头: ${char.name} 桌前散落的光影与字迹]`,
    content: result.slice(0, 100),
    location: '日常生活'
  };
};

// ==========================================
// 2. 动态生成: NPC 街坊生活碎片发帖 (生活交集碰撞)
// ==========================================
export const generateNpcPost = async (npc, chatId = null, charName = '', userName = '', topicHint = '') => {
  const memoryContext = await buildRecentPlotContext(chatId);
  const personaText = npc.personaSummary
    ? `你的说话风格/性格棱角: ${npc.personaSummary}`
    : '';

  // 友谊向好感：按档位给一段态度提示，熟人档以上还会掷一次"要不要 @用户"。
  const affinityHint = await buildAffinityHint(npc.id);
  const shouldMention = await rollMentionUser(npc.id);
  const mentionName = userName || 'User';
  const withMention = (text) =>
    shouldMention && !String(text).includes(`@${mentionName}`) ? `${text} @${mentionName}` : text;

  const systemPrompt = `你是一个常驻生活在小镇/街区里的 NPC 角色 [${npc.name}]，你的职业/身份是 [${npc.roleTag || '街区邻里'}]。
${personaText}
${affinityHint}
你正在社交生活圈发布一条属于你职业与日常特质的真实拍立得动态。

【绝对不能混淆的身份边界】
你不是 [${charName || '这位常客'}]，绝不能模仿、借用TA的语气、兴趣、口头禅或说话方式——你有自己独立的人格和说话习惯，跟TA是完全不同的两个人。

【同城生活的邻里常客】
- 常常出没的伙伴: ${charName || '熟悉的面孔'}
- 另一位常客: ${userName || 'User'}

${memoryContext ? `${memoryContext}\n（以上片段仅供你感知当下季节/氛围，不要模仿里面任何人的说话方式或语气，也不要逐字引用，你要保持你自己的口吻）` : ''}

【创作指导】
1. 内容必须强烈体现你的职业标签和你自己的说话风格（例如花店店主提到了修剪残枝、咖啡师提到了刚烘焙的新批次豆子、摄影师拍下的逆光街景）。
2. 可以自然、不经意地带出一丝与同城伙伴的生活交集（例如：“方才看见 ${charName || '熟悉的身影'} 匆匆走过街口”，或者提及常客的小习惯），让整个街区生活圈产生真实的偶遇感。
3. 不要逐字引用对话内容，也不要窥探式地转述用户的私人对话。
4. 必须输出纯 JSON 字符串，不要带 Markdown 语法：
   - "imagePrompt": 照片画面的细节描摹，80字以内；
   - "content": 随感正文，不超过100字；
   - "location": 与你身份相符的地点（如：木槿花房、烘焙吧台、转角书店）。
5. 绝对禁止使用任何 Emoji。${shouldMention ? `
6. 这条动态里请自然地 @${mentionName} 一次（直接写成 @${mentionName}），比如想起TA、顺口邀TA、或跟TA打个招呼，语气要符合上面的熟络程度，不要刻意。` : ''}`;

  const userPrompt = topicHint
    ? `请围绕主题：“${topicHint}” 记录你的生活切片。`
    : `请以 [${npc.name}] 的身份记录当下的街区生活碎片。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        imagePrompt: removeEmoji(parsed.imagePrompt || ''),
        content: withMention(removeEmoji(parsed.content || '')),
        location: removeEmoji(parsed.location || `${npc.name}的日常角落`)
      };
    } catch {}
  }

  return {
    imagePrompt: `[街区随拍: ${npc.name} 忙碌的工作台]`,
    content: withMention(result.slice(0, 100)),
    location: `${npc.name}的小店`
  };
};

// ==========================================
// 3. 评论生成: Char 或 NPC 为动态写评论
// ==========================================
export const generateSnapshotComment = async (snapshot, commenter, chatId = null) => {
  let commenterDesc = '';

  if (commenter.type === 'character') {
    const char = await db.characters.get(Number(commenter.id));
    commenterDesc = `角色姓名: ${char?.name}\n人设简介: ${char?.bio}\n性格特征: ${char?.extraNotes}`;
  } else {
    commenterDesc = `NPC 姓名: ${commenter.name}\n职业身份: ${commenter.roleTag || '街区邻里'}${commenter.personaSummary ? `\n说话风格/性格棱角: ${commenter.personaSummary}` : ''}`;
  }

  const authorEntity = {
    type: snapshot.authorType || 'user',
    id: snapshot.characterId || snapshot.npcId || null,
    name: snapshot.authorName
  };
  const entity = { type: commenter.type, id: commenter.id, name: commenter.name };

  const { text: relationInfo } = await buildRelationshipNarrative(chatId, entity, authorEntity);

  // 只有"NPC 评论用户自己的动态"时，对用户的熟络程度才相关
  const affinityHint =
    commenter.type === 'npc' && snapshot.authorType === 'user'
      ? await buildAffinityHint(commenter.id)
      : '';

  const systemPrompt = `你正在以 [${commenter.name}] 的身份，为一条拍立得生活动态留言。

【动态作者】: ${snapshot.authorName || '某位朋友'}
【动态画面】: ${snapshot.imagePrompt || '无画面描摹'}
【动态正文】: ${snapshot.content || '无正文'}
【打卡地点】: ${snapshot.location || '某处'}

【你的身份】:
${commenterDesc}

【与作者的社交关系】:
${relationInfo}

${affinityHint}

【规则】
1. 语言简练，20-50字以内，像真实生活圈里的留言。
2. 符合你的人物设定或职业口吻，可以温和打趣、问候、探讨画面物件或随口附和。${commenter.type === 'npc' ? '\n2b. 你不是动态作者，也不是作者生活圈里的主角本人，不要模仿或借用他们的语气/口头禅——按照上方给出的"说话风格/性格棱角"保持你自己的说话方式。' : ''}
3. 严格遵守上方给出的"与作者的社交关系"里对亲密/暧昧表达边界的说明。
4. 绝对禁止使用任何 Emoji。
5. 仅输出评论文本本身，不要附加额外引号或前缀。`;

  return await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请为这条生活动态写下一条自然真切的短评。' }
  ], 0.7, 150);
};

// ==========================================
// 4. 追评回复: Char 或 NPC 回复某条评论 (多轮接话)
// ==========================================
export const generateSnapshotReply = async (snapshot, responder, replyTargetComment, userReplyText = '', chatId = null) => {
  let responderDesc = '';
  if (responder.type === 'character') {
    const char = await db.characters.get(Number(responder.id));
    responderDesc = `角色姓名: ${char?.name}\n人设: ${char?.bio || ''} / ${char?.extraNotes || ''}`;
  } else {
    responderDesc = `NPC 姓名: ${responder.name}\n职业身份: ${responder.roleTag || '街区邻里'}${responder.personaSummary ? `\n说话风格/性格棱角: ${responder.personaSummary}` : ''}`;
  }

  const authorEntity = {
    type: snapshot.authorType || 'user',
    id: snapshot.characterId || snapshot.npcId || null,
    name: snapshot.authorName
  };
  const entity = { type: responder.type, id: responder.id, name: responder.name };

  const { text: relationInfo } = await buildRelationshipNarrative(chatId, entity, authorEntity);

  // 有 userReplyText 说明是用户本人在跟 NPC 说话，此时熟络程度才相关
  const affinityHint =
    responder.type === 'npc' && userReplyText
      ? await buildAffinityHint(responder.id)
      : '';

  const systemPrompt = `你正在拍立得动态下方，以 [${responder.name}] 的身份回复来自 [${replyTargetComment.senderName}] 的评论。

【动态原帖背景】:
作者: ${snapshot.authorName}
正文/画面: ${snapshot.content || snapshot.imagePrompt}

【被回复的评论】:
${replyTargetComment.senderName}: "${replyTargetComment.content}"

${userReplyText ? `【对方的最新回复】:\n"${userReplyText}"` : ''}

【你的身份】:
${responderDesc}

【你与动态作者的关系】:
${relationInfo}

${affinityHint}

【规则】
1. 像日常交谈一样自然接话，20-60字以内。
2. 保持你的性格或职业身份口吻一致。${responder.type === 'npc' ? '\n2b. 你不是评论作者、也不是动态作者本人，不要模仿或借用他们的语气/口头禅——按照上方给出的"说话风格/性格棱角"保持你自己的说话方式。' : ''}
3. 严格遵守上方给出的"你与动态作者的关系"里对亲密/暧昧表达边界的说明。
4. 绝对禁止使用任何 Emoji。
5. 仅输出回复正文，不要附加额外修饰。`;

  return await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请生成自然得体的接续回复。' }
  ], 0.75, 150);
};

// ==========================================
// 5. NPC 自动补齐: 从角色人设里找已提到的配角，不够再自由发挥补足
// ==========================================
/**
 * 给某个chat准备 targetCount 个NPC——优先把角色人设文本里已经提到的、
 * 有名字的配角原样收录，人设里不够数量再由AI自由发挥补充，
 * 补充时贴合角色人设暗示的生活圈氛围（不是完全随机瞎编）。
 * 只在"这个chat从来没有任何NPC"时被调用一次（调用方 snapshotNpcService
 * 负责判断和去重，这里只负责生成）。
 */
// 把 chat.userName / chat.userPersona 里可能出现的"user 本人在这个世界线里
// 叫什么"的候选别名，拆成一份用于 prompt 排除说明 + 结果过滤的列表。
// userPersona 通常是一段较长的人设描述而不是单纯一个称呼，所以除了整段原文
// 之外，还额外把它的第一行/第一句摘出来（很多用户写法是"名字：xxx，性格：xxx"
// 或者第一句就是称呼/身份自述），提高"名字碰巧就是这几个字"时的过滤命中率。
const buildUserAliasList = (userAliases) => {
  const { userName = '', userPersona = '' } = userAliases || {};
  const aliases = new Set();

  const addIfNonEmpty = (val) => {
    const trimmed = String(val || '').trim();
    if (trimmed) aliases.add(trimmed);
  };

  addIfNonEmpty(userName);
  addIfNonEmpty(userPersona);

  if (userPersona) {
    const firstLine = String(userPersona).split(/[\n。，,.]/)[0];
    addIfNonEmpty(firstLine);
  }

  return Array.from(aliases);
};

/**
 * 给某个chat准备 targetCount 个NPC——优先把角色人设文本里已经提到的、
 * 有名字的配角原样收录，人设里不够数量再由AI自由发挥补充，
 * 补充时贴合角色人设暗示的生活圈氛围（不是完全随机瞎编）。
 * 只在"这个chat从来没有任何NPC"时被调用一次（调用方 snapshotNpcService
 * 负责判断和去重，这里只负责生成）。
 *
 * userAliases: { userName, userPersona } —— 来自 chat 表，用来告诉AI
 * "user在这个世界线里可能被称呼成什么"，避免角色人设文本里提到的、
 * 实际上是指user本人的称呼（而非字面的"User"两个字）被误当成一个
 * 独立的配角NPC提取出来。除了在prompt里明确列出这些别名要求排除，
 * 结果里也会再做一次名字匹配过滤兜底。
 */
export const extractOrInventNpcs = async (character, targetCount = 3, userAliases = null) => {
  const aliasList = buildUserAliasList(userAliases);
  const aliasExclusionText = aliasList.length > 0
    ? `\n【重要：以下称呼/描述实际指的是 User 本人，绝不能把它们当成配角NPC收录或补充】\n${aliasList.map((a) => `- ${a}`).join('\n')}`
    : '';

  const systemPrompt = `你需要为角色 [${character?.name || '这位角色'}] 所在的生活圈准备 ${targetCount} 个配角NPC，用于其社交动态圈（拍立得生活动态/评论区）里日常出没。

【角色人设参考】
姓名: ${character?.name || '未知'}
简介: ${character?.bio || '无'}
性格/习惯/背景: ${character?.extraNotes || '无'}
${aliasExclusionText}

【生成规则，按优先级】
1. 优先从上面的人设文本里找出已经被提到的、有名字的配角/朋友/同事/家人等（不包括角色本人、User，以及上方明确列出的"实际指user本人"的称呼），把他们直接收录进来。
2. 如果人设里没有提到足够数量的配角，再根据人设所暗示的生活圈氛围和世界观，自由发挥、合理地补充新的NPC，使总数凑够 ${targetCount} 个。每个新补充的NPC要有具体的身份/职业标签，贴近角色的生活场景（同事、邻居、常去的店家等），不要凭空脱离人设的调性。
3. 每个NPC的名字不要重复，也不要与角色本人或User同名/同称呼。

【输出格式】
必须输出合法的纯 JSON 数组字符串，不要用 Markdown 语法包装，每个元素包含:
- "name": NPC 姓名
- "roleTag": 身份/职业标签（例如：楼下咖啡师、健身房搭子、合租室友）

严格输出恰好 ${targetCount} 个元素，不要输出任何 JSON 以外的文字。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请生成这 ${targetCount} 位NPC。` }
  ], 0.8, 500);

  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('NPC生成结果解析失败：未找到JSON数组');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('NPC生成结果为空');
  }

  // 结果过滤兜底：万一AI没听话，仍然产出了跟 user 别名重合的"NPC"，
  // 在写入数据库之前就把它筛掉，而不是依赖prompt单独生效。
  const normalizedAliases = aliasList.map((a) => a.trim().toLowerCase());
  const isUserAlias = (name) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    return normalizedAliases.some((alias) => alias && (alias === normalized || alias.includes(normalized) || normalized.includes(alias)));
  };

  return parsed
    .filter((item) => item && item.name)
    .filter((item) => !isUserAlias(item.name))
    .slice(0, targetCount)
    .map((item) => ({
      name: removeEmoji(String(item.name)).trim(),
      roleTag: removeEmoji(String(item.roleTag || '街区邻里')).trim()
    }));
};

// ==========================================
// 5b. NPC 人设固化: 第一次发帖/评论前生成一段简短、独立的人设/说话风格
// ==========================================
/**
 * 只生成文本，不做任何 DB 读写（DB 缓存由 snapshotNpcService.ensureNpcPersona
 * 负责，这里跟 extractOrInventNpcs 一样保持"纯生成"职责，避免循环引用）。
 *
 * 目的：解决NPC发帖/评论容易被主角人设"夺舍"、写得像char的问题——
 * 以前NPC只有 name + roleTag，人设太单薄，AI在缺乏具体人格支撑时，
 * 容易被prompt里"近期剧情氛围片段"（char/user的真实对话语气）带偏。
 * 这里生成一段独立于char的、有具体说话习惯/口头禅/性格棱角的简短人设，
 * 生成一次后永久缓存在 npc.personaSummary 上，之后每次发帖/评论/回复
 * 都复用同一份，保证同一个NPC长期人设一致。
 */
export const generateNpcPersonaText = async (npc, character) => {
  const systemPrompt = `请为一个虚构的配角NPC设计一段简短的人设/说话风格描述，供后续反复扮演使用。

【NPC基本信息】
姓名: ${npc?.name || '未知'}
身份/职业标签: ${npc?.roleTag || '街区邻里'}

【这个NPC生活圈里的主角，仅供参考，你设计的人设必须与TA明显不同】
主角姓名: ${character?.name || '未知'}
主角简介: ${character?.bio || '无'}

【要求】
1. 描述这个NPC具体的说话习惯（例如：喜欢用短句、爱用某种口头禅、语气直接或含蓄、幽默感强或一本正经等），以及1-2个具体的性格棱角或小癖好。
2. 必须明显区别于上面给出的主角人设——不要让这个NPC的语气、关注点、用词风格跟主角相似或重叠。
3. 不超过80字，直接给出描述正文本身，不要加任何前缀、标题或引号。
4. 绝对禁止使用任何 Emoji。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请生成这段人设/说话风格描述。' }
  ], 0.8, 200);

  return removeEmoji(result).trim() || `说话直接、带点${npc?.roleTag || '街坊'}特有的实在劲儿，不多废话。`;
};

// ==========================================
// 6. 动态生成: 虚构本地媒体账号发布生活资讯速报
// ==========================================
export const NEWS_ACCOUNT_NAME = '本地生活速报';
export const NEWS_ACCOUNT = { name: NEWS_ACCOUNT_NAME, avatar: '' };

/**
 * 生成一条"本地生活速报"——一个虚构的本地媒体/公众号账号发布的资讯类
 * 动态，跟角色/NPC的个人生活随笔区分开：客观、公共信息口吻，不是
 * 第一人称抒情。用来给生活圈添点"这是个活的小世界"的氛围感。
 */
export const generateNewsPost = async (chatId = null) => {
  const memoryContext = await buildRecentPlotContext(chatId);

  const systemPrompt = `你正在运营一个虚构的本地生活媒体账号 [${NEWS_ACCOUNT_NAME}]，在同城生活圈发布一条简短的本地资讯/生活速报（不是私人动态，是像本地公众号/生活号那样的公共信息发布）。

${memoryContext}

【创作指导】
1. 内容围绕虚构的本地生活资讯：可以是社区活动预告、天气生活提示、街区新店开业、周边趣闻等，保持轻松、贴近生活、非负面重大事件。
2. 语气客观、简洁，像公众号资讯的口吻，不是个人化的随笔——不用第一人称抒情。
3. 如果上方提供了近期剧情氛围片段，可以让内容隐约呼应当下的季节感或氛围，但不要提及任何私人对话细节。
4. 必须输出纯 JSON 字符串，不要带 Markdown 语法：
   - "imagePrompt": 配图的画面描摹（资讯类的客观场景，如街景、活动海报感），80字以内；
   - "content": 资讯正文，不超过100字；
   - "location": 资讯相关地点（如：中心广场、社区公告栏）。
5. 绝对禁止使用任何 Emoji。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请发布一条本地生活速报。' }
  ]);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        imagePrompt: removeEmoji(parsed.imagePrompt || ''),
        content: removeEmoji(parsed.content || ''),
        location: removeEmoji(parsed.location || '同城速报')
      };
    } catch {}
  }

  return {
    imagePrompt: '[资讯速览: 社区公告栏的最新一角]',
    content: result.slice(0, 100),
    location: '同城速报'
  };
};

export default {
  removeEmoji,
  getApiConfig,
  buildRecentPlotContext,
  buildRelationshipNarrative,
  generateCharacterPost,
  generateNpcPost,
  generateSnapshotComment,
  generateSnapshotReply,
  extractOrInventNpcs,
  generateNpcPersonaText,
  generateNewsPost,
  NEWS_ACCOUNT_NAME,
  NEWS_ACCOUNT
};