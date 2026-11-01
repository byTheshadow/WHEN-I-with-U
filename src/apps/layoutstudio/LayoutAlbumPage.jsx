// src/apps/layoutstudio/LayoutAlbumPage.jsx
//
// 修图室相册页：缩略格栅（时间倒序、可按角色筛选），点开看大图和角色的两句话，
// 可以保存到设备、发回聊天室、删除。叠在 .ls-app 里面，盖住向导。
//
// 发回聊天室由外面传 onSendToChat(work, blob) 进来，这个页面不直接依赖 AI 服务。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Images, Send, Trash2, X } from 'lucide-react';

import { deleteLayoutWork, listLayoutWorks } from './layoutWorksService';
import './layoutAlbum.css';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const LayoutAlbumPage = ({ characters = [], onBack, onSendToChat, showToast }) => {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState(null);
  const [urls, setUrls] = useState({});
  const [openId, setOpenId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sending, setSending] = useState(false);

  const toast = useCallback(
    (text) => {
      if (showToast) showToast(text);
    },
    [showToast]
  );

  const reload = useCallback(async () => {
    try {
      const list = await listLayoutWorks();
      setWorks(list);
    } catch (error) {
      console.warn('[LayoutAlbum] 读取相册失败：', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 每次作品列表变化，重新生成预览地址，旧的统一释放。
  useEffect(() => {
    const next = {};
    works.forEach((work) => {
      if (work.blob) next[work.id] = URL.createObjectURL(work.blob);
    });
    setUrls(next);
    return () => {
      Object.values(next).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [works]);

  const charMap = useMemo(() => {
    const map = new Map();
    characters.forEach((c) => map.set(c.id, c));
    return map;
  }, [characters]);

  // 只列出相册里真有作品的角色，做成筛选条。
  const filterChars = useMemo(() => {
    const ids = [];
    works.forEach((w) => {
      if (!ids.includes(w.characterId)) ids.push(w.characterId);
    });
    return ids;
  }, [works]);

  const shown = useMemo(
    () => (filterId == null ? works : works.filter((w) => w.characterId === filterId)),
    [works, filterId]
  );

  // 当前筛选的角色没作品了（比如删光了），自动回到全部。
  useEffect(() => {
    if (filterId != null && !filterChars.includes(filterId)) setFilterId(null);
  }, [filterChars, filterId]);

  const openWork = useMemo(() => works.find((w) => w.id === openId) || null, [works, openId]);
  const openChar = openWork ? charMap.get(openWork.characterId) : null;

  const closeDetail = () => {
    if (sending) return;
    setOpenId(null);
    setConfirmDelete(false);
  };

  const handleDownload = () => {
    if (!openWork?.blob) return;
    const url = URL.createObjectURL(openWork.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `修图室-${openWork.createdAt || Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('已保存');
  };

  const handleSend = async () => {
    if (!openWork || !onSendToChat || sending) return;
    setSending(true);
    try {
      await onSendToChat(openWork, openWork.blob);
    } catch (error) {
      console.warn('[LayoutAlbum] 发回聊天室失败：', error);
      toast('发送失败，请再试一次');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!openWork) return;
    try {
      await deleteLayoutWork(openWork.id);
      setOpenId(null);
      setConfirmDelete(false);
      await reload();
      toast('已删除');
    } catch (error) {
      console.warn('[LayoutAlbum] 删除失败：', error);
      toast('删除失败，请再试一次');
    }
  };

  return (
    <div className="ls-album">
      <header className="ls-top">
        <button type="button" className="ls-back" onClick={onBack}>
          <ArrowLeft size={17} />
          <span>返回</span>
        </button>
        <div className="ls-ttl">
          <h1>相册</h1>
          <p>{works.length ? `共 ${works.length} 张` : '修好的图会放在这里'}</p>
        </div>
        <div />
      </header>

      {filterChars.length > 1 && (
        <div className="ls-alb-filter">
          <button
            type="button"
            className={`ls-alb-chip${filterId == null ? ' ls-on' : ''}`}
            onClick={() => setFilterId(null)}
          >
            全部
          </button>
          {filterChars.map((id) => {
            const c = charMap.get(id);
            return (
              <button
                key={String(id)}
                type="button"
                className={`ls-alb-chip${filterId === id ? ' ls-on' : ''}`}
                onClick={() => setFilterId(id)}
              >
                {c?.name || '已删除的角色'}
              </button>
            );
          })}
        </div>
      )}

      <div className="ls-alb-body">
        {loading ? (
          <p className="ls-alb-empty">读取中...</p>
        ) : works.length === 0 ? (
          <div className="ls-alb-empty">
            <Images size={34} />
            <b>相册还是空的</b>
            <span>修好一张图以后，在最后一步点「存进相册」，它就会出现在这里。</span>
          </div>
        ) : (
          <div className="ls-alb-grid">
            {shown.map((work) => (
              <button
                key={work.id}
                type="button"
                className="ls-alb-cell"
                onClick={() => setOpenId(work.id)}
              >
                {urls[work.id] && <img src={urls[work.id]} alt="" loading="lazy" />}
                <span>{charMap.get(work.characterId)?.name || ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {openWork && (
        <div className="ls-alb-view" role="dialog" aria-modal="true">
          <header className="ls-alb-vtop">
            <button type="button" className="ls-back" onClick={closeDetail}>
              <X size={17} />
              <span>关闭</span>
            </button>
            <span className="ls-alb-time">{formatTime(openWork.createdAt)}</span>
          </header>

          <div className="ls-alb-vbody">
            <div className="ls-res">
              {urls[openWork.id] && <img src={urls[openWork.id]} alt="修好的图片" />}
            </div>

            {(openWork.praise || openWork.why) && (
              <div className="ls-alb-words">
                <div className="ls-alb-who">{openChar?.name || 'TA'} 说</div>
                {openWork.praise && <p>{openWork.praise}</p>}
                {openWork.why && <p>{openWork.why}</p>}
              </div>
            )}

            <button type="button" className="ls-card ls-act" onClick={handleDownload}>
              <span className="ls-ic">
                <Download size={19} />
              </span>
              <span>
                <b>保存到设备</b>
                <small>导出为一张 JPEG 图片</small>
              </span>
            </button>

            {onSendToChat && (
              <button
                type="button"
                className="ls-card ls-act"
                disabled={sending}
                onClick={handleSend}
              >
                <span className="ls-ic">
                  <Send size={19} />
                </span>
                <span>
                  <b>{sending ? '发送中...' : '发回聊天室'}</b>
                  <small>把图和摘要发给 {openChar?.name || 'TA'}</small>
                </span>
              </button>
            )}

            {confirmDelete ? (
              <div className="ls-alb-confirm">
                <p>删掉后找不回来了，确定吗？</p>
                <div>
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    再想想
                  </button>
                  <button type="button" className="ls-danger" onClick={handleDelete}>
                    确定删除
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ls-card ls-act"
                onClick={() => setConfirmDelete(true)}
              >
                <span className="ls-ic">
                  <Trash2 size={19} />
                </span>
                <span>
                  <b>删除这张</b>
                  <small>只删相册里的这一张</small>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutAlbumPage;