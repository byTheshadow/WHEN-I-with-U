import db from '../../db';

const stripJsonFence = (value = '') =>
  String(value)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const sanitizeText = (value = '', maxLength = 180) =>
  String(value)
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]/g, '')
    .replace(/[“”"]/g, '')
    .trim()
    .slice(0, maxLength);

export const generateDailyOfferingDecision = async ({
  character,
  imageEntries = []
}) => {
  const configRecord = await db.settings.get('apiConfig');
  const apiConfig = configRecord?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return null;
  }

  const imagePoolText =
    imageEntries.length > 0
      ? imageEntries
          .map(
            (image) =>
              `- 图片 ID: ${image.id}; 描述: ${sanitizeText(image.description, 180)}`
          )
          .join('\n')
      : '图片盒为空。';

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name || '未署名角色'}。

【当前真实时间】
${new Date().toLocaleString('zh-CN')}

【角色设定】
- 角色简介：${character.bio || '未填写'}
- 补充设定：${character.extraNotes || '未填写'}
- 角色状态：${Array.isArray(character.statusList) ? character.statusList.join('；') : '未填写'}

【用户私人图片盒】
${imagePoolText}

【任务】
今天是用户第一次进入主页。请由你决定留下一份轻量陪伴物：
1. 音乐；或
2. 图片。

如果选择音乐：
- 选择现实中确实存在的歌曲与艺人；
- 避免冷门到无法搜索、虚构曲目、纯歌词片段或播客；
- 曲目应适合被 iTunes 搜索。

如果选择图片：
- 可以从用户私人图片盒中选择一张；
- 也可以选择外部免费风景图；
- 外部图必须给出简洁英文检索词；
- 优先自然风景、天气、建筑、植物、路途、城市光影；
- 不要选择人物肖像、品牌、影视角色、暴力或成人内容。

【寄语要求】
- 以角色第一人称说话；
- 只写一句到两句简短寄语；
- 温柔、克制、有私密感；
- 不要使用 Emoji；
- 不要说“推荐”“算法”“AI”“接口”“搜索”；
- 不要带标题、引号或解释。

【输出要求】
严格输出 JSON 对象，不要 Markdown，不要额外文字：

音乐格式：
{
  "mediaType": "music",
  "message": "角色寄语",
  "music": {
    "title": "真实歌曲名",
    "artist": "真实艺人名"
  }
}

用户图片盒格式：
{
  "mediaType": "image",
  "message": "角色寄语",
  "image": {
    "source": "userPool",
    "imageId": 1,
    "query": ""
  }
}

外部风景图格式：
{
  "mediaType": "image",
  "message": "角色寄语",
  "image": {
    "source": "externalLandscape",
    "imageId": null,
    "query": "quiet coastal road after rain"
  }
}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      temperature: 0.85,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: '请为今天的首次进入主页，留下这一份只属于今天的陪伴物。'
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Daily offering API failed: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;

  if (!rawContent) {
    throw new Error('Daily offering AI response is empty.');
  }

  const parsed = JSON.parse(stripJsonFence(rawContent));

  return {
    mediaType: parsed?.mediaType === 'image' ? 'image' : 'music',
    message: sanitizeText(parsed?.message, 160),
    music: {
      title: sanitizeText(parsed?.music?.title, 100),
      artist: sanitizeText(parsed?.music?.artist, 100)
    },
    image: {
      source:
        parsed?.image?.source === 'userPool'
          ? 'userPool'
          : 'externalLandscape',
      imageId: parsed?.image?.imageId ?? null,
      query: sanitizeText(parsed?.image?.query, 120)
    }
  };
};
