import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Plus, Send, Trash2, X } from 'lucide-react';

import db from '../../../db';
import { triggerAiResponse } from '../../../services/aiService';
import {
  recordAlmanacEvent,
  ALMANAC_EVENT_TYPES,
} from '../../almanac/services/almanacService';
import { triggerGlobalToast } from '../../../components/NotificationToast';
import BroadcastFlyEffect from './effects/BroadcastFlyEffect';

// "群发"撰写弹窗：从会话列表的多选模式打开，targets 是已经选好的
// 最多 5 个 { chat, character } 组合。这里现写一条或几条新消息，一次性
// 分别写进每一个目标聊天窗，然后各自触发一次 AI 回复——跟平时在某个
// 聊天窗里发消息、AI 自动回复是同一套逻辑（triggerAiResponse 自己会
// 从数据库读 chat/character，不依赖某个聊天窗是否正打开着）。
//
// 这里不复用"转发"那条路径：转发是把已有消息原样搬到别的聊天窗、
// 不触发 AI；这里是现写新内容、发完就要对方（AI）回应。
//
// 视觉上走"明信片"这套意象，跟发送时那个纸飞机+星光的仪式感呼应：
// 收件人是一张张贴上去的邮票贴纸，每条草稿是一张可以写字的明信片，
// 发送按钮是"寄出"。还是从底部弹出的那种弹层，只是做得更饱满、
// 更有质感，不是一张单薄的表单卡。

const MAX_MESSAGES = 5;

// 明信片轻微的随机倾斜角度，让好几张叠在一起时不是死板的一条直线，
// 用 index 取模、固定一组角度，不用每次渲染都随机（避免文字输入时
// 因为重渲染导致卡片抖动）。
const POSTCARD_TILTS = [-1.2, 1.4, -1.5, 1.2, -1.0];
const STAMP_TILTS = [-3.5, 2.8, -2.2, 3.2, -2.5];

