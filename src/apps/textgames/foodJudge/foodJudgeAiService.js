// src/apps/textgames/foodJudge/foodJudgeAiService.js
//
// "美食判官"的案件生成。一局三案，三案同时并行生成（三次独立请求，等待
// 时间约等于一次），走 interactionAiService.js 里已有的
// getGenerationContext/requestAiText（一次性的纯 system prompt，不走
// aiService.js 的主回复管线——案件是游戏内部的虚构素材，不是角色台词）。
//
// 案件跟绑定的角色无关：店、顾客、老板都是 AI 临时编的虚构人物，角色只在
// 后面的点评环节（Slice B）出场。这里取 chatId 只是为了拿到 apiConfig。
//
// 难度"随机、玩家不能选"：每案由代码从三种类型里随机抽一种，再告诉模型
// 这一案该写成什么样——
//   customer_right  顾客占理，老板在狡辩/避重就轻   → 标准答案：维持差评
//   customer_wrong  顾客无理取闹或夸大，老板有理有据 → 标准答案：撤销差评
//   gray            双方各有道理，答案不明显         → 没有标准答案
// 类型和"真相"只存在代码里，不写进差评/回应的正文，玩家要靠两边的陈述和
// 证据自己判断。揭晓时才把真相展示出来。
//
// 菜系和投诉角度也由代码随机抽（三案互不重复），避免模型每次都编出同一个
// "等位太久的砂锅粥"。

import { getGenerationContext, requestAiText } from '../../messages/interactions/interactionAiService';

const MAX_EVIDENCE = 3;
const MAX_TAGS = 3;

export const CASE_TYPES = {
  customer_right: {
    id: 'customer_right',
    truth: 'keep',
    brief:
      '顾客说得基本属实，店家确实有问题。老板的回应里有避重就轻、强行辩解或只认小错的成分，但要写得像真实的店主会说的话，不能一眼就是反派。',
  },
  customer_wrong: {
    id: 'customer_wrong',
    truth: 'void',
    brief:
      '顾客在无理取闹、误会，或者明显夸大事实、把自己的责任推给店家。老板的回应有理有据，带着具体可核对的证据，语气可以有点无奈或带火气，但不能人身攻击。',
  },
  gray: {
    id: 'gray',
    truth: 'gray',
    brief:
      '双方各有道理：差评里既有真实的问题也有夸大的部分，老板的回应里既有站得住的证据也有回避的地方。不要让答案一眼分明。',
  },
};

const CASE_TYPE_LIST = Object.values(CASE_TYPES);

const CUISINES = [
  '砂锅粥店', '手工面馆', '奶茶店', '烧烤摊', '日料店', '披萨店', '小笼包铺', '火锅店',
  '咖啡店', '冰淇淋铺', '麻辣烫店', '烘焙坊', '炸鸡店', '川菜馆', '早餐铺', '外卖便当店',
];

const ANGLES = [
  '等位或上菜太慢', '分量太少', '口味太咸或太淡', '下单备注没有照做', '吃到异物或担心卫生',
  '外卖送达时已经凉了或洒了', '觉得价格太贵', '服务员态度不好', '菜品和宣传图差距太大',
  '食材不够新鲜', '被临时告知某道菜没有了', '拼桌或座位安排的纠纷',
];

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// 三案类型独立随机；三案全同时重抽（避免一局三案都是"顾客无理取闹"）。
const pickCaseTypes = (count) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const picked = Array.from(
      { length: count },
      () => CASE_TYPE_LIST[randomInt(0, CASE_TYPE_LIST.length - 1)]
    );
    if (new Set(picked.map((item) => item.id)).size > 1) return picked;
  }
  return shuffle(CASE_TYPE_LIST).slice(0, count);
};

