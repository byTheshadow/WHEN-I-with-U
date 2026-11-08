// src/apps/stmemory/StCleaningRulesEditor.jsx
//
// 清洗规则编辑器：导入前决定"哪些内容要从消息里清掉"。
//   - 这份聊天里出现的标签：试跑时扫出来的成对标签，按出现次数列出，颜色越深出现越多，
//     点一下加进规则（会连标签带内容一起删）
//   - 已启用的规则：开关 + 删除
//   - 标签：写 <is></is> 就把所有 <is> ... </is> 包着的内容连标签一起清掉（一次可以写多个）
//   - 高级：自己写正则（查找 / 标志 / 替换成）
// 规则列表由父组件持有并保存，这里只负责编辑。渲染成若干 <section>，放进向导第二步的列里。
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  makeRegexRule,
  makeTagRule,
  parseTagNames,
  validateRegex,
} from './stCleaning';

// 标签芯片的"热度"：按出现次数相对最大值分五档，从白逐渐加深到深蓝。
const HEAT_LEVELS = [8, 22, 45, 68, 90];
const DARK_FROM_LEVEL = 3; // 这一档起底色够深，文字改用反色

const heatLevel = (count, max) => (
  Math.min(HEAT_LEVELS.length - 1, Math.max(0, Math.ceil((count / max) * HEAT_LEVELS.length) - 1))
);

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

  const shownTags = tagStats.slice(0, 30);
  const maxCount = Math.max(1, ...shownTags.map((item) => item.count));
  const enabledCount = rules.filter((rule) => rule.enabled).length;

  return (
    <>
      {shownTags.length > 0 && (
        <section>
          <div className="lbl" style={{ marginBottom: 4 }}>这份聊天里出现的标签</div>
          <p className="mute" style={{ margin: '0 0 10px', fontSize: 12 }}>
            按出现次数排列，颜色越深出现越多，只统计成对的标签。点一下加进规则，会连标签带内容一起删掉。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {shownTags.map((item) => {
              const added = rules.some((rule) => rule.id === `tag:${item.tag}`);
              const level = heatLevel(item.count, maxCount);
              const classes = ['tag'];
              if (level >= DARK_FROM_LEVEL) classes.push('dark');
              if (added) classes.push('tag-on');
              return (
                <button
                  key={item.tag}
                  type="button"
                  className={classes.join(' ')}
                  style={{ '--p': `${HEAT_LEVELS[level]}%` }}
                  disabled={added}
                  title={`出现在 ${item.messageCount} 条消息里，共约 ${item.chars} 字`}
                  onClick={() => addRules([makeTagRule(item.tag)])}
                >
                  {`<${item.tag}>`} <b>×{item.count}{added ? ' 已加' : ''}</b>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="lbl" style={{ marginBottom: 10 }}>
          已启用的规则　{enabledCount}
        </div>
        {rules.length === 0 ? (
          <p className="mute" style={{ margin: 0 }}>还没有规则，原文会原样保留。</p>
        ) : (
          <div className="glass" style={{ overflow: 'hidden' }}>
            {rules.map((rule) => (
              <div className="rule" key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.6 }}>
                <button
                  type="button"
                  className="swb"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`规则 ${rule.label} ${rule.enabled ? '已开启' : '已关闭'}`}
                  onClick={() => toggleRule(rule.id)}
                >
                  <span className={`sw${rule.enabled ? ' sw-on' : ''}`} />
                </button>
                <code title={rule.label}>{rule.label}</code>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="删除这条规则"
                  onClick={() => removeRule(rule.id)}
                >
                  <Trash2 className="ico" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <label htmlFor="qc-new-tag" className="vh">要清理的标签</label>
          <input
            id="qc-new-tag"
            className="inp"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="自己写，例如 <note></note>"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTags();
            }}
          />
          <button type="button" className="btn btn-out" style={{ minHeight: 48 }} onClick={handleAddTags}>
            添加
          </button>
        </div>

        <button
          type="button"
          className="btn-underline"
          style={{ marginTop: 6 }}
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((value) => !value)}
        >
          高级：自己写正则
        </button>

        {showAdvanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            <label className="vh" htmlFor="qc-rx-find">查找（正则）</label>
            <input
              id="qc-rx-find"
              className="inp mono-inp"
              placeholder="查找（正则）"
              value={regexFind}
              onChange={(e) => setRegexFind(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="vh" htmlFor="qc-rx-flags">标志</label>
              <input
                id="qc-rx-flags"
                className="inp mono-inp"
                style={{ width: 88, flex: 'none' }}
                placeholder="标志"
                value={regexFlags}
                onChange={(e) => setRegexFlags(e.target.value)}
              />
              <label className="vh" htmlFor="qc-rx-replace">替换成</label>
              <input
                id="qc-rx-replace"
                className="inp mono-inp"
                style={{ flex: 1, minWidth: 0 }}
                placeholder="替换成（留空 = 删除）"
                value={regexReplace}
                onChange={(e) => setRegexReplace(e.target.value)}
              />
            </div>
            {regexError && <p style={{ margin: 0, color: 'var(--bad)' }} role="alert">{regexError}</p>}
            <button type="button" className="btn btn-out" onClick={handleAddRegex}>添加这条正则</button>
          </div>
        )}
      </section>
    </>
  );
};

export default StCleaningRulesEditor;