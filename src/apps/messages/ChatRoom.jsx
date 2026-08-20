import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Sparkles, Image, Volume2, DollarSign, FileText,
  Trash2, RotateCcw, Quote, CheckCheck, Sliders, VolumeX, Eye
} from 'lucide-react';
import db from '../../db';
import ChatHeaderBar from './components/ChatHeaderBar';
import TypingIndicator from './components/TypingIndicator';
import AudioKeepAlive from './components/AudioKeepAlive';
import BubbleCustomizer from './components/BubbleCustomizer';

import TextCard from './components/cards/TextCard';
import ImageCard from './components/cards/ImageCard';
import VoiceCard from './components/cards/VoiceCard';
import TransferCard from './components/cards/TransferCard';
import ArticleCard from './components/cards/ArticleCard';

export const ChatRoom = ({ chatId, onBack, onOpenCharacterEditor }) => {
  const [chat, setChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedType, setSelectedType] = useState('text'); // text | image | voice | transfer | article
  const [isAiTyping, setIsAiTyping] = useState(false);

  const [quotedMsg, setQuotedMsg] = useState(null);
  const [showBubbleCustomizer, setShowBubbleCustomizer] = useState(false);
  const [extraInputMeta, setExtraInputMeta] = useState({});

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatData();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const loadChatData = async () => {
    const chatRecord = await db.chats.get(chatId);
    if (!chatRecord) return;
    setChat(chatRecord);

    const charRecord = await db.characters.get(chatRecord.characterId);
    if (charRecord) setCharacter(charRecord);

    const msgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
    setMessages(msgs);
  };

  // 用户发送消息 (不触发 AI，允许连续发多条)
  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim() || (selectedType === 'image' ? '看我发给你的这张图片' : '语音消息'),
      metadata: extraInputMeta,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString()
    };

    const msgId = await db.messages.add(newMsg);
    newMsg.id = msgId;
    setMessages((prev) => [...prev, newMsg]);

    setInputText('');
    setQuotedMsg(null);
    setSelectedType('text');
    setExtraInputMeta({});
    await db.chats.update(chatId, { updatedAt: new Date().toISOString() });
  };

  // 触发 AI 回复 (Trigger AI)
  const handleTriggerAi = async () => {
    if (!character || isAiTyping) return;
    setIsAiTyping(true);

    try {
      const apiSettings = await db.settings.get('apiConfig');
      const apiConfig = apiSettings?.value || {};

      let aiContent = `${character.name} 收到你的消息，并给了你温暖的肯定。`;

      if (apiConfig.baseUrl && apiConfig.apiKey) {
        // 请求真实 LLM API
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
        const historyContext = messages.slice(-15).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.model || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: `${character.bio}\n${character.extraNotes}` },
              ...historyContext
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          aiContent = data.choices?.[0]?.message?.content || aiContent;
        }
      }

      const aiMsg = {
        chatId,
        characterId: character.id,
        sender: 'character',
        type: 'text',
        content: aiContent,
        metadata: {},
        isRead: true,
        timestamp: new Date().toISOString()
      };

      const msgId = await db.messages.add(aiMsg);
      aiMsg.id = msgId;
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI Response failed:', err);
    } finally {
      setIsAiTyping(false);
    }
  };

  // 删除单条消息
  const handleDeleteMessage = async (id) => {
    await db.messages.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // 清空聊天记录
  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
  };

  // 保存气泡与打字文案
  const handleSaveBubbleStyle = async (newStyle) => {
    const updated = { ...chat, bubbleStyle: newStyle };
    setChat(updated);
    await db.chats.update(chatId, { bubbleStyle: newStyle });
  };

  if (!chat || !character) return null;

  const bubbleStyle = chat.bubbleStyle || {};

  return (
    <div className="flex flex-col h-[85vh] text-xs text-left">
      {/* 1. 顶部 Header Bar */}
      <div className="flex items-center justify-between pb-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 font-semibold opacity-70 hover:opacity-100">
          <ArrowLeft className="w-4 h-4" />
          <span>Chats</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBubbleCustomizer(true)}
            className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 opacity-70 hover:opacity-100"
            title="定制气泡样式"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <ChatHeaderBar character={character} chat={chat} onOpenSettings={onOpenCharacterEditor} />

      {/* 2. 聊天消息流 */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1">
        {messages.length === 0 && (
          <div className="py-12 text-center space-y-2 opacity-40">
            <p className="font-mono text-[11px]">NO MESSAGES YET</p>
            <p className="text-[10px]">在下方输入内容向 {character.name} 发送消息</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const quoted = msg.quotedMessageId ? messages.find((m) => m.id === msg.quotedMessageId) : null;

          return (
            <div key={msg.id} className={`flex flex-col space-y-1 group ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1 text-[9px] opacity-40 font-mono px-1">
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isUser && <CheckCheck className="w-3 h-3 text-blue-500 opacity-80" />}
              </div>

              {quoted && (
                <div className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border-l-2 border-current opacity-60 text-[10px] max-w-[80%]">
                  <span className="font-bold block">{quoted.sender === 'user' ? 'You' : character.name}</span>
                  <p className="truncate">{quoted.content}</p>
                </div>
              )}

              <div className="flex items-end gap-1.5 max-w-[85%]">
                {!isUser && character.avatar && (
                  <img src={character.avatar} alt={character.name} className="w-6 h-6 rounded-full object-cover shrink-0 mb-1" />
                )}

                <div
                  className={`p-3.5 rounded-2xl shadow-sm relative transition-all ${bubbleStyle.fontFamily || 'font-sans'} ${bubbleStyle.fontSize || 'text-xs'} ${
                    isUser
                      ? bubbleStyle.userBg || 'bg-black text-white dark:bg-white dark:text-black'
                      : bubbleStyle.aiBg || 'bg-black/5 dark:bg-white/10 text-current'
                  }`}
                >
                  {msg.type === 'text' && <TextCard content={msg.content} />}
                  {msg.type === 'image' && <ImageCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'voice' && <VoiceCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'transfer' && <TransferCard content={msg.content} metadata={msg.metadata} />}
                  {msg.type === 'article' && <ArticleCard content={msg.content} metadata={msg.metadata} />}
                </div>

                {/* 消息快捷悬浮菜单 */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                  <button type="button" onClick={() => setQuotedMsg(msg)} className="p-1 opacity-50 hover:opacity-100" title="引用">
                    <Quote className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => handleDeleteMessage(msg.id)} className="p-1 opacity-50 hover:opacity-100 text-rose-500" title="删除">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isAiTyping && <TypingIndicator customText={chat.typingText || `${character.name} 正在思考...`} />}
        <div ref={messagesEndRef} />
      </div>

      {/* 引用回复提示框 */}
      {quotedMsg && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/10 border-l-2 border-black dark:border-white text-[10px] mb-2">
          <div className="truncate pr-2">
            <span className="font-bold">引用 {quotedMsg.sender === 'user' ? 'You' : character.name}:</span> {quotedMsg.content}
          </div>
          <button type="button" onClick={() => setQuotedMsg(null)} className="p-1 opacity-60 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {/* 特殊卡片类型扩展输入配置 */}
      {selectedType !== 'text' && (
        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10 mb-2 space-y-2 text-[11px]">
          <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
            <span>MODIFIER: {selectedType.toUpperCase()}</span>
            <button type="button" onClick={() => setSelectedType('text')}>&times;</button>
          </div>
          {selectedType === 'image' && (
            <input
              type="text"
              placeholder="输入图片的视觉细节描述..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-white dark:bg-black/40 rounded p-1.5 outline-none"
            />
          )}
          {selectedType === 'transfer' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="转账金额 (如 520.00)"
                onChange={(e) => setExtraInputMeta({ ...extraInputMeta, amount: e.target.value })}
                className="w-1/2 bg-white dark:bg-black/40 rounded p-1.5 outline-none"
              />
              <input
                type="text"
                placeholder="名目说明"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-1/2 bg-white dark:bg-black/40 rounded p-1.5 outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* 3. 底部悬浮输入框 */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-1.5 p-2 rounded-3xl border border-white/20 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-lg">
          {/* 特殊消息类型工具 */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-1.5 opacity-70">
            <button
              type="button"
              onClick={() => setSelectedType('image')}
              className={`p-1.5 rounded-full transition-all ${selectedType === 'image' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="图片卡片"
            >
              <Image className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('voice')}
              className={`p-1.5 rounded-full transition-all ${selectedType === 'voice' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="模拟语音"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('transfer')}
              className={`p-1.5 rounded-full transition-all ${selectedType === 'transfer' ? 'bg-black/10 dark:bg-white/20 font-bold' : ''}`}
              title="杂志风转账"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder={selectedType === 'text' ? '输入消息...' : `已选 ${selectedType} 格式`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-transparent px-2 outline-none font-sans text-xs"
          />

          {/* 双发送按钮：发送消息 & Trigger AI */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSendMessage}
              className="p-2 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 active:scale-95 transition-all"
              title="仅发送消息 (不触发AI)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTriggerAi}
              disabled={isAiTyping}
              className="px-3 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-[10px] flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
              title="触发 AI 生成回复"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>AI</span>
            </button>
          </div>
        </div>

        {/* 顶部/底部提示栏与清理历史 */}
        <div className="flex items-center justify-between px-2 text-[10px] opacity-40">
          <button type="button" onClick={handleClearHistory} className="hover:opacity-100 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            <span>清空本记录</span>
          </button>
          <span className="font-mono">ENCRYPTED LOCAL STORAGE</span>
        </div>
      </div>

      {showBubbleCustomizer && (
        <BubbleCustomizer
          currentStyle={bubbleStyle}
          onSave={handleSaveBubbleStyle}
          onClose={() => setShowBubbleCustomizer(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;
