// src/apps/fiction/fictionPerspective.js
//
// 叙事视角：纯数据和纯函数，不碰数据库、不发请求。
//
// 镜头不固定在某个角色身上：谁是当前场景的焦点就跟着谁，一段里也可以切到另一个人。
// 玩家扮演的角色（「我的设定」）在叙述里怎么称呼，由存档自己决定，存在
// persona.address 里：
//   you   叙述里称「你」（默认）
//   name  用「我的设定」里填的姓名；没填姓名时自动退回「你」
//   he    称「他」
//   she   称「她」
// 旧存档没有这个字段，一律按 you 处理，不用迁移。

export const PERSONA_ADDRESS_MODES = [
  { id: 'you', label: '你' },
  { id: 'name', label: '姓名' },
  { id: 'he', label: '他' },
  { id: 'she', label: '她' },
];

export const DEFAULT_PERSONA_ADDRESS = 'you';

const str = (value) => String(value ?? '').trim();

export const normalizePersonaAddress = (value) => (
  PERSONA_ADDRESS_MODES.some((item) => item.id === value) ? value : DEFAULT_PERSONA_ADDRESS
);

// 实际生效的称呼：选了「姓名」却没填名字时退回「你」。
export const resolvePersonaAddress = (persona) => {
  const name = str(persona?.name);
  const chosen = normalizePersonaAddress(persona?.address);

  return { mode: chosen === 'name' && !name ? 'you' : chosen, name };
};

const buildAddressLine = ({ mode, name }) => {
  switch (mode) {
    case 'name':
      return `玩家扮演的角色叫「${name}」，叙述里一律用姓名称呼 TA，不要用「你」称呼 TA。其他人物也用名字或「他」「她」称呼。人物在对白里怎么称呼 TA，按各自的设定来。`;
    case 'he':
    case 'she': {
      const pronoun = mode === 'he' ? '他' : '她';
      const nameNote = name ? `（姓名是「${name}」，需要分清人物时可以用姓名）` : '';

      return `玩家扮演的角色在叙述里用「${pronoun}」称呼${nameNote}，不要用「你」称呼 TA。其他人物用名字或「他」「她」称呼。人物在对白里怎么称呼 TA，按各自的设定来。`;
    }
    default:
      return '玩家扮演的角色在叙述里称「你」，其他人物用名字或「他」「她」称呼。';
  }
};

/**
 * 提示词开头关于视角的几行（数组，调用方展开进去）。
 * @param save 存档记录，只读 persona 和 mode
 */
export const buildPerspectiveLines = (save) => {
  const address = resolvePersonaAddress(save?.persona);
  const lines = [
    '叙述的镜头自然地跟着当前场景的焦点人物走：这一刻谁是戏的重心，就贴近谁的所见、所感、所想；焦点换了，镜头也跟着换。同一段里可以切到另一个人的视角，但切换要有交代（空一行，或用一句话过渡），不要在同一句话里来回跳。',
    buildAddressLine(address),
    '可以写玩家扮演的角色简短的感受和感官（比如心里一紧、闻到了什么），但 TA 的决定、台词和主动行动要留给玩家。',
  ];

  if (address.mode !== 'you' && save?.mode !== 'novel') {
    lines.push('选项文字不写主语，直接写要做的事。');
  }

  return lines;
};

export default {
  PERSONA_ADDRESS_MODES,
  DEFAULT_PERSONA_ADDRESS,
  normalizePersonaAddress,
  resolvePersonaAddress,
  buildPerspectiveLines,
};