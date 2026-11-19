// src/apps/messages/friends/FriendRequestsModal.jsx
//
// 【新建文件说明】好友申请页（全屏浮层）· 切片 A。样式照"好友申请 · 视觉参考"。
//
// 一个组件里四种视图，用 view 状态切换（不拆路由）：
//   list      新的朋友：待处理列表 + 折叠的已处理历史
//   detail    申请详情：待处理的显示"通过前"（真实身份锁定），已通过的显示揭晓后的名片
//   settings  设置区：总开关 + 每个角色的开关（+ 临时测试入口）
//
// 切片 A 的"通过 / 拒绝"只改状态；身份揭晓后往聊天里写结果消息、拒绝后的 24 小时冷却、
// 名片落到角色 friends 里，都是切片 C 的事。
//
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronDown, SlidersHorizontal, Lock } from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import db from '../../../db';
import {
  getRequestStatus,
  loadFriendRequestItems,
  loadFriendSettings,
  decideFriendRequest,
  setFriendIntroEnabled,
  setCharacterFriendIntro,
  createTestFriendRequest
} from './friendRequestService';

import { resolveFriendRequest } from './friendDecisionService';
import FriendChatRoom from './FriendChatRoom';
import './friend-requests.css';

// ====== 展示用小工具 ======
const AVATAR_TINTS = ['#d9cfc0', '#c9d3c4', '#d6c4c4', '#c4ccd6', '#d8d0b8', '#cdc4d6'];

const tintFor = (name) => {
  const s = String(name || '');
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
};

// 首字占位头像：以后用户给了图片 URL，在这里按 avatarId 换成图片即可。
const Avatar = ({ name, size = 44 }) => (
  <span
    className={`fr-av fr-av--${size}`}
    style={{ background: tintFor(name) }}
    aria-hidden="true"
  >
    {Array.from(String(name || '?'))[0]}
  </span>
);

