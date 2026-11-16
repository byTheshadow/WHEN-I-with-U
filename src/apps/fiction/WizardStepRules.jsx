// src/apps/fiction/WizardStepRules.jsx
//
// 向导第 3 步：规则与数值。
// 世界书（复用聊天里的 rpWorldBooks + 本存档专属条目）、每轮字数下限、
// 选项设置、数值系统、文生图模式。
// 纯小说式没有选项，选项设置和数值系统整块隐藏，只留一句说明。

import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';

import FictionSheetPortal from './FictionSheetPortal';

import { getAllRpWorldBooks } from '../rp/rpWorldBookService';
import { FICTION_IMAGE_MODES, FICTION_MODES } from './fictionService';
import {
  MAX_LOCAL_ENTRIES,
  MAX_STATS,
  OPTION_MIN_RANGE,
  STAT_NAME_FORBIDDEN,
  TEXT_FIELD_MAX,
  WORD_MIN_RANGE,
  formatKeywords,
  makeId,
  parseKeywords,
} from './fictionWizardService';

const WORD_PRESETS = [800, 1500, 2000, 3000];

const IMAGE_ITEMS = [
  { id: FICTION_IMAGE_MODES.OFF, label: '关闭' },
  { id: FICTION_IMAGE_MODES.MANUAL, label: '手动' },
  { id: FICTION_IMAGE_MODES.AUTO, label: '自动' },
];

const pad2 = (value) => String(value).padStart(2, '0');

const FieldLabel = ({ children, tag = '可留空' }) => (
  <div className="fic-w-label-row">
    <span className="fic-w-label">{children}</span>
    <span className="fic-w-tag">{tag}</span>
  </div>
);

const SheetShell = (props) => (
  <FictionSheetPortal>
    <SheetShellBase {...props} />
  </FictionSheetPortal>
);

const SheetShellBase = ({ title, meta, onClose, footer, children }) => (
  <>
    <button type="button" className="fic-btn-reset fic-mask" aria-label="关闭" onClick={onClose} />
    <div className="fic-sheet fic-w-sheet" role="dialog" aria-label={title}>
      <div className="fic-sheet-grab" />
      <div className="fic-sheet-name">{title}</div>
      {meta ? <div className="fic-sheet-meta">{meta}</div> : null}
      <div className="fic-w-sheet-scroll">{children}</div>
      {footer ? <div className="fic-sheet-actions">{footer}</div> : null}
    </div>
  </>
);

