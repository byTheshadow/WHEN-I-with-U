// src/apps/messages/secretCode/SecretCodeHelpSheet.jsx
//
// 词典页右上角"?"打开的底部弹层：把原来堆在文件夹柜顶部的三样东西收到这里——
//   1. 悄悄话词典怎么用（说明）
//   2. 用量和开销（估算）+ "省着带"开关（SecretCodeStatsStrip）
//   3. 允许角色提议新暗号的开关
// 文件夹柜和文件夹内页共用同一个弹层，由 SecretCodeCabinet 持有开关状态。
import React from 'react';
import { X } from 'lucide-react';
import './secretCode.css';
import './secretCodeWall.css';
import { SECRET_CODE_LIMITS } from './secretCodeService';
import SecretCodeStatsStrip from './SecretCodeStatsStrip';

export const SecretCodeHelpSheet = ({
  characterId,
  characterName,
  entries,
  folders,
  proposalEnabled,
  leaving,
  onToggleProposal,
  onUpdated,
  showToast,
  onClose,
}) => (
  <div
    className="sw-sheet-host"
    onKeyDown={(e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }}
  >
    <div className={`sw-sheet-back${leaving ? ' is-out' : ''}`} onClick={onClose} />
    <div
      className={`sw-sheet sw-sheet--help${leaving ? ' is-out' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="悄悄话词典说明"
    >
      <div className="sw-sheet__grab" />
      <button type="button" className="sw-sheet__x" onClick={onClose} aria-label="关闭说明">
        <X />
      </button>

      <h3>悄悄话词典怎么用</h3>
      <p className="sw-help__lead">
        你和{characterName}之间的专属约定：给一句话起一个很短的暗号，
        {characterName}会在聊天里用它代替长句。只有你们俩懂，聊得越久越有默契。
      </p>

      <ol className="sc-steps">
        <li>
          <span className="sc-outline-num">01</span>
          <div>
            <b>约定</b>
            <span>
              {characterName}觉得合适时会提议一个新暗号，你点"收下"就会存到这里。你也可以自己做一张。
            </span>
          </div>
        </li>
        <li>
          <span className="sc-outline-num">02</span>
          <div>
            <b>使用</b>
            <span>聊天里出现的暗号带一道荧光笔底色，点一下就能看到含义。</span>
          </div>
        </li>
        <li>
          <span className="sc-outline-num">03</span>
          <div>
            <b>整理</b>
            <span>
              每个文件夹里的暗号会变成一堆有重量的方块，用得越多越大越重，满 9 次变镭射。点一张放进解码窗，按住可以拖。
            </span>
          </div>
        </li>
      </ol>

      <SecretCodeStatsStrip
        characterId={characterId}
        characterName={characterName}
        entries={entries}
        folders={folders}
        proposalEnabled={proposalEnabled}
        onUpdated={onUpdated}
        showToast={showToast}
      />

      <div className="sc-switchrow">
        <span>
          <b>允许{characterName}提议新暗号</b>
          关掉后不会再有提议卡片，已有的暗号照常能用。
        </span>
        <button
          type="button"
          className="sc-switch"
          role="switch"
          aria-checked={proposalEnabled}
          aria-label={`允许${characterName}提议新暗号`}
          onClick={onToggleProposal}
        />
      </div>

      <p className="sw-help__foot">
        暗号最多 {SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符 · 一本最多 {SECRET_CODE_LIMITS.MAX_ENTRIES} 条
      </p>
    </div>
  </div>
);

export default SecretCodeHelpSheet;