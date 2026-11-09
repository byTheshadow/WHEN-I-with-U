// src/apps/layoutstudio/LayoutTweakPanel.jsx
//
// 出图之后的"微调文字和排布"折叠面板。完全通用：不关心是哪个模板，
// 只读 spec 里的元素和模板声明的 paramOptions。
//   - 模板参数（比如散点拼贴的形状）用小按钮切换；
//   - 每个带文字的元素（text / row / emoji 贴纸）一行输入框，可改字、可删除；
//   - "加一段文字"（模板允许 text 元素时）；
//   - "重新排布"：同一个模板换一个随机种子重排。

import React from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

import { MAX_ITEMS } from './layoutConstants';
import { getTemplate } from './templates';

const itemLabel = (item, counters) => {
  if (item.kind === 'row') {
    counters.row += 1;
    return `清单 ${counters.row}`;
  }
  if (item.kind === 'sticker') {
    counters.glyph += 1;
    return `字形 ${counters.glyph}`;
  }
  counters.text += 1;
  return `文字 ${counters.text}`;
};

const isEditable = (item) =>
  item.kind === 'text' ||
  item.kind === 'row' ||
  (item.kind === 'sticker' && item.sticker === 'glyph');

const LayoutTweakPanel = ({ spec, disabled, onChange, onReroll, defaultOpen = false }) => {
  const tpl = getTemplate(spec.templateId);
  if (!tpl) return null;

  const counters = { row: 0, text: 0, glyph: 0 };
  const rows = spec.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isEditable(item))
    .map(({ item, index }) => ({ item, index, label: itemLabel(item, counters) }));

  const updateItem = (index, patch) => {
    onChange({
      ...spec,
      items: spec.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (index) => {
    onChange({ ...spec, items: spec.items.filter((_, i) => i !== index) });
  };

  const addText = () => {
    if (spec.items.length >= MAX_ITEMS) return;
    onChange({
      ...spec,
      items: [
        ...spec.items,
        {
          kind: 'text',
          id: `n${Date.now() % 100000}`,
          text: '新的一句',
          x: 0.5,
          y: 0.5,
          size: 0.06,
          color: '#ffffff',
          font: 'sans',
          weight: 700,
          align: 'center',
          rot: 0,
          shadow: true,
        },
      ],
    });
  };

  return (
   <details className="ls-card ls-tweak" open={defaultOpen}>
      <summary>
        微调文字和排布 <span>可选</span>
      </summary>
      <div className="ls-body">
        {tpl.paramOptions.map((option) => (
          <div key={option.key} className="ls-chips">
            <span className="ls-chips-label">{option.label}</span>
            {option.options.map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                className={`ls-chip${spec.params[option.key] === value ? ' ls-on' : ''}`}
                onClick={() =>
                  onChange({
                    ...spec,
                    params: { ...spec.params, [option.key]: value },
                    items: spec.items.map((it) =>
                      it.kind === 'shape' ? { ...it, shape: value } : it
                    ),
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        ))}

        {rows.map(({ item, index, label }) => (
          <label key={item.id + index} className="ls-field">
            <span>{label}</span>
            <input
              type="text"
              maxLength={60}
              disabled={disabled}
              value={item.kind === 'sticker' ? item.glyph : item.text}
              onChange={(e) =>
                updateItem(index, item.kind === 'sticker' ? { glyph: e.target.value } : { text: e.target.value })
              }
            />
            {item.kind !== 'row' && (
              <button
                type="button"
                className="ls-field-del"
                aria-label="删除这一项"
                disabled={disabled}
                onClick={() => removeItem(index)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </label>
        ))}

        <div className="ls-tweak-actions">
          {tpl.kinds.includes('text') && (
            <button type="button" className="ls-chip" disabled={disabled} onClick={addText}>
              <Plus size={13} /> 加一段文字
            </button>
          )}
          <button type="button" className="ls-chip" disabled={disabled} onClick={onReroll}>
            <RefreshCw size={13} /> 重新排布
          </button>
        </div>
      </div>
    </details>
  );
};

export default LayoutTweakPanel;