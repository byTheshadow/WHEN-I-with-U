// src/apps/textgames/foodJudge/foodJudgeService.js
//
// "美食判官"的数据层：薄薄一层包在 textGameSharedService 上面，只负责
// 算"这一局跟角色看法一致几案"、拼这个游戏自己的 contextNote/noticeText
// 文案，然后写战绩 + 往聊天里回传一条 text_game_result 消息。
//
// 不新建表、不升数据库版本：额外字段通过 recordTextGameMatch 的 extra
// 参数铺平存进 textGameMatches 这一行。
//
// result 字段的含义（这个游戏没有输赢，这里只是沿用公共表的三态字段）：
//   'win'  = 角色表了态的案件里，至少一半跟用户看法一致
//   'loss' = 不到一半一致
// 这个值只用于 textGameMatches 的记录，聊天里角色看到的是下面拼好的
// contextNote，文案里不会出现"赢/输"。
//
// "案件真相"不写进 contextNote：角色在点评时本来就不知道标准答案，
// 回写进聊天后也保持同一个立场，别让角色在下次聊天里突然"全知"。

import {
  listCharactersForPicker,
  getChatIdForCharacter,
  recordTextGameMatch,
} from '../textGameSharedService';

export const GAME_ID_FOOD_JUDGE = 'food-judge';

export { listCharactersForPicker, getChatIdForCharacter };

const VERDICT_WORD = { keep: '维持差评', void: '撤销差评' };
const MAX_NOTE_SNIPPET = 30;

const clip = (text) => String(text || '').trim().slice(0, MAX_NOTE_SNIPPET);

// stances[i]: 角色在第 i 案的立场 'keep' | 'void'，没表态（点评生成失败）为 null。
export const countAgreement = (verdicts, stances) => {
  const stanced = stances.filter(Boolean).length;
  const agreed = stances.filter((stance, index) => stance && stance === verdicts[index]).length;
  return { stanced, agreed };
};

export const computeFoodJudgeResult = (verdicts, stances) => {
  const { stanced, agreed } = countAgreement(verdicts, stances);
  if (stanced === 0) return 'win';
  return agreed * 2 >= stanced ? 'win' : 'loss';
};

// cases: foodJudgeAiService.generateCaseSet 返回的案件数组
// verdicts: ('keep' | 'void')[]    用户的判决
// stances: ('keep' | 'void' | null)[]    角色的立场
// views: string[]    角色当时对每个案子说的看法（可能为空字符串）
export const recordFoodJudgeMatch = async ({ characterId, cases, verdicts, stances, views }) => {
  const result = computeFoodJudgeResult(verdicts, stances);
  const { stanced, agreed } = countAgreement(verdicts, stances);
  const keepCount = verdicts.filter((item) => item === 'keep').length;
  const voidCount = verdicts.filter((item) => item === 'void').length;

  const caseNotes = cases.map((item, index) => {
    const mine = stances[index];
    const viewText = views?.[index] ? `你当时说：“${clip(views[index])}”。` : '';
    const stanceText = mine
      ? `你自己的立场是${VERDICT_WORD[mine]}，${mine === verdicts[index] ? '跟用户一致' : '跟用户不一致'}。`
      : '你当时没来得及表态。';

    return (
      `第${index + 1}案「${item.shop}」：顾客${clip(item.cust)}给了${item.stars}星差评（${clip(item.text)}），` +
      `${item.boss}回应：“${clip(item.reply)}”。用户判了${VERDICT_WORD[verdicts[index]]}。${viewText}${stanceText}`
    );
  });

  const contextNote =
    `这局是你和用户一起坐在判官席上，审三条虚构店铺的差评，用户来下判决（案件里的店和人都是编的，跟你们现实无关）。` +
    `${caseNotes.join('')}` +
    `三案合计：用户维持了${keepCount}案、撤销了${voidCount}案` +
    `${stanced > 0 ? `；你表了态的${stanced}案里，有${agreed}案和用户看法一致` : ''}。`;

  let noticeText;
  if (stanced === 0) noticeText = `你们一起审完了三条差评`;
  else if (agreed === stanced) noticeText = `三条差评审完，你们的看法全都一致`;
  else if (agreed === 0) noticeText = `三条差评审完，你们的看法一个都没对上`;
  else noticeText = `三条差评审完，${stanced}案里有${agreed}案看法一致`;

  return recordTextGameMatch({
    gameId: GAME_ID_FOOD_JUDGE,
    gameTitle: '美食判官',
    characterId,
    result,
    contextNote,
    noticeText,
    extra: { agreedCount: agreed, stancedCount: stanced, keepCount, voidCount },
  });
};