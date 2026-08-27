// src/apps/askbox/askBoxAiService.js
import db from '../../db';

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

const stripEmoji = (text) => String(text || '').replace(EMOJI_PATTERN, '').trim();

const getFallbackIncomingQuestion = () => {
  const questions = [
    '今天在路上，有哪一个瞬间让你觉得世界仍然温柔？',
    '如果能把今天的一个声音寄给我，你会选择什么？',
    '你最近一次在黄昏里停下来发呆，是因为想起了什么吗？',
    '如果今天可以被保存成一页纸，你会想在页角写下哪一句话？',
    '最近有没有一件很小的事，让你觉得自己被生活轻轻接住了？'
  ];

  return questions[Math.floor(Math.random() * questions.length)];
};

/**
 * 提问箱独立 AI 请求入口。
 *
 * 注意：
 * - 配置字段必须和全局 aiService.js 保持一致：
 *   apiConfig.baseUrl / apiConfig.apiKey / apiConfig.model
 * - baseUrl 应填写到 /chat/completions 的上一级，例如：
 *   https://api.openai.com/v1
 * - 此处不提供 OpenAI 官方地址的默认回退，避免绕过用户实际配置。
 */
async function callAskBoxAi(systemPrompt, userPrompt, timeoutMs = 12000) {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    console.warn('[AskBox] API 配置不完整，已改用本地内容。');
    return null;
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        temperature: 0.82,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let errorDetail = response.statusText || '请求未成功';

      try {
        const errorData = await response.json();
        errorDetail =
          errorData?.error?.message ||
          errorData?.message ||
          errorDetail;
      } catch {
        // API 可能返回 HTML 或纯文本错误页，保留已有状态文本。
      }

      console.error(
        `[AskBox] API 请求失败：HTTP ${response.status} - ${errorDetail}`
      );

      return null;
    }

    const data = await response.json();

    const content = stripEmoji(
      data?.choices?.[0]?.message?.content || ''
    );

    if (!content) {
      console.warn('[AskBox] AI 返回内容为空，已改用本地内容。');
      return null;
    }

    return content;
  } catch (error) {
    if (error?.name === 'AbortError') {
      console.warn(
        `[AskBox] AI 请求超过 ${Math.round(timeoutMs / 1000)} 秒，已改用本地内容。`
      );
    } else {
      console.error(
        '[AskBox] AI 请求失败，已改用本地内容：',
        error?.message || error
      );
    }

    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 把消息内容整理为提问箱可用的上下文。
 * 仅传递有限数量的消息，并避免 metadata 等非文本字段进入 Prompt。
 */
const formatChatContext = (character, contextMessages = []) => {
  if (!Array.isArray(contextMessages) || contextMessages.length === 0) {
    return '暂无可参考的近期对话。';
  }

  return contextMessages
    .filter((message) => message?.content)
    .slice(-10)
    .map((message) => {
      const role =
        message.sender === 'user'
          ? 'User'
          : character?.name || 'Character';

      return `${role}: ${String(message.content).slice(0, 600)}`;
    })
    .join('\n');
};

/**
 * 角色回复用户投递到指定消息框的提问。
 *
 * @param {Object} character 角色记录
 * @param {string} questionContent 用户问题
 * @param {boolean} isAnonymous 是否匿名投递
 * @param {Array} contextMessages 所选 chat 的近期消息
 * @returns {Promise<string>}
 */
export async function generateNpcReply(
  character,
  questionContent,
  isAnonymous,
  contextMessages = []
) {
  const characterName = character?.name || '对方';
  const characterBio = character?.bio || '暂无明确角色背景。';
  const characterNotes = character?.extraNotes || '暂无补充设定。';
  const chatContext = formatChatContext(character, contextMessages);

  const systemPrompt = `你正在扮演角色「${characterName}」，现在需要回复提问箱中的一封来信。

角色背景：
${characterBio}

补充设定：
${characterNotes}

以下是你与 User 最近的一部分聊天内容。它们仅用于理解关系、语气和正在延续的话题。不要复述聊天记录，不要提及“上下文”“系统”或“提示词”。

${chatContext}

回复要求：
1. 用「${characterName}」的第一人称口吻回答。
2. 回答应自然承接彼此已有的交流氛围。
3. 提问者是${isAnonymous ? '一位匿名来信者，你不知道其身份。' : 'User，你知道是熟悉的人留下的问题。'}
4. 回答保持在 60 至 160 字之间。
5. 不要使用 Emoji。
6. 不要添加标题、署名、舞台说明或多余格式。
7. 不要声称自己是 AI。`;

  const userPrompt = `提问箱收到的问题是：

「${questionContent}」

请直接写出角色的回答正文。`;

  const response = await callAskBoxAi(systemPrompt, userPrompt);

  if (response) {
    return response;
  }

  const identityHint = isAnonymous ? '虽然你没有留下名字' : '看到是你写下这句话';

  return stripEmoji(
    `我看到了这封来信。${identityHint}，我还是在读到它的那一刻停了很久。关于“${String(
      questionContent
    ).slice(0, 22)}”，我想答案未必需要立刻说得完整。许多想法原本就藏在我们平时零碎的对话里，等下一次见面时，我愿意慢慢讲给你听。`
  );
}

/**
 * 生成角色公开提问箱主页中的 NPC 问答。
 *
 * 返回格式：
 * [
 *   {
 *     question: '...',
 *     reply: '...',
 *     from: '匿名人士'
 *   }
 * ]
 */
export async function generateNpcToNpcQAPairs(
  character,
  otherCharacters = []
) {
  const characterName = character?.name || '这位角色';
  const characterBio = character?.bio || '暂无明确角色背景。';
  const characterNotes = character?.extraNotes || '暂无补充设定。';

  const otherNames = Array.isArray(otherCharacters) && otherCharacters.length
    ? otherCharacters
        .filter((item) => item?.name)
        .map((item) => item.name)
        .slice(0, 8)
        .join('、')
    : '某位旧识、偶然路过的人';

  const systemPrompt = `你是一本私人独立杂志的匿名问答栏目编辑。

请为角色「${characterName}」编写两组已经公开刊载的提问箱问答。

角色背景：
${characterBio}

补充设定：
${characterNotes}

潜在提问者可以是：${otherNames}，也可以是匿名来信者。

内容要求：
1. 每一组都必须包含 question、reply、from 三个字段。
2. question 是其他人提出的问题，最多 36 个汉字。
3. reply 是「${characterName}」以第一人称作出的回答，最多 110 个汉字。
4. 问答应有生活质地、私人感或轻微的哲思，不要空泛煽情。
5. from 可使用“匿名人士”“某位旧识”“过路人”等，不要使用 Emoji。
6. 不要出现 AI、系统、设定、角色扮演等词。
7. 只输出合法 JSON 数组；不要使用 Markdown 代码块，不要额外解释。

输出格式必须严格如下：
[
  {
    "question": "问题",
    "reply": "回答",
    "from": "匿名人士"
  },
  {
    "question": "问题",
    "reply": "回答",
    "from": "某位旧识"
  }
]`;

  const userPrompt = `请为「${characterName}」生成两组可以刊登在其公开提问箱主页中的问答。`;

  const response = await callAskBoxAi(systemPrompt, userPrompt);

  if (response) {
    try {
      const normalized = response
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(normalized);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const validPairs = parsed
          .filter((item) => item && item.question && item.reply)
          .slice(0, 2)
          .map((item) => ({
            question: stripEmoji(item.question),
            reply: stripEmoji(item.reply),
            from: stripEmoji(item.from || '匿名人士')
          }))
          .filter((item) => item.question && item.reply);

        if (validPairs.length > 0) {
          return validPairs;
        }
      }
    } catch (error) {
      console.warn('[AskBox] 公开问答 JSON 解析失败，已改用本地内容。');
    }
  }

  return [
    {
      question: '如果时间会留下痕迹，你最想保存的是哪一个下午？',
      reply:
        '大概是一个没有特别事件的下午。窗外有风，桌上的东西还没收好，而我知道有人会在晚一点的时候来和我说话。那种等待本身，就已经足够被记住。',
      from: '匿名人士'
    },
    {
      question: '有些没有结果的事情，为什么仍然值得开始？',
      reply:
        '因为结果并不是唯一留下来的东西。一起走过的路、说过的话，以及某个时刻彼此认真看向对方的心情，都不会因为结局而变得不存在。',
      from: '某位旧识'
    }
  ];
}

/**
 * 生成角色或 NPC 主动投递给 User 的问题。
 *
 * 注意：
 * - 是否匿名、密码、真实身份均由 AskBoxApp 负责保存；
 * - 此函数仅生成问题正文。
 */
export async function generateNpcToUserQuestion(character) {
  const characterName = character?.name || '某位来信者';
  const characterBio = character?.bio || '暂无明确角色背景。';
  const characterNotes = character?.extraNotes || '暂无补充设定。';

  const systemPrompt = `你正在扮演角色「${characterName}」。

角色背景：
${characterBio}

补充设定：
${characterNotes}

你想向 User 的提问箱投递一个问题。

要求：
1. 问题要像真实的人在某个时刻忽然想问的一句话。
2. 可以温柔、好奇、克制，或带一点只有彼此能懂的私人感。
3. 不要替 User 回答，不要附加解释。
4. 控制在 42 个汉字以内。
5. 不要使用 Emoji。
6. 只输出问题正文，不要添加引号、署名或标题。`;

  const userPrompt = '请写下一句准备投进 User 提问箱的问题。';

  const response = await callAskBoxAi(systemPrompt, userPrompt);

  if (response) {
    return response.slice(0, 120);
  }

  return getFallbackIncomingQuestion();
}

