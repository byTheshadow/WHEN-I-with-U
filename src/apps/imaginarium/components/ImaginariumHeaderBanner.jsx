import React, { useState } from 'react';
import { Music, ChevronUp, Search, Plus, Edit3, Check, Upload, Trash2 } from 'lucide-react';

/**
 * 极简紧凑型抽屉状态栏 (ImaginariumHeaderBanner)
 * 使用 SVG 音乐图标为按钮，支持全量文字与图片编辑 (支持本地上传 Base64 / URL)
 */
export const ImaginariumHeaderBanner = ({ chat, onUpdateChatInfo }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [title, setTitle] = useState(chat.title || '虚构沙龙');
  const [handle, setHandle] = useState(chat.handle || '@SalonTheme');
  const [description, setDescription] = useState(chat.description || '这里是自定义的群聊简介或主题描述。');
  const [statsText, setStatsText] = useState(chat.statsText || '128 成员 • 42 在线');

  const [gallery, setGallery] = useState(
    chat.gallery || [
      { id: 1, title: '日常手稿', count: '42 张', url: chat.bgImage || 'https://picsum.photos/300/300?random=10' },
      { id: 2, title: '主题归档', count: '28 张', url: 'https://picsum.photos/300/300?random=11' }
    ]
  );

  const handleImageFileUpload = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        callback(evt.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryUrlChange = (index, url) => {
    const updated = [...gallery];
    updated[index].url = url;
    setGallery(updated);
  };

  const handleGalleryTitleChange = (index, text) => {
    const updated = [...gallery];
    updated[index].title = text;
    setGallery(updated);
  };

  const handleAddGalleryItem = () => {
    setGallery([
      ...gallery,
      { id: Date.now(), title: '新画廊切片', count: '0 张', url: 'https://picsum.photos/300/300?random=' + Date.now() }
    ]);
  };

  const handleDeleteGalleryItem = (index) => {
    setGallery(gallery.filter((_, i) => i !== index));
  };

  const handleSaveInfo = () => {
    setIsEditing(false);
    if (onUpdateChatInfo) {
      onUpdateChatInfo({
        ...chat,
        title,
        handle,
        description,
        statsText,
        gallery
      });
    }
  };

  return (
    <div className="w-full max-w-[380px] mx-auto z-40 relative">
      {/* 居中悬浮音乐按钮开关 */}
      <div className="flex justify-center items-center">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "点击展开沙龙音乐状态栏" : "收起状态栏"}
          className="imaginarium-banner-toggle-btn"
        >
          {isCollapsed ? (
            <Music className="w-3.5 h-3.5 text-[var(--accent-color)] animate-pulse" />
          ) : (
            <ChevronUp className="w-4 h-4 opacity-70" />
          )}
        </button>
      </div>

      {/* 可折叠紧凑主体 */}
      <div
        className={`imaginarium-banner-collapsible ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden py-0' : 'max-h-[600px] opacity-100 py-2'}`}
      >
        <div
          className="rounded-[1.5rem] p-3.5 shadow-xl border backdrop-blur-xl space-y-3 text-center"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {/* 顶栏控制 */}
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-mono opacity-50 uppercase tracking-widest">Salon Status Bar</span>
            <button
              type="button"
              onClick={() => (isEditing ? handleSaveInfo() : setIsEditing(true))}
              className="px-2 py-0.5 rounded-full border flex items-center gap-1 font-bold"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              {isEditing ? <Check className="w-3 h-3 text-emerald-500" /> : <Edit3 className="w-3 h-3" />}
              <span>{isEditing ? '保存' : '编辑'}</span>
            </button>
          </div>

          {/* 1. 文本信息与头像 */}
          <div className="flex items-center gap-3 text-left">
            <div className="w-14 h-14 rounded-full overflow-hidden border shadow-sm shrink-0 relative group" style={{ borderColor: 'var(--card-border)' }}>
              <img
                src={chat.bgImage || 'https://picsum.photos/200/200?random=1'}
                alt="Banner Avatar"
                className="w-full h-full object-cover"
              />
              {isEditing && (
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFileUpload(e.target.files?.[0], (url) => onUpdateChatInfo({ ...chat, bgImage: url }))}
                  />
                </label>
              )}
            </div>

            <div className="flex-1 space-y-1 overflow-hidden">
              {isEditing ? (
                <div className="space-y-1 text-xs">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-1 rounded border outline-none font-bold text-xs"
                    style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                  />
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="w-full p-1 rounded border outline-none text-[10px] opacity-70"
                    style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                  />
                </div>
              ) : (
                <>
                  <h3 className="font-serif font-bold text-sm tracking-wide truncate">{title}</h3>
                  <span className="text-[10px] opacity-50 block font-mono truncate">{handle}</span>
                </>
              )}
            </div>
          </div>

          {/* 2. 描述与统计编辑 */}
          {isEditing ? (
            <div className="space-y-1 text-xs">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-1 rounded border outline-none text-xs"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
              />
              <input
                type="text"
                value={statsText}
                onChange={(e) => setStatsText(e.target.value)}
                className="w-full p-1 rounded border outline-none text-[10px]"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
              />
            </div>
          ) : (
            <div className="space-y-1 text-left">
              <p className="text-[11px] leading-snug opacity-75">{description}</p>
              <div className="text-[10px] font-mono opacity-50 pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
                {statsText}
              </div>
            </div>
          )}

          {/* 3. 画廊图片区 (支持 URL / 本地上传 / 标题修改) */}
          <div className="space-y-1.5 pt-1 text-left">
            <div className="flex items-center justify-between text-[10px] font-bold opacity-70">
              <span>画廊相册</span>
              {isEditing && (
                <button type="button" onClick={handleAddGalleryItem} className="text-emerald-500 flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> 添加切片
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {gallery.map((item, idx) => (
                <div key={item.id || idx} className="space-y-1 group relative">
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border relative" style={{ borderColor: 'var(--card-border)' }}>
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    {isEditing && (
                      <div className="absolute inset-0 bg-black/60 p-1 flex flex-col justify-between text-white text-[9px]">
                        <div className="flex justify-between items-center">
                          <label className="p-1 rounded bg-white/20 cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageFileUpload(e.target.files?.[0], (url) => handleGalleryUrlChange(idx, url))}
                            />
                          </label>
                          <button type="button" onClick={() => handleDeleteGalleryItem(idx)} className="text-rose-400 p-1">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => handleGalleryUrlChange(idx, e.target.value)}
                          placeholder="图片 URL"
                          className="w-full bg-black/40 p-0.5 rounded text-[8px] outline-none text-white truncate"
                        />
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleGalleryTitleChange(idx, e.target.value)}
                      className="w-full p-0.5 text-[10px] font-bold border rounded outline-none"
                      style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                    />
                  ) : (
                    <div className="px-0.5">
                      <div className="font-bold text-[11px] truncate">{item.title}</div>
                      <div className="text-[9px] opacity-40">{item.count}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImaginariumHeaderBanner;
