// 聊天室"按钮外观"预设注册表：输入栏 + 顶部header那批圆形按钮共用同一套
// 可切换的视觉皮肤（默认纯色块 / 毛玻璃 / 黑玻璃……）。
//
// 每个聊天室各自选自己的预设，存在 chat.controlStyle 字段上（未设置时
// 按 'default' 处理，不需要为老数据做迁移）。
//
// 以后要继续加新预设，只需要在下面 CHAT_CONTROL_STYLE_PRESETS 里新增一项
// 并给出对应的 buildRules，不用改这个文件以外的任何东西——
// ChatSettingsModal 的选择器和 ChatRoom 的样式注入都是照着这个表遍历的。
//
// buildRules(selectors) 返回一批 CSS 规则字符串，selectors 是调用方
// （目前是 ChatRoom.jsx）传进来的、已经带上 `.chat-room-container` 作用域
// 前缀的选择器列表，避免这里重复关心具体挂在哪些 class 上。

const glassRule = (selectors, {
  background,
  border,
  boxShadow,
  color,
  blur = 18,
  saturate = 160,
}) => selectors.map((selector) => `${selector} {
  background: ${background} !important;
  border: 1px solid ${border} !important;
  box-shadow: ${boxShadow} !important;
  color: ${color} !important;
  backdrop-filter: blur(${blur}px) saturate(${saturate}%) !important;
  -webkit-backdrop-filter: blur(${blur}px) saturate(${saturate}%) !important;
}`);

export const CHAT_CONTROL_STYLE_PRESETS = {
  default: {
    label: '默认',
    // 保持现有纯色块外观，不输出任何覆盖规则。
    buildRules: () => [],
  },

  frostedGlass: {
    label: '毛玻璃',
    buildRules: (selectors) => glassRule(selectors, {
      background: 'rgba(255, 255, 255, 0.28)',
      border: 'rgba(255, 255, 255, 0.4)',
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
      color: '#1a1a1a',
    }),
  },

  darkGlass: {
    label: '黑玻璃',
    buildRules: (selectors) => glassRule(selectors, {
      background: 'rgba(8, 8, 10, 0.45)',
      border: 'rgba(255, 255, 255, 0.14)',
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)',
      color: '#ffffff',
      saturate: 140,
    }),
  },
};

export const CHAT_CONTROL_STYLE_OPTIONS = Object.entries(CHAT_CONTROL_STYLE_PRESETS)
  .map(([id, preset]) => ({ id, label: preset.label }));

export const getControlStyleRules = (styleId, selectors) => {
  const preset = CHAT_CONTROL_STYLE_PRESETS[styleId] || CHAT_CONTROL_STYLE_PRESETS.default;
  return preset.buildRules(selectors);
};