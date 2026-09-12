import React from 'react';

const phaseConfig = {
  store_list: { label: '附近门店', tone: 'warm' },
  order_created: { label: '待支付', tone: 'danger' },
  cooking: { label: '制作中', tone: 'warm' },
  ready: { label: '可取餐', tone: 'success' },
  completed: { label: '已完成', tone: 'muted' },
  cancelled: { label: '已取消', tone: 'muted' },
};

function Icon({ name, className = '' }) {
  const paths = {
    pin: (
      <>
        <path d="M20 10.5c0 5.2-8 10.5-8 10.5S4 15.7 4 10.5a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10.5" r="2.3" />
      </>
    ),
    arrow: <path d="M5 12h13M13 6l6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.2 2" />
      </>
    ),
    check: <path d="m5 12.5 4.2 4.2L19 7" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg
      className={`mcd-icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function McdonaldsMark() {
  return (
    <svg className="mcd-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M8 24c.7-9.2 2.3-16 4.6-16 2.2 0 2.7 7 3.2 16M16 22.6C16.8 13.7 18.2 8 20.1 8c2 0 3.1 7 3.9 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

function StatusBadge({ phase }) {
  const current = phaseConfig[phase] || {
    label: '麦当劳',
    tone: 'muted',
  };

  return (
    <span className={`mcd-status ${current.tone}`}>
      {current.label}
    </span>
  );
}

function StoreList({ stores = [] }) {
  return (
    <section className="mcd-section">
      <div className="mcd-section-label">选择取餐门店</div>

      <div className="mcd-store-list">
        {stores.map((store, index) => (
          <div
            className={`mcd-store-row ${index === 0 ? 'selected' : ''}`}
            key={`${store.name}-${index}`}
          >
            <div className="mcd-store-info">
              <p className="mcd-store-title">{store.name}</p>

              {store.address && (
                <div className="mcd-store-address">
                  <Icon name="pin" className="small" />
                  <span>{store.address}</span>
                </div>
              )}
            </div>

            <div className="mcd-store-meta">
              <span>{store.distance || store.status || ''}</span>
              <Icon name="chevron" className="small mcd-store-arrow" />
            </div>
          </div>
        ))}
      </div>

      {stores[0] && (
        <div className="mcd-selection-confirm">
          <span>当前取餐门店</span>
          <strong>{stores[0].name}</strong>
        </div>
      )}
    </section>
  );
}

function Receipt({ card }) {
  const items = card.items || [];
  const total =
    typeof card.total === 'number'
      ? card.total.toFixed(2)
      : card.total || '-';

  return (
    <section className="mcd-receipt-scene">
      <div className="mcd-printer">
        <span className="mcd-printer-light" />
        <span className="mcd-printer-slot" />
      </div>

      <div className="mcd-receipt-wrap">
        <div className="mcd-receipt">
          <div className="mcd-receipt-head">
            <strong>McDonald's</strong>
            <span>餐饮消费小票</span>
          </div>

          <div className="mcd-receipt-rule dotted" />

          <div className="mcd-receipt-info">
            <span>订单号</span>
            <span>{card.orderNo || '生成中'}</span>

            <span>取餐方式</span>
            <span>到店取餐</span>

            <span>门店</span>
            <span>{card.storeName || '麦当劳'}</span>
          </div>

          <div className="mcd-receipt-rule" />

          <div className="mcd-receipt-items-title">
            <span>商品</span>
            <span>金额</span>
          </div>

          {items.length > 0 ? (
            items.map((item, index) => {
              const price =
                typeof item.price === 'number'
                  ? item.price.toFixed(2)
                  : item.price || '-';

              return (
                <div
                  className="mcd-receipt-line"
                  key={`${item.name}-${index}`}
                >
                  <span>
                    {item.name} <em>×{item.qty || 1}</em>
                  </span>
                  <span>{price}</span>
                </div>
              );
            })
          ) : (
            <div className="mcd-receipt-empty">暂无商品信息</div>
          )}

          <div className="mcd-receipt-total">
            <span>应付合计</span>
            <strong>¥{total}</strong>
          </div>

          <div className="mcd-receipt-barcode" />

          <div className="mcd-barcode-number">
            {card.orderNo || 'MCD-ORDER'}
          </div>

          <div className="mcd-receipt-foot">
            请完成支付后凭订单号取餐
          </div>
        </div>
      </div>

      {card.payUrl && (
        <a
          className="mcd-pay-button"
          href={card.payUrl}
          target="_blank"
          rel="noreferrer"
        >
          前往支付
          <Icon name="arrow" className="small" />
        </a>
      )}
    </section>
  );
}

function BurgerAnimation() {
  return (
    <div className="mcd-kitchen-illustration" aria-hidden="true">
      <div className="mcd-steam">
        <i />
        <i />
        <i />
      </div>

      <div className="mcd-burger">
        <div className="mcd-burger-top" />
        <div className="mcd-burger-cheese" />
        <div className="mcd-burger-patty" />
        <div className="mcd-burger-bottom" />
      </div>

      <div className="mcd-kitchen-counter" />
    </div>
  );
}

function Cooking({ card }) {
  return (
    <section className="mcd-cooking-scene">
      <div className="mcd-cooking-glow" />

      <BurgerAnimation />

      <h2>厨房正在为你备餐</h2>
      <p className="mcd-cooking-copy">
        餐品制作完成后，我们会提醒你取餐
      </p>

      <div className="mcd-progress">
        <div className="done">
          <i />
          <span>已下单</span>
        </div>
        <div className="current">
          <i />
          <span>制作中</span>
        </div>
        <div>
          <i />
          <span>待取餐</span>
        </div>
      </div>

      <div className="mcd-cooking-bottom">
        <span>
          <Icon name="clock" className="small" />
          预计还需约 {card.etaMinutes || '-'} 分钟
        </span>

        {card.pickupCode && (
          <strong className="mcd-pickup-small">{card.pickupCode}</strong>
        )}
      </div>
    </section>
  );
}

function Ready({ card }) {
  const pickupCode = card.pickupCode || card.orderNo || '-';

  return (
    <section className="mcd-ready-scene">
      <span className="mcd-ready-orbit orbit-left" />
      <span className="mcd-ready-orbit orbit-right" />

      <div className="mcd-ready-lamp">
        <span>READY</span>
      </div>

      <div className="mcd-ready-store">
        {card.storeName || '麦当劳'}
      </div>

      <div className="mcd-ready-message">
        <Icon name="check" className="small" />
        餐品已备好，请到柜台取餐
      </div>

      <div className="mcd-ready-code">{pickupCode}</div>

      <div className="mcd-ready-hint">
        请留意柜台屏幕或向工作人员出示取餐号
      </div>

      <div className="mcd-ready-rule" />

      <div className="mcd-ready-order">
        <span>ORDER NO.</span>
        <span>{card.orderNo || '-'}</span>
      </div>
    </section>
  );
}

function Cancelled() {
  return (
    <section className="mcd-cancelled">
      <div className="mcd-cancelled-icon">
        <Icon name="close" />
      </div>

      <h2>订单已取消</h2>
      <p>该订单已关闭，无法继续支付或取餐</p>
    </section>
  );
}

export default function McdOrderCard({ card }) {
  if (!card || card.kind !== 'mcd') return null;

  const { phase } = card;

  return (
    <>
      <style>{`
        .mcd-card,
        .mcd-card * {
          box-sizing: border-box;
        }

        .mcd-card {
          --mcd-ink: #282522;
          --mcd-muted: #918b83;
          --mcd-faint: #bbb4aa;
          --mcd-card: rgba(255, 253, 248, .86);
          --mcd-surface: rgba(246, 241, 233, .76);
          --mcd-surface-solid: #f6f0e7;
          --mcd-line: rgba(53, 44, 33, .1);
          --mcd-yellow: #ffbc0d;
          --mcd-yellow-dark: #d99200;
          --mcd-red: #c91524;
          --mcd-red-dark: #9e101b;
          --mcd-green: #168363;

          position: relative;
          width: min(100%, 360px);
          margin: 10px 0;
          padding: 20px;
          overflow: hidden;
          isolation: isolate;
          color: var(--mcd-ink);
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, .42),
              transparent 38%
            ),
            var(--mcd-card);
          border: 1px solid var(--mcd-line);
          border-radius: 28px;
          box-shadow:
            0 35px 80px rgba(60, 48, 33, .14),
            0 8px 22px rgba(60, 48, 33, .08),
            inset 0 1px 0 rgba(255, 255, 255, .9);
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "SF Pro Display",
            "Segoe UI",
            "PingFang SC",
            "Microsoft YaHei",
            sans-serif;
          backdrop-filter: blur(25px) saturate(1.1);
          -webkit-backdrop-filter: blur(25px) saturate(1.1);
        }

        .mcd-card::before {
          position: absolute;
          z-index: -2;
          inset: 0;
          opacity: .18;
          pointer-events: none;
          content: "";
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.3'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }

        .mcd-card::after {
          position: absolute;
          z-index: -1;
          top: -130px;
          right: -100px;
          width: 260px;
          height: 260px;
          content: "";
          background: rgba(255, 188, 13, .12);
          border-radius: 50%;
          filter: blur(48px);
          pointer-events: none;
        }

        .mcd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 23px;
        }

        .mcd-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .mcd-brand-mark {
          display: grid;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          place-items: center;
          color: var(--mcd-red);
          background: var(--mcd-yellow);
          border-radius: 12px;
          box-shadow:
            0 6px 14px rgba(217, 146, 0, .22),
            inset 0 1px 0 rgba(255, 255, 255, .5);
        }

        .mcd-mark {
          width: 25px;
          height: 25px;
        }

        .mcd-brand-copy {
          min-width: 0;
        }

        .mcd-brand-name {
          overflow: hidden;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -.02em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mcd-brand-subtitle {
          margin-top: 3px;
          color: var(--mcd-muted);
          font-size: 10px;
        }

        .mcd-status {
          flex: 0 0 auto;
          padding: 6px 9px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .mcd-status.warm {
          color: #9a6700;
          background: rgba(255, 188, 13, .14);
          border-color: rgba(255, 188, 13, .2);
        }

        .mcd-status.danger {
          color: var(--mcd-red);
          background: rgba(201, 21, 36, .075);
          border-color: rgba(201, 21, 36, .11);
        }

        .mcd-status.success {
          color: var(--mcd-green);
          background: rgba(22, 131, 99, .1);
          border-color: rgba(22, 131, 99, .15);
        }

        .mcd-status.muted {
          color: var(--mcd-muted);
          background: var(--mcd-surface);
          border-color: var(--mcd-line);
        }

        .mcd-section-label {
          margin-bottom: 9px;
          color: var(--mcd-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .mcd-store-list {
          display: grid;
          gap: 4px;
        }

        .mcd-store-row {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          overflow: hidden;
          padding: 15px 4px;
          border-bottom: 1px solid var(--mcd-line);
          transition:
            padding .25s ease,
            background .25s ease,
            transform .2s ease;
        }

        .mcd-store-row:last-child {
          border-bottom: 0;
        }

        .mcd-store-row:hover,
        .mcd-store-row.selected {
          padding-right: 9px;
          padding-left: 9px;
          background: rgba(255, 188, 13, .1);
          border-radius: 13px;
        }

        .mcd-store-row:active {
          transform: scale(.985);
        }

        .mcd-store-row.selected::before {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 3px;
          content: "";
          background: var(--mcd-yellow);
          border-radius: 4px;
        }

        .mcd-store-info {
          min-width: 0;
        }

        .mcd-store-title {
          margin: 0 0 5px;
          font-size: 13px;
          font-weight: 800;
        }

        .mcd-store-address {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: hidden;
          max-width: 235px;
          color: var(--mcd-muted);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mcd-store-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          flex: 0 0 auto;
          color: var(--mcd-red);
          font-family: ui-monospace, Consolas, monospace;
          font-size: 10px;
          font-weight: 800;
        }

        .mcd-store-arrow {
          opacity: .45;
          transition: transform .2s ease;
        }

        .mcd-store-row:hover .mcd-store-arrow,
        .mcd-store-row.selected .mcd-store-arrow {
          transform: translateX(3px);
        }

        .mcd-selection-confirm {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          padding: 11px 13px;
          color: #8e6300;
          background: rgba(255, 188, 13, .14);
          border-radius: 13px;
          font-size: 10px;
        }

        .mcd-selection-confirm strong {
          overflow: hidden;
          max-width: 180px;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mcd-icon {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
          fill: none;
          stroke: currentColor;
          strokeLinecap: round;
          strokeLinejoin: round;
          strokeWidth: 1.7;
          vertical-align: middle;
        }

        .mcd-icon.small {
          width: 13px;
          height: 13px;
        }

        .mcd-receipt-scene {
          padding-top: 3px;
          text-align: center;
        }

        .mcd-printer {
          position: relative;
          z-index: 2;
          width: 190px;
          height: 40px;
          margin: 0 auto;
          background: #242321;
          border: 1px solid #111;
          border-radius: 5px 5px 2px 2px;
          box-shadow: 0 8px 14px rgba(0, 0, 0, .22);
        }

        .mcd-printer-light {
          position: absolute;
          top: 10px;
          left: 14px;
          width: 7px;
          height: 7px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 14px 0 #777;
        }

        .mcd-printer-slot {
          position: absolute;
          right: 12px;
          bottom: 8px;
          left: 46px;
          height: 7px;
          background: #000;
          border: 1px solid #555;
          border-radius: 1px;
          box-shadow: inset 0 1px 3px #000;
        }

        .mcd-receipt-wrap {
          position: relative;
          z-index: 1;
          width: calc(100% - 24px);
          max-width: 274px;
          margin: -1px auto 0;
        }

        .mcd-receipt {
          position: relative;
          padding: 22px 18px 28px;
          overflow: hidden;
          color: #111;
          background: #fff;
          border: 1px solid #111;
          border-top: 0;
          filter: drop-shadow(0 10px 10px rgba(0, 0, 0, .18));
          font-family:
            "Courier New",
            "Noto Sans Mono CJK SC",
            "Microsoft YaHei",
            monospace;
          text-align: left;
        }

        .mcd-receipt::before {
          position: absolute;
          inset: 0;
          opacity: .06;
          content: "";
          background: repeating-linear-gradient(
            0deg,
            #000 0 1px,
            transparent 1px 4px
          );
          pointer-events: none;
        }

        .mcd-receipt::after {
          position: absolute;
          right: -1px;
          bottom: -1px;
          left: -1px;
          height: 9px;
          content: "";
          background:
            linear-gradient(
              135deg,
              transparent 0 5px,
              #111 5px 6px,
              transparent 6px 11px
            ) 0 0 / 12px 10px repeat-x;
        }

        .mcd-receipt-head {
          position: relative;
          text-align: center;
        }

        .mcd-receipt-head strong {
          display: block;
          font-size: 19px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .mcd-receipt-head span {
          display: block;
          margin-top: 6px;
          font-size: 9px;
          letter-spacing: .08em;
        }

        .mcd-receipt-rule {
          position: relative;
          height: 1px;
          margin: 12px 0 10px;
          background: #111;
        }

        .mcd-receipt-rule.dotted {
          background: repeating-linear-gradient(
            to right,
            #111 0 5px,
            transparent 5px 8px
          );
        }

        .mcd-receipt-info {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 5px 12px;
          margin: 8px 0;
          font-size: 9px;
          line-height: 1.45;
        }

        .mcd-receipt-info span:nth-child(even) {
          max-width: 135px;
          overflow: hidden;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mcd-receipt-items-title,
        .mcd-receipt-line,
        .mcd-receipt-total {
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .mcd-receipt-items-title {
          margin: 10px 0 7px;
          font-size: 9px;
          font-weight: 900;
        }

        .mcd-receipt-line {
          margin: 7px 0;
          font-size: 10px;
          line-height: 1.35;
        }

        .mcd-receipt-line span:first-child {
          min-width: 0;
        }

        .mcd-receipt-line span:last-child {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .mcd-receipt-line em {
          font-style: normal;
          opacity: .65;
        }

        .mcd-receipt-empty {
          position: relative;
          padding: 9px 0;
          color: #777;
          font-size: 10px;
          text-align: center;
        }

        .mcd-receipt-total {
          margin-top: 13px;
          padding-top: 10px;
          border-top: 1px dashed #111;
          font-size: 14px;
          font-weight: 900;
        }

        .mcd-receipt-total strong {
          font-size: 16px;
        }

        .mcd-receipt-barcode {
          position: relative;
          width: 166px;
          height: 34px;
          margin: 18px auto 8px;
          background:
            repeating-linear-gradient(
              90deg,
              #000 0 2px,
              transparent 2px 4px,
              #000 4px 5px,
              transparent 5px 8px,
              #000 8px 11px,
              transparent 11px 13px
            );
        }

        .mcd-barcode-number {
          position: relative;
          color: #111;
          font-size: 8px;
          letter-spacing: .2em;
          text-align: center;
        }

        .mcd-receipt-foot {
          position: relative;
          margin-top: 13px;
          color: #111;
          font-size: 8px;
          line-height: 1.6;
          text-align: center;
        }

        .mcd-pay-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          margin-top: 14px;
          padding: 12px 14px;
          color: #fff;
          background: var(--mcd-red);
          border-radius: 13px;
          box-shadow: 0 8px 18px rgba(201, 21, 36, .2);
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          transition: transform .2s ease, background .2s ease;
        }

        .mcd-pay-button:hover {
          background: var(--mcd-red-dark);
          transform: translateY(-2px);
        }

        .mcd-pay-button:active {
          transform: scale(.98);
        }

        .mcd-cooking-scene,
        .mcd-ready-scene,
        .mcd-cancelled {
          position: relative;
          overflow: hidden;
          border-radius: 21px;
        }

        .mcd-cooking-scene {
          min-height: 300px;
          padding: 22px 17px 18px;
          background:
            radial-gradient(
              circle at 50% 96%,
              rgba(255, 188, 13, .2),
              transparent 50%
            ),
            var(--mcd-surface);
          text-align: center;
        }

        .mcd-cooking-glow {
          position: absolute;
          top: -58px;
          left: 50%;
          width: 190px;
          height: 190px;
          background: rgba(255, 188, 13, .15);
          border-radius: 50%;
          filter: blur(30px);
          transform: translateX(-50%);
          animation: mcd-glow-breathe 3.5s ease-in-out infinite;
        }

        .mcd-kitchen-illustration {
          position: relative;
          width: 176px;
          height: 102px;
          margin: 7px auto 16px;
        }

        .mcd-kitchen-counter {
          position: absolute;
          bottom: 10px;
          left: 5px;
          width: 166px;
          height: 20px;
          background: linear-gradient(#e0a42c, #b87113);
          border-radius: 4px;
          box-shadow: 0 10px 15px rgba(121, 76, 8, .2);
        }

        .mcd-burger {
          position: absolute;
          bottom: 29px;
          left: 56px;
          width: 66px;
          height: 43px;
          animation: mcd-burger-float 2.4s ease-in-out infinite;
        }

        .mcd-burger-top {
          position: absolute;
          top: 0;
          left: 4px;
          width: 58px;
          height: 22px;
          background: #d58125;
          border-radius: 32px 32px 9px 9px;
          box-shadow: inset 0 -5px rgba(120, 56, 10, .18);
        }

        .mcd-burger-top::before {
          position: absolute;
          top: 6px;
          left: 15px;
          width: 4px;
          height: 2px;
          content: "";
          background: #f6cf76;
          border-radius: 3px;
          box-shadow:
            13px 4px #f6cf76,
            25px -1px #f6cf76;
        }

        .mcd-burger-cheese {
          position: absolute;
          top: 22px;
          left: 1px;
          width: 64px;
          height: 6px;
          background: var(--mcd-yellow);
          clip-path: polygon(
            0 0,
            100% 0,
            92% 100%,
            72% 55%,
            54% 100%,
            33% 58%,
            14% 100%
          );
        }

        .mcd-burger-patty {
          position: absolute;
          bottom: 5px;
          left: 4px;
          width: 58px;
          height: 13px;
          background: #59321e;
          border-radius: 5px;
          box-shadow: 0 4px rgba(73, 38, 20, .23);
        }

        .mcd-burger-bottom {
          position: absolute;
          bottom: 0;
          left: 4px;
          width: 58px;
          height: 8px;
          background: #ce7925;
          border-radius: 3px 3px 12px 12px;
        }

        .mcd-steam {
          position: absolute;
          bottom: 79px;
          left: 68px;
          width: 38px;
          height: 39px;
        }

        .mcd-steam i {
          position: absolute;
          bottom: 0;
          width: 7px;
          height: 31px;
          border-left: 2px solid rgba(255, 255, 255, .7);
          border-radius: 50%;
          filter: blur(1px);
          animation: mcd-steam-rise 2.7s ease-in-out infinite;
        }

        .mcd-steam i:nth-child(1) {
          left: 1px;
        }

        .mcd-steam i:nth-child(2) {
          left: 14px;
          height: 37px;
          animation-delay: -.8s;
        }

        .mcd-steam i:nth-child(3) {
          left: 28px;
          animation-delay: -1.5s;
        }

        .mcd-cooking-scene h2 {
          position: relative;
          margin: 0;
          font-size: 14px;
          font-weight: 850;
        }

        .mcd-cooking-copy {
          position: relative;
          margin: 7px 0 0;
          color: var(--mcd-muted);
          font-size: 10px;
        }

        .mcd-progress {
          position: relative;
          display: flex;
          justify-content: space-between;
          margin: 26px 6px 0;
        }

        .mcd-progress::before {
          position: absolute;
          top: 5px;
          right: 7px;
          left: 7px;
          height: 2px;
          content: "";
          background: linear-gradient(
            90deg,
            var(--mcd-yellow) 68%,
            var(--mcd-line) 68%
          );
        }

        .mcd-progress > div {
          position: relative;
          z-index: 1;
          color: var(--mcd-muted);
          font-size: 9px;
        }

        .mcd-progress i {
          display: block;
          width: 11px;
          height: 11px;
          margin: 0 auto 7px;
          background: var(--mcd-surface-solid);
          border: 2px solid var(--mcd-line);
          border-radius: 50%;
        }

        .mcd-progress .done,
        .mcd-progress .current {
          color: var(--mcd-ink);
          font-weight: 700;
        }

        .mcd-progress .done i,
        .mcd-progress .current i {
          background: var(--mcd-yellow);
          border-color: var(--mcd-yellow);
          box-shadow: 0 0 0 4px rgba(255, 188, 13, .13);
        }

        .mcd-progress .current i {
          animation: mcd-dot-pulse 1.6s infinite;
        }

        .mcd-cooking-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 23px;
          color: var(--mcd-muted);
          font-size: 10px;
        }

        .mcd-cooking-bottom span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .mcd-pickup-small {
          color: var(--mcd-yellow-dark);
          font-family: ui-monospace, Consolas, monospace;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .mcd-ready-scene {
          min-height: 314px;
          padding: 25px 16px 20px;
          background:
            radial-gradient(
              circle at 50% 20%,
              rgba(255, 188, 13, .24),
              transparent 46%
            ),
            linear-gradient(
              145deg,
              rgba(201, 21, 36, .08),
              transparent 55%
            ),
            var(--mcd-surface);
          text-align: center;
        }

        .mcd-ready-orbit {
          position: absolute;
          width: 66px;
          height: 66px;
          border: 1px solid rgba(255, 188, 13, .34);
          border-radius: 50%;
          animation: mcd-orbit 7s linear infinite;
        }

        .mcd-ready-orbit.orbit-left {
          top: 23px;
          left: -35px;
        }

        .mcd-ready-orbit.orbit-right {
          right: -35px;
          bottom: 37px;
          animation-direction: reverse;
        }

        .mcd-ready-lamp {
          position: relative;
          display: grid;
          width: 76px;
          height: 32px;
          margin: 3px auto 18px;
          place-items: center;
          background: var(--mcd-yellow);
          border-radius: 7px;
          box-shadow:
            0 0 0 6px rgba(255, 188, 13, .1),
            0 0 33px rgba(255, 188, 13, .4);
          animation: mcd-lamp-pulse 2.4s ease-in-out infinite;
        }

        .mcd-ready-lamp::before {
          position: absolute;
          top: -8px;
          left: 50%;
          width: 2px;
          height: 8px;
          content: "";
          background: var(--mcd-yellow-dark);
          transform: translateX(-50%);
        }

        .mcd-ready-lamp span {
          color: var(--mcd-red);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .1em;
        }

        .mcd-ready-store {
          position: relative;
          color: var(--mcd-muted);
          font-size: 11px;
          font-weight: 700;
        }

        .mcd-ready-message {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-top: 6px;
          color: var(--mcd-green);
          font-size: 11px;
          font-weight: 850;
        }

        .mcd-ready-code {
          position: relative;
          margin: 18px 0 13px;
          color: var(--mcd-red);
          font-family: ui-monospace, Consolas, monospace;
          font-size: clamp(48px, 18vw, 64px);
          font-weight: 950;
          letter-spacing: .12em;
          line-height: .9;
          text-shadow:
            2px 2px 0 rgba(201, 21, 36, .14),
            0 9px 26px rgba(201, 21, 36, .2);
          animation: mcd-code-breathe 2.4s ease-in-out infinite;
        }

        .mcd-ready-hint {
          position: relative;
          color: var(--mcd-muted);
          font-size: 10px;
        }

        .mcd-ready-rule {
          position: relative;
          height: 1px;
          margin: 20px 0 13px;
          background: repeating-linear-gradient(
            to right,
            var(--mcd-line) 0 5px,
            transparent 5px 9px
          );
        }

        .mcd-ready-order {
          position: relative;
          display: flex;
          justify-content: space-between;
          color: var(--mcd-faint);
          font-family: ui-monospace, Consolas, monospace;
          font-size: 9px;
        }

        .mcd-cancelled {
          padding: 34px 18px;
          color: var(--mcd-muted);
          background: var(--mcd-surface);
          text-align: center;
        }

        .mcd-cancelled-icon {
          display: grid;
          width: 42px;
          height: 42px;
          margin: 0 auto 13px;
          place-items: center;
          border: 1px solid var(--mcd-line);
          border-radius: 50%;
        }

        .mcd-cancelled h2 {
          margin: 0;
          color: var(--mcd-ink);
          font-size: 13px;
          font-weight: 800;
        }

        .mcd-cancelled p {
          margin: 7px 0 0;
          font-size: 10px;
        }

        @keyframes mcd-glow-breathe {
          0%, 100% {
            opacity: .5;
            transform: translateX(-50%) scale(.85);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scale(1.12);
          }
        }

        @keyframes mcd-burger-float {
          0%, 100% {
            transform: translateY(1px) rotate(-1deg);
          }
          50% {
            transform: translateY(-6px) rotate(1deg);
          }
        }

        @keyframes mcd-steam-rise {
          0% {
            opacity: 0;
            transform: translateY(12px) rotate(8deg);
          }
          35%, 65% {
            opacity: .75;
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) rotate(-10deg);
          }
        }

        @keyframes mcd-dot-pulse {
          50% {
            box-shadow: 0 0 0 8px rgba(255, 188, 13, .03);
          }
        }

        @keyframes mcd-orbit {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes mcd-lamp-pulse {
          50% {
            box-shadow:
              0 0 0 9px rgba(255, 188, 13, .07),
              0 0 44px rgba(255, 188, 13, .54);
          }
        }

        @keyframes mcd-code-breathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.045);
          }
        }

        @media (prefers-color-scheme: dark) {
          .mcd-card {
            --mcd-ink: #f5f1e9;
            --mcd-muted: #aaa39b;
            --mcd-faint: #716b63;
            --mcd-card: rgba(38, 37, 34, .86);
            --mcd-surface: rgba(53, 49, 43, .78);
            --mcd-surface-solid: #34312c;
            --mcd-line: rgba(255, 255, 255, .09);

            box-shadow:
              0 35px 80px rgba(0, 0, 0, .38),
              0 8px 22px rgba(0, 0, 0, .24),
              inset 0 1px 0 rgba(255, 255, 255, .06);
          }
        }

        .dark .mcd-card {
          --mcd-ink: #f5f1e9;
          --mcd-muted: #aaa39b;
          --mcd-faint: #716b63;
          --mcd-card: rgba(38, 37, 34, .86);
          --mcd-surface: rgba(53, 49, 43, .78);
          --mcd-surface-solid: #34312c;
          --mcd-line: rgba(255, 255, 255, .09);

          box-shadow:
            0 35px 80px rgba(0, 0, 0, .38),
            0 8px 22px rgba(0, 0, 0, .24),
            inset 0 1px 0 rgba(255, 255, 255, .06);
        }

        @media (prefers-reduced-motion: reduce) {
          .mcd-card *,
          .mcd-card *::before,
          .mcd-card *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }

        @media (max-width: 390px) {
          .mcd-card {
            padding: 17px;
            border-radius: 24px;
          }
        }
      `}</style>

      <article className="mcd-card">
        <header className="mcd-header">
          <div className="mcd-brand">
            <div className="mcd-brand-mark">
              <McdonaldsMark />
            </div>

            <div className="mcd-brand-copy">
              <div className="mcd-brand-name">
                {card.storeName || '麦当劳'}
              </div>
              <div className="mcd-brand-subtitle">麦当劳到店取餐</div>
            </div>
          </div>

          <StatusBadge phase={phase} />
        </header>

        {phase === 'store_list' && (
          <StoreList stores={card.stores || []} />
        )}

        {phase === 'order_created' && <Receipt card={card} />}

        {phase === 'cooking' && <Cooking card={card} />}

        {phase === 'ready' && <Ready card={card} />}

        {(phase === 'cancelled' || phase === 'completed') && (
          <Cancelled />
        )}
      </article>
    </>
  );
}

