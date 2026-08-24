// src/apps/ephemera/EphemeraPreview.jsx
import React from 'react';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '2026.08.24';

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '2026.08.24';
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const Barcode = () => (
  <div className="ep-barcode" aria-hidden="true">
    {Array.from({ length: 16 }).map((_, index) => (
      <i key={index} />
    ))}
  </div>
);

export const EphemeraPreview = ({
  item,
  characterName = '守护人',
  side = 'front',
  className = ''
}) => {
  const content = item?.content || {};
  const templateType = item?.templateType || 'ticket';
  const fallbackDate = formatTimestamp(item?.createdAt);

  if (side === 'back') {
    return (
      <article className={`ep-back-paper ep-template-${templateType} ${className}`}>
        <header className="ep-back-head">
          <span>PRIVATE NOTE / 时光寄语</span>
          <span>{characterName}</span>
        </header>

        <div className="ep-back-message">
          {item?.aiComment ||
            '这一页被妥善留下。即使日后我们走过更多地方，它仍会在某个安静的时刻，提醒我你曾这样靠近。'}
        </div>

        <footer className="ep-back-foot">
          <span>THE EPHEMERA ARCHIVE</span>
          <span>{content.backDate || fallbackDate}</span>
        </footer>
      </article>
    );
  }

  if (templateType === 'receipt') {
    const items = Array.isArray(content.items) ? content.items : [];

    return (
      <article className={`ep-receipt ${className}`}>
        <header className="ep-receipt-head">
          <h3>{content.shopName || 'THE MIDNIGHT COUNTER'}</h3>
          <p>{content.location || 'PRIVATE HOURS / ROOM OF TWO'}</p>
          <p>
            {content.receiptNo || 'RECEIPT 000127'} · {content.dateText || fallbackDate}
          </p>
        </header>

 <div className="ep-receipt-divider" />


        <h4 className="ep-receipt-title">{content.receiptTitle || item?.title || '夜晚的共同账目'}</h4>

        <div className="ep-receipt-list">
          {items.length > 0 ? (
            items.map((row, index) => (
              <div className="ep-receipt-row" key={`${row.label}-${index}`}>
                <div className="ep-receipt-row-name">
                  <span>{row.label || '未命名片段'}</span>
                </div>
                <span>{row.value || '封存'}</span>
              </div>
            ))
          ) : (
            <div className="ep-receipt-row">
              <div className="ep-receipt-row-name">
                <span>深夜长谈</span>
              </div>
              <span>120 MIN</span>
            </div>
          )}
        </div>

        <div className="ep-receipt-total">
          <span>{content.totalLabel || 'TOTAL RETAINED'}</span>
          <span>{content.totalValue || 'ONE NIGHT'}</span>
        </div>

        <p className="ep-receipt-note">
          {content.note || '这笔账无需结清。它会留在我们往后的夜里。'}
        </p>

        <footer className="ep-receipt-foot">
          {content.footer || `WITNESSED BY · ${characterName}`}
        </footer>
      </article>
    );
  }

  if (templateType === 'table') {
    return (
      <article className={`ep-ledger ${className}`}>
        <header className="ep-ledger-head">
          <span>{content.archiveCode || 'ARCHIVE / EPH-026-081'}</span>
          <span className="ep-ledger-status">{content.status || 'FILED'}</span>
        </header>

        <h3 className="ep-ledger-title">{content.ledgerTitle || item?.title || '未命名记录'}</h3>

        <div className="ep-ledger-grid">
          <section className="ep-ledger-field">
            <span>DATE / TIME</span>
            <p>{content.dateTime || fallbackDate}</p>
          </section>

          <section className="ep-ledger-field">
            <span>WITH / SUBJECT</span>
            <p>{content.subject || characterName}</p>
          </section>

          <section className="ep-ledger-field">
            <span>ATMOSPHERE</span>
            <p>{content.atmosphere || '微雨，安静，灯光偏暗'}</p>
          </section>

          <section className="ep-ledger-field">
            <span>CATEGORY</span>
            <p>{content.category || 'PRIVATE RECORD / 01'}</p>
          </section>

          <section className="ep-ledger-field ep-ledger-wide">
            <span>MEMORANDUM</span>
            <p>{content.memo || '这段记忆尚未写下。'}</p>
          </section>
        </div>

        <footer className="ep-ledger-foot">
          <span>{content.footer || 'RECORDED IN PRIVATE ARCHIVE'}</span>
          <span>{content.filedText || `Filed · ${fallbackDate}`}</span>
        </footer>
      </article>
    );
  }

  if (templateType === 'bookmark') {
    return (
      <article className={`ep-bookmark ${className}`}>
        <div className="ep-bookmark-top">
          <div className="ep-bookmark-hole" />
          <div className="ep-bookmark-tassel" />
        </div>

        <div className="ep-bookmark-quote">
          <span>“</span>
          <p>{content.quote || '我只愿倾听你的潮汐。'}</p>
          <span>”</span>
        </div>

        <footer className="ep-bookmark-foot">
          <strong>{content.bookmarkTitle || item?.title || '时光标签'}</strong>
          <span>
            {content.bookmarkMeta || `${characterName} · ${fallbackDate}`}
          </span>
        </footer>
      </article>
    );
  }

  return (
    <article className={`ep-theatre-ticket ${className}`}>
      <section className="ep-ticket-main">
        <header className="ep-ticket-topline">
          <span>{content.venue || 'THE EPHEMERA THEATRE'}</span>
          <span>{content.ticketNo || 'NO. 0017'}</span>
        </header>

        <div className="ep-ticket-rule" />

        <h3 className="ep-ticket-title">{content.ticketTitle || item?.title || '未命名时光'}</h3>

        <p className="ep-ticket-subtitle">
          {content.subtitle || 'A QUIET NIGHT, HELD TOGETHER'}
        </p>

        <p className="ep-ticket-description">
          {content.description || '在这里记录共同经历的那一刻。'}
        </p>

        <footer className="ep-ticket-meta">
          <div>
            <span>WITH</span>
            <strong>{content.withName || characterName}</strong>
          </div>

          <div>
            <span>DATE</span>
            <strong>{content.dateText || fallbackDate}</strong>
          </div>

          <div>
            <span>SESSION</span>
            <strong>{content.session || '23:17 — 04:08'}</strong>
          </div>
        </footer>
      </section>

      <aside className="ep-ticket-stub">
        <span className="ep-ticket-admit">{content.admitText || 'ADMIT ONE'}</span>

        <div>
          <strong className="ep-ticket-seat">{content.seat || 'R.04\nS.24'}</strong>
          <p>{content.stubDetail || 'NIGHT\nSESSION\nARCHIVE'}</p>
        </div>

        <Barcode />
      </aside>
    </article>
  );
};

export default EphemeraPreview;
