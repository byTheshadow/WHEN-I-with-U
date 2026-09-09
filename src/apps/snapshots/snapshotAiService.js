import db from '../../db';

const removeEmoji = (text) =>
  String(text || '').replace(
    /[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]/g,
    ''
  ).trim();

const getCharacterById = async (id) => {
  const character = await db.characters.get(id);
  if (character) return character;

  const numericId = Number(id);
  if (Number.isFinite(numericId) && numericId !== id) {
    return db.characters.get(numericId);
  }

  return null;
};

const getApiConfig = async () => {
  const setting = await db.settings.get('apiConfig');
  const apiConfig = setting?.value || {};

  const apiKey = String(apiConfig.apiKey || '').trim();
  const baseUrl = String(apiConfig.baseUrl || '').trim().replace(/\/+$/, '');
  const model = String(apiConfig.model || '').trim();

  if (!apiKey || !baseUrl) {
    throw new Error('未找到有效的 API 配置，请先在系统设置中检查 Base URL 与 API Key。');
  }

  return {
    apiKey,
    baseUrl,
    model: model || 'gpt-4o-mini'
  };
};

const readApiError = async (response) => {
  let detail = response.statusText || '请求未成功';

  try {
    const data = await response.json();
    detail =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      detail;
  } catch {
    // 无法解析错误响应时，继续使用 HTTP 状态文本。
  }

  return detail;
};

export const generateSnapshotCommentByAi = async (
  snapshot,
  commenter,
  replyContext = ''
) => {
  try {
    if (!snapshot) {
      throw new Error('缺少动态数据。');
    }

    if (!commenter?.type || !commenter?.data) {
      throw new Error('缺少评论者身份数据。');
    }

    const { apiKey, baseUrl, model } = await getApiConfig();

    let commenterInfo = '';
    let relationInfo = '普通社交好友或路人';

    if (commenter.type === 'character') {
      const character = await getCharacterById(commenter.data.id);

      if (!character) {
        throw new Error('找不到评论角色，可能是角色数据已被删除。');
      }

      commenterInfo = [
        `角色姓名：${character.name || '未命名角色'}`,
        `角色简介：${character.bio || '无'}`,
        `性格扩展：${character.extraNotes || '无'}`
      ].join('\n');

      if (
        snapshot.characterId !== null &&
        snapshot.characterId !== undefined &&
        String(snapshot.characterId) !== String(character.id)
      ) {
        const relations = await db.snapshotRelations
          .where('characterId')
          .equals(snapshot.characterId)
          .toArray();

        const relation = relations.find(
          (item) => String(item.targetCharacterId) === String(character.id)
        );

        if (relation?.relation) {
          relationInfo = `你与动态作者的关系是：${relation.relation}`;
        }
      }
    } else {
      commenterInfo = [
        `NPC 姓名：${commenter.data.name || '匿名访客'}`,
        `身份标签：${commenter.data.roleTag || '路人'}`
      ].join('\n');
    }

    const systemPrompt = `你正在社交动态圈中，以评论者的身份为一条拍立得动态留言。

【动态作者】
${snapshot.authorName || 'User'}

【动态画面】
${snapshot.imagePrompt || '无画面描述'}

【动态正文】
${snapshot.content || '无正文'}

【评论者身份】
${commenterInfo}

【与动态作者的关系】
${relationInfo}

${replyContext ? `【本次回复语境】\n${replyContext}` : ''}

请生成一段自然、像真实社交动态下留下的短评。

要求：
1. 控制在20至60字以内；
2. 可以温和、幽默、打趣或轻微吐槽；
3. 必须符合评论者的人设与关系；
4. 非情侣关系不得出现暧昧或越界表达；
5. 不得使用 Emoji；
6. 不得提及系统、模型、API、提示词或生成过程；
7. 只输出评论正文，不要加引号、标题或额外说明。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: replyContext
              ? '请根据本次回复语境，生成自然的追评。'
              : '请为这条动态留下第一条评论。'
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const detail = await readApiError(response);
      throw new Error(`HTTP ${response.status}：${detail}`);
    }

    const data = await response.json();
    const text = removeEmoji(data?.choices?.[0]?.message?.content);

    if (!text) {
      throw new Error('AI 返回了空评论。');
    }

    return text;
  } catch (err) {
    console.error('[Snapshots AI] 评论生成失败：', err);

    throw new Error(
      err instanceof Error
        ? `Snapshots 评论生成失败：${err.message}`
        : 'Snapshots 评论生成失败：未知错误'
    );
  }
};

export default {
  generateSnapshotCommentByAi
};