const stripWrappingQuotes = (text = '') =>
  String(text)
    .trim()
    .replace(/^["'“”‘’「」]+/, '')
    .replace(/["'“”‘’「」]+$/, '')
    .trim();

const readField = (content, label) => {
  const match = content.match(new RegExp(`^\\s*${label}\\s*[：:]\\s*(.+)$`, 'm'));
  return match ? stripWrappingQuotes(match[1]) : '';
};

const parseCaseText = (content, caseType) => {
  const shop = readField(content, '店名').slice(0, 20);
  const cust = readField(content, '顾客昵称').slice(0, 16);
  const text = readField(content, '差评').slice(0, 140);
  const boss = readField(content, '店主称呼').slice(0, 12) || '店主';
  const reply = readField(content, '回应').slice(0, 220);
  const truth = readField(content, '真相').slice(0, 90);
  const time = readField(content, '时间').slice(0, 14);

  if (!shop || !cust || !text || !reply || !truth) return null;

  const starsRaw = parseInt(readField(content, '星级'), 10);
  const stars = Number.isFinite(starsRaw) ? Math.min(3, Math.max(1, starsRaw)) : 1;

  const tags = readField(content, '标签')
    .split(/[、,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  const evidence = [...content.matchAll(/证据[^：:\n]*[：:]\s*(.+)/g)]
    .map((match) => stripWrappingQuotes(match[1]))
    .filter(Boolean)
    .slice(0, MAX_EVIDENCE)
    .map((line) => {
      const [name, ...rest] = line.split(/[｜|]/);
      if (rest.length === 0) return { name: '证据', value: line.slice(0, 30) };
      return { name: name.trim().slice(0, 10), value: rest.join('｜').trim().slice(0, 30) };
    });

  // 灰色案件没有标准答案，但模型会给一个"稍微倾向哪边"，只用于揭晓时的措辞，
  // 不当作对错判定。
  const leanRaw = readField(content, '倾向');
  const lean = leanRaw.includes('撤') ? 'void' : leanRaw.includes('维') ? 'keep' : null;

  return {
    type: caseType.id,
    truthVerdict: caseType.truth, // 'keep' | 'void' | 'gray'
    lean,
    no: String(randomInt(1000, 9999)),
    shop,
    shopRating: Math.round((4.2 + Math.random() * 0.7) * 10) / 10,
    shopReviews: randomInt(200, 3000),
    cust,
    stars,
    time,
    tags,
    text,
    boss,
    reply,
    evidence,
    truth,
  };
};

const buildCasePrompt = ({ caseType, cuisine, angle }) => `你在为一个叫"美食判官"的文字游戏编写一个完全虚构的差评案件。玩家要扮演判官，看完顾客的差评和老板的反驳后，决定这条差评该"维持展示"还是"撤销"。

案件设定：
- 店铺类型：${cuisine}
- 差评的核心投诉：${angle}
- 案件走向：${caseType.brief}

要求：
- 店名、顾客昵称、老板称呼全部原创，不使用真实品牌、真实人物，不出现"某某"这类占位词；
- 差评要像真实点评平台上的口吻：有情绪，有具体细节，可以有错别字风格的随意感，但不要过长；
- 老板的回应要像真实的店主：有具体的事实、数字、时间或证据，不是空话；
- 差评和回应的正文里不能直接点明谁对谁错，也不能替玩家下结论，答案要靠玩家对比两边的说法自己判断；
- 不使用 Emoji，不提及 AI、游戏、系统。

严格按下面格式输出，不要输出任何其他内容：
店名：<不超过10个汉字>
顾客昵称：<不超过8个汉字>
星级：<1、2、3 中的一个数字>
时间：<例如 周六 22:41>
标签：<2到3个短标签，用顿号隔开，每个不超过6个汉字>
差评：<顾客的差评原文，50到100个汉字>
店主称呼：<例如 店主 老陈>
回应：<老板的反驳，70到130个汉字>
证据一：<证据名称>｜<证据内容，不超过15个汉字>
证据二：<证据名称>｜<证据内容，不超过15个汉字>
证据三：<证据名称>｜<证据内容，不超过15个汉字>
真相：<用中立口吻，一句话说清这件事实际上谁对谁错，不超过45个汉字>
倾向：<维持 或 撤销，只用于判断哪边稍占理>`;

const generateOneCase = async ({ apiConfig, caseType, cuisine, angle }) => {
  const systemPrompt = buildCasePrompt({ caseType, cuisine, angle });

  // 格式偶尔会跑偏，同一案最多试两次；两次都解析不出来才算这案失败。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = (await requestAiText({ apiConfig, systemPrompt })) || '';
    const parsed = parseCaseText(content, caseType);
    if (parsed) return parsed;
  }

  return null;
};

// 返回 { ok: true, cases: [...3个案件] }
//   或 { ok: false, reason: 'unavailable' | 'parse' }
export const generateCaseSet = async ({ chatId, count = 3 }) => {
  try {
    const context = await getGenerationContext(chatId);
    if (!context) return { ok: false, reason: 'unavailable' };

    const { apiConfig } = context;
    const types = pickCaseTypes(count);
    const cuisines = shuffle(CUISINES).slice(0, count);
    const angles = shuffle(ANGLES).slice(0, count);

    const results = await Promise.all(
      types.map((caseType, index) =>
        generateOneCase({
          apiConfig,
          caseType,
          cuisine: cuisines[index],
          angle: angles[index],
        })
      )
    );

    if (results.some((item) => !item)) return { ok: false, reason: 'parse' };

    return { ok: true, cases: results };
  } catch (error) {
    console.warn('[FoodJudge] 案件生成失败。', error);
    return { ok: false, reason: 'unavailable' };
  }
};