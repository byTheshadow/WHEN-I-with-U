// src/apps/messages/secretCode/SecretCodeStatsStrip.jsx
//
// 词典页顶部的汇总条（切片D）：一张小纸条，三件事——
//   1. 角色用了几次暗号、你用了几次（分开记，只统计开启统计之后的聊天）
//   2. 每次聊天因为带着词典，大约多花多少 token（只算开销，不跟"节省"相减）
//   3. 省着带开关：打开后提示词里只放你这一轮用到的暗号
// 所有 token 数字都是按字符折算的估算，界面里一律写明"估算"。
import React, { useEffect, useMemo, useState } from 'react';
import './secretCode.css';
import './secretCodeStats.css';
import {
  getSecretCodeLightInjection,
  setSecretCodeLightInjection,
} from './secretCodeService';
import { buildSecretCodePromptParts } from './secretCodePrompt';
import { estimateTokens } from './secretCodeTokenEstimate';

const TOP_COUNT = 3;

export const SecretCodeStatsStrip = ({
  characterId,
  characterName,
  entries,
  folders,
  proposalEnabled,
  onUpdated,
  showToast,
}) => {
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSecretCodeLightInjection(characterId)
      .then((value) => {
        if (!cancelled) setLightMode(value);
      })
      .catch((error) => {
        console.warn('[SecretCodeStatsStrip] 读取省着带开关失败：', error);
      });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const stats = useMemo(() => {
    let role = 0;
    let user = 0;
    let all = 0;
    entries.forEach((entry) => {
      role += entry.roleUseCount || 0;
      user += entry.userUseCount || 0;
      all += entry.useCount || 0;
    });
    const top = entries
      .filter((entry) => (entry.useCount || 0) > 0)
      .slice()
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, TOP_COUNT);
    return { role, user, legacy: Math.max(0, all - role - user), top };
  }, [entries]);

  // 平时一轮（用户没用到任何暗号时）提示词里多出来的部分
  const overhead = useMemo(() => {
    const parts = buildSecretCodePromptParts(
      {
        secretCodes: entries,
        secretCodeFolders: folders,
        secretCodeProposalEnabled: proposalEnabled,
        secretCodeLightInjection: lightMode,
      },
      { pendingProposalCount: 0, userText: '' }
    );
    const dictionary = estimateTokens(parts.dictionaryBlock);
    const proposal = estimateTokens(parts.proposalBlock);
    return { dictionary, proposal, total: dictionary + proposal };
  }, [entries, folders, proposalEnabled, lightMode]);

  if (!entries || entries.length === 0) return null;

  const toggleLight = async () => {
    const next = !lightMode;
    setLightMode(next);
    try {
      await setSecretCodeLightInjection(characterId, next);
      if (onUpdated) onUpdated({ secretCodeLightInjection: next });
      if (showToast) {
        showToast(
          next
            ? '省着带已打开，只会带上你这一轮用到的暗号。'
            : '省着带已关闭，会重新带上最常用的几条暗号。'
        );
      }
    } catch (error) {
      console.warn('[SecretCodeStatsStrip] 保存省着带开关失败：', error);
      setLightMode(!next);
      if (showToast) showToast('没能保存，请稍后再试。');
    }
  };

  return (
    <section className="sc-stats sc-paper" aria-label="暗号用量与开销（估算）">
      <span className="sc-tlabel">// 用量 · 估算</span>

      <div className="sc-stats__row">
        <div className="sc-stats__cell">
          <b>{stats.role}</b>
          <small>{characterName}用了</small>
        </div>
        <div className="sc-stats__cell">
          <b>{stats.user}</b>
          <small>你用了</small>
        </div>
        <div className="sc-stats__cell">
          <b>约 {overhead.total}</b>
          <small>每次聊天多带的 token（估算）</small>
        </div>
      </div>

      {stats.top.length > 0 && (
        <p className="sc-stats__top">
          最常用：
          {stats.top.map((entry) => (
            <span key={entry.id} className="sc-stats__chip">
              {entry.code} x{entry.useCount}
            </span>
          ))}
        </p>
      )}

      <p className="sc-stats__note">
        词典约 {overhead.dictionary}
        {overhead.proposal > 0 ? `，提议说明约 ${overhead.proposal}` : ''}
        （都是估算，实际随模型分词会有出入）。每次发消息都会带上这些，不管这轮用没用到暗号；
        只有{characterName}真的拿暗号代替整句话时才少写几个字，所以它主要是氛围，不保证省 token。
        {stats.legacy > 0 ? ` 另有 ${stats.legacy} 次是更早记的，没有分角色。` : ''}
      </p>

      <div className="sc-switchrow sc-stats__switch">
        <span>
          <b>省着带</b>
          {lightMode
            ? `已打开：只带你这一轮用到的暗号，${characterName}不会主动用别的暗号。`
            : `打开后只带你这一轮用到的暗号，${characterName}只会回应你用到的，不再主动用。`}
        </span>
        <button
          type="button"
          className="sc-switch"
          role="switch"
          aria-checked={lightMode}
          aria-label="省着带"
          onClick={() => void toggleLight()}
        />
      </div>
    </section>
  );
};

export default SecretCodeStatsStrip;