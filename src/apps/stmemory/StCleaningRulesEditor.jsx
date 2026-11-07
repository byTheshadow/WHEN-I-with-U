// src/apps/stmemory/StCleaningRulesEditor.jsx
//
// 清洗规则编辑器：导入前决定"哪些内容要从消息里清掉"。
//   - 标签：写 <is></is> 就把所有 <is> ... </is> 包着的内容连标签一起清掉（一次可以写多个）
//   - 聊天里出现的标签：试跑时从这份聊天里扫出来的成对标签，按出现次数列出，点一下加进规则
//   - 高级：自己写正则（查找 / 标志 / 替换成）
// 规则列表由父组件持有并保存，这里只负责编辑。
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  makeRegexRule,
  makeTagRule,
  parseTagNames,
  validateRegex,
} from './stCleaning';

const fieldStyle = {
  background: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

const StCleaningRulesEditor = ({ rules, onChange, tagStats = [] }) => {
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [regexFind, setRegexFind] = useState('');
  const [regexFlags, setRegexFlags] = useState('gi');
  const [regexReplace, setRegexReplace] = useState('');
  const [regexError, setRegexError] = useState('');

  // 按 id 去重地加入若干规则；已有的保持原样（包括它的开关状态）。
  const addRules = (incoming) => {
    const existingIds = new Set(rules.map((rule) => rule.id));
    const fresh = incoming.filter((rule) => !existingIds.has(rule.id));
    if (fresh.length > 0) onChange([...rules, ...fresh]);
  };

  const handleAddTags = () => {
    const names = parseTagNames(tagInput);
    if (names.length === 0) return;
    addRules(names.map(makeTagRule));
    setTagInput('');
  };

  const handleAddRegex = () => {
    const error = validateRegex(regexFind, regexFlags);
    if (error) {
      setRegexError(error);
      return;
    }
    setRegexError('');
    addRules([makeRegexRule({
      findRegex: regexFind,
      flags: regexFlags,
      replaceString: regexReplace,
    })]);
    setRegexFind('');
    setRegexReplace('');
  };

  const toggleRule = (id) => onChange(
    rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
  );

  const removeRule = (id) => onChange(rules.filter((rule) => rule.id !== id));

  return (
    <div className="space-y-2.5 text-xs">
      <p className="leading-relaxed opacity-60">
        导入前先把不想要的内容清掉。规则对每条消息单独生效，所有记忆包共用这一份，改完点下面的"重新统计"看效果。
      </p>

      {rules.length === 0 ? (
        <p className="opacity-50">还没有规则，原文会原样保留。</p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
              style={{ ...fieldStyle, opacity: rule.enabled ? 1 : 0.55 }}
            >
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={rule.label}>
                {rule.label}
              </span>
              <button
                type="button"
                aria-label="删除这条规则"
                onClick={() => removeRule(rule.id)}
                className="opacity-50 hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border px-3 py-2 outline-none"
          style={fieldStyle}
          placeholder="要清理的标签，例如 <is></is>"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddTags();
          }}
        />
        <button
          type="button"
          onClick={handleAddTags}
          className="flex items-center gap-1 rounded-xl border px-3 font-semibold"
          style={fieldStyle}
        >
          <Plus className="h-3.5 w-3.5" /> 添加
        </button>
      </div>

      {tagStats.length > 0 && (
        <div className="space-y-1">
          <span className="font-semibold">这份聊天里出现的标签</span>
          <p className="text-[10px] opacity-50">
            按出现次数从多到少列出，只统计成对的 {'<名字> ... </名字>'}。点一下把它加进清洗规则（会连标签带内容一起删），加完用"重新统计"看前后对比。
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tagStats.slice(0, 30).map((item) => {
              const added = rules.some((rule) => rule.id === `tag:${item.tag}`);
              return (
                <button
                  key={item.tag}
                  type="button"
                  disabled={added}
                  title={`出现在 ${item.messageCount} 条消息里，共约 ${item.chars} 字`}
                  onClick={() => addRules([makeTagRule(item.tag)])}
                  className="rounded-full border px-2.5 py-1 font-mono text-[11px] disabled:opacity-40"
                  style={fieldStyle}
                >
                  {`<${item.tag}>`} x{item.count}{added ? ' 已加' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((value) => !value)}
        className="font-semibold underline-offset-2 opacity-70 hover:underline"
      >
        {showAdvanced ? '收起高级（自己写正则）' : '高级（自己写正则）'}
      </button>

      {showAdvanced && (
        <div className="space-y-1.5">
          <input
            className="w-full rounded-xl border px-3 py-2 font-mono outline-none"
            style={fieldStyle}
            placeholder="查找（正则）"
            value={regexFind}
            onChange={(e) => setRegexFind(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="w-20 rounded-xl border px-3 py-2 font-mono outline-none"
              style={fieldStyle}
              placeholder="标志"
              value={regexFlags}
              onChange={(e) => setRegexFlags(e.target.value)}
            />
            <input
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 font-mono outline-none"
              style={fieldStyle}
              placeholder="替换成（留空 = 删除）"
              value={regexReplace}
              onChange={(e) => setRegexReplace(e.target.value)}
            />
          </div>
          {regexError && <p className="text-rose-500">{regexError}</p>}
          <button
            type="button"
            onClick={handleAddRegex}
            className="rounded-xl border px-3 py-1.5 font-semibold"
            style={fieldStyle}
          >
            添加这条正则
          </button>
        </div>
      )}
    </div>
  );
};

export default StCleaningRulesEditor;