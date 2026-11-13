// src/apps/messages/toys/ToyPlayer.jsx
//
// 全屏试玩弹层：顶栏（关闭 / 标题和作者 / 玩法 / 更多）+ 沙箱 iframe + 底部说明。
// 渲染到 document.body（portal），不受聊天室里 transform / overflow 的影响。
// 代码在这里才从 db.chatToys 读出来；iframe 的沙箱规则见 toySandbox.js。

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ListChecks, MoreHorizontal, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import { buildToyDocument } from './toySandbox';
import { recordToyPlay } from './toyCollectionService';
import { deleteToy, getToy } from './toyService';
import './toys.css';

const ToyPlayer = ({ message, characterName = '对方', onClose }) => {
  const metadata = message?.metadata || {};

  const [toy, setToy] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | missing
  const [runKey, setRunKey] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getToy(metadata.toyId)
      .then((row) => {
        if (cancelled) return;
        setToy(row);
        setLoadState(row ? 'ready' : 'missing');
                // 记一次玩过（收藏页用）。失败不影响试玩。
        if (row) recordToyPlay(row.id).catch((error) => console.warn('记录玩过次数失败：', error));
      })
      .catch((error) => {
        console.warn('读取小玩具失败：', error);
        if (!cancelled) setLoadState('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [metadata.toyId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const srcDoc = useMemo(() => (toy?.html ? buildToyDocument(toy.html) : ''), [toy]);

  const toggleRules = () => {
    setMenuOpen(false);
    setRulesOpen((value) => !value);
  };

  const toggleMenu = () => {
    setRulesOpen(false);
    setMenuOpen((value) => !value);
  };

  const handleRestart = () => {
    setMenuOpen(false);
    setRunKey((value) => value + 1);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);

    try {
      await deleteToy(message);
    } catch (error) {
      console.warn('删除小玩具失败：', error);
    }

    onClose?.();
  };

  const title = toy?.title || metadata.title || '小玩具';
  const rules = toy?.rules || metadata.rules || '';

  return createPortal(
    <div className="toy-player" role="dialog" aria-modal="true" aria-label={title}>
      <div className="toy-player__top">
        <button type="button" className="toy-player__icon" aria-label="关闭" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>

        <div className="toy-player__titles">
          <b>{title}</b>
          <span>由 {characterName} 制作</span>
        </div>

        <button
          type="button"
          className={`toy-player__icon${rulesOpen ? ' toy-player__icon--on' : ''}`}
          aria-label="玩法"
          onClick={toggleRules}
        >
          <ListChecks className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`toy-player__icon${menuOpen ? ' toy-player__icon--on' : ''}`}
          aria-label="更多"
          onClick={toggleMenu}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="toy-player__stage">
        <div className="toy-player__frame">
          {loadState === 'ready' && (
            <iframe
              key={runKey}
              title={title}
              sandbox="allow-scripts"
              srcDoc={srcDoc}
            />
          )}
          {loadState === 'loading' && <div className="toy-player__message">正在打开……</div>}
          {loadState === 'missing' && (
            <div className="toy-player__message">这个小玩具的内容找不到了，可能已经被清理。</div>
          )}
        </div>
      </div>

      <div className="toy-player__foot">
        <ShieldCheck className="h-3.5 w-3.5" />
        在隔离环境中运行，无法读取你的聊天和设置
      </div>

      {menuOpen && (
        <div className="toy-player__menu">
          <button type="button" className="toy-player__menu-item" onClick={handleRestart}>
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <button
            type="button"
            className="toy-player__menu-item toy-player__menu-item--danger"
            onClick={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除这个玩具
          </button>
        </div>
      )}

      <div className={`toy-player__sheet${rulesOpen ? ' toy-player__sheet--open' : ''}`}>
        <div className="toy-player__grab" />
        <div className="toy-card__kicker">How to play</div>
        <h4>玩法</h4>
        <p>{rules || '这个小玩具没有写玩法说明。'}</p>
        <div className="toy-ask__actions">
          <button
            type="button"
            className="toy-ask__button toy-ask__button--primary"
            onClick={() => setRulesOpen(false)}
          >
            知道了
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        title="删除这个小玩具？"
        message="删除后它的内容会被清除，聊天里的卡片会变成“已删除”。此操作无法撤销。"
        confirmText="删除"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>,
    document.body,
  );
};

export default ToyPlayer;
