import React, { useState, useEffect } from 'react';
import { X, Camera, Sparkles, Image as ImageIcon, MapPin, Link2 } from 'lucide-react';
import db from '../../db';

export const CreateSnapshotModal = ({ isOpen, onClose, onPostCreated, onInviteAiPost }) => {
  const [mode, setMode] = useState('user'); // 'user' | 'ai'
  const [characters, setCharacters] = useState([]);
  const [chats, setChats] = useState([]);

  // User 表单
  const [mediaUrl, setMediaUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');

  // AI 邀约表单
  const [aiCharacterId, setAiCharacterId] = useState('');
  const [aiTopicHint, setAiTopicHint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadSelectOptions();
  }, [isOpen]);

  const loadSelectOptions = async () => {
    try {
      const charList = await db.characters.toArray();
      const chatList = await db.chats.toArray();
      setCharacters(charList);
      setChats(chatList);
      if (charList.length > 0) setAiCharacterId(charList[0].id);
    } catch (err) {
      console.error('Failed to load select options:', err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitUserPost = async (e) => {
    e.preventDefault();
    if (!imagePrompt.trim() && !content.trim()) return;

    try {
      let authorName = 'User';
      let authorAvatar = '';

      if (selectedChatId) {
        const chat = chats.find(c => c.id === Number(selectedChatId));
        if (chat) {
          const char = characters.find(c => c.id === chat.characterId);
          authorName = char?.userPersona || 'User';
          authorAvatar = char?.userAvatar || '';
        }
      } else {
        const savedPersona = await db.snapshotSettings.get('globalPersona');
        const savedAvatar = await db.snapshotSettings.get('globalAvatar');
        if (savedPersona?.value) authorName = savedPersona.value.split('\n')[0] || 'User';
        if (savedAvatar?.value) authorAvatar = savedAvatar.value;
      }

      await db.snapshots.add({
        authorType: 'user',
        authorName,
        authorAvatar,
        mediaUrl: mediaUrl || '',
        imagePrompt: imagePrompt.trim(),
        content: content.trim(),
        location: location.trim() || '某处空间',
        likes: 0,
        isLiked: false,
        linkedChatId: selectedChatId ? Number(selectedChatId) : null,
        timestamp: Date.now()
      });

      // 重置表单
      setMediaUrl('');
      setImagePrompt('');
      setContent('');
      setLocation('');
      setSelectedChatId('');
      onPostCreated();
      onClose();
    } catch (err) {
      console.error('Failed to submit post:', err);
    }
  };

  const handleSubmitAiInvite = async () => {
    if (!aiCharacterId) return;
    onInviteAiPost(Number(aiCharacterId), aiTopicHint, selectedChatId ? Number(selectedChatId) : null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[2rem] p-5 space-y-4 border shadow-2xl flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-bold text-sm">发布拍立得动态 / 邀约 AI</h3>
          <button onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <button
            onClick={() => setMode('user')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'user' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: mode === 'user' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            自己发布动态
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'ai' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: mode === 'ai' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            邀约伴侣 AI 主动发帖
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {mode === 'user' ? (
            <form onSubmit={handleSubmitUserPost} className="space-y-3">
              {/* 图片预览与上传区 */}
              <div>
                <label className="text-xs font-semibold block mb-1">照片上传 (可选)</label>
                <div
                  className="h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                >
                  {mediaUrl ? (
                    <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center opacity-60 space-y-1">
                      <Camera className="w-6 h-6 mx-auto opacity-70" />
                      <span className="text-[11px] block">点击上传真实照片 (也可不传)</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
              </div>

              {/* 图片描述必填 */}
              <div>
                <label className="text-xs font-semibold block mb-1">
                  画面描述 <span className="text-red-500 font-bold">* 必填 (供 AI 理解视觉画面)</span>
                </label>
                <textarea
                  required
                  placeholder="例: 午后散落在复古木桌上的咖啡杯、拍立得相片与明媚的阳光线角..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none h-16 resize-none"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              {/* 配文 */}
              <div>
                <label className="text-xs font-semibold block mb-1">动态随感 / 文字</label>
                <textarea
                  placeholder="写下这一刻的心境..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none h-16 resize-none"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              {/* 地点与对话框联动 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold block mb-1">地点打卡</label>
                  <div className="flex items-center gap-1 p-2 rounded-xl border text-xs" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                    <MapPin className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    <input
                      type="text"
                      placeholder="地点名称..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-transparent outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold block mb-1">关联特定对话框人设</label>
                  <div className="flex items-center gap-1 p-2 rounded-xl border text-xs" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                    <Link2 className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    <select
                      value={selectedChatId}
                      onChange={(e) => setSelectedChatId(e.target.value)}
                      className="w-full bg-transparent outline-none text-xs"
                    >
                      <option value="">使用全局 User 人设</option>
                      {chats.map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95 mt-2"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                发布到 Snapshots
              </button>
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-[11px] opacity-60">
                邀请角色库中的伴侣 AI 独立创作一条符合其人设的生活时刻动态。
              </p>

              <div>
                <label className="text-xs font-semibold block mb-1">选择邀约发帖的伴侣</label>
                <select
                  value={aiCharacterId}
                  onChange={(e) => setAiCharacterId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">灵感 / 主题引导 (可选)</label>
                <input
                  type="text"
                  placeholder="例: 雨天书房里的热可可、下班后的落日交响曲..."
                  value={aiTopicHint}
                  onChange={(e) => setAiTopicHint(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">关联特定对话框记忆 (可选)</label>
                <select
                  value={selectedChatId}
                  onChange={(e) => setSelectedChatId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <option value="">不关联 (纯基于角色库个人设定)</option>
                  {chats.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.title}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSubmitAiInvite}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>生成伴侣拍立得动态</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateSnapshotModal;
