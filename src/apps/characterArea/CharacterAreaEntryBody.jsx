import React from 'react';
import {
  ENTRY_FORMATS,
  normalizeEntryFormat,
  parseLedgerRows,
  parseLetterParagraphs,
  parseListItems,
} from './characterAreaEntryFormats';

// ============================================================
// 角色专属区域的条目正文和目录标记（切片 F2）。
//
//   - CharacterAreaEntryBody：点开一条之后的正文，按 entry.format 摆成 6 种
//     样子之一（普通 / 便签 / 清单 / 信件 / 语录 / 账本）。没有 format 的老条目
//     按普通文字显示，样子和以前一样。
//   - CharacterAreaEntryMark：目录里标题左边的小标记，普通文字没有。
//
// 点缀色用 --area-accent（区域有主题时才有定义），没有就退回正文色，所以
// 老区域、没设计过外观的区域也能正常显示。所有内容都是纯文本节点，不会
// 被当成 HTML。
// ============================================================

const ACCENT = 'var(--area-accent, var(--text-main))';
const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';

const baseBlockClass = 'rounded-2xl text-sm leading-relaxed';

function PlainBody({ content }) {
  return (
    <div
      className={`${baseBlockClass} whitespace-pre-wrap px-4 py-3`}
      style={{ background: 'var(--bg-surface)' }}
    >
      {content}
    </div>
  );
}

function NoteBody({ content }) {
  return (
    <div
      className={`${baseBlockClass} relative whitespace-pre-wrap px-4 pb-4 pt-5`}
      style={{
        background: `color-mix(in srgb, ${ACCENT} 14%, var(--card-bg))`,
        border: `1px solid color-mix(in srgb, ${ACCENT} 32%, transparent)`,
        transform: 'rotate(-0.6deg)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -7,
          left: '50%',
          width: 52,
          height: 14,
          marginLeft: -26,
          borderRadius: 2,
          background: `color-mix(in srgb, ${ACCENT} 40%, transparent)`,
        }}
      />
      {content}
    </div>
  );
}

function ListBody({ content }) {
  const items = parseListItems(content);

  return (
    <ul
      className={`${baseBlockClass} flex flex-col gap-2 px-4 py-3`}
      style={{ background: 'var(--bg-surface)' }}
    >
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            style={{
              position: 'relative',
              flexShrink: 0,
              width: 15,
              height: 15,
              marginTop: 3,
              borderRadius: 4,
              border: `1.5px solid ${ACCENT}`,
              background: item.checked ? ACCENT : 'transparent',
            }}
          >
            {item.checked ? (
              <span
                style={{
                  position: 'absolute',
                  left: 4,
                  top: 0,
                  width: 4,
                  height: 8,
                  border: 'solid var(--card-bg)',
                  borderWidth: '0 2px 2px 0',
                  transform: 'rotate(45deg)',
                }}
              />
            ) : null}
          </span>
          <span
            style={{
              textDecoration: item.checked ? 'line-through' : 'none',
              opacity: item.checked ? 0.6 : 1,
            }}
          >
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LetterBody({ content }) {
  const paragraphs = parseLetterParagraphs(content);

  return (
    <div
      className={`${baseBlockClass} px-5 py-4`}
      style={{
        background: 'var(--bg-surface)',
        borderLeft: `3px solid ${ACCENT}`,
        lineHeight: 2,
      }}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index} style={{ textIndent: '2em' }}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function QuoteBody({ content }) {
  return (
    <div
      className="px-6 py-6 text-center"
      style={{
        borderTop: `1px solid ${softBorder}`,
        borderBottom: `1px solid ${softBorder}`,
      }}
    >
      <div style={{ color: ACCENT, fontSize: 30, lineHeight: 1, height: 18 }} aria-hidden="true">
        &ldquo;
      </div>
      <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed">{content}</p>
    </div>
  );
}

function LedgerBody({ content }) {
  const rows = parseLedgerRows(content);

  return (
    <div className={`${baseBlockClass} px-3 py-2`} style={{ background: 'var(--bg-surface)' }}>
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex gap-3 py-1.5"
          style={{
            borderBottom: index === rows.length - 1 ? 'none' : `1px dashed ${softBorder}`,
          }}
        >
          <span
            className="shrink-0 text-xs"
            style={{ width: 64, paddingTop: 2, color: 'var(--text-muted)' }}
          >
            {row.left}
          </span>
          <span className="flex-1">{row.right}</span>
        </div>
      ))}
    </div>
  );
}

const BODY_COMPONENTS = {
  plain: PlainBody,
  note: NoteBody,
  list: ListBody,
  letter: LetterBody,
  quote: QuoteBody,
  ledger: LedgerBody,
};

export function CharacterAreaEntryBody({ entry }) {
  const format = normalizeEntryFormat(entry?.format);
  const Body = BODY_COMPONENTS[format] || PlainBody;

  return <Body content={entry?.content || ''} />;
}

export function CharacterAreaEntryMark({ format }) {
  const key = normalizeEntryFormat(format);
  const meta = ENTRY_FORMATS[key];

  if (!meta || !meta.tag) return null;

  return (
    <span
      title={meta.label}
      aria-hidden="true"
      style={{
        flexShrink: 0,
        padding: '2px 4px',
        borderRadius: 4,
        fontSize: 10,
        lineHeight: 1,
        color: ACCENT,
        border: `1px solid color-mix(in srgb, ${ACCENT} 55%, transparent)`,
      }}
    >
      {meta.tag}
    </span>
  );
}