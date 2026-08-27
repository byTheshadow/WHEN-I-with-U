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
  PenTool
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import { generateNpcReply, generateNpcToNpcQuestions, generateNpcToUserQuestion } from './askBoxAiService';

export default function AskBoxApp({ onBackHub }) {
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // 选项卡： 'send' (我向角色提问 & 角色主页) | 'receive' (角色向我提问)
  const [activeTab, setActiveTab] = useState('send');
  
  // 我向角色提问状态
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  
  // 角色列表及他们主页的 NPC 随机提问
  const [npcMainQuestions, setNpcMainQuestions] = useState([]);
  const [loadingNpcMain, setLoadingNpcMain] = useState(false);
  
  // 角色向我提问的状态
  const [incomingQuestions, setIncomingQuestions] = useState([]);
  const [selectedIncoming, setSelectedIncoming] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // 删除确认弹窗
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 加载初始数据
  useEffect(() => {
    loadCharacters();
    loadIncomingQuestions();
  }, []);

  // 当选择的角色发生改变时，自动拉取或生成该角色主页上的 NPC 匿名提问
  useEffect(() => {
    if (selectedChar) {
      loadNpcMainQuestions(selectedChar);
    }
  }, [selectedChar]);

  const loadCharacters = async () => {
    const list = await db.characters.toArray();
    setCharacters(list);
    if (list.length > 0 && !selectedChar) {
      setSelectedChar(list[0]);
    }
  };

  const loadIncomingQuestions = async () => {
    // 这里的 sender 不是 user，就是角色向我提问
    const list = await db.askBoxQuestions
      .filter(q => q.sender !== 'user')
      .reverse()
      .toArray();
    setIncomingQuestions(list);
  };

  // 生成 NPC 提问箱主页的随机问答
  const loadNpcMainQuestions = async (character) => {
    setLoadingNpcMain(true);
    const otherChars = characters.filter(c => c.id !== character.id);
    const questions = await generateNpcToNpcQuestions(character, otherChars);
    setNpcMainQuestions(questions);
    setLoadingNpcMain(false);
  };

  // 1. 用户向角色发送提问
  const handleSendQuestion = async () => {
    if (!questionText.trim() || !selectedChar) return;
    setSending(true);

    const newQuestion = {
      characterId: selectedChar.id,
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
      
      triggerGlobalToast({
        title: '信件已投递',
        content: '问题已投入提问箱，请静候回音。',
        iconType: 'mail',
        duration: 3000
      });

      setQuestionText('');
      
      // 模拟不确定的回复时间（1到4秒延迟，实际模拟几小时，这里采用短时间以便展示）
      const delayTime = Math.floor(Math.random() * 3000) + 1500;
      setTimeout(async () => {
        const reply = await generateNpcReply(selectedChar, newQuestion.content, isAnonymous);
        await db.askBoxQuestions.update(qId, {
          reply: reply,
          replyAt: Date.now()
        });
        
        triggerGlobalToast({
          title: '信箱有新回音',
          content: `${selectedChar.name} 回复了你的提问。`,
          iconType: 'bell',
          duration: 4000
        });

        // 重新拉取 NPC 提问卡片
        if (selectedChar && selectedChar.id === newQuestion.characterId) {
          loadNpcMainQuestions(selectedChar);
        }
        loadIncomingQuestions();
      }, delayTime);

    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  // 用户 Reroll NPC 主页上的提问
  const handleRerollNpcMain = () => {
    if (selectedChar) {
      loadNpcMainQuestions(selectedChar);
    }
  };

  // 2. 模拟自动触发：随机生成角色向我提问
  const handleTriggerIncoming = async () => {
    if (characters.length === 0) {
      triggerGlobalToast({
        title: '未发现角色',
        content: '请先在消息应用中创建至少一位陪伴角色。',
        iconType: 'bell'
      });
      return;
    }

    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    
    // 生成随机 4 位数字密码
    const randomPassword = Math.floor(1000 + Math.random() * 9000).toString();
    
    // 生成随机匿名提问
    const questionContent = await generateNpcToUserQuestion(randomChar);
    
    // 是否匿名 (NPC 随机决定是否隐藏名字)
    const npcAnonymous = Math.random() > 0.4;

    const newIncoming = {
      characterId: randomChar.id,
      sender: npcAnonymous ? 'anonymous_npc' : randomChar.name,
      isAnonymous: npcAnonymous,
      content: questionContent,
      reply: '',
      replyAt: null,
      needPassword: 1, // 需要答对密码才能看
      password: randomPassword,
      isPasswordUnlocked: 0, // 初始未解锁
      createdAt: Date.now()
    };

    await db.askBoxQuestions.add(newIncoming);
    
    // 提醒密码暗示 (在控制台或者通知里，作为彩蛋式暗示)
    console.log(`[开发调试提示] 收到 ${randomChar.name} 的提问，查看密码是：${randomPassword}`);
    
    triggerGlobalToast({
      title: '提问箱深处有响动',
      content: '收到了一封有密码锁保护的来信。',
      iconType: 'mail',
      duration: 4000
    });

    loadIncomingQuestions();
  };

  // 密码解锁偷偷查看
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
          title: '解锁成功',
          content: '悄悄翻开了信笺的折角...',
          iconType: 'mail'
        });
      });
    } else {
      setPasswordError(true);
      triggerGlobalToast({
        title: '密码错误',
        content: '信封上的封条毫无动静。',
        iconType: 'bell'
      });
    }
  };

  // 答复 NPC 提问，并写回 messages 表
  const handleReplyIncoming = async () => {
    if (!replyText.trim() || !selectedIncoming) return;
    setReplying(true);

    const charId = selectedIncoming.characterId;
    const resolvedReply = replyText.trim();

    try {
      // 1. 更新提问箱表的答复
      await db.askBoxQuestions.update(selectedIncoming.id, {
        reply: resolvedReply,
        replyAt: Date.now()
      });

      // 2. 寻找或创建一个与该角色的聊天室 (chat)
      let activeChat = await db.chats.where('characterId').equals(charId).first();
      if (!activeChat) {
        // 创建一个降级 chat
        const char = await db.characters.get(charId);
        const chatId = await db.chats.add({
          characterId: charId,
          mode: 'chat',
          title: char ? char.name : '陪伴聊天',
          summary: '',
          updatedAt: Date.now()
        });
        activeChat = { id: chatId };
      }

      // 3. 将回答写回对话 message 记录中，使角色知道答案
      const anonymousSenderLabel = selectedIncoming.isAnonymous ? '匿名提问箱' : '提问箱投递';
      await db.messages.add({
        chatId: activeChat.id,
        characterId: charId,
        sender: 'user',
        type: 'text',
        metadata: { askBoxRef: selectedIncoming.id },
        content: `「在提问箱答复了 ${anonymousSenderLabel} 留下的问题：${selectedIncoming.content}」\n回答：${resolvedReply}`,
        isRead: 1,
        timestamp: Date.now()
      });

      triggerGlobalToast({
        title: '答复已送达',
        content: '你的答案已经写入故事，对方已明了。',
        iconType: 'mail'
      });

      // 清空状态
      setReplyText('');
      setSelectedIncoming(null);
      loadIncomingQuestions();

    } catch (e) {
      console.error(e);
    } finally {
      setReplying(false);
    }
  };

  // 删除某条提问记录
  const triggerDelete = (id) => {
    setConfirmDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId) {
      await db.askBoxQuestions.delete(confirmDeleteId);
      triggerGlobalToast({
        title: '记录已焚毁',
        content: '来信的灰烬已随风逝去。',
        iconType: 'mail'
      });
      setSelectedIncoming(null);
      loadIncomingQuestions();
    }
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col space-y-6 min-h-[85vh]">
      {/* 头部导航与杂志风格小标题 */}
      <header className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--divider)' }}>
        <button
          onClick={onBackHub}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="font-serif text-[11px] uppercase tracking-[0.2em] opacity-40">
          The Ask Box / Issue 08
        </span>
      </header>

      {/* 杂志排版头部大标题 */}
      <div className="space-y-1 text-left">
        <h2 className="font-serif text-3xl font-normal leading-none tracking-tight" style={{ color: 'var(--text-main)' }}>
          提问信箱
        </h2>
        <p className="text-[11px] tracking-wider uppercase opacity-50" style={{ color: 'var(--text-sub)' }}>
          Anonymity Box & Secret Inquiry
        </p>
      </div>

      {/* 选项卡切换 - 杂志风 */}
      <div className="flex w-full border-b" style={{ borderColor: 'var(--divider)' }}>
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'send' ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          给角色写信
          {activeTab === 'send' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--text-main)] animate-fade-in" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeTab === 'receive' ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-60'
          }`}
        >
          收到的来信
          {incomingQuestions.some(q => !q.reply) && (
            <span className="absolute top-0 right-[28%] h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
          {activeTab === 'receive' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--text-main)] animate-fade-in" />
          )}
        </button>
      </div>

      {/* 主展示区 */}
      {activeTab === 'send' ? (
        <div className="space-y-6 animate-fade-in">
          {/* 选择投递对象 */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
              投递对象 (Select Character)
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] ${
                    selectedChar?.id === char.id
                      ? 'border-[var(--text-main)] bg-[var(--control-soft-bg)] scale-95'
                      : 'border-[var(--card-border)] opacity-60'
                  }`}
                >
                  <img
                    src={char.avatar || 'https://via.placeholder.com/150'}
                    alt={char.name}
                    className="h-9 w-9 rounded-full object-cover filter grayscale"
                  />
                  <span className="text-[10px] font-bold tracking-tight">{char.name}</span>
                </button>
              ))}
              {characters.length === 0 && (
                <div className="text-xs italic py-2 opacity-50">还没有创建任何陪伴角色。</div>
              )}
            </div>
          </div>

          {/* 投递信纸 */}
          {selectedChar && (
            <div
              className="p-5 border rounded-2xl shadow-sm space-y-4 relative overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              {/* 拟物信纸页眉线 */}
              <div className="flex items-center justify-between text-[9px] uppercase tracking-widest opacity-40">
                <span>To: {selectedChar.name}</span>
                <span>Stamp: Postbox</span>
              </div>

              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="在这张淡黄的纸笺上写下你想问的问题..."
                rows={3}
                maxLength={200}
                className="w-full resize-none bg-transparent text-sm leading-relaxed border-none outline-none focus:ring-0 placeholder-opacity-30"
                style={{
                  color: 'var(--text-main)',
                  fontFamily: 'serif'
                }}
              />

              <div className="flex items-center justify-between pt-2 border-t border-dashed" style={{ borderColor: 'var(--divider)' }}>
                {/* 匿名按钮 */}
                <button
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
                >
                  {isAnonymous ? (
                    <UserX className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {isAnonymous ? '匿名投递' : '署名投递'}
                  </span>
                </button>

                <button
                  onClick={handleSendQuestion}
                  disabled={sending || !questionText.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all disabled:opacity-30 active:scale-95"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--accent-foreground)'
                  }}
                >
                  <Send className="h-3 w-3" />
                  {sending ? '投递中' : '投进信箱'}
                </button>
              </div>
            </div>
          )}

          {/* 角色公开提问箱主页 */}
          {selectedChar && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                  {selectedChar.name} 的提问箱公开信件
                </label>
                <button
                  onClick={handleRerollNpcMain}
                  disabled={loadingNpcMain}
                  title="重新翻牌提问"
                  className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                >
                  <RotateCw className={`h-3 w-3 ${loadingNpcMain ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-3">
                {npcMainQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 border rounded-xl space-y-1 relative"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--card-border)'
                    }}
                  >
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-wider opacity-35">
                      <span>来信 #{idx + 1}</span>
                      <span>匿名人士</span>
                    </div>
                    <p className="text-xs font-serif italic" style={{ color: 'var(--text-main)' }}>
                      「{q}」
                    </p>
                    <p className="text-[10px] pt-1 text-right italic opacity-50" style={{ color: 'var(--text-muted)' }}>
                      待解答...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 角色向我提问的信件列表 */
        <div className="space-y-4 animate-fade-in">
          {/* 生成测试用问答的隐蔽按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleTriggerIncoming}
              className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded border border-dashed opacity-45 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-sub)', borderColor: 'var(--card-border)' }}
            >
              在旅途中聆听来信
            </button>
          </div>

          <div className="space-y-3">
            {incomingQuestions.map((item) => {
              const isLocked = item.needPassword && !item.isPasswordUnlocked;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedIncoming(item)}
                  className={`p-4 border rounded-xl transition-all cursor-pointer relative ${
                    selectedIncoming?.id === item.id 
                      ? 'border-[var(--text-main)] shadow' 
                      : 'border-[var(--card-border)] hover:bg-[var(--control-soft-bg)]'
                  }`}
                  style={{
                    backgroundColor: 'var(--card-bg)'
                  }}
                >
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider opacity-45 mb-2">
                    <span>
                      来自: {item.isAnonymous ? '某人的加密信件' : item.sender}
                    </span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {isLocked ? (
                    <div className="flex items-center gap-2.5 py-2">
                      <Lock className="h-4 w-4 text-amber-500 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-xs font-serif italic tracking-wide opacity-65">
                          信件已被蜡封保护。需核对 4 位数线索...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-serif leading-relaxed" style={{ color: 'var(--text-main)' }}>
                        「{item.content}」
                      </p>
                      
                      {item.reply ? (
                        <div className="mt-2 pt-2 border-t border-dashed" style={{ borderColor: 'var(--divider)' }}>
                          <p className="text-[10px] uppercase tracking-wider opacity-35">你的回复:</p>
                          <p className="text-xs font-sans italic opacity-75 mt-0.5">
                            {item.reply}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end text-[10px] text-red-400 font-bold uppercase tracking-wider pt-1 animate-pulse">
                          待我答复
                        </div>
                      )}
                    </div>
                  )}

                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDelete(item.id);
                    }}
                    className="absolute bottom-3 right-3 p-1 rounded opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    title="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {incomingQuestions.length === 0 && (
              <div className="py-14 text-center border border-dashed rounded-xl" style={{ borderColor: 'var(--card-border)' }}>
                <Inbox className="h-8 w-8 mx-auto opacity-20" />
                <p className="mt-2.5 text-xs opacity-40">提问箱里空空如也，或许晚点会有信差路过</p>
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
                  {selectedIncoming.isAnonymous ? '匿名卡片' : selectedIncoming.sender} 的信件细览
                </span>
                <button
                  onClick={() => setSelectedIncoming(null)}
                  className="text-[10px] uppercase font-bold tracking-widest opacity-60"
                >
                  关闭 (Close)
                </button>
              </div>

              {selectedIncoming.needPassword && !selectedIncoming.isPasswordUnlocked ? (
                // 密码输入解密界面 (拟物答对密码机制)
                <div className="space-y-4 text-center py-4">
                  <div className="flex justify-center mb-1">
                    <Key className="h-7 w-7 text-amber-500 opacity-80" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-widest">输入 4 位数解锁密码</h4>
                    <p className="text-[10px] opacity-40">
                      （提示：偷偷向你提问的角色在留下信封时脑海中所想的 4 位数字）
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
                    <p className="text-[10px] text-red-500">封泥未破，请再次确认密码线索。</p>
                  )}
                  <button
                    onClick={handleUnlockPassword}
                    className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-transform active:scale-95"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-foreground)'
                    }}
                  >
                    验对封泥
                  </button>
                </div>
              ) : (
                // 已解锁，显示具体问题及回答区域
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                    <p className="font-serif text-sm leading-relaxed" style={{ color: 'var(--text-main)' }}>
                      「{selectedIncoming.content}」
                    </p>
                  </div>

                  {selectedIncoming.reply ? (
                    // 已回复
                    <div className="p-4 rounded-xl border border-dashed" style={{ borderColor: 'var(--card-border)' }}>
                      <span className="text-[9px] uppercase tracking-widest opacity-40">你的答复：</span>
                      <p className="text-xs font-sans italic opacity-85 mt-1 leading-relaxed">
                        {selectedIncoming.reply}
                      </p>
                    </div>
                  ) : (
                    // 待回复
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1">
                        <PenTool className="h-3 w-3" /> 填写你的答复
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="将答案写在信封背面..."
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
              )}
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