const formatAgo = (ts) => {
  const minutes = Math.floor((Date.now() - (ts || 0)) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '昨天' : `${days} 天前`;
};

const formatDate = (ts) => {
  const d = new Date(ts || Date.now());
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

const Switch = ({ on, label, large = false, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    className={`fr-switch${large ? ' fr-switch--lg' : ''}`}
    onClick={onToggle}
  />
);

const Row = ({ label, children, locked = false, strong = false }) => (
  <div className={`fr-row${locked ? ' fr-row--locked' : ''}`}>
    <span className="fr-label">{label}</span>
    <span className={`fr-value${strong ? ' fr-value--strong' : ''}`}>{children}</span>
  </div>
);

// ====== 主组件 ======
export const FriendRequestsModal = ({ onClose, onChanged }) => {
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'settings'
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState({ globalEnabled: false, characters: [] });
  const [devMsg, setDevMsg] = useState('');
const [chatFriend, setChatFriend] = useState(null); // { id, ownerId, name }：正在聊天的朋友

  const reload = useCallback(async () => {
    setItems(await loadFriendRequestItems());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const notifyChanged = () => {
    if (typeof onChanged === 'function') onChanged();
  };

  const now = Date.now();
  const pendingItems = items.filter((it) => getRequestStatus(it, now) === 'pending');
  const historyItems = items.filter((it) => getRequestStatus(it, now) !== 'pending');
  const selected = items.find((it) => it.id === selectedId) || null;

  // ----- 导航 -----
  const handleBack = () => {
    if (view === 'list') {
      onClose();
      return;
    }
    setView('list');
    setSelectedId(null);
    setDevMsg('');
  };

  const openDetail = (item) => {
    setSelectedId(item.id);
    setView('detail');
  };

  const openSettings = async () => {
    setSettings(await loadFriendSettings());
    setView('settings');
  };

  // ----- 通过 / 拒绝 -----
  const handleAccept = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await resolveFriendRequest(selected, 'accepted');
      await reload();
      notifyChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmedDecline = async () => {
    setConfirmDecline(false);
    if (!selected || busy) return;
    setBusy(true);
    try {
           await resolveFriendRequest(selected, 'declined');
      await reload();
      notifyChanged();
      setView('list');
      setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  // ----- 设置区 -----
  const handleToggleGlobal = async () => {
    const next = !settings.globalEnabled;
    setSettings((prev) => ({ ...prev, globalEnabled: next }));
    await setFriendIntroEnabled(next);
    notifyChanged();
  };

  const handleToggleCharacter = async (character) => {
    const next = !character.enabled;
    setSettings((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === character.id ? { ...c, enabled: next } : c))
    }));
    await setCharacterFriendIntro(character.id, next);
    notifyChanged();
  };

  // 临时测试入口：写入一封测试申请（不检查名额，方便反复测）
  const handleDevCreate = async (kind) => {
    setDevMsg('');
    try {
      if (kind === 'global') {
        await createTestFriendRequest({ type: 'global' });
        setDevMsg('已写入一封「自己来的」测试申请');
      } else {
        const list = settings.characters;
        if (list.length === 0) {
          setDevMsg('还没有角色，先去角色库创建一个');
          return;
        }
        const target = list[Math.floor(Math.random() * list.length)];
        const exists = await db.characters.get(Number(target.id));
        if (!exists) return;
        await createTestFriendRequest({ type: 'character', id: target.id });
        setDevMsg(`已写入一封来自「${target.name}」的测试申请`);
      }
      await reload();
      notifyChanged();
    } catch (err) {
      console.error('[FriendRequestsModal] 写入测试申请失败:', err);
      setDevMsg('写入失败，看看控制台');
    }
  };

  // ====== 视图：列表 ======
  const renderList = () => (
    <>
      <div className="fr-title">
        <h1>新的朋友</h1>
        <p>通过之后，才会知道 TA 是谁</p>
      </div>

      {pendingItems.length === 0 && historyItems.length === 0 && (
        <div className="fr-empty">
          还没有新的朋友来找你
          <br />
          等角色介绍，或者有人自己来
        </div>
      )}

      {pendingItems.length > 0 && (
        <div className="fr-list">
          <div className="fr-sec">待处理 · {pendingItems.length}</div>
          {pendingItems.map((it) => (
            <button key={it.id} type="button" className="fr-card" onClick={() => openDetail(it)}>
              <Avatar name={it.alias} size={44} />
              <span className="fr-card-body">
                <span className="fr-card-head">
                  <span className="fr-card-name">{it.alias}</span>
                  <span className="fr-card-time">{formatAgo(it.createdAt)}</span>
                </span>
                <span className="fr-card-line">{it.openingLine || '想加你为好友。'}</span>
                {it.ownerType === 'character' ? (
                  <span className="fr-card-from">来自 {it.ownerName} 的朋友</span>
                ) : (
                  <span>
                    <span className="fr-tag">自己来的</span>
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {historyItems.length > 0 && (
        <div className="fr-list" style={{ gap: 8 }}>
          <button
            type="button"
            className="fr-fold"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span>已处理 · {historyItems.length}</span>
            <ChevronDown
              className="w-4 h-4"
              style={{ transform: historyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}
            />
          </button>

          {historyOpen &&
            historyItems.map((it) => {
              const status = getRequestStatus(it, now);
              if (status === 'accepted') {
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="fr-hist fr-hist--btn"
                    onClick={() => openDetail(it)}
                  >
                    <Avatar name={it.hidden?.realName || it.alias} size={34} />
                    <span className="fr-hist-name">{it.hidden?.realName || it.alias}</span>
                    <span className="fr-hist-state fr-hist-state--ok">已通过 · 看名片</span>
                  </button>
                );
              }
              return (
                <div
                  key={it.id}
                  className={`fr-hist${status === 'expired' ? ' fr-hist--missed' : ''}`}
                >
                  <Avatar name={it.alias} size={34} />
                  <span className="fr-hist-name">{it.alias}</span>
                  <span className="fr-hist-state">{status === 'expired' ? '错过' : '已拒绝'}</span>
                </div>
              );
            })}
        </div>
      )}
    </>
  );

  // ====== 视图：详情（待处理）/ 名片（已通过） ======
  const renderDetail = () => {
    if (!selected) {
      return <div className="fr-empty">这封申请找不到了</div>;
    }

    const status = getRequestStatus(selected, now);
    const fromChar = selected.ownerType === 'character';

    // 已通过：揭晓后的好友名片
    if (status === 'accepted') {
      const h = selected.hidden || {};
      const realName = h.realName || selected.alias;
      return (
        <>
          <div className="fr-hero">
            <Avatar name={realName} size={88} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="fr-hero-name">{realName}</span>
              {realName !== selected.alias && <span className="fr-hero-sub">化名 {selected.alias}</span>}
            </div>
            <span className="fr-tag" style={{ fontSize: 11, padding: '3px 10px' }}>已通过</span>
          </div>

          <div className="fr-block">
            <Row label="真名" strong>{realName}</Row>
            <Row label={fromChar ? `与 ${selected.ownerName}` : '关系'}>{h.relation || '—'}</Row>
            <Row label="性格">{h.personality || '—'}</Row>
            <Row label="说话风格">{h.speechStyle || '—'}</Row>
            <Row label="认识于">
              {formatDate(selected.decidedAt || selected.createdAt)} ·{' '}
              {fromChar ? `由 ${selected.ownerName} 介绍` : '自己来的'}
            </Row>
          </div>

          <div className="fr-spacer" />

          <button
            type="button"
            className="fr-btn fr-btn--solid"
            onClick={() =>
              setChatFriend({
                id: selected.id,
                ownerId: fromChar ? selected.ownerId : null,
                name: realName,
              })
            }
          >
            开始聊天
          </button>
          <div className="fr-center-note">和朋友的对话只保存在这台设备上</div>
        </>
      );
    }

    // 待处理：通过前
    const isPending = status === 'pending';
    return (
      <>
        <div className="fr-hero">
          <Avatar name={selected.alias} size={88} />
          <span className="fr-hero-name">{selected.alias}</span>
          <span className="fr-hero-sub">想加你为好友</span>
        </div>

        <div className="fr-block">
          <Row label="来自">
            {fromChar ? <span className="fr-value--strong">{selected.ownerName} 的朋友</span> : '自己来的'}
          </Row>
          <Row label="申请语">{selected.openingLine || '想加你为好友。'}</Row>
          {fromChar && selected.introReason && <Row label="介绍理由">{selected.introReason}</Row>}
          <Row label="收到">{formatAgo(selected.createdAt)}</Row>
          <Row label="真实身份" locked>
            <span className="fr-locked">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              通过后揭晓
            </span>
          </Row>
        </div>

        <div className="fr-note">
          {isPending ? '未处理的申请，7 天后会变成「错过」。' : '这封申请已经错过了。'}
        </div>

        <div className="fr-spacer" />

        <div className="fr-actions">
          <button
            type="button"
            className="fr-btn"
            disabled={!isPending || busy}
            onClick={() => setConfirmDecline(true)}
          >
            拒绝
          </button>
          <button
            type="button"
            className="fr-btn fr-btn--solid"
            disabled={!isPending || busy}
            onClick={handleAccept}
          >
            通过
          </button>
        </div>
      </>
    );
  };

  // ====== 视图：设置区 ======
  const renderSettings = () => (
    <>
      <div className="fr-title">
        <h1>好友申请设置</h1>
        <p>决定会不会有新朋友来找你</p>
      </div>

      <div className="fr-set-card">
        <div className="fr-set-text">
          <span className="fr-set-title">允许角色介绍朋友</span>
          <span className="fr-set-desc">
            总开关，默认关闭。关闭时不会有新的申请出现，包括朋友自己来的。
          </span>
        </div>
        <Switch
          large
          on={settings.globalEnabled}
          label="允许角色介绍朋友"
          onToggle={handleToggleGlobal}
        />
      </div>

      <div className="fr-list">
        <div className="fr-sec">每个角色单独设置</div>
        {settings.characters.length === 0 && (
          <div className="fr-note">还没有角色。</div>
        )}
        {settings.characters.map((c) => (
          <div key={c.id} className="fr-set-row">
            <Avatar name={c.name} size={38} />
            <span className="fr-set-name">{c.name}</span>
            <Switch on={c.enabled} label={`${c.name}可以介绍朋友`} onToggle={() => handleToggleCharacter(c)} />
          </div>
        ))}
      </div>

      <div className="fr-note">
        角色开关只管「这位角色会不会介绍朋友」。总开关关闭时，所有角色都不会介绍。
      </div>

      <div className="fr-dev">
        <span className="fr-dev-title">临时测试入口（后面的切片会删掉）</span>
        <button type="button" onClick={() => handleDevCreate('character')}>
          随机给一位角色写入一封测试申请
        </button>
        <button type="button" onClick={() => handleDevCreate('global')}>
          写入一封「自己来的」测试申请
        </button>
        {devMsg && <span className="fr-dev-title">{devMsg}</span>}
      </div>
    </>
  );

  return (
    <div className="fr-root animate-fade-in-up">
      <div className="fr-scroll">
        <div className="fr-top">
          <button type="button" className="fr-round" aria-label="返回" onClick={handleBack}>
            <ChevronLeft className="w-[18px] h-[18px]" />
          </button>

          {view === 'list' ? (
            <button type="button" className="fr-round" aria-label="好友申请设置" onClick={openSettings}>
              <SlidersHorizontal className="w-[18px] h-[18px]" />
            </button>
          ) : (
            <span />
          )}
        </div>

        {view === 'list' && renderList()}
        {view === 'detail' && renderDetail()}
        {view === 'settings' && renderSettings()}
      </div>

        {chatFriend && (
        <FriendChatRoom friend={chatFriend} onBack={() => setChatFriend(null)} />
      )}

      <ConfirmModal
        isOpen={confirmDecline}
        title="拒绝这位朋友？"
        message="拒绝之后无法撤回，你也不会知道 TA 是谁。"
        confirmText="拒绝"
        cancelText="再想想"
        onCancel={() => setConfirmDecline(false)}
        onConfirm={handleConfirmedDecline}
      />
    </div>
  );
};

export default FriendRequestsModal;