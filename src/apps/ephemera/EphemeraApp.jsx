// src/apps/ephemera/EphemeraApp.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  ArrowLeft,
  Download,
  Edit3,
  FileDown,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import EphemeraCastModal from './EphemeraCastModal';
import EphemeraPreview from './EphemeraPreview';
import ephemeraService from './ephemeraService';
import './ephemera.css';

const fileSafeName = (value) =>
  String(value || 'ephemera')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 40);

const downloadNodeAsPng = async (node, filename) => {
  if (!node) {
    throw new Error('未找到可导出的票券节点');
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const computedStyles = window.getComputedStyle(node);
  const backgroundColor =
    computedStyles.backgroundColor && computedStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? computedStyles.backgroundColor
      : getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim();

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor,
    style: {
      transform: 'none',
      boxShadow: 'none'
    }
  });

  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const TicketCard = ({
  item,
  characterName,
  onEdit,
  onDelete,
  onExport,
  exportError
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const frontRef = useRef(null);
  const backRef = useRef(null);

  const handleExport = async (event, side) => {
    event.stopPropagation();

    try {
      const target = side === 'back' ? backRef.current : frontRef.current;
      await onExport(target, item, side);
    } catch (error) {
      console.error('导出票券失败：', error);
      exportError('图片导出失败，请稍后再试。');
    }
  };

  return (
    <article className="ep-card-shell">
      <div
        className={`ep-flip-stage ${isFlipped ? 'is-flipped' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => setIsFlipped((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsFlipped((value) => !value);
          }
        }}
      >
        <div className="ep-flip-inner">
          <div className="ep-flip-face ep-flip-front">
            <div ref={frontRef} className="ep-export-node">
              <EphemeraPreview item={item} characterName={characterName} side="front" />
            </div>
          </div>

          <div className="ep-flip-face ep-flip-back">
            <div ref={backRef} className="ep-export-node">
              <EphemeraPreview item={item} characterName={characterName} side="back" />
            </div>
          </div>
        </div>
      </div>

      <div className="ep-card-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          title="翻转票券"
          aria-label="翻转票券"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <RotateCcw size={14} />
        </button>

        <button
          type="button"
          title="编辑票券"
          aria-label="编辑票券"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
        >
          <Edit3 size={14} />
        </button>

        <div className="ep-export-menu">
          <button type="button" title="保存为图片" aria-label="保存为图片">
            <Download size={14} />
          </button>

          <div className="ep-export-options">
            <button type="button" onClick={(event) => handleExport(event, 'front')}>
              保存正面
            </button>
            <button type="button" onClick={(event) => handleExport(event, 'back')}>
              保存背面
            </button>
          </div>
        </div>

        <button
          type="button"
          title="删除票券"
          aria-label="删除票券"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
};

export const EphemeraApp = ({ onBackHub }) => {
  const [items, setItems] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const [nextItems, nextCharacters] = await Promise.all([
      ephemeraService.getAll(),
      ephemeraService.getCharacters()
    ]);

    setItems(nextItems);
    setCharacters(nextCharacters);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getCharacterName = useCallback(
    (characterId) => {
      return characters.find((character) => character.id === characterId)?.name || '守护人';
    },
    [characters]
  );

  const handleExport = async (node, item, side) => {
    const safeTitle = fileSafeName(item.title || item.content?.ticketTitle);
    await downloadNodeAsPng(node, `ephemera-${safeTitle}-${side}.png`);
    setNotice(`已准备保存票券${side === 'front' ? '正面' : '背面'}图片。`);
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id) {
      return;
    }

    try {
      await ephemeraService.remove(pendingDelete.id);
      setPendingDelete(null);
      setNotice('这张票券已从时光票夹中移除。');
      await loadData();
    } catch (error) {
      console.error('删除时光票券失败：', error);
      setNotice('删除失败，请稍后再试。');
    }
  };

  return (
    <section className="ep-app">
      <header className="ep-app-header">
        <button type="button" className="ep-exit-button" onClick={onBackHub}>
          <ArrowLeft size={15} />
          <span>EXIT</span>
        </button>

        <div className="ep-app-heading">
          <span>THE EPHEMERA</span>
          <h2>时光票根影集</h2>
        </div>

        <button
          type="button"
          className="ep-new-button"
          onClick={() => {
            setEditingItem(null);
            setIsEditorOpen(true);
          }}
        >
          <Plus size={16} />
          <span>铸造</span>
        </button>
      </header>

      <p className="ep-app-intro">
        把共同经历过的片段印铸成票根、小票、档案页或书签。点击票券可翻到背面，阅读留下的寄语。
      </p>

      {notice && (
        <div className="ep-notice" role="status">
          <FileDown size={14} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>
            关闭
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="ep-empty-state">
          <span>THE DRAWER IS QUIET</span>
          <p>还没有被印刷的时光。选择一个值得留下的瞬间，开始铸造第一张票券。</p>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsEditorOpen(true);
            }}
          >
            <Plus size={15} />
            铸造第一张
          </button>
        </div>
      ) : (
        <div className="ep-card-list">
          {items.map((item) => (
            <TicketCard
              key={item.id}
              item={item}
              characterName={getCharacterName(item.characterId)}
              onEdit={(selectedItem) => {
                setEditingItem(selectedItem);
                setIsEditorOpen(true);
              }}
              onDelete={setPendingDelete}
              onExport={handleExport}
              exportError={setNotice}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="ep-floating-create"
        onClick={() => {
          setEditingItem(null);
          setIsEditorOpen(true);
        }}
      >
        <Plus size={17} />
        <span>铸造时光记忆</span>
      </button>

      {isEditorOpen && (
        <EphemeraCastModal
          editingItem={editingItem}
          characters={characters}
          onClose={() => {
            setEditingItem(null);
            setIsEditorOpen(false);
          }}
          onSaved={async () => {
            setEditingItem(null);
            setIsEditorOpen(false);
            setNotice('票券已妥善收入时光票夹。');
            await loadData();
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="移除这张时光票券"
        message="移除后无法恢复。与这张票相关的文字、寄语与排版记录都会一并删除。"
        confirmText="确认移除"
        cancelText="保留票券"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
};

export default EphemeraApp;
