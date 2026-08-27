import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Key,
  Trash2,
  RotateCw,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Inbox,
  PenTool,
  Mail,
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  generateNpcReply,
  generateNpcToNpcQAPairs,
  generateNpcToUserQuestion
} from './askBoxAiService';

export default function AskBoxApp({ onBackHub }) {
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  const [activeTab, setActiveTab] = useState('send');

  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [isFolded, setIsFolded] = useState(true);
  const [isDelivering, setIsDelivering] = useState(false);

  const [npcQAPairs, setNpcQAPairs] = useState([]);
  const [loadingNpcMain, setLoadingNpcMain] = useState(false);

  const [incomingQuestions, setIncomingQuestions] = useState([]);
  const [selectedIncoming, setSelectedIncoming] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadCharacters();
    loadIncomingQuestions();
  }, []);

  useEffect(() => {
    if (selectedChar) {
      loadChatsForCharacter(selectedChar.id);
      loadNpcQAPairs(selectedChar);
    } else {
      setChats([]);
      setSelectedChat(null);
    }
  }, [selectedChar]);

  const loadCharacters = async () => {
    const list = await db.characters.toArray();
    setCharacters(list);

    if (list.length > 0 && !selectedChar) {
      setSelectedChar(list[0]);
    }
  };

  const loadChatsForCharacter = async (charId) => {
    const list = await db.chats.where('characterId').equals(charId).toArray();
    setChats(list);

    if (list.length > 0) {
      const sorted = [...list].sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      );
      setSelectedChat(sorted[0]);
    } else {
      setSelectedChat(null);
    }
  };

  const loadIncomingQuestions = async () => {
    const list = await db.askBoxQuestions
      .filter((q) => q.sender !== 'user')
      .reverse()
      .toArray();

    setIncomingQuestions(list);
  };

  const loadNpcQAPairs = async (character) => {
    setLoadingNpcMain(true);

    try {
      const otherChars = characters.filter((c) => c.id !== character.id);
      const pairs = await generateNpcToNpcQAPairs(character, otherChars);
      setNpcQAPairs(pairs);
    } finally {
      setLoadingNpcMain(false);
    }
  };

  // 我向角色发送提问，并同步将角色答复写入指定聊天会话。
  const handleSendQuestion = async () => {
    if (!questionText.trim() || !selectedChar) return;

    if (!selectedChat) {
      triggerGlobalToast({
        title: '选择一个消息会话',
        content: '投递提问前，必须在此角色下选中一个具体的消息对话框。',
        iconType: 'bell'
      });
      return;
    }

    setSending(true);
    setIsDelivering(true);

    const newQuestion = {
      characterId: selectedChar.id,
      chatId: selectedChat.id,
      sender: 'user',
      isAnonymous,
      content: questionText.trim(),
      reply: '',
      replyAt: null,
      needPassword: 0,
      password: '',
      isPasswordUnlocked: 1,
      createdAt: Date.now()
    };

    try {
      const qId = await db.askBoxQuestions.add(newQuestion);

      setTimeout(() => {
        setIsDelivering(false);
        setQuestionText('');
        setIsFolded(true);

        triggerGlobalToast({
          title: '信件滑入邮筒',
          content: `已成功投往与 ${selectedChar.name} 关联的消息框。`,
          iconType: 'mail',
          duration: 3000
        });
      }, 700);

      const contextMsgs = await db.messages
        .where('chatId')
        .equals(selectedChat.id)
        .reverse()
        .limit(10)
        .toArray();

      contextMsgs.reverse();

      const delayTime = Math.floor(Math.random() * 1500) + 1500;

      setTimeout(async () => {
        try {
          const reply = await generateNpcReply(
            selectedChar,
            newQuestion.content,
            isAnonymous,
            contextMsgs
          );

          await db.askBoxQuestions.update(qId, {
            reply,
            replyAt: Date.now()
          });

          const anonymityLabel = isAnonymous ? '匿名' : '署名';

          await db.messages.add({
            chatId: selectedChat.id,
            characterId: selectedChar.id,
            sender: 'character',
            type: 'text',
            metadata: { askBoxRef: qId },
            content: `「在提问箱收到了你的${anonymityLabel}提问：${newQuestion.content}」\n\n我的回答是：\n${reply}`,
            isRead: 0,
            timestamp: Date.now()
          });

          await db.chats.update(selectedChat.id, {
            updatedAt: Date.now()
          });

          triggerGlobalToast({
            title: '信箱传来回音',
            content: `${selectedChar.name} 已在会话框中作答，并同步写在了信札上。`,
            iconType: 'bell',
            duration: 4000
          });

          loadIncomingQuestions();
        } catch (error) {
          console.error('[AskBox] 生成角色答复失败：', error);
        }
      }, delayTime);
    } catch (error) {
      console.error(error);
      setIsDelivering(false);
    } finally {
      setSending(false);
    }
  };

  const handleRerollNpcMain = () => {
    if (selectedChar) {
      loadNpcQAPairs(selectedChar);
    }
  };

  // 模拟角色主动向用户发来一封提问信。
  // 关键修复：创建时保存对应 chatId，后续答复优先写入该会话。
  const handleTriggerIncoming = async () => {
    if (characters.length === 0) {
      triggerGlobalToast({
        title: '尚无角色',
        content: '请先创建至少一位陪伴角色。',
        iconType: 'bell'
      });
      return;
    }

    const randomChar =
      characters[Math.floor(Math.random() * characters.length)];
    const randomPassword = Math.floor(
      1000 + Math.random() * 9000
    ).toString();

    const questionContent = await generateNpcToUserQuestion(randomChar);
    const needsLock = Math.random() > 0.3;

    const characterChats = await db.chats
      .where('characterId')
      .equals(randomChar.id)
      .toArray();

    const targetChat = [...characterChats].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    )[0];

    const newIncoming = {
      characterId: randomChar.id,
      chatId: targetChat?.id || null,
      sender: randomChar.name,
      isAnonymous: needsLock,
      content: questionContent,
      reply: '',
      replyAt: null,
      needPassword: needsLock ? 1 : 0,
      password: randomPassword,
      isPasswordUnlocked: needsLock ? 0 : 1,
      createdAt: Date.now()
    };

    await db.askBoxQuestions.add(newIncoming);

    console.log(
      `[开发调试提示] 匿名来信真实寄件人是 [${randomChar.name}]，4位解锁身份密码为：${randomPassword}`
    );

    triggerGlobalToast({
      title: '邮差轻轻叩门',
      content: needsLock
        ? '收到一封寄件身份被火漆锁住的提问信。'
        : `收到来自 ${randomChar.name} 的公开提问信。`,
      iconType: 'mail',
      duration: 4000
    });

    loadIncomingQuestions();
  };

  const handleUnlockPassword = () => {
    if (!selectedIncoming) return;

    if (passwordInput.trim() === selectedIncoming.password) {
      db.askBoxQuestions
        .update(selectedIncoming.id, {
          isPasswordUnlocked: 1
        })
        .then(() => {
          setSelectedIncoming((prev) => ({
            ...prev,
            isPasswordUnlocked: 1
          }));
          setPasswordInput('');
          setPasswordError(false);
          loadIncomingQuestions();

          triggerGlobalToast({
            title: '封泥已被敲碎',
            content: `已破译真实写信人是：${selectedIncoming.sender}`,
            iconType: 'mail'
          });
        });
    } else {
      setPasswordError(true);

      triggerGlobalToast({
        title: '密码错误',
        content: '数字无法咬合，无法溶解蜡印。',
        iconType: 'bell'
      });
    }
  };

  // 无论身份是否解锁，都允许回答。
  const handleReplyIncoming = async () => {
    if (!replyText.trim() || !selectedIncoming) return;

    setReplying(true);

    const charId = selectedIncoming.characterId;
    const resolvedReply = replyText.trim();

    try {
      await db.askBoxQuestions.update(selectedIncoming.id, {
        reply: resolvedReply,
        replyAt: Date.now()
      });

      // 优先使用来信创建时记录的 chatId。
      let activeChat = selectedIncoming.chatId
        ? await db.chats.get(selectedIncoming.chatId)
        : null;

      // 兼容旧数据：没有 chatId 时回退到角色下的已有会话。
      if (!activeChat) {
        activeChat = await db.chats
          .where('characterId')
          .equals(charId)
          .first();
      }

      // 如果角色尚无会话，则创建一个新的提问箱会话。
      if (!activeChat) {
        const chatId = await db.chats.add({
          characterId: charId,
          mode: 'chat',
          title:
            selectedIncoming.needPassword &&
            !selectedIncoming.isPasswordUnlocked
              ? '提问箱对话'
              : selectedIncoming.sender || '提问箱对话',
          summary: '',
          updatedAt: Date.now()
        });

        activeChat = { id: chatId };

        await db.askBoxQuestions.update(selectedIncoming.id, {
          chatId
        });
      }

      const displaySenderName =
        selectedIncoming.needPassword &&
        !selectedIncoming.isPasswordUnlocked
          ? '匿名提问者'
          : selectedIncoming.sender || '提问者';

      await db.messages.add({
        chatId: activeChat.id,
        characterId: charId,
        sender: 'user',
        type: 'text',
        metadata: { askBoxRef: selectedIncoming.id },
        content: `「在提问箱答复了${displaySenderName}的提问：${selectedIncoming.content}」\n\n我的回答：${resolvedReply}`,
        isRead: 1,
        timestamp: Date.now()
      });

      await db.chats.update(activeChat.id, {
        updatedAt: Date.now()
      });

      triggerGlobalToast({
        title: '答复送达',
        content: '已将回答同步反馈到你的聊天对话框中。',
        iconType: 'mail'
      });

      setReplyText('');
      setSelectedIncoming(null);
      loadIncomingQuestions();

      if (selectedChar?.id === charId) {
        loadChatsForCharacter(charId);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setReplying(false);
    }
  };

  const triggerDelete = (id) => {
    setConfirmDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId) {
      await db.askBoxQuestions.delete(confirmDeleteId);

      triggerGlobalToast({
        title: '焚毁成功',
        content: '信件碎屑已随潮汐飘散。',
        iconType: 'mail'
      });

      setSelectedIncoming(null);
      loadIncomingQuestions();
    }

    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col space-y-6 min-h-[85vh] text-[var(--text-main)] font-sans">
      <header
        className="flex items-center justify-between pb-2 border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          onClick={onBackHub}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <span className="font-serif text-[10px] uppercase tracking-[0.25em] opacity-40">
          Inquiry Box • Issue No. 04
        </span>
      </header>

      <div className="space-y-1">
        <h2 className="font-serif text-4xl font-normal tracking-tight leading-none">
          提问信箱
        </h2>

        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-widest uppercase opacity-40">
            Anonymity exchange between souls
          </p>
          <div
            className="h-px flex-1 mx-4 opacity-15"
            style={{ backgroundColor: 'var(--text-main)' }}
          />
          <span className="text-[9px] uppercase tracking-wider opacity-30 font-mono">
            PWA Stable
          </span>
        </div>
      </div>

      <div
        className="flex w-full border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'send'
              ? 'text-[var(--text-main)]'
              : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          给角色写信
          {activeTab === 'send' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text-main)]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('receive')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'receive'
              ? 'text-[var(--text-main)] font-bold'
              : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          收到的来信
          {incomingQuestions.some((q) => !q.reply) && (
            <span className="absolute top-1 right-[22%] h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
          {activeTab === 'receive' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text-main)]" />
          )}
        </button>
      </div>

      {activeTab === 'send' ? (
        <div className="space-y-6 animate-fade-in">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              投递给谁 / Deliver to
            </label>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char)}
                  className={`flex flex-col items-center gap-2 p-2.5 rounded-2xl border transition-all min-w-[80px] ${
                    selectedChar?.id === char.id
                      ? 'border-[var(--text-main)] bg-[var(--control-soft-bg)] scale-95 shadow-sm'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-60'
                  }`}
                >
                  <img
                    src={
                      char.avatar ||
                      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=100'
                    }
                    alt={char.name}
                    className="h-10 w-10 rounded-full object-cover filter grayscale border border-stone-200"
                    onError={(event) => {
                      event.target.src =
                        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=100';
                    }}
                  />
                  <span className="text-[10px] font-bold tracking-tight">
                    {char.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedChar && (
            <div className="space-y-2 animate-fade-in-up">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 opacity-80" />
                投递至指定消息框 (关联上下文)
              </label>

              {chats.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${
                        selectedChat?.id === chat.id
                          ? 'border-[var(--text-main)] bg-[var(--control-soft-bg)] font-semibold'
                          : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-75'
                      }`}
                    >
                      <span className="truncate">
                        {chat.title || '无标题会话'}
                      </span>
                      <span className="text-[9px] opacity-40">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 border rounded-xl border-dashed text-xs text-center opacity-50 bg-[var(--bg-surface)]">
                  没有找到与该角色的消息框。请先前往聊天室创建一个对话。
                </div>
              )}
            </div>
          )}

          {selectedChar && selectedChat && (
            <div className="relative mt-2">
              {isDelivering && (
                <div className="absolute inset-0 bg-[var(--bg-main)]/90 z-20 flex flex-col items-center justify-center rounded-2xl animate-fade-in">
                  <div className="animate-bounce">
                    <Mail
                      className="h-10 w-10"
                      style={{ color: 'var(--text-main)' }}
                    />
                  </div>
                  <span className="text-xs uppercase tracking-widest font-serif mt-3 animate-pulse">
                    正在火漆固封并塞入邮筒...
                  </span>
                </div>
              )}

              <div
                onClick={() => isFolded && setIsFolded(false)}
                className={`border rounded-2xl p-5 transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col justify-between ${
                  isFolded
                    ? 'h-24 bg-[var(--bg-surface)] border-dashed hover:scale-[1.01] cursor-pointer'
                    : 'h-auto bg-[var(--card-bg)] border-solid'
                }`}
                style={{
                  borderColor: isFolded
                    ? 'var(--text-muted)'
                    : 'var(--card-border)'
                }}
              >
                {isFolded ? (
                  <div className="flex items-center justify-between h-full w-full">
                    <div className="space-y-1">
                      <h4
                        className="font-serif text-sm font-bold"
                        style={{ color: 'var(--text-main)' }}
                      >
                        点击铺开空白信笺
                      </h4>
                      <p
                        className="text-[10px] uppercase tracking-wider"
                        style={{ color: 'var(--text-sub)' }}
                      >
                        致: {selectedChar.name} • 寄至《{selectedChat.title}》
                      </p>
                    </div>

                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center border transition-colors"
                      style={{
                        borderColor: 'var(--divider)',
                        backgroundColor: 'var(--control-soft-bg)'
                      }}
                    >
                      <ChevronDown
                        className="h-4 w-4"
                        style={{ color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-widest opacity-40 font-mono">
                      <span>信纸正文 •致 {selectedChar.name}</span>
                      <span>邮签: POSTAL MAIL</span>
                    </div>

                    <div
                      className="h-px"
                      style={{ backgroundColor: 'var(--divider)' }}
                    />

                    <textarea
                      value={questionText}
                      onChange={(event) => setQuestionText(event.target.value)}
                      placeholder="写下你想在会话中问他的问题。他会收到通知，并在对应的消息框中进行长信答复..."
                      rows={4}
                      maxLength={200}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed border-none outline-none focus:ring-0 placeholder-opacity-40"
                      style={{
                        color: 'var(--text-main)',
                        fontFamily: 'serif',
                        backgroundAttachment: 'local',
                        backgroundImage:
                          'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0) 95%, var(--divider) 95%)',
                        backgroundSize: '100% 2.2rem',
                        lineHeight: '2.2rem'
                      }}
                    />

                    <div
                      className="flex items-center justify-between pt-4 border-t border-dashed"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsAnonymous(!isAnonymous);
                        }}
                        className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        {isAnonymous ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        )}

                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {isAnonymous ? '匿名提问' : '署名提问'}
                        </span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsFolded(true);
                          }}
                          className="px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors hover:bg-[var(--control-soft-hover)]"
                          style={{
                            borderColor: 'var(--card-border)',
                            backgroundColor: 'var(--control-soft-bg)'
                          }}
                        >
                          收起信纸
                        </button>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSendQuestion();
                          }}
                          disabled={sending || !questionText.trim()}
                          className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all disabled:opacity-30 active:scale-95"
                          style={{
                            backgroundColor: 'var(--accent-color)',
                            color: 'var(--accent-foreground)'
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                          投进信箱
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedChar && (
            <div className="space-y-4 pt-3">
              <div
                className="flex items-center justify-between border-b pb-2"
                style={{ borderColor: 'var(--divider)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                  {selectedChar.name} 主页公开的往来信笺
                </span>

                <button
                  onClick={handleRerollNpcMain}
                  disabled={loadingNpcMain}
                  className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
                >
                  <RotateCw
                    className={`h-3 w-3 ${
                      loadingNpcMain ? 'animate-spin' : ''
                    }`}
                  />
                  Reroll
                </button>
              </div>

              {loadingNpcMain ? (
                <div className="py-10 text-center text-xs italic opacity-40 animate-pulse font-serif">
                  正在翻检旧信纸...
                </div>
              ) : (
                <div className="space-y-5">
                  {npcQAPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300"
                      style={{
                        borderColor: 'var(--card-border)',
                        backgroundColor: 'var(--card-bg)'
                      }}
                    >
                      <div
                        className="p-4"
                        style={{ backgroundColor: 'var(--bg-surface)' }}
                      >
                        <div className="flex justify-between items-center text-[9px] uppercase tracking-widest opacity-40 mb-1.5 font-mono">
                          <span>LETTER #{idx + 1}</span>
                          <span>FROM: {pair.from || '匿名人士'}</span>
                        </div>

                        <p
                          className="text-xs font-serif italic leading-relaxed"
                          style={{ color: 'var(--text-main)' }}
                        >
                          「{pair.question}」
                        </p>
                      </div>

                      <div
                        className="p-4 relative border-t border-dashed"
                        style={{
                          borderColor: 'var(--divider)',
                          backgroundColor: 'var(--card-bg)'
                        }}
                      >
                        <div
                          className="absolute top-[-3.5px] left-0 right-0 h-[6px] opacity-10 bg-transparent border-b-[6px] border-dotted"
                          style={{ borderColor: 'var(--text-main)' }}
                        />

                        <div className="text-[9px] uppercase tracking-widest opacity-35 mb-2 flex items-center gap-1 font-mono">
                          <span>REPLY BY {selectedChar.name}</span>
                        </div>

                        <p
                          className="text-xs leading-relaxed font-serif"
                          style={{ color: 'var(--text-sub)' }}
                        >
                          {pair.reply}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              信匣存根
            </span>

            <button
              onClick={handleTriggerIncoming}
              className="text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-dashed opacity-50 hover:opacity-100 transition-opacity"
              style={{
                color: 'var(--text-sub)',
                borderColor: 'var(--card-border)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              聆听来信 (测试同步)
            </button>
          </div>

          <div className="space-y-4">
            {incomingQuestions.map((item) => {
              const isIdentityLocked =
                item.needPassword && !item.isPasswordUnlocked;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedIncoming(item);
                    setPasswordInput('');
                    setPasswordError(false);
                    setReplyText('');
                  }}
                  className={`p-4 border rounded-2xl transition-all cursor-pointer relative ${
                    selectedIncoming?.id === item.id
                      ? 'border-[var(--text-main)] shadow-md scale-[0.99]'
                      : 'border-[var(--card-border)] hover:bg-[var(--bg-surface)]'
                  }`}
                  style={{
                    backgroundColor:
                      selectedIncoming?.id === item.id
                        ? 'var(--control-soft-bg)'
                        : 'var(--card-bg)'
                  }}
                >
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider opacity-45 mb-2 font-mono">
                    <div className="flex items-center gap-1.5">
                      {isIdentityLocked ? (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Lock className="h-3 w-3" />
                          [ 寄信人身份已用蜡印封锁 ]
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <Unlock className="h-3 w-3" />
                          来自: {item.sender}
                        </span>
                      )}
                    </div>

                    <span>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="py-1">
                    <p
                      className="text-xs font-serif leading-relaxed"
                      style={{ color: 'var(--text-main)' }}
                    >
                      「{item.content}」
                    </p>
                  </div>

                  {item.reply ? (
                    <div
                      className="mt-2.5 pt-2 border-t border-dotted"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <span className="text-[9px] uppercase tracking-widest opacity-40">
                        已同步的答复：
                      </span>
                      <p
                        className="text-[11px] font-sans italic opacity-75 mt-0.5"
                        style={{ color: 'var(--text-sub)' }}
                      >
                        {item.reply}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="mt-2 pt-2 border-t border-dotted flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-red-500"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <span>等待我的答复</span>
                      <span className="animate-pulse">●</span>
                    </div>
                  )}

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      triggerDelete(item.id);
                    }}
                    className="absolute bottom-3 right-3 p-1 rounded opacity-50 hover:opacity-100 hover:text-red-500 transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    title="烧毁存根"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {incomingQuestions.length === 0 && (
              <div
                className="py-14 text-center border border-dashed rounded-2xl animate-fade-in"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <Inbox className="h-8 w-8 mx-auto opacity-20" />
                <p className="mt-2.5 text-xs opacity-40 font-serif">
                  目前还没有收到任何纸笺提问
                </p>
              </div>
            )}
          </div>

          {selectedIncoming && (
            <div
              className="p-5 border rounded-2xl mt-4 space-y-4 shadow-lg animate-fade-in-up"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--card-border)'
              }}
            >
              <div
                className="flex items-center justify-between border-b pb-2"
                style={{ borderColor: 'var(--divider)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                  {selectedIncoming.needPassword &&
                  !selectedIncoming.isPasswordUnlocked
                    ? '加密信件'
                    : selectedIncoming.sender}{' '}
                  信件查看
                </span>

                <button
                  onClick={() => setSelectedIncoming(null)}
                  className="text-[10px] font-bold tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                >
                  关闭 (CLOSE)
                </button>
              </div>

              {/* 问题正文始终显示，不受身份解锁状态影响。 */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <div className="flex justify-between items-center text-[9px] uppercase tracking-widest opacity-35 mb-1">
                  <span>问题正文</span>
                  <span>
                    {selectedIncoming.needPassword &&
                    !selectedIncoming.isPasswordUnlocked
                      ? '寄件者: 身份匿名'
                      : `寄件者: ${selectedIncoming.sender}`}
                  </span>
                </div>

                <p
                  className="font-serif text-xs leading-relaxed"
                  style={{ color: 'var(--text-main)' }}
                >
                  「{selectedIncoming.content}」
                </p>
              </div>

              {/* 密码区只用于解锁身份；即使不解锁，下面仍可直接答复。 */}
              {selectedIncoming.needPassword &&
                !selectedIncoming.isPasswordUnlocked && (
                  <div
                    className="space-y-4 text-center py-3 bg-[var(--card-bg)] p-4 rounded-xl border"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex justify-center mb-1">
                      <Key className="h-7 w-7 text-amber-500 opacity-80" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        输入 4 位数解锁寄信人
                      </h4>
                      <p className="text-[10px] opacity-40 leading-relaxed max-w-[280px] mx-auto">
                        不解锁也可以直接回答这道问题。密码仅用于查看寄信人的真实身份。
                      </p>
                    </div>

                    <div className="flex justify-center gap-2 max-w-[220px] mx-auto">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={passwordInput}
                        onChange={(event) => {
                          setPasswordInput(
                            event.target.value.replace(/\D/g, '')
                          );
                          setPasswordError(false);
                        }}
                        placeholder="••••"
                        className="w-full text-center border rounded-lg py-2 text-lg tracking-[0.6em] font-mono outline-none transition-all focus:border-[var(--text-main)]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--card-border)',
                          color: 'var(--text-main)'
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleUnlockPassword}
                        disabled={passwordInput.length !== 4}
                        className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-transform active:scale-95 disabled:opacity-30"
                        style={{
                          backgroundColor: 'var(--accent-color)',
                          color: 'var(--accent-foreground)'
                        }}
                      >
                        解锁身份
                      </button>
                    </div>

                    {passwordError && (
                      <p className="text-[10px] text-red-500">
                        密码不正确，但你仍然可以回答这道问题。
                      </p>
                    )}
                  </div>
                )}

              {/* 回复区始终显示，无论身份是否解锁。 */}
              {selectedIncoming.reply ? (
                <div
                  className="p-4 rounded-xl border border-dashed"
                  style={{
                    borderColor: 'var(--card-border)',
                    backgroundColor: 'var(--card-bg)'
                  }}
                >
                  <span className="text-[9px] uppercase tracking-widest opacity-40">
                    已寄往对话框的答案：
                  </span>

                  <p className="text-xs font-sans italic opacity-85 mt-1 leading-relaxed">
                    {selectedIncoming.reply}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1">
                    <PenTool className="h-3 w-3" />
                    填写你的答复并寄给对方
                  </label>

                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder={
                      selectedIncoming.needPassword &&
                      !selectedIncoming.isPasswordUnlocked
                        ? '即使不知道寄信人是谁，也可以直接写下你的回答...'
                        : '将答案写在信封背面。提交后，这行字会立刻以你的名义出现在对应的聊天记录中...'
                    }
                    rows={3}
                    maxLength={200}
                    className="w-full p-3 border rounded-xl resize-none text-xs leading-relaxed outline-none"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleReplyIncoming}
                      disabled={replying || !replyText.trim()}
                      className="px-5 py-1.5 rounded-full text-xs font-bold tracking-wider transition-transform active:scale-95 disabled:opacity-30"
                      style={{
                        backgroundColor: 'var(--accent-color)',
                        color: 'var(--accent-foreground)'
                      }}
                    >
                      {replying ? '投递中' : '投回聊天框'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="焚毁来信"
          message="确定要彻底烧掉这封来信吗？该操作不可撤销，对应的存根也将永远消失。"
          confirmText="焚毁"
          cancelText="保留"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