const SwitchRow = ({ label, hint, checked, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    className="fic-btn-reset fic-w-switch-row"
    onClick={onToggle}
  >
    <span className="fic-w-switch-text">
      <span className="fic-w-switch-label">{label}</span>
      {hint ? <span className="fic-w-switch-hint">{hint}</span> : null}
    </span>
    <span className={`fic-w-switch ${checked ? 'is-on' : ''}`} aria-hidden="true" />
  </button>
);

const WizardStepRules = ({ form, onChange, onToast }) => {
  const [books, setBooks] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [entryDraft, setEntryDraft] = useState(null);
  const [statDraft, setStatDraft] = useState(null);
  const [statError, setStatError] = useState('');

  const isNovel = form.mode === FICTION_MODES.NOVEL;
  const worldBookIds = Array.isArray(form.worldBookIds) ? form.worldBookIds : [];
  const localEntries = Array.isArray(form.localEntries) ? form.localEntries : [];
  const stats = Array.isArray(form.stats) ? form.stats : [];
  const wordMin = Number(form.wordMin) || 2000;
  const optionMin = Number(form.optionMin) || OPTION_MIN_RANGE.min;

  useEffect(() => {
    let cancelled = false;

    getAllRpWorldBooks().then((list) => {
      if (!cancelled) setBooks(Array.isArray(list) ? list : []);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const closeSheet = () => {
    setSheet(null);
    setEntryDraft(null);
    setStatDraft(null);
    setStatError('');
  };

  // ---------- 世界书 ----------

  const toggleBook = (id) => {
    onChange({
      worldBookIds: worldBookIds.includes(id)
        ? worldBookIds.filter((item) => item !== id)
        : [...worldBookIds, id],
    });
  };

  const openEntries = () => {
    setEntryDraft(null);
    setSheet('entries');
  };

  const openEntryEditor = (entry) => {
    setEntryDraft({
      id: entry?.id || null,
      keywordsText: formatKeywords(entry?.keywords),
      content: entry?.content || '',
      enabled: entry ? entry.enabled !== false : true,
    });
  };

  const saveEntry = () => {
    const content = String(entryDraft?.content || '').trim();

    if (!content) {
      onToast?.('条目内容不能为空');
      return;
    }

    const next = {
      id: entryDraft.id || makeId('le'),
      keywords: parseKeywords(entryDraft.keywordsText),
      content,
      enabled: entryDraft.enabled,
    };

    onChange({
      localEntries: entryDraft.id
        ? localEntries.map((item) => (item.id === entryDraft.id ? next : item))
        : [...localEntries, next],
    });
    setEntryDraft(null);
  };

  const deleteEntry = () => {
    onChange({ localEntries: localEntries.filter((item) => item.id !== entryDraft?.id) });
    setEntryDraft(null);
  };

  // ---------- 数值 ----------

  const openStat = (stat) => {
    setStatError('');
    setStatDraft({
      id: stat?.id || null,
      name: stat?.name || '',
      initial: String(stat ? stat.initial : 10),
      min: String(stat ? stat.min : 0),
      max: String(stat ? stat.max : 100),
      desc: stat?.desc || '',
    });
    setSheet('stat');
  };

  const saveStat = () => {
    const name = statDraft.name.trim();
    const parse = (text) => (String(text).trim() === '' ? NaN : Math.round(Number(text)));
    const initial = parse(statDraft.initial);
    const min = parse(statDraft.min);
    const max = parse(statDraft.max);

    let message = '';

    if (!name) message = '数值需要一个名称';
    else if (STAT_NAME_FORBIDDEN.test(name)) message = '名称里不能有空格、冒号、逗号和竖线';
    else if (Array.from(name).length > 8) message = '名称最多 8 个字';
    else if (stats.some((item) => item.id !== statDraft.id && item.name.toLowerCase() === name.toLowerCase())) {
      message = '已经有同名的数值了';
    } else if (![initial, min, max].every(Number.isFinite)) message = '初始值和范围都要填数字';
    else if (min >= max) message = '最小值要小于最大值';

    if (message) {
      setStatError(message);
      return;
    }

    const next = {
      id: statDraft.id || makeId('st'),
      name,
      initial: Math.min(max, Math.max(min, initial)),
      min,
      max,
      desc: statDraft.desc.trim(),
    };

    onChange({
      stats: statDraft.id
        ? stats.map((item) => (item.id === statDraft.id ? next : item))
        : [...stats, next],
    });
    closeSheet();
  };

  const deleteStat = () => {
    onChange({ stats: stats.filter((item) => item.id !== statDraft?.id) });
    closeSheet();
  };

  // ---------- 抽屉 ----------

  const renderSheet = () => {
    if (sheet === 'entries') {
      if (entryDraft) {
        return (
          <SheetShell
            title={entryDraft.id ? '编辑条目' : '添加条目'}
            meta="只属于这份存档，不会出现在别的存档里"
            onClose={() => setEntryDraft(null)}
            footer={(
              <>
                <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={saveEntry}>
                  保存
                </button>
                {entryDraft.id && (
                  <button type="button" className="fic-btn-reset fic-sheet-btn is-danger" onClick={deleteEntry}>
                    删除这条
                  </button>
                )}
                <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={() => setEntryDraft(null)}>
                  返回
                </button>
              </>
            )}
          >
            <label className="fic-w-sub-label" htmlFor="fic-le-kw">关键词</label>
            <input
              id="fic-le-kw"
              type="text"
              className="fic-w-input"
              value={entryDraft.keywordsText}
              placeholder="用逗号或顿号分隔，比如：渡口、老周"
              onChange={(event) => setEntryDraft({ ...entryDraft, keywordsText: event.target.value })}
            />
            <div className="fic-w-meta">
              <span>关键词出现在最近的剧情里时才会带入；留空则每一轮都带入。</span>
            </div>

            <label className="fic-w-sub-label" htmlFor="fic-le-content">内容</label>
            <textarea
              id="fic-le-content"
              className="fic-w-textarea"
              rows={6}
              value={entryDraft.content}
              maxLength={TEXT_FIELD_MAX}
              placeholder="一条设定，写成一两句清楚的话。"
              onChange={(event) => setEntryDraft({ ...entryDraft, content: event.target.value })}
            />

            <SwitchRow
              label="启用这一条"
              checked={entryDraft.enabled}
              onToggle={() => setEntryDraft({ ...entryDraft, enabled: !entryDraft.enabled })}
            />
          </SheetShell>
        );
      }

      return (
        <SheetShell
          title="本存档专属条目"
          meta={`${localEntries.length} / ${MAX_LOCAL_ENTRIES} 条 · 不会出现在别的存档里`}
          onClose={closeSheet}
          footer={(
            <>
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-solid"
                disabled={localEntries.length >= MAX_LOCAL_ENTRIES}
                onClick={() => openEntryEditor(null)}
              >
                添加条目
              </button>
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
                完成
              </button>
            </>
          )}
        >
          {localEntries.length === 0 && (
            <div className="fic-w-rowhint">还没有专属条目。适合放只在这个故事里成立的设定。</div>
          )}
          {localEntries.length > 0 && (
            <div className="fic-w-rows">
              {localEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="fic-btn-reset fic-w-pick"
                  onClick={() => openEntryEditor(entry)}
                >
                  <span className="fic-w-pick-text">
                    <span className="fic-w-pick-name">
                      {entry.keywords.length > 0 ? entry.keywords.join('、') : '每一轮都带入'}
                      {entry.enabled === false ? ' · 已停用' : ''}
                    </span>
                    <span className="fic-w-pick-sub">{entry.content}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </SheetShell>
      );
    }

    if (sheet === 'stat' && statDraft) {
      return (
        <SheetShell
          title={statDraft.id ? '编辑数值' : '添加数值'}
          meta="AI 只给每个选项的增减，结算交给程序"
          onClose={closeSheet}
          footer={(
            <>
              <button type="button" className="fic-btn-reset fic-sheet-btn is-solid" onClick={saveStat}>
                保存
              </button>
              {statDraft.id && (
                <button type="button" className="fic-btn-reset fic-sheet-btn is-danger" onClick={deleteStat}>
                  删除这个数值
                </button>
              )}
              <button type="button" className="fic-btn-reset fic-sheet-btn" onClick={closeSheet}>
                取消
              </button>
            </>
          )}
        >
          <label className="fic-w-sub-label" htmlFor="fic-st-name">名称</label>
          <input
            id="fic-st-name"
            type="text"
            className="fic-w-input"
            value={statDraft.name}
            maxLength={8}
            placeholder="比如：好感度、金钱、体力"
            onChange={(event) => setStatDraft({ ...statDraft, name: event.target.value })}
          />

          <div className="fic-w-num-grid">
            {[
              { key: 'initial', label: '初始值' },
              { key: 'min', label: '最小值' },
              { key: 'max', label: '最大值' },
            ].map((item) => (
              <div key={item.key} className="fic-w-num-cell">
                <label className="fic-w-sub-label" htmlFor={`fic-st-${item.key}`}>{item.label}</label>
                <input
                  id={`fic-st-${item.key}`}
                  type="number"
                  inputMode="numeric"
                  className="fic-w-input"
                  value={statDraft[item.key]}
                  onChange={(event) => setStatDraft({ ...statDraft, [item.key]: event.target.value })}
                />
              </div>
            ))}
          </div>

          <label className="fic-w-sub-label" htmlFor="fic-st-desc">给 AI 看的说明</label>
          <textarea
            id="fic-st-desc"
            className="fic-w-textarea"
            rows={3}
            value={statDraft.desc}
            maxLength={200}
            placeholder="这个数值代表什么，数值高低意味着什么。"
            onChange={(event) => setStatDraft({ ...statDraft, desc: event.target.value })}
          />

          {statError && <div className="fic-w-error" role="alert">{statError}</div>}
        </SheetShell>
      );
    }

    return null;
  };

  return (
    <div className="fic-w-body">
      {/* ---------- 世界书 ---------- */}
      <section className="fic-w-field">
        <FieldLabel>世界书</FieldLabel>

        <div className="fic-w-rows">
          {books === null && <div className="fic-w-rowhint">正在读取世界书…</div>}
          {books && books.length === 0 && (
            <div className="fic-w-rowhint">聊天里还没有世界书，可以只用下面的本存档专属条目。</div>
          )}
          {books && books.map((book) => {
            const on = worldBookIds.includes(book.id);
            const count = (book.entries || []).filter((entry) => entry.enabled !== false && entry.content).length;

            return (
              <button
                key={book.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                className="fic-btn-reset fic-w-pick"
                onClick={() => toggleBook(book.id)}
              >
                <span className={`fic-w-check ${on ? 'is-on' : ''}`} aria-hidden="true">
                  {on && <Check size={14} strokeWidth={2.2} />}
                </span>
                <span className="fic-w-pick-text">
                  <span className="fic-w-pick-name">{book.name || '未命名世界书'}</span>
                  <span className="fic-w-pick-sub">{count} 条 · 关键词留空的每轮都带，其余按关键词触发</span>
                </span>
              </button>
            );
          })}

          <div className="fic-w-pick is-static">
            <span className="fic-w-pick-text">
              <span className="fic-w-pick-name">本存档专属条目</span>
              <span className="fic-w-pick-sub">{localEntries.length} 条 · 不会出现在别的存档里</span>
            </span>
            <button type="button" className="fic-btn-reset fic-w-outline-btn is-compact" onClick={openEntries}>
              管理
            </button>
          </div>
        </div>
        <div className="fic-w-hint">用的是聊天里已有的世界书，不用重新写一遍。</div>
      </section>

      {/* ---------- 字数 ---------- */}
      <section className="fic-w-field">
        <FieldLabel tag="下限">每一轮剧情字数</FieldLabel>
        <div className="fic-w-big-number">
          <span className="fic-w-big-value">{wordMin}</span>
          <span className="fic-w-big-unit">字起</span>
        </div>
        <input
          type="range"
          className="fic-w-range"
          aria-label="每一轮剧情字数下限"
          min={WORD_MIN_RANGE.min}
          max={WORD_MIN_RANGE.max}
          step={WORD_MIN_RANGE.step}
          value={wordMin}
          onChange={(event) => onChange({ wordMin: Number(event.target.value) })}
        />
        <div className="fic-w-range-ends">
          <span>{WORD_MIN_RANGE.min}</span>
          <span>{WORD_MIN_RANGE.max}</span>
        </div>
        <div className="fic-w-chips">
          {WORD_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={wordMin === value}
              className={`fic-btn-reset fic-w-chip ${wordMin === value ? 'is-on' : ''}`}
              onClick={() => onChange({ wordMin: value })}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="fic-w-hint">只是下限，AI 会尽量写够。字数越多，生成越慢，也越费额度。</div>
      </section>

      {isNovel && (
        <div className="fic-w-note">
          纯小说式没有选项，所以选项设置和数值系统在这里不会用到。想用数值的话，请把第 1 步的形式改成选择式。
        </div>
      )}

      {/* ---------- 选项 ---------- */}
      {!isNovel && (
        <section className="fic-w-field">
          <FieldLabel tag="选择式">选项</FieldLabel>

          <div className="fic-w-switch-row is-static">
            <span className="fic-w-switch-text">
              <span className="fic-w-switch-label">每次至少给出</span>
              <span className="fic-w-switch-hint">纯文字选项</span>
            </span>
            <span className="fic-w-stepper">
              <button
                type="button"
                className="fic-btn-reset fic-w-step-btn"
                aria-label="减少选项数"
                disabled={optionMin <= OPTION_MIN_RANGE.min}
                onClick={() => onChange({ optionMin: optionMin - 1 })}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span className="fic-w-step-value">{optionMin}</span>
              <button
                type="button"
                className="fic-btn-reset fic-w-step-btn"
                aria-label="增加选项数"
                disabled={optionMin >= OPTION_MIN_RANGE.max}
                onClick={() => onChange({ optionMin: optionMin + 1 })}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </span>
          </div>

          <SwitchRow
            label="允许自己输入行动"
            hint="不被选项框住"
            checked={form.allowFreeInput !== false}
            onToggle={() => onChange({ allowFreeInput: form.allowFreeInput === false })}
          />
          <SwitchRow
            label="选项上显示数值变化"
            hint="关闭时，选完才知道代价。之后可在回看里揭晓。"
            checked={Boolean(form.showDeltas)}
            onToggle={() => onChange({ showDeltas: !form.showDeltas })}
          />
        </section>
      )}

      {/* ---------- 数值系统 ---------- */}
      {!isNovel && (
        <section className="fic-w-field">
          <FieldLabel tag={`${stats.length} / ${MAX_STATS}`}>数值系统</FieldLabel>

          {stats.length > 0 && (
            <ol className="fic-w-rows">
              {stats.map((stat, index) => (
                <li key={stat.id}>
                  <button type="button" className="fic-btn-reset fic-w-pick" onClick={() => openStat(stat)}>
                    <span className="fic-w-roman is-num">{pad2(index + 1)}</span>
                    <span className="fic-w-pick-text">
                      <span className="fic-w-pick-name">{stat.name}</span>
                      <span className="fic-w-pick-sub">
                        初始 {stat.initial} · 范围 {stat.min} – {stat.max}
                        {stat.desc ? ` · ${stat.desc}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            className="fic-btn-reset fic-w-add-btn"
            disabled={stats.length >= MAX_STATS}
            onClick={() => openStat(null)}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            添加数值
          </button>
          <div className="fic-w-hint">AI 只给每个选项的增减，结算交给程序，不会算错。</div>
        </section>
      )}

      {/* ---------- 文生图 ---------- */}
      <section className="fic-w-field">
        <FieldLabel tag="沿用已配置的接口">文生图</FieldLabel>
        <div className="fic-w-chips is-equal" role="radiogroup" aria-label="文生图模式">
          {IMAGE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={form.imageMode === item.id}
              className={`fic-btn-reset fic-w-chip ${form.imageMode === item.id ? 'is-on' : ''}`}
              onClick={() => onChange({ imageMode: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="fic-w-hint">图会插在剧情里，同时收进画廊。</div>
      </section>

      {renderSheet()}
    </div>
  );
};

export default WizardStepRules;