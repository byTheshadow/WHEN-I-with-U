// src/apps/fiction/ImagePromptsSheet.jsx
//
// 「配图要求」底部抽屉（从向导「文生图」区块打开）。
//   - 顶部切换「标签版 / 自然语言版」，默认停在当前生图后端对应的那一版
//   - 自动配图、手动配图各一个文本框，文本框里显示的就是现在实际在用的文本
//     （没改过时是默认文本）；改过的右上角显示「已修改」，下面有「恢复默认」
//   - 点「完成」或点遮罩都会保存；写成空、或者写得和默认一样，都当作没改过
// 数据由父组件交进来（prompts 是库里存的值），保存成功后通过 onSaved 交回去。

import React, { useMemo, useState } from 'react';

import FictionSheetPortal from './FictionSheetPortal';
import { saveImagePrompts } from './fictionImagePrompts';
import {
  IMAGE_PROMPT_KIND,
  IMAGE_PROMPT_MAX,
  IMAGE_PROMPT_VARIANT,
  getDefaultPrompt,
  normalizeImagePrompts,
  resolvePromptText,
  setPromptText,
  variantOfBackend,
} from './fictionImagePromptDefaults';
import './fictionThinkingEditor.css';
import './fictionImagePrompts.css';

const KIND_ITEMS = [
  {
    kind: IMAGE_PROMPT_KIND.AUTO,
    label: '自动配图',
    hint: 'AI 写完正文后，顺带给出这一幕的画面描述。',
  },
  {
    kind: IMAGE_PROMPT_KIND.MANUAL,
    label: '手动配图',
    hint: '点段末的相机图标时，AI 读这一段，写出画面描述。',
  },
];

const VARIANT_ITEMS = [
  { id: IMAGE_PROMPT_VARIANT.TAGS, label: '标签版' },
  { id: IMAGE_PROMPT_VARIANT.NATURAL, label: '自然语言版' },
];

const VARIANT_HINT = {
  [IMAGE_PROMPT_VARIANT.TAGS]: '标签版输出英文逗号标签，给 NovelAI 用。',
  [IMAGE_PROMPT_VARIANT.NATURAL]: '自然语言版输出一两句中文，给第三方接口用。',
};

const BACKEND_LABEL = {
  [IMAGE_PROMPT_VARIANT.TAGS]: '当前生图后端是 NovelAI。',
  [IMAGE_PROMPT_VARIANT.NATURAL]: '当前生图后端不是 NovelAI。',
};

// 把库里的值展开成「文本框里显示的文本」：改过的用改过的，没改过的用默认。
const toValues = (prompts) => {
  const values = { auto: {}, manual: {} };

  Object.values(IMAGE_PROMPT_KIND).forEach((kind) => {
    Object.values(IMAGE_PROMPT_VARIANT).forEach((variant) => {
      values[kind][variant] = resolvePromptText(prompts, kind, variant);
    });
  });

  return values;
};

const ImagePromptsSheet = ({ prompts, backend, onSaved, onClose }) => {
  const initial = useMemo(() => normalizeImagePrompts(prompts), [prompts]);
  const backendVariant = variantOfBackend(backend);
  const [variant, setVariant] = useState(backendVariant);
  const [values, setValues] = useState(() => toValues(initial));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const setValue = (kind, text) => {
    setValues((current) => ({
      ...current,
      [kind]: { ...current[kind], [variant]: text },
    }));
  };

  const isModified = (kind) => {
    const text = String(values[kind][variant] ?? '').trim();

    return Boolean(text) && text !== getDefaultPrompt(kind, variant);
  };

  const buildResult = () => {
    let next = initial;

    Object.values(IMAGE_PROMPT_KIND).forEach((kind) => {
      Object.values(IMAGE_PROMPT_VARIANT).forEach((item) => {
        next = setPromptText(next, kind, item, values[kind][item]);
      });
    });

    return next;
  };

  const handleClose = async () => {
    if (saving) return;

    const next = buildResult();

    if (JSON.stringify(next) === JSON.stringify(initial)) {
      onClose();

      return;
    }

    setSaving(true);

    try {
      await saveImagePrompts(next);
      onSaved(next);
      onClose();
    } catch (error) {
      console.warn('[Fiction] 保存配图要求失败：', error);
      setNotice('保存失败了，请再点一次「完成」。');
      setSaving(false);
    }
  };

  return (
    <FictionSheetPortal>
      <button type="button" className="fic-btn-reset fic-mask" aria-label="保存并关闭" onClick={handleClose} />
      <div className="fic-sheet fic-w-sheet fic-th-sheet" role="dialog" aria-label="配图要求">
        <div className="fic-sheet-grab" />
        <div className="fic-sheet-name">配图要求</div>
        <div className="fic-sheet-meta">全局设置，所有存档共用</div>
        {notice ? <div className="fic-th-note is-warn" role="status">{notice}</div> : null}

        <div className="fic-w-sheet-scroll">
          <div className="fic-w-chips is-equal fic-ip-variants" role="radiogroup" aria-label="版本">
            {VARIANT_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={variant === item.id}
                className={`fic-btn-reset fic-w-chip ${variant === item.id ? 'is-on' : ''}`}
                onClick={() => setVariant(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="fic-w-hint">
            {VARIANT_HINT[variant]}
            {variant === backendVariant ? BACKEND_LABEL[variant] : ''}
          </div>

          {KIND_ITEMS.map((item) => {
            const modified = isModified(item.kind);
            const text = values[item.kind][variant] ?? '';
            const id = `fic-ip-${item.kind}`;

            return (
              <div key={item.kind} className="fic-ip-block">
                <div className="fic-w-label-row">
                  <label className="fic-w-label" htmlFor={id}>{item.label}</label>
                  <span className={`fic-w-tag ${modified ? 'is-req' : ''}`}>{modified ? '已修改' : '默认'}</span>
                </div>
                <div className="fic-w-hint fic-ip-hint">{item.hint}</div>
                <textarea
                  id={id}
                  className="fic-w-textarea fic-ip-textarea"
                  rows={6}
                  value={text}
                  maxLength={IMAGE_PROMPT_MAX}
                  onChange={(event) => setValue(item.kind, event.target.value)}
                />
                <div className="fic-w-meta">
                  <span />
                  <span>{text.length}/{IMAGE_PROMPT_MAX}</span>
                </div>
                <button
                  type="button"
                  className={`fic-btn-reset fic-w-file-btn fic-ip-reset ${modified ? '' : 'is-idle'}`}
                  disabled={!modified}
                  onClick={() => setValue(item.kind, getDefaultPrompt(item.kind, variant))}
                >
                  恢复默认
                </button>
              </div>
            );
          })}

          <div className="fic-w-hint fic-ip-foot">
            自动配图外面那层 [IMAGE] 标签由程序自动加，这里只写描述怎么写。
          </div>
        </div>

        <div className="fic-sheet-actions">
          <button
            type="button"
            className="fic-btn-reset fic-sheet-btn is-solid"
            disabled={saving}
            onClick={handleClose}
          >
            完成
          </button>
        </div>
      </div>
    </FictionSheetPortal>
  );
};

export default ImagePromptsSheet;