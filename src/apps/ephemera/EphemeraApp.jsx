// src/apps/ephemera/EphemeraApp.jsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit, HelpCircle } from 'lucide-react';
import { ephemeraService } from './ephemeraService';
import EphemeraCastModal from './EphemeraCastModal';
import ConfirmModal from '../../components/ConfirmModal';
import './ephemera.css';

export const EphemeraApp = ({ onBackHub }) => {
  const [ephemeras, setEphemeras] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [isCastOpen, setIsCastOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [flippedIds, setFlippedIds] = useState(new Set());

  // ConfirmModal 状态
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const list = await ephemeraService.getAllEphemeras();
    const chars = await ephemeraService.getCharacters();
    setEphemeras(list);
    setCharacters(chars);
  };

  const handleCardClick = (id) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startDelete = (e, id) => {
    e.stopPropagation(); // 防止冒泡触发 3D 翻转
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (confirmDeleteId) {
      await ephemeraService.deleteEphemera(confirmDeleteId);
      setConfirmDeleteId(null);
      await loadData();
    }
  };

  const startEdit = (e, item) => {
    e.stopPropagation(); // 防止冒泡
    setEditingItem(item);
    setIsCastOpen(true);
  };

  const handleCastFinished = async () => {
    setIsCastOpen(false);
    setEditingItem(null);
    await loadData();
  };

  // 格式化日期
  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getCharacterName = (charId) => {
    const char = characters.find((c) => c.id === charId);
    return char ? char.name : '守护人';
  };

  return (
    <div className="flex flex-col min-h-screen text-[var(--text-main)]">
      {/* 顶部悬浮控制条 */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-transform active:scale-95 border"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-sub)'
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit</span>
        </button>
        <span className="font-serif text-sm italic opacity-60">The Ephemeras</span>
      </div>

      {/* 模块描述信息 */}
      <div className="mb-8 text-left space-y-1.5">
        <h2 className="text-2xl font-serif font-semibold tracking-tight">时光票箱</h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          将与角色共同度过的某一瞬，印铸为戏剧票根、消费收据或旧式书签。点击票卡可在 3D 空间下翻看其背后的守护评语。
        </p>
      </div>

      {/* 票箱主抽屉 */}
      <div className="flex-1 space-y-6 pb-24">
        {ephemeras.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border border-dashed text-center"
            style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
          >
            <HelpCircle className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-xs font-serif italic text-[var(--text-muted)] max-w-[240px] leading-relaxed">
              这里是空的。那些细碎的、值得落笔的时光，正在等待被印刷成票。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {ephemeras.map((item) => {
              const isFlipped = flippedIds.has(item.id);
              const charName = getCharacterName(item.characterId);
              return (
                <div key={item.id} className="ephemera-perspective w-full">
                  <div
                    onClick={() => handleCardClick(item.id)}
                    className={`ephemera-card-inner cursor-pointer ${isFlipped ? 'is-flipped' : ''}`}
                  >
                    {/* CARD FRONT */}
                    <div className="ephemera-card-front flex flex-col justify-between p-5">
                      {/* Cinema Ticket Design */}
                      {item.templateType === 'ticket' && (
                        <div className="h-full flex flex-col justify-between relative">
                          <div className="ticket-notch-left" />
                          <div className="ticket-notch-right" />
                          
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Admit One</span>
                            <span className="text-[10px] font-mono opacity-50">{formatDate(item.createdAt)}</span>
                          </div>

                          <div className="my-4 text-center">
                            <h4 className="text-lg font-serif font-bold tracking-tight mb-2 px-4 leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-[var(--text-sub)] italic max-w-[90%] mx-auto line-clamp-2">
                              {item.content?.details}
                            </p>
                          </div>

                          {/* Dashed Line separating main and control stub */}
                          <div className="border-t border-dashed my-2 opacity-50" style={{ borderColor: 'var(--card-border)' }} />

                          <div className="flex items-center justify-between text-[11px]">
                            <div className="text-left">
                              <span className="block text-[8px] uppercase tracking-wider opacity-40">With Character</span>
                              <span className="font-serif font-bold text-[var(--text-sub)]">{charName}</span>
                            </div>
                            <div className="text-center px-2 py-0.5 border rounded border-[var(--card-border)] bg-[var(--bg-surface)]">
                              <span className="font-mono text-[9px] tracking-wider uppercase">{item.content?.seatNo || 'ROW 1 / SEAT 1'}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[8px] uppercase tracking-wider opacity-40">Class</span>
                              <span className="font-mono text-[9px] uppercase tracking-wider">{item.content?.category || 'LATE NIGHT'}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-center items-center gap-0.5 opacity-80">
                            {[...Array(24)].map((_, i) => (
                              <span
                                key={i}
                                className="ticket-barcode-line"
                                style={{
                                  width: i % 3 === 0 ? '3px' : i % 5 === 0 ? '1px' : '2px',
                                  marginRight: '1px'
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Daily Receipt Design */}
                      {item.templateType === 'receipt' && (
                        <div className="h-full flex flex-col justify-between receipt-paper relative pt-4 pb-2 px-2">
                          <div className="text-center font-mono space-y-1">
                            <h4 className="text-sm font-bold tracking-wide">{item.title}</h4>
                            <p className="text-[9px] opacity-50">{formatDate(item.createdAt)}</p>
                          </div>

                          <div className="font-mono text-[10px] my-3 space-y-1 opacity-80 leading-relaxed border-t border-b border-dashed py-3" style={{ borderColor: 'var(--card-border)' }}>
                            {(item.content?.items || []).map((row, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{row.label}</span>
                                <span>{row.value}</span>
                              </div>
                            ))}
                          </div>

                          <div className="text-center space-y-1 pb-1">
                            <p className="text-[9px] font-mono tracking-tighter opacity-60">
                              GUARDIAN SIGN: {charName.toUpperCase()}
                            </p>
                            <p className="text-[8px] font-serif italic opacity-40">
                              thank you for sharing this day
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Vintage Ledger Design */}
                      {item.templateType === 'table' && (
                        <div className="h-full flex flex-col justify-between ledger-double-border p-3 relative">
                          <div className="absolute right-3 top-3 px-3 py-1.5 vintage-stamp text-[10px] font-bold border-2">
                            RECORDED
                          </div>
                          
                          <div className="space-y-3">
                            <div className="border-b pb-1.5" style={{ borderColor: 'var(--card-border)' }}>
                              <span className="text-[9px] font-serif uppercase tracking-widest opacity-40 block">Time & Date</span>
                              <span className="text-xs font-mono">{formatDate(item.createdAt)}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs border-b pb-1.5" style={{ borderColor: 'var(--card-border)' }}>
                              <div>
                                <span className="text-[9px] font-serif uppercase tracking-widest opacity-40 block">Subject</span>
                                <span className="font-medium">{charName}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-serif uppercase tracking-widest opacity-40 block">Atmosphere</span>
                                <span className="font-mono">{item.content?.weather || 'Overcast'}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[9px] font-serif uppercase tracking-widest opacity-40 block mb-1">Memorandum</span>
                              <p className="text-[11px] leading-relaxed text-[var(--text-sub)] font-serif italic line-clamp-3">
                                {item.content?.details}
                              </p>
                            </div>
                          </div>

                          <div className="text-right text-[9px] opacity-40 uppercase tracking-widest">
                            {item.title}
                          </div>
                        </div>
                      )}

                      {/* Literary Bookmark Design */}
                      {item.templateType === 'bookmark' && (
                        <div className="h-full flex flex-col justify-between items-center py-2 px-4 relative">
                          <div className="w-full">
                            <div className="bookmark-hole" />
                            <div className="bookmark-tassel" />
                          </div>

                          <div className="text-center my-auto py-2">
                            <p className="ephemera-serif text-lg font-bold leading-relaxed px-2 text-[var(--text-main)] italic">
                              “ {item.content?.quote || '我只愿倾听你的潮汐。'} ”
                            </p>
                          </div>

                          <div className="w-full text-center space-y-1 border-t pt-2" style={{ borderColor: 'var(--card-border)' }}>
                            <h4 className="text-[11px] font-serif font-bold tracking-wide">{item.title}</h4>
                            <p className="text-[9px] opacity-40 font-mono">
                              {charName} &nbsp;|&nbsp; {formatDate(item.createdAt).split(' ')[0]}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Hover Action Buttons */}
                      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => startEdit(e, item)}
                          className="p-1.5 rounded-full border bg-[var(--card-bg)] hover:bg-[var(--bg-surface)]"
                          style={{ borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => startDelete(e, item.id)}
                          className="p-1.5 rounded-full border bg-[var(--card-bg)] hover:bg-[var(--bg-surface)]"
                          style={{ borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* CARD BACK */}
                    <div className="ephemera-card-back flex flex-col justify-between p-6 relative">
                      <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: 'var(--card-border)' }}>
                        <span className="text-[9px] font-serif uppercase tracking-widest opacity-40">时光寄语</span>
                        <span className="text-[9px] font-serif italic opacity-40">{charName} 的手抄笔迹</span>
                      </div>

                      <div className="my-auto py-4">
                        <p className="ephemera-serif text-[13px] leading-loose text-[var(--text-sub)] text-left indent-6 italic font-medium">
                          {item.aiComment || '时光在这里被小心折叠。那一刻我们并肩站立，周围的风很大，但我们的声音很近。'}
                        </p>
                      </div>

                      <div className="flex justify-between items-end border-t pt-2 text-[9px] opacity-40" style={{ borderColor: 'var(--card-border)' }}>
                        <span className="font-mono">NO. {String(item.id).padStart(4, '0')}</span>
                        <span className="font-mono">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部悬浮添加按钮 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setIsCastOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-full shadow-lg transition-transform active:scale-95 font-semibold text-xs text-[var(--accent-foreground)] bg-[var(--accent-color)]"
        >
          <Plus className="h-4 w-4" />
          <span>铸造时光记忆</span>
        </button>
      </div>

      {/* 铸造模态框 */}
      {isCastOpen && (
        <EphemeraCastModal
          onClose={() => {
            setIsCastOpen(false);
            setEditingItem(null);
          }}
          onFinished={handleCastFinished}
          editingItem={editingItem}
          characters={characters}
        />
      )}

      {/* 二级删除确认模态框 */}
      {confirmDeleteId !== null && (
        <ConfirmModal
          isOpen={true}
          title="销毁记忆票券"
          message="此操作将永久粉碎这张承载了你们共同足迹的记忆卡片。是否确认销毁？"
          confirmText="确认销毁"
          cancelText="保留它"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

export default EphemeraApp;