const BroadcastComposer = ({ targets, onClose, onSent }) => {
  const [drafts, setDrafts] = useState(['']);
  const [isSending, setIsSending] = useState(false);
  const [showSendEffect, setShowSendEffect] = useState(false);

  const postmarkLabel = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${month}.${day}`;
  }, []);

  const handleDraftChange = (index, value) => {
    setDrafts((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleAddDraft = () => {
    setDrafts((previous) => (
      previous.length >= MAX_MESSAGES ? previous : [...previous, '']
    ));
  };

  const handleRemoveDraft = (index) => {
    setDrafts((previous) => (
      previous.length <= 1 ? previous : previous.filter((_, i) => i !== index)
    ));
  };

  const trimmedDrafts = drafts.map((text) => text.trim()).filter(Boolean);
  const canSend = trimmedDrafts.length > 0 && !isSending && targets.length > 0;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);

    try {
      for (const { chat, character } of targets) {
        const userAvatar = chat?.userAvatar || character?.userAvatar || '';
        const userName = chat?.userName || character?.userName || '你';

        for (const content of trimmedDrafts) {
          const newMsg = {
            chatId: chat.id,
            characterId: chat.characterId,
            sender: 'user',
            type: 'text',
            content,
            metadata: {},
            userAvatar,
            userName,
            isRead: true,
            timestamp: new Date().toISOString(),
          };

          const msgId = await db.messages.add(newMsg);
          newMsg.id = msgId;

          void recordAlmanacEvent({
            chatId: chat.id,
            characterId: chat.characterId,
            eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
            timestamp: newMsg.timestamp,
            metadata: {
              source: 'broadcast-composer',
              messageType: 'text',
            },
          });
        }

        await db.chats.update(chat.id, {
          updatedAt: new Date().toISOString(),
        });

        // 每个目标各自独立触发一次 AI 回复，互不等待。
        void triggerAiResponse(chat.id);
      }

      // 先放"纸飞机飞出去"的全屏动效，动效结束后才真正关闭弹窗、
      // 回到会话列表，让人能看清"发出去了"这个反馈。
      setShowSendEffect(true);
    } catch (err) {
      console.error('[BroadcastComposer] 寄出失败：', err);
      setIsSending(false);
      triggerGlobalToast({
        title: '寄出失败',
        content: '有几封没寄出去，稍后再试试吧',
        iconType: 'bell',
        duration: 2600,
      });
    }
  };

  const handleFlyEffectDone = () => {
    const count = targets.length;

    triggerGlobalToast({
      title: '已寄出',
      content: `已送到 ${count} 位的信箱`,
      iconType: 'chat',
      duration: 2400,
    });

    onSent?.();
  };

  // 通过 Portal 渲染到 body 根层级，避开页面中局部容器 overflow: hidden 裁剪与相对定位限制
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 遮罩背景：全屏微灰遮罩，完全遮蔽底层列表，杜绝重叠与毛边 */}
      <div
        className="fixed inset-0"
        style={{
          background: 'rgba(246, 246, 247, 0.94)',
        }}
        onClick={() => !isSending && onClose()}
      />

      {/* 1. 背景罗盘刻度轮盘 (黑白纯净线稿) */}
      <div className="compass-stage pointer-events-none" aria-hidden="true">
        <svg className="compass-dial-svg" viewBox="0 0 500 500" fill="none" stroke="#222222">
          {/* 最外圈精密刻度大环 */}
          <circle cx="250" cy="250" r="235" strokeWidth="0.75" strokeOpacity="0.25" />
          <circle cx="250" cy="250" r="225" strokeWidth="0.5" strokeDasharray="2 6" strokeOpacity="0.35" />
          <circle cx="250" cy="250" r="195" strokeWidth="1" strokeOpacity="0.2" />

          {/* 罗盘方位标记 (N, E, S, W) */}
          <text x="250" y="24" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="#111111" stroke="none">N · 000°</text>
          <text x="480" y="254" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="#111111" stroke="none">E · 090°</text>
          <text x="250" y="488" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="#111111" stroke="none">S · 180°</text>
          <text x="22" y="254" fontSize="10" fontFamily="Georgia, serif" fontWeight="bold" textAnchor="middle" fill="#111111" stroke="none">W · 270°</text>

          {/* 极坐标十字分线 */}
          <line x1="250" y1="18" x2="250" y2="482" strokeWidth="0.6" strokeOpacity="0.2" />
          <line x1="18" y1="250" x2="482" y2="250" strokeWidth="0.6" strokeOpacity="0.2" />

          {/* 45度斜向指示虚线 */}
          <line x1="85" y1="85" x2="415" y2="415" strokeWidth="0.5" strokeDasharray="3 4" strokeOpacity="0.18" />
          <line x1="85" y1="415" x2="415" y2="85" strokeWidth="0.5" strokeDasharray="3 4" strokeOpacity="0.18" />

          {/* 内圈同心圆与小刻度 */}
          <circle cx="250" cy="250" r="150" strokeWidth="0.5" strokeDasharray="1 4" strokeOpacity="0.2" />
          <circle cx="250" cy="250" r="110" strokeWidth="0.75" strokeOpacity="0.2" />
        </svg>
      </div>

      {/* 2. 前景：纯净居中拼贴信卡 (固定最大高与弹性布局，永不截断顶底) */}
      <div 
        className="collage-card relative z-20 flex w-full max-w-[380px] flex-col gap-3.5"
        style={{ maxHeight: 'calc(100vh - 40px)' }}
      >
        {/* 顶栏：罗盘印戳 + 标题 (shrink-0 确保不被挤压) */}
        <div className="card-header shrink-0 flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            <div className="postmark-seal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
              </svg>
              <span className="postmark-date">{postmarkLabel}</span>
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-[13px] font-bold text-[#111111] tracking-tight leading-tight">
                寻迹信标 · 寄往 {targets.length} 方位
              </h3>
              <p className="text-[10px] text-[#737373] mt-0.5 leading-tight">向定锚目标并发投递信笺</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="btn-close"
            aria-label="收起寻迹信标"
            title="收起"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3. 邮票贴纸：收件人一览 (shrink-0) */}
        <div className="stamps-strip shrink-0 no-scrollbar flex gap-2.5 overflow-x-auto py-1">
          {targets.map(({ chat, character }, index) => (
            <div
              key={chat.id}
              className="stamp-pill flex shrink-0 flex-col items-center gap-1.5"
              style={{ transform: `rotate(${STAMP_TILTS[index % STAMP_TILTS.length]}deg)` }}
            >
              {character?.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="stamp-avatar h-7 w-7 rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="stamp-avatar flex h-7 w-7 items-center justify-center rounded-md bg-[#f4f4f5] text-[10px] font-bold text-[#111111]">
                  {character?.name?.[0] || <MessageCircle className="h-3.5 w-3.5 opacity-50" />}
                </div>
              )}
              <span className="stamp-name max-w-[70px] truncate text-[9.5px] font-medium text-[#111111]">
                {chat.title || character?.name || '未命名'}
              </span>
            </div>
          ))}
        </div>

        {/* 4. 明信片信纸草稿 (flex-1 min-h-0 可纵向自适应滚动) */}
        <div className="postcard-stack flex-1 min-h-0 no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-0.5 py-1">
          {drafts.map((draft, index) => (
            <div
              key={index}
              className="postcard-sheet relative shrink-0"
              style={{ transform: `rotate(${POSTCARD_TILTS[index % POSTCARD_TILTS.length]}deg)` }}
            >
              <div className="sheet-meta flex items-center justify-between pb-1">
                <span className="sheet-index">No. {String(index + 1).padStart(2, '0')} · Postcard</span>

                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDraft(index)}
                    className="sheet-delete-btn p-1 text-[#a1a1aa] hover:text-red-500 transition-colors"
                    aria-label={`撕除第 ${index + 1} 张`}
                    title="撕除这一张"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(index, event.target.value)}
                placeholder={index === 0 ? '在信纸上落笔寄给大家的话...' : '再写一张明信片...'}
                rows={2}
                maxLength={500}
                className="sheet-textarea w-full resize-none bg-transparent text-xs text-[#111111] placeholder:text-[#a1a1aa] leading-relaxed outline-none"
              />
            </div>
          ))}
        </div>

        {/* 附写下一张便签 (shrink-0) */}
        {drafts.length < MAX_MESSAGES && (
          <button
            type="button"
            onClick={handleAddDraft}
            className="btn-add-sheet shrink-0 flex w-full items-center justify-center gap-1.5 py-2.5 text-[11px] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>附写下一张便签</span>
          </button>
        )}

        {/* 5. 底部发送按钮 (shrink-0 确保完整展示) */}
        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="btn-seal-send shrink-0 relative flex w-full items-center justify-center gap-2 text-xs font-semibold disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" style={{ transform: 'rotate(45deg)' }} />
          <span>{isSending ? '印发启程中...' : '印发启程 · 寄出信笺'}</span>
        </button>
      </div>

      {showSendEffect && (
        <BroadcastFlyEffect onDone={handleFlyEffectDone} />
      )}

      <style>{`
        /* ================= 1. 背景罗盘轮盘 ================= */
        .compass-stage {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 580px;
          height: 580px;
          pointer-events: none;
          z-index: 15;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .compass-dial-svg {
          width: 100%;
          height: 100%;
          animation: slowRotate 160s linear infinite;
          opacity: 0.65;
        }

        /* ================= 2. 居中拼贴信笺卡片 ================= */
        .collage-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 24px;
          padding: 22px 20px 20px;
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 20px 45px -10px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(255, 255, 255, 0.8) inset;
          animation: cardPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .card-header {
          border-bottom: 1px solid #e5e5e7;
        }

        .postmark-seal {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.2px dashed #111111;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transform: rotate(-10deg);
          flex-shrink: 0;
          background: #ffffff;
        }

        .postmark-date {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #111111;
          line-height: 1;
          margin-top: 1px;
        }

        .btn-close {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background: transparent;
          color: #737373;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-close:hover:not(:disabled) {
          border-color: #111111;
          color: #111111;
          transform: rotate(90deg);
        }

        /* ================= 3. 邮票贴纸 ================= */
        .stamp-pill {
          background: #ffffff;
          border: 1px solid #d4d4d8;
          border-radius: 10px;
          padding: 7px 9px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .stamp-pill:hover {
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
          z-index: 2;
        }

        /* ================= 4. 明信片信纸 ================= */
        .postcard-sheet {
          background: #fafaf9;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          padding: 10px 12px;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.035);
          transition: transform 0.25s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .postcard-sheet:hover,
        .postcard-sheet:focus-within {
          border-color: rgba(0, 0, 0, 0.25);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
        }

        .sheet-index {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 10px;
          color: #737373;
          letter-spacing: 0.05em;
        }

        .btn-add-sheet {
          background: transparent;
          border: 1px dashed rgba(0, 0, 0, 0.16);
          border-radius: 12px;
          padding: 8px;
          color: #737373;
          cursor: pointer;
        }

        .btn-add-sheet:hover {
          border-color: #111111;
          color: #111111;
          background: rgba(0, 0, 0, 0.02);
        }

        /* ================= 5. 发送按钮 ================= */
        .btn-seal-send {
          height: 42px;
          border-radius: 9999px;
          background: #111111;
          color: #ffffff;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .btn-seal-send:hover:not(:disabled) {
          background: #27272a;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
        }

        .btn-seal-send:active:not(:disabled) {
          transform: scale(0.98);
        }

        @keyframes slowRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes cardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );

  // 保证在 SSR 或 DOM 未就绪时安全降级
  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};

export default BroadcastComposer;