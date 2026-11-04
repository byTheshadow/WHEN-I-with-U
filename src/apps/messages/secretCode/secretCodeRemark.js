// src/apps/messages/secretCode/secretCodeRemark.js
//
// 一个很小的 remark 插件：在 Markdown 语法树里把文本节点里的暗号切出来，
// 包成 <sc-code> 元素，由 SecretCodeTextCard 里的组件负责画高亮。
// 不依赖 unist-util-visit，自己递归；代码块、行内代码、链接里的文字不动。
import { splitTextByCodes } from './secretCodeMarks';

export const SC_CODE_TAG = 'sc-code';

const SKIP_TYPES = new Set(['code', 'inlineCode', 'link', 'linkReference', 'definition', 'html']);

const walk = (node, regexp) => {
  if (!node || !Array.isArray(node.children)) return;

  const next = [];
  node.children.forEach((child) => {
    if (SKIP_TYPES.has(child.type)) {
      next.push(child);
      return;
    }

    if (child.type === 'text') {
      const parts = splitTextByCodes(child.value, regexp);
      if (!parts) {
        next.push(child);
        return;
      }
      parts.forEach((part) => {
        if (!part.code) {
          next.push({ type: 'text', value: part.text });
          return;
        }
        next.push({
          type: 'scCode',
          data: { hName: SC_CODE_TAG },
          children: [{ type: 'text', value: part.text }],
        });
      });
      return;
    }

    walk(child, regexp);
    next.push(child);
  });

  node.children = next;
};

/** 生成 remark 插件。regexp 为 null 时返回 null，调用方不必挂插件。 */
export const createSecretCodeRemarkPlugin = (regexp) => {
  if (!regexp) return null;
  return function secretCodeRemark() {
    return (tree) => {
      walk(tree, regexp);
    };
  };
};