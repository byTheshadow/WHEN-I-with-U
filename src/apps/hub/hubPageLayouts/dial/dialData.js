// src/apps/hub/hubPageLayouts/dial/dialData.js
//
// 「转盘电台」整页版式的数据层：把 appRegistry.js 的分组和应用，排成转盘上的
// 「槽位」——每个分组先有一格章节页，后面跟着这个分组里的应用。应用的名称、
// 图标、分组都来自 appRegistry.js（改注册表，这里自动同步）；这个文件只补
// 版式自己的东西：章节的英文名、一句话说明、每章的色调。
//
// 槽位的形状：
//   章节  { key, type: 'chapter', ch, num, en, zh, sub }
//   应用  { key, type: 'app', ch, num, id, app, en, no, chapterEn }
//   ch 是章节序号（从 0 开始），num 是 '01' 这样的编号，no 是应用在全部应用里的序号。

import { getGroupedHubApps } from '../../appRegistry';

// 每个分组（appRegistry 里的 HUB_APP_GROUPS）对应的章节英文名和说明。
// 分组 id 以 appRegistry.js 为准；新增分组时在这里补一条，缺了也不会崩，
// 会回退成分组自己的英文名和提示。
export const DIAL_CHAPTER_COPY = {
  talk: { en: 'Conversations', blurb: '群聊、长文、通话与匿名信箱' },
  memory: { en: 'Memory & Archive', blurb: '日记、记忆室、票根与快照' },
  story: { en: 'Stories & Making', blurb: '协作小说、文游、生图、修图与贺卡' },
  daily: { en: 'Days & Away', blurb: '日程、晨报、旅行与足迹' },
  play: { en: 'Play & Small Things', blurb: '棋、文字游戏、生态瓶与小盒子' },
  tools: { en: 'Tools', blurb: '定时工作流与接口记录' },
};

// 每章一个色调，转盘高亮、弥散光和装饰图都跟着变。
export const DIAL_TINTS = ['#f0a8b8', '#b9a6e8', '#f5c08a', '#9cc8ee', '#9fdcc0', '#b8bdd8'];

export const getDialTint = (chapterIndex) =>
  DIAL_TINTS[chapterIndex % DIAL_TINTS.length];

const pad2 = (value) => String(value).padStart(2, '0');

export const buildDialSlots = () => {
  const slots = [];
  let appNumber = 0;

  getGroupedHubApps().forEach((group, chapterIndex) => {
    const copy = DIAL_CHAPTER_COPY[group.id] || {};
    const chapterEn = copy.en || group.en;
    const num = pad2(chapterIndex + 1);
    const apps = group.apps.filter((app) => !app.pinned);

    slots.push({
      key: `chapter-${group.id}`,
      type: 'chapter',
      ch: chapterIndex,
      num,
      en: chapterEn,
      zh: group.label,
      sub: copy.blurb || group.hint,
    });

    apps.forEach((app) => {
      appNumber += 1;
      slots.push({
        key: `app-${app.id}`,
        type: 'app',
        ch: chapterIndex,
        num,
        id: app.id,
        app,
        en: app.en,
        no: appNumber,
        chapterEn,
      });
    });
  });

  return { slots, appCount: appNumber };
};
