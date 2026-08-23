import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Search, Plus, Edit3, Image as ImageIcon, Check } from 'lucide-react';

/**
 * 顶部抽屉式状态栏组件 (ImaginariumHeaderBanner)
 * 居中小按钮展开/折叠，全量跟随 theme.css 颜色
 */
export const ImaginariumHeaderBanner = ({ chat, onUpdateChatInfo }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // 编辑态本地数据
  const [title, setTitle] = useState(chat.title || '虚构沙龙');
  const [handle, setHandle] = useState(chat.handle || '@SalonTheme');
  const [description, setDescription] = useState(chat.description || '这里是自定义的群聊简介或主题描述。你可以编辑这里的文字。');
  const [statsText, setStatsText] = useState(chat.statsText || '128 成员 • 42 在线');

  // 图片画廊预设
  const [gallery, setGallery] = useState(
    chat.gallery || [
      { id: 1, title: '日常手稿', count: '42 张图片', url: chat.bgImage || 'https://picsum.photos/300/300?random=10' },
      { id: 2, title: '主题归档', count: '28 张图片', url: 'https://picsum.photos/300/300?random=11' }
    ]
  );

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
    <div className="w-full max-w-[420px] mx-auto z-40 transition-all duration-300 relative">
      {/* 核心开关：居中悬浮小按钮 */}
      <div className="flex justify-center items-center py-1">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "展开群聊状态栏" : "收起群聊状态栏"}
          className="imaginarium-banner-toggle-btn shadow-md hover:scale-105 active:scale-95 transition-all"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* 可折叠主体内容 */}
      <div
        className={`imaginarium-banner-collapsible ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden py-0' : 'max-h-[800px] opacity-100 py-3 px-4'}`}
      >
        <div
          className="rounded-[2rem] p-4 shadow-xl border backdrop-blur-xl space-y-4 text-center"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          {/* 操作模式切换 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => (isEditing ? handleSaveInfo() : setIsEditing(true))}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              {isEditing ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" /> 完成编辑
                </>
              ) : (
                <>
                  <Edit3 className="w-3 h-3" /> 编辑信息
                </>
              )}
            </button>
          </div>

          {/* 1. 头像与文本编辑区 */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 shadow-md shrink-0" style={{ borderColor: 'var(--card-border)' }}>
              <img
                src={chat.bgImage || 'https://picsum.photos/200/200?random=1'}
                alt="Banner Avatar"
                className="w-full h-full object-cover"
              />
            </div>

            {isEditing ? (
              <div className="w-full space-y-1.5 text-xs">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="沙龙名称"
                  className="w-full text-center font-bold p-1 rounded-lg border outline-none"
                  style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                />
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@Handle"
                  className="w-full text-center p-1 rounded-lg border outline-none opacity-70"
                  style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                />
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="群聊简介..."
                  className="w-full p-1.5 rounded-lg border outline-none text-xs"
                  style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                />
                <input
                  type="text"
                  value={statsText}
                  onChange={(e) => setStatsText(e.target.value)}
                  placeholder="成员统计"
                  className="w-full text-center p-1 rounded-lg border outline-none text-[10px]"
                  style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
                />
              </div>
            ) : (
              <>
                <h2 className="font-serif font-bold text-base tracking-wide">{title}</h2>
                <span className="text-[11px] opacity-50 block font-mono">{handle}</span>
                <p className="text-xs leading-relaxed opacity-80 max-w-xs">{description}</p>
                <div className="text-[11px] font-semibold opacity-70 pt-1 pb-2 border-b w-full" style={{ borderColor: 'var(--card-border)' }}>
                  {statsText}
                </div>
              </>
            )}
          </div>

          {/* 2. 伪搜索与快捷操作栏 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs opacity-60" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
              <Search className="w-3.5 h-3.5" />
              <span>搜索沙龙记录...</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
              <Plus className="w-4 h-4" />
            </div>
          </div>

          {/* 3. 画廊相册卡片区 */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-left">
            {gallery.map((item, idx) => (
              <div key={item.id || idx} className="space-y-1 group">
                <div className="aspect-square rounded-xl overflow-hidden border relative" style={{ borderColor: 'var(--card-border)' }}>
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/10" />
                </div>
                <div className="px-0.5">
                  <div className="font-bold text-xs truncate">{item.title}</div>
                  <div className="text-[10px] opacity-50">{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImaginariumHeaderBanner;
