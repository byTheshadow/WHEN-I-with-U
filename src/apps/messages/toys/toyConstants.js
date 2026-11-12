// src/apps/messages/toys/toyConstants.js
//
// "让TA做个小玩具"的共用常量。
// 聊天里只留一条消息（type: 'chat_toy'），小玩具的 HTML 代码单独放在 db.chatToys 表里，
// 消息本身只带标题和规则，所以代码永远不会进入 AI 的聊天上下文。

export const TOY_MESSAGE_TYPE = 'chat_toy';

export const TOY_STATUS = {
  MAKING: 'making',
  READY: 'ready',
  FAILED: 'failed',
  DELETED: 'deleted',
};

export const TOY_LIMITS = {
  titleChars: 12,
  rulesChars: 140,
  requestChars: 60,
  htmlChars: 30000,
  // 第一次生成 + 失败后带着原因重写的次数。
  attempts: 2,
  // 隐藏沙箱里试跑的时长：这段时间内没有报错就算能用。
  dryRunMs: 1800,
};

// 角色自己决定做小玩具（toyDirective.js）：
//   - 同一个聊天主动做完一个之后，冷却这么久才会再把"可以做"的说明交给角色；
//   - 冷却之外，每次回复按这个概率把说明交给角色（用户明确点名时不受这两项限制）。
export const TOY_AUTO = {
  cooldownMs: 6 * 60 * 60 * 1000,
  offerProbability: 0.3,
};

// "想玩什么"小卡里的快捷词。点一下填进输入框；不选、不填就是让角色自己决定。
export const TOY_QUICK_PICKS = ['打地鼠', '记忆翻牌', '贪吃蛇', '反应力测试'];