import React, { useState } from 'react';
import { GlassCard } from '../../components/GlassCard';
import { SvgIcon } from '../../components/SvgIcon';

export const QuickBoard = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'Kaelen (AI 伴侣)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      content: '今天工作忙完记得多喝水哦，昨晚聊到的那部科幻小说我整理了心得在日记里啦。',
      time: '10:42 AM'
    }
  ]);
  const [replyText, setReplyText] = useState('');

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setMessages([
      ...messages,
      {
        id: Date.now(),
        sender: 'User',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        content: replyText,
        time: '刚刚'
      }
    ]);
    setReplyText('');
  };

  return (
    <GlassCard className="mb-6 border-l-4 border-l-purple-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SvgIcon name="messages" className="w-4 h-4 text-purple-400" />
          <h3 className="text-base font-semibold">主页动态留言板</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
          实时挂贴
        </span>
      </div>

      {/* 留言贴纸列表 */}
      <div className="space-y-3 mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className="glass-panel p-3.5 rounded-2xl flex items-start gap-3 bg-white/5">
            <img src={msg.avatar} alt={msg.sender} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-purple-300">{msg.sender}</span>
                <span className="text-[10px] text-muted">{msg.time}</span>
              </div>
              <p className="text-xs leading-relaxed font-light">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷回复敲击框 */}
      <form onSubmit={handleSendReply} className="flex gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="快速给 Kaelen 留小纸条..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-purple-500/50 transition-colors"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <SvgIcon name="send" className="w-3.5 h-3.5" />
          <span>回复</span>
        </button>
      </form>
    </GlassCard>
  );
};
