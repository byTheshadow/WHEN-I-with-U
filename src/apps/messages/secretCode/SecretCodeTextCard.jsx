// src/apps/messages/secretCode/SecretCodeTextCard.jsx
//
// 文字气泡的"暗号版"渲染：在原来的 TextCard 上加两件事——
//   1. 把暗号画成斜体 + 荧光笔底色（只改背景，颜色取自它所在文件夹的颜色）；
//   2. 点一下暗号，在文字下面抽出一张撕下来的纸条：含义、文件夹名、用过几次。
// 另外负责"用量统计"：每条消息只算一次，攒一会儿再批量写库。
//
// 词典里没有暗号、或这条消息里一个也没命中时，行为和原来的 TextCard 完全一样。
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TextCard from '../components/cards/TextCard';
import './secretCode.css';
import { useSecretCodeDictionary } from './secretCodeDictionaryStore';
import {
  buildSecretCodeRegExp,
  countCodeUses,
  pickHighlightCodes,
} from './secretCodeMarks';
import { SC_CODE_TAG, createSecretCodeRemarkPlugin } from './secretCodeRemark';
import { getFolderColorVar } from './secretCodeFolderStyle';
import { ensureSecretCodeCountingSince, recordSecretCodeUses } from './secretCodeService';
import db from '../../../db';

// ---- 用量统计：模块级批量队列 ---------------------------------------------
const FLUSH_DELAY_MS = 1500;
const pendingUses = new Map(); // characterId -> { 暗号: 次数 }
let flushTimer = null;

const flushUses = () => {
  flushTimer = null;
  const jobs = Array.from(pendingUses.entries());
  pendingUses.clear();
  jobs.forEach(([characterId, totals]) => {
    recordSecretCodeUses(characterId, totals).catch((error) => {
      console.warn('[SecretCodeTextCard] 记录暗号用量失败：', error);
    });
  });
};

const queueUses = (characterId, totals) => {
  const bucket = pendingUses.get(characterId) || {};
  Object.entries(totals).forEach(([code, n]) => {
    bucket[code] = (bucket[code] || 0) + n;
  });
  pendingUses.set(characterId, bucket);
  if (flushTimer === null && typeof window !== 'undefined') {
    flushTimer = window.setTimeout(flushUses, FLUSH_DELAY_MS);
  }
};

const toMillis = (value) => {
  if (typeof value === 'number') return value;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export const SecretCodeTextCard = ({ msg, character }) => {
  const characterId = msg?.characterId ?? character?.id;
  const isUser = msg?.sender === 'user';
  const content = msg?.content || '';
  const markedCodes = msg?.metadata?.secretCodes;

  const book = useSecretCodeDictionary(characterId);
  const [openCode, setOpenCode] = useState('');

  const regexp = useMemo(
    () =>
      buildSecretCodeRegExp(
        pickHighlightCodes({ entries: book.entries, isUser, markedCodes })
      ),
    [book.entries, isUser, markedCodes]
  );

  const remarkPlugin = useMemo(() => createSecretCodeRemarkPlugin(regexp), [regexp]);

  const entryByCode = useMemo(() => {
    const map = new Map();
    book.entries.forEach((entry) => map.set(entry.code, entry));
    return map;
  }, [book.entries]);

  const folderById = useMemo(() => {
    const map = new Map();
    book.folders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [book.folders]);

  // ---- 用量统计：这条消息只算一次（metadata 里留标记） --------------------
  const alreadyCounted = Boolean(msg?.metadata?.secretCodeUsesCounted);
  useEffect(() => {
    if (!regexp || alreadyCounted || !characterId || !msg?.id) return undefined;
    let cancelled = false;

    const run = async () => {
      const totals = countCodeUses(content, regexp);
      if (Object.keys(totals).length === 0) return;

      const since = await ensureSecretCodeCountingSince(characterId);
      if (cancelled) return;
      if (toMillis(msg.timestamp || msg.createdAt) < toMillis(since)) return;

      // 先落标记再入队：标记没存上就宁可不算，也不重复算
      const latest = await db.messages.get(msg.id);
      if (cancelled || !latest || latest.metadata?.secretCodeUsesCounted) return;
      await db.messages.update(msg.id, {
        metadata: { ...(latest.metadata || {}), secretCodeUsesCounted: true },
      });
      queueUses(characterId, totals);
    };

    run().catch((error) => {
      console.warn('[SecretCodeTextCard] 统计暗号用量失败：', error);
    });
    return () => {
      cancelled = true;
    };
  }, [regexp, alreadyCounted, characterId, msg?.id, msg?.timestamp, msg?.createdAt, content]);

  // 点气泡以外的地方收起纸条
  useEffect(() => {
    if (!openCode) return undefined;
    const close = () => setOpenCode('');
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openCode]);

  const CodeMark = useCallback(
    ({ children }) => {
      const code = Array.isArray(children) ? children.join('') : String(children ?? '');
      const entry = entryByCode.get(code);
      const folder = entry ? folderById.get(entry.folderId) : null;
      const colorVar = folder ? getFolderColorVar(folder) : 'var(--accent-color)';

      return (
        <span
          role="button"
          tabIndex={0}
          className={`sc-code${isUser ? ' sc-code--me' : ''}${openCode === code ? ' sc-code--open' : ''}`}
          style={{ '--fc': colorVar }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setOpenCode((current) => (current === code ? '' : code));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpenCode((current) => (current === code ? '' : code));
            }
          }}
        >
          {children}
        </span>
      );
    },
    [entryByCode, folderById, isUser, openCode]
  );

  const openEntry = openCode ? entryByCode.get(openCode) : null;
  const openFolder = openEntry ? folderById.get(openEntry.folderId) : null;

  const extraComponents = useMemo(() => ({ [SC_CODE_TAG]: CodeMark }), [CodeMark]);
  const extraRemarkPlugins = useMemo(() => (remarkPlugin ? [remarkPlugin] : []), [remarkPlugin]);

  return (
    <div className="secret-code-scope sc-textwrap">
      <TextCard
        content={content}
        extraRemarkPlugins={extraRemarkPlugins}
        extraComponents={extraComponents}
      />
      {openEntry && (
        <div
          className={`sc-pull${isUser ? ' sc-pull--me' : ''}`}
          style={{ '--fc': getFolderColorVar(openFolder || {}) }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="sc-pull__code">{openEntry.code}</span>
          <span className="sc-pull__meaning">{openEntry.meaning}</span>
          <span className="sc-pull__meta">
            {openFolder?.name || '未分类'} · 用过 {openEntry.useCount || 0} 次
          </span>
        </div>
      )}
    </div>
  );
};

export default SecretCodeTextCard;