import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Key, 
  Trash2, 
  RotateCw, 
  HelpCircle, 
  UserCheck, 
  UserX, 
  Lock, 
  Unlock,
  CheckCircle,
  Inbox,
  PenTool,
  Mail,
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import { generateNpcReply, generateNpcToNpcQAPairs, generateNpcToUserQuestion } from './askBoxAiService';

export default function AskBoxApp({ onBackHub }) {
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // 当前角色对应的消息会话(chats)列表及选中的消息会话
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  
  // 选项卡： 'send' (给角色写信/主页) | 'receive' (收到的来信)
  const [activeTab, setActiveTab] = useState('send');
  
  // 我向角色提问状态
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [isFolded, setIsFolded] = useState(true); // 拟物折叠动效
  const [isDelivering, setIsDelivering] = useState(false); // 投递动画

  // 角色公开提问箱的 NPC 随机问答对
  const [npcQAPairs, setNpcQAPairs] = useState([]);
  const [loadingNpcMain, setLoadingNpcMain] = useState(false);
  
  // 角色向我提问的状态
  const [incomingQuestions, setIncomingQuestions] = useState([]);
  const [selectedIncoming, setSelectedIncoming] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // 删除确认
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 加载数据
  useEffect(() => {
    loadCharacters();
    loadIncomingQuestions();
  }, []);

  // 当选择角色变动时，拉取该角色下的消息框(chats)与公开问答对
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
      setSelectedChat(list[0]);
    } else {
      setSelectedChat(null);
    }
  };

  const loadIncomingQuestions = async () => {
    const list = await db.askBoxQuestions
      .filter(q => q.sender !== 'user')
      .reverse()
      .toArray();
    setIncomingQuestions(list);
  };

  const loadNpcQAPairs = async (character) => {
    setLoadingNpcMain(true);
    const otherChars = characters.filter(c => c.id !== character.id);
    const pairs = await generateNpcToNpcQAPairs(character, otherChars);
    setNpcQAPairs(pairs);
    setLoadingNpcMain(false);
  };

  // 1. 发送提问（带消息框上下文）
  const handleSendQuestion = async () => {
    if (!questionText.trim() || !selectedChar) return;
    
    // 如果没有选择消息框，提示必须绑定上下文
    if (!selectedChat) {
      triggerGlobalToast({
        title: '需要选择消息框',
        content: '请先在该角色下选择一个互动的会话上下文。',
        iconType: 'bell'
      });
      return;
    }

    setSending(true);
    setIsDelivering(true); // 开启投递飞出动效

    const newQuestion = {
      characterId: selectedChar.id,
      chatId: selectedChat.id, // 关联消息框 ID
      sender: 'user',
      isAnonymous: isAnonymous,
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
      
      // 延迟关闭投递动画
      setTimeout(() => {
        setIsDelivering(false);
        setQuestionText('');
        setIsFolded(true);
        triggerGlobalToast({
          title: '信件已投入信箱',
          content: '问题正随着邮差前往对方的消息框...',
          iconType: 'mail',
          duration: 3000
        });
      }, 800);

      // 获取当前聊天对话框的上下文消息（前 10 条）
      const contextMsgs = await db.messages
        .where('chatId')
        .equals(selectedChat.id)
        .reverse()
        .limit(10)
        .toArray();
      contextMsgs.reverse();

      // 模拟派送时间 (1.5 - 3.5秒内回复)
      const delayTime = Math.floor(Math.random() * 2000) + 1500;
      setTimeout(async () => {
        const reply = await generateNpcReply(selectedChar, newQuestion.content, isAnonymous, contextMsgs);
        
        // 更新提问箱记录
        await db.askBoxQuestions.update(qId, {
          reply: reply,
          replyAt: Date.now()
        });

        // 写入对应的消息框(chats)上下文中，使故事延续
        const senderLabel = isAnonymous ? '匿名提问' : '署名提问';
        await db.messages.add({
          chatId: selectedChat.id,
          characterId: selectedChar.id,
          sender: 'character',
          type: 'text',
          metadata: { askBoxRef: qId },
          content: `「在提问箱收到了你的${senderLabel}：${newQuestion.content}」\n\n我的回答是：${reply}`,
          isRead: 0,
          timestamp: Date.now()
        });

        // 更新 chats 的最后活跃时间
        await db.chats.update(selectedChat.id, {
          updatedAt: Date.now()
        });

        triggerGlobalToast({
          title: '会话收到新回音',
          content: `${selectedChar.name} 已在对应消息框中回复了你的提问。`,
          iconType: 'bell',
          duration: 4500
        });

        loadIncomingQuestions();
      }, delayTime);

    } catch (e) {
      console.error(e);
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

  // 2. 模拟自动触发角色给我写信
  const handleTriggerIncoming = async () => {
    if (characters.length === 0) {
      triggerGlobalToast({
        title: '未发现角色',
        content: '请先创建至少一位陪伴角色。',
        iconType: 'bell'
      });
      return;
    }

    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    const randomPassword = Math.floor(1000 + Math.random() * 9000).toString();
    const questionContent = await generateNpcToUserQuestion(randomChar);
    const npcAnonymous = Math.random() > 0.3; // 70% 概率会是匿名来信

    const newIncoming = {
      characterId: randomChar.id,
      sender: randomChar.name, // 它的真实身份其实是这个角色
      isAnonymous: npcAnonymous,
      content: questionContent,
      reply: '',
      replyAt: null,
      needPassword: npcAnonymous ? 1 : 0, // 如果是匿名提问，需要密码才能揭开身份
      password: randomPassword,
      isPasswordUnlocked: npcAnonymous ? 0 : 1, // 非匿名无需解锁
      createdAt: Date.now()
    };

    await db.askBoxQuestions.add(newIncoming);
    
    console.log(`[开发调试提示] 匿名提问解锁密码是：${randomPassword}（来信人：${randomChar.name}）`);
    
    triggerGlobalToast({
      title: '信箱有声响',
      content: npcAnonymous ? '收到了一封匿名人的加密蜡印信笺。' : `收到了来自 ${randomChar.name} 的提问信笺。`,
      iconType: 'mail',
      duration: 4000
    });

    loadIncomingQuestions();
  };

  // 密码解锁：验证火漆印，解锁真实身份
  const handleUnlockPassword = () => {
    if (!selectedIncoming) return;
    if (passwordInput.trim() === selectedIncoming.password) {
      db.askBoxQuestions.update(selectedIncoming.id, {
        isPasswordUnlocked: 1
      }).then(() => {
        setSelectedIncoming(prev => ({ ...prev, isPasswordUnlocked: 1 }));
        setPasswordInput('');
        setPasswordError(false);
        loadIncomingQuestions();
        triggerGlobalToast({
          title: '封泥碎裂',
          content: `已确认来信人是：${selectedIncoming.sender}`,
          iconType: 'mail'
        });
      });
    } else {
      setPasswordError(true);
      triggerGlobalToast({
        title: '解锁失败',
        content: '封印纹丝不动，密码不太对。',
        iconType: 'bell'
      });
    }
  };

  // 回复 NPC 提问，并写回关联的 messages 会话流中
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

      // 找到该角色的合适 chat
      let activeChat = await db.chats.where('characterId').equals(charId).first();
      if (!activeChat) {
        const chatId = await db.chats.add({
          characterId: charId,
          mode: 'chat',
          title: selectedIncoming.sender || '陪伴聊天',
          summary: '',
          updatedAt: Date.now()
        });
        activeChat = { id: chatId };
      }

      const anonymityLabel = selectedIncoming.needPassword ? '匿名提问箱' : '提问箱';
      await db.messages.add({
        chatId: activeChat.id,
        characterId: charId,
        sender: 'user',
        type: 'text',
        metadata: { askBoxRef: selectedIncoming.id },
        content: `「在提问箱答复了你留下的问题：${selectedIncoming.content}」\n\n我的回答：${resolvedReply}`,
        isRead: 1,
        timestamp: Date.now()
      });

      await db.chats.update(activeChat.id, {
        updatedAt: Date.now()
      });

      triggerGlobalToast({
        title: '答复已寄出',
        content: `回答已同步送入与 ${selectedIncoming.sender} 的消息框。`,
        iconType: 'mail'
      });

      setReplyText('');
      setSelectedIncoming(null);
      loadIncomingQuestions();

    } catch (e) {
      console.error(e);
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
        title: '来信已烧毁',
        content: '记录已从提问箱清除。',
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
      
      {/* 头部杂志期刊风栏目条 */}
      <header className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--divider)' }}>
        <button
          onClick={onBackHub}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="font-serif text-[10px] uppercase tracking-[0.25em] opacity-40">
          Letter & Inquiry Room
        </span>
      </header>

      {/* 杂志排版主标题 */}
      <div className="space-y-1">
        <h2 className="font-serif text-4xl font-normal tracking-tight leading-none">
          提问信箱
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-widest uppercase opacity-40">
            A safe space for mutual conversations
          </p>
          <div className="h-px flex-1 mx-4 opacity-10" style={{ backgroundColor: 'var(--text-main)' }} />
          <span className="text-[9px] uppercase tracking-wider opacity-30 font-mono">v1.2</span>
        </div>
      </div>

      {/* 极简选项卡切换 */}
      <div className="flex w-full border-b" style={{ borderColor: 'var(--divider)' }}>
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'send' ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          给角色写信
          {activeTab === 'send' && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--accent-color)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'receive' ? 'text-[var(--text-main)] text-bold' : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          收到的来信
          {incomingQuestions.some(q => !q.reply) && (
            <span className="absolute top-1 right-[22%] h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
          {activeTab === 'receive' && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--accent-color)]" />
          )}
        </button>
      </div>

      {/* 主面板内容 */}
      {activeTab === 'send' ? (
        <div className="space-y-6 animate-fade-in">
          
          {/* 1. 角色选择 */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              投递给谁 / Send to
            </label>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char)}
                  className={`flex flex-col items-center gap-2 p-2.5 rounded-2xl border transition-all min-w-[75px] ${
                    selectedChar?.id === char.id
                      ? 'border-[var(--text-main)] bg-[var(--control-soft-bg)] scale-95 shadow-sm'
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] opacity-60'
                  }`}
                >
                  <img
                    src={char.avatar || 'https://via.placeholder.com/150'}
                    alt={char.name}
                    className="h-10 w-10 rounded-full object-cover filter grayscale border border-stone-200"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=100' }}
                  />
                  <span className="text-[10px] font-bold tracking-tight">{char.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 消息框关联 (Chats context) */}
          {selectedChar && (
            <div className="space-y-2 animate-fade-in-up">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> 投递至指定消息框 (关联上下文)
              </label>
              {chats.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
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
                      <span className="truncate">{chat.title || '无标题会话'}</span>
                      <span className="text-[9px] opacity-40">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 border rounded-xl border-dashed text-xs text-center opacity-50 bg-[var(--bg-surface)]">
                  没有找到与该角色的消息框。请前往 Messages 创建对话。
                </div>
              )}
            </div>
          )}

          {/* 3. 拟物折叠信封信纸 */}
          {selectedChar && selectedChat && (
            <div className="relative mt-2">
              
              {/* 信封投递飞出动效遮罩 */}
              {isDelivering && (
                <div className="absolute inset-0 bg-white/80 dark:bg-black/80 z-20 flex flex-col items-center justify-center rounded-2xl animate-fade-in">
                  <div className="animate-bounce">
                    <Mail className="h-10 w-10 text-[var(--accent-color)]" />
                  </div>
                  <span className="text-xs uppercase tracking-widest font-serif mt-3 animate-pulse">正在投递信纸...</span>
                </div>
              )}

              {/* 拟物信封封皮 */}
              <div 
                onClick={() => setIsFolded(false)}
                className={`cursor-pointer border-2 rounded-2xl p-5 transition-all duration-500 shadow-sm relative overflow-hidden flex flex-col justify-between ${
                  isFolded 
                    ? 'h-24 bg-stone-100 dark:bg-stone-900 border-dashed border-stone-400 hover:border-solid hover:scale-[1.01]' 
                    : 'h-auto bg-[var(--card-bg)] border-[var(--card-border)]'
                }`}
              >
                {isFolded ? (
                  <div className="flex items-center justify-between h-full w-full">
                    <div className="space-y-1">
                      <h4 className="font-serif text-sm font-bold opacity-80">点击展开未写信纸</h4>
                      <p className="text-[10px] uppercase tracking-wider opacity-45">TO: {selectedChar.name} • {selectedChat.title}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full border border-dashed border-stone-400 flex items-center justify-center">
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-widest opacity-40 font-mono">
                      <span>信纸正文 • {selectedChar.name} 收</span>
                      <span>邮戳: 提问箱</span>
                    </div>

                    {/* 信封内衬线效果 */}
                    <div className="h-px bg-stone-200 dark:bg-stone-800" />

                    <textarea
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="提问将进入此会话的记忆里。在此手写你想问的问题..."
                      rows={4}
                      maxLength={200}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed border-none outline-none focus:ring-0 placeholder-opacity-30"
                      style={{
                        color: 'var(--text-main)',
                        fontFamily: 'serif',
                        backgroundAttachment: 'local',
                        backgroundImage: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0) 95%, var(--divider) 95%)',
                        backgroundSize: '100% 2rem',
                        lineHeight: '2rem'
                      }}
                    />

                    <div className="flex items-center justify-between pt-4 border-t border-dashed" style={{ borderColor: 'var(--divider)' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAnonymous(!isAnonymous);
                        }}
                        className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        {isAnonymous ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {isAnonymous ? '匿名投递' : '署名投递'}
                        </span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFolded(true);
                          }}
                          className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--card-border)] hover:bg-stone-50"
                        >
                          收起
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendQuestion();
                          }}
                          disabled={sending || !questionText.trim()}
                          className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all disabled:opacity-30 active:scale-95"
                          style={{
                            backgroundColor: 'var(--accent-color)',
                            color: 'var(--accent-foreground)'
                          }}
                        >
                          <Send className="h-3 w-3" />
                          投进信箱
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 公开问答期刊墙 (QA Pairs with responses) */}
          {selectedChar && (
            <div className="space-y-4 pt-3">
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                  {selectedChar.name} 的主页公开问答专栏
                </span>
                <button
                  onClick={handleRerollNpcMain}
                  disabled={loadingNpcMain}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
                >
                  <RotateCw className={`h-3 w-3 ${loadingNpcMain ? 'animate-spin' : ''}`} /> Reroll
                </button>
              </div>

              {loadingNpcMain ? (
                <div className="py-10 text-center text-xs italic opacity-40 animate-pulse">正在编排卡片...</div>
              ) : (
                <div className="space-y-4">
                  {npcQAPairs.map((pair, idx) => (
                    <div 
                      key={idx}
                      className="border rounded-2xl overflow-hidden shadow-sm flex flex-col"
                      style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
                    >
                      {/* 问题纸笺 */}
                      <div className="p-4 bg-[var(--bg-surface)] border-b" style={{ borderColor: 'var(--card-border)' }}>
                        <div className="flex justify-between items-center text-[9px] uppercase tracking-widest opacity-40 mb-1">
                          <span>Q. #{idx + 1}</span>
                          <span>来自: {pair.from || '匿名人士'}</span>
                        </div>
                        <p className="text-xs font-serif italic text-[var(--text-main)]">
                          「{pair.question}」
                        </p>
                      </div>

                      {/* 撕裂纸张虚线 + 答复区 */}
                      <div className="p-4 relative bg-stone-50 dark:bg-stone-900 border-t border-dashed" style={{ borderColor: 'var(--divider)' }}>
                        <div className="absolute top-[-5px] left-0 right-0 h-[6px] bg-transparent border-b-[6px] border-dotted opacity-20" style={{ borderColor: 'var(--text-main)' }} />
                        <div className="text-[9px] uppercase tracking-widest opacity-35 mb-1.5 flex items-center gap-1 font-mono">
                          <span>A. ANSWER BY {selectedChar.name}</span>
                        </div>
                        <p className="text-xs leading-relaxed font-serif text-[var(--text-sub)]">
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
        
        /* 角色向我提问的信件列表 */
        <div className="space-y-4 animate-fade-in">
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              投递日志
            </span>
            <button
              onClick={handleTriggerIncoming}
              className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-dashed opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-sub)', borderColor: 'var(--card-border)' }}
            >
              模拟同步: 在路途中聆听来信
            </button>
          </div>

          <div className="space-y-4">
            {incomingQuestions.map((item) => {
              // 修改后逻辑：内容始终可见，只锁住寄信人的真实身份
              const isIdentityLocked = item.needPassword && !item.isPasswordUnlocked;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedIncoming(item)}
                  className={`p-4 border rounded-2xl transition-all cursor-pointer relative ${
                    selectedIncoming?.id === item.id 
                      ? 'border-[var(--text-main)] bg-[var(--control-soft-bg)] shadow-md scale-[0.99]' 
                      : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  
                  {/* 信件状态行 */}
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider opacity-45 mb-2 font-mono">
                    <div className="flex items-center gap-1">
                      {isIdentityLocked ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Lock className="h-3 w-3" /> 加密匿名信笺
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Unlock className="h-3 w-3" /> 寄件人: {item.sender}
                        </span>
                      )}
                    </div>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* 问题内容永远直接可见 */}
                  <div className="py-1">
                    <p className="text-xs font-serif leading-relaxed" style={{ color: 'var(--text-main)' }}>
                      「{item.content}」
                    </p>
                  </div>

                  {/* 如果有回复则展示，没有则展示待回复提示 */}
                  {item.reply ? (
                    <div className="mt-2 pt-2 border-t border-dotted" style={{ borderColor: 'var(--divider)' }}>
                      <span className="text-[9px] uppercase tracking-widest opacity-40">已答复：</span>
                      <p className="text-[11px] font-sans italic opacity-75 mt-0.5">{item.reply}</p>
                    </div>
                  ) : (
                    <div className="mt-2 flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-red-500">
                      <span>待我回复</span>
                      <span className="animate-pulse">●</span>
                    </div>
                  )}

                  {/* 偷偷烧毁按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDelete(item.id);
                    }}
                    className="absolute bottom-3 right-3 p-1 rounded opacity-50 hover:opacity-100 hover:text-red-500 transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    title="烧毁信件"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {incomingQuestions.length === 0 && (
              <div className="py-14 text-center border border-dashed rounded-2xl" style={{ borderColor: 'var(--card-border)' }}>
                <Inbox className="h-8 w-8 mx-auto opacity-20" />
                <p className="mt-2.5 text-xs opacity-40 font-serif">尚未有任何书信送达此信箱</p>
              </div>
            )}
          </div>

          {/* 解锁与回复的拟物详情浮窗 */}
          {selectedIncoming && (
            <div
              className="p-5 border rounded-2xl mt-4 space-y-4 shadow-lg animate-fade-in-up"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--card-border)'
              }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                  信件细览
                </span>
                <button
                  onClick={() => setSelectedIncoming(null)}
                  className="text-[10px] uppercase font-bold tracking-widest opacity-60 hover:opacity-100"
                >
                  关闭
                </button>
              </div>

              {/* 问题本身始终可见 */}
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                <span className="text-[9px] uppercase tracking-widest opacity-35">问题正文：</span>
                <p className="font-serif text-sm leading-relaxed mt-1" style={{ color: 'var(--text-main)' }}>
                  「{selectedIncoming.content}」
                </p>
              </div>

              {/* 身份锁：如果需要输入密码且未解锁，显示输入框解锁寄件人身份 */}
              {selectedIncoming.needPassword && !selectedIncoming.isPasswordUnlocked ? (
                <div className="space-y-4 text-center py-4 border rounded-xl bg-[var(--card-bg)] border-dashed p-4">
                  <div className="flex justify-center mb-1">
                    <Key className="h-6 w-6 text-amber-500 opacity-80" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-widest">验对 4 位数线索解锁寄件人真实身份</h4>
                    <p className="text-[10px] opacity-40">
                      （提示：寄件人在封泥时留下的 4 位数字密码）
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 max-w-[200px] mx-auto">
                    <input
                      type="text"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full text-center border rounded-lg py-2 text-lg tracking-[0.6em] font-mono bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-main)] outline-none"
                    />
                  </div>
                  {passwordError && (
                    <p className="text-[10px] text-red-500">密码不正确，封泥纹丝不动。</p>
                  )}
                  <button
                    onClick={handleUnlockPassword}
                    className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-foreground)'
                    }}
                  >
                    解锁来信人身份
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-xs flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-emerald-600" />
                  <span>
                    已确认寄件人身份：<strong>{selectedIncoming.sender}</strong>
                  </span>
                </div>
              )}

              {/* 回复框区域 */}
              <div className="space-y-3">
                {selectedIncoming.reply ? (
                  <div className="p-4 rounded-xl border border-dashed" style={{ borderColor: 'var(--card-border)' }}>
                    <span className="text-[9px] uppercase tracking-widest opacity-40 font-mono">你的答复：</span>
                    <p className="text-xs font-sans italic opacity-85 mt-1 leading-relaxed">
                      {selectedIncoming.reply}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1">
                      <PenTool className="h-3 w-3" /> 填写你的答复
                    </label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="将你的答案写在信封背面..."
                      rows={3}
                      maxLength={200}
                      className="w-full p-3 border rounded-xl resize-none text-xs leading-relaxed bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-main)] focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleReplyIncoming}
                        disabled={replying || !replyText.trim()}
                        className="px-5 py-2 rounded-full text-xs font-bold tracking-wider transition-transform active:scale-95 disabled:opacity-30"
                        style={{
                          backgroundColor: 'var(--accent-color)',
                          color: 'var(--accent-foreground)'
                        }}
                      >
                        {replying ? '送出中' : '投回信箱'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* 确认删除对话框 */}
      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="焚毁来信"
          message="你确定要彻底烧掉这封信件吗？该操作不可撤销，信件将永远消失在空气中。"
          confirmText="焚毁"
          cancelText="保留"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
      
    </div>
  );
}
