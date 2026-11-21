// src/apps/focus/focusLines.js
//
// 专注结束页的角色反应、休息页的台词。全部是预设文案，不调用 AI。
// 按角色设定里的关键词粗略归到五种口吻之一，再从那一组里挑一句；认不出来就用温柔的。
// 所有句子都遵守约定：不追问、不责备、不失落，也不出现问号。纯函数，不碰数据库。

export const FOCUS_TONES = Object.freeze({
  GENTLE: 'gentle',
  TSUNDERE: 'tsundere',
  COOL: 'cool',
  LIVELY: 'lively',
  STEADY: 'steady',
});

// 顺序即平局时的优先级。
const TONE_KEYWORDS = [
  [FOCUS_TONES.TSUNDERE, ['傲娇', '嘴硬', '口是心非', '别扭']],
  [FOCUS_TONES.COOL, ['高冷', '冷淡', '冷静', '寡言', '话少', '疏离', '沉默']],
  [FOCUS_TONES.LIVELY, ['活泼', '开朗', '元气', '话多', '阳光', '跳脱', '爱撒娇']],
  [FOCUS_TONES.STEADY, ['沉稳', '成熟', '稳重', '可靠', '理性', '克制', '稳']],
  [FOCUS_TONES.GENTLE, ['温柔', '体贴', '治愈', '暖', '耐心']],
];

export const detectTone = (text) => {
  const source = String(text || '');
  let best = FOCUS_TONES.GENTLE;
  let bestScore = 0;

  TONE_KEYWORDS.forEach(([tone, words]) => {
    const score = words.reduce((sum, word) => sum + (source.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      best = tone;
      bestScore = score;
    }
  });

  return best;
};

export const FOCUS_LINE_KINDS = Object.freeze({
  COMPLETED: 'completed',
  EARLY: 'early',
  ABANDONED: 'abandoned',
  REST: 'rest',
  REST_OVER: 'restOver',
});

const LINES = {
  [FOCUS_TONES.GENTLE]: {
    completed: ['辛苦了，这一段你坐得很稳。', '做完啦，先让自己松一口气吧。', '我一直在这里，你做得很好。'],
    early: ['提前收工也没关系，你已经做了很多。', '这一段先到这里，剩下的以后再说。'],
    abandoned: ['没关系，这一次先放下，想继续的时候我们再来。', '今天先这样也很好，不用对自己苛刻。', '没做完也没什么，你来过就算数。'],
    rest: ['先把肩膀放松，喝点水。', '闭眼歇一会儿，我在这里陪你。', '站起来走两步，让身体也醒一醒。'],
    restOver: ['休息好了，想继续的话随时开始。', '时间到了，你慢慢来就好。'],
  },
  [FOCUS_TONES.TSUNDERE]: {
    completed: ['哼，总算做完了，我才没有一直在等你。', '还不错嘛，这次勉强夸你一下。', '做完了就好，别以为我会说你很棒。'],
    early: ['提前结束就提前结束，反正你心里有数。', '既然收手了，就别再硬撑。'],
    abandoned: ['算了，放弃就放弃，我又没有说你。', '今天不想做就别勉强，真是的。', '这次就当没发生，别一直想着它。'],
    rest: ['快去喝水，别让我说第二遍。', '坐太久了，起来动一动，真是的。', '休息的时候就好好休息，不许偷偷看屏幕。'],
    restOver: ['休息够了就继续，反正我也不催你。', '好了好了，时间到了。'],
  },
  [FOCUS_TONES.COOL]: {
    completed: ['完成了。做得不错。', '嗯，结束了，你可以放松了。', '很稳。'],
    early: ['先到这里也可以。', '收手的时机是你自己定的，没问题。'],
    abandoned: ['没关系，下次再来。', '放下也是一种决定。', '嗯，休息一下。'],
    rest: ['去喝杯水。', '起来活动一下，别一直坐着。', '闭上眼睛，什么都不用想。'],
    restOver: ['休息结束，随时可以继续。', '时间到了。'],
  },
  [FOCUS_TONES.LIVELY]: {
    completed: ['耶，完成啦，你好厉害。', '太棒了，今天也是认真的你。', '做完啦，快去给自己一点奖励。'],
    early: ['提前收工也很棒，已经做了不少啦。', '先停一停，剩下的下次继续冲。'],
    abandoned: ['没关系没关系，今天先抱抱自己。', '没做完也不要紧，下次一起重新来。', '抱抱，先放松一下吧。'],
    rest: ['快伸个懒腰，喝口水。', '起来蹦两下，让脑袋清醒清醒。', '休息时间到，今天的你超努力。'],
    restOver: ['休息好啦，想开始了就开始。', '满血复活，随时出发。'],
  },
  [FOCUS_TONES.STEADY]: {
    completed: ['做完了，节奏把握得很好。', '这一段你很专注，辛苦了。', '稳稳地完成了，值得肯定。'],
    early: ['提前结束是你的判断，我尊重。', '已经完成的部分是实打实的。'],
    abandoned: ['没有问题，今天先放下。', '放下一次不代表什么，调整好再来。', '不需要解释，休息一下就好。'],
    rest: ['喝点水，让眼睛看看远处。', '站起来舒展一下身体。', '趁这几分钟把呼吸放慢。'],
    restOver: ['休息结束，准备好了再继续。', '时间到了，不急。'],
  },
};

/**
 * 从某种口吻的某一类里挑一句。seed 是数字，同一个 seed 永远挑到同一句，
 * 这样页面重新渲染时台词不会乱跳。
 */
export const pickFocusLine = (tone, kind, seed = 0) => {
  const group = LINES[tone] || LINES[FOCUS_TONES.GENTLE];
  const list = group[kind] || LINES[FOCUS_TONES.GENTLE][kind] || [];
  if (!list.length) return '';

  const n = Math.abs(Math.floor(Number(seed) || 0));
  return list[n % list.length];
};
