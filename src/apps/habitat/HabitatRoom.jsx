import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Apple,
  ArrowLeft,
  Bot,
  Droplets,
  Heart,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  User,
  Users
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import {
  clearLogsByType,
  getHabitatById,
  getLogs,
  performUserCare,
  saveHabitat
} from './habitatService';
import { chatWithHabitat } from './habitatAiService';
import { AdoptionAndEditModal } from './components/AdoptionAndEditModal';

export const HabitatRoom = ({ habitatId, onBack }) => {
  const [habitat, setHabitat] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [statusMessage, setStatusMessage] = useState('正在读取生命体状态');
  const [activeTab, setActiveTab] = useState('care');
  const [ledgerSubTab, setLedgerSubTab] = useState('user');

  const [inputText, setInputText] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isCaring, setIsCaring] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [interactionText, setInteractionText] = useState('');
  const [sprayActive, setSprayActive] = useState(false);

  const [confirmState, setConfirmState] = useState(null);

  const chatEndRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const getStatusText = (data) => {
    if (data.moisture < 35) {
      return '状态提醒：当前水分不足';
    }

    if (data.nutrients < 35) {
      return '状态提醒：当前养分不足';
    }

    if (data.sanitation < 35) {
      return '状态提醒：生态舱需要清洁';
    }

    return '生命体状态稳定';
  };

  const loadRoom = useCallback(async () => {
    const normalizedId = Number(habitatId);

    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      setHabitat(null);
      setLogs([]);
      setLoadError('未能识别生命体档案。');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError('');

      const [data, logList] = await Promise.all([
        getHabitatById(normalizedId),
        getLogs(normalizedId)
      ]);

      if (!data) {
        setHabitat(null);
        setLogs([]);
        setLoadError('未找到这个生命体的档案，它可能已被放归。');
        setStatusMessage('生命体档案不存在');
        return;
      }

      setHabitat(data);
      setLogs(logList);
      setStatusMessage(getStatusText(data));
    } catch (error) {
      console.error('加载生态瓶详情失败：', error);
      setHabitat(null);
      setLogs([]);
      setLoadError('生命体档案读取失败，请返回温室后再次进入。');
      setStatusMessage('生命体档案读取失败');
    } finally {
      setIsLoading(false);
    }
  }, [habitatId]);

  useEffect(() => {
    void loadRoom();

    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [loadRoom]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeTab, logs]);

  const showInteractionFeedback = (text) => {
    setInteractionText(text);

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setInteractionText('');
    }, 2200);
  };

  const handleAction = async (actionType) => {
    if (!habitat || isCaring || isAiResponding) {
      return;
    }

    const isAnimal = habitat.type === 'animal';

    const actionTextMap = {
      feed: isAnimal
        ? '正在投喂，饱腹感正在上升'
        : '正在施肥，养分正在渗入土壤',
      water: isAnimal
        ? '正在喷洒水雾，环境湿度正在上升'
        : '正在浇水，根系正在吸收水分',
      clean: '正在擦拭生态舱，洁净度正在上升',
      play: isAnimal
        ? '正在陪伴玩耍，羁绊正在加深'
        : '正在轻轻抚育，羁绊正在加深'
    };

    setIsCaring(true);
    showInteractionFeedback(actionTextMap[actionType] || '正在进行照料');

    if (actionType === 'water') {
      setSprayActive(true);

      window.setTimeout(() => {
        setSprayActive(false);
      }, 1200);
    }

    try {
      const updated = await performUserCare(habitat.id, actionType);

      if (updated) {
        setHabitat(updated);
        setStatusMessage(getStatusText(updated));
      }

      await loadRoom();
    } catch (error) {
      console.error('照料生命体失败：', error);
      showInteractionFeedback('本次照料未能完成，请稍后重试');
    } finally {
      setIsCaring(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (
      !habitat ||
      !inputText.trim() ||
      isAiResponding ||
      isCaring
    ) {
      return;
    }

    const message = inputText.trim();
    const normalizedId = Number(habitat.id);

    setInputText('');
    setIsAiResponding(true);

    try {
      await db.habitatLogs.add({
        habitatId: normalizedId,
        logType: 'chat_user',
        operatorName: '我',
        avatar: '',
        actionType: 'chat',
        content: message,
        timestamp: Date.now()
      });

      const allLogs = await db.habitatLogs
        .where('habitatId')
        .equals(normalizedId)
        .sortBy('timestamp');

      const conversationContext = allLogs
        .filter(
          (item) =>
            item.logType === 'chat_user' ||
            item.logType === 'chat_npc'
        )
        .slice(-8);

      const reply = await chatWithHabitat(
        habitat,
        message,
        conversationContext
      );

      await db.habitatLogs.add({
        habitatId: normalizedId,
        logType: 'chat_npc',
        operatorName: habitat.name,
        avatar: habitat.avatar || '',
        actionType: 'chat',
        content: reply,
        timestamp: Date.now()
      });

      showInteractionFeedback(`${habitat.name}回应了你`);
    } catch (error) {
      console.error('与生命体聊天失败：', error);
      showInteractionFeedback('感应暂时中断，请稍后再试');
    } finally {
      setIsAiResponding(false);
      await loadRoom();
    }
  };

  const handleReroll = async (logId) => {
    if (!habitat || isAiResponding || isCaring) {
      return;
    }

    setIsAiResponding(true);

    try {
      const normalizedId = Number(habitat.id);

      const allLogs = await db.habitatLogs
        .where('habitatId')
        .equals(normalizedId)
        .sortBy('timestamp');

      const targetIndex = allLogs.findIndex((item) => item.id === logId);

      if (targetIndex === -1) {
        return;
      }

      let userMessage = '请回应我。';

      for (let index = targetIndex - 1; index >= 0; index -= 1) {
        if (allLogs[index].logType === 'chat_user') {
          userMessage = allLogs[index].content;
          break;
        }
      }

      const conversationContext = allLogs
        .slice(0, targetIndex)
        .filter(
          (item) =>
            item.logType === 'chat_user' ||
            item.logType === 'chat_npc'
        )
        .slice(-8);

      const reply = await chatWithHabitat(
        habitat,
        userMessage,
        conversationContext
      );

      await db.habitatLogs.update(logId, {
        content: reply,
        timestamp: Date.now()
      });

      showInteractionFeedback('已重新感应一条回应');
    } catch (error) {
      console.error('重新生成生命体回应失败：', error);
      showInteractionFeedback('重新感应失败，请稍后重试');
    } finally {
      setIsAiResponding(false);
      await loadRoom();
    }
  };

  const handleUpdate = async (data) => {
    try {
      await saveHabitat(data);
      setShowEditModal(false);
      await loadRoom();
    } catch (error) {
      console.error('更新生命体档案失败：', error);
      showInteractionFeedback('档案保存失败，请稍后重试');
    }
  };

  const requestDeleteChat = (log) => {
    setConfirmState({
      type: 'delete-chat',
      logId: log.id,
      title: '删除这条对话',
      message: '删除后无法恢复这条与生命体的交流记录。'
    });
  };

  const requestClearLedger = (type) => {
    const isUserLedger = type === 'user';

    setConfirmState({
      type: 'clear-ledger',
      ledgerType: type,
      title: isUserLedger ? '清空我的照料记录' : '清空角色照料记录',
      message: isUserLedger
        ? '这将永久删除你对该生命体的全部照料手账。'
        : '这将永久删除绑定角色留下的全部照料手账。'
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmState || !habitat) {
      return;
    }

    try {
      if (confirmState.type === 'delete-chat') {
        await db.habitatLogs.delete(confirmState.logId);
        showInteractionFeedback('已删除这条交流记录');
      }

      if (confirmState.type === 'clear-ledger') {
        const logType =
          confirmState.ledgerType === 'user'
            ? 'user_action'
            : 'co_care';

        await clearLogsByType(habitat.id, logType);

        showInteractionFeedback(
          confirmState.ledgerType === 'user'
            ? '已清空我的照料记录'
            : '已清空角色照料记录'
        );
      }

      await loadRoom();
    } catch (error) {
      console.error('执行记录操作失败：', error);
      showInteractionFeedback('操作未完成，请稍后重试');
    } finally {
      setConfirmState(null);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center px-8 text-center text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        正在读取生命体档案...
      </div>
    );
  }

  if (!habitat) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {loadError || '生命体档案暂时无法读取。'}
        </p>

        <button
          type="button"
          onClick={onBack}
          className="rounded-full border px-4 py-2 text-xs font-semibold transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          返回温室
        </button>
      </div>
    );
  }

  const isAnimal = habitat.type === 'animal';

  const labels = {
    feed: isAnimal ? '喂食' : '施肥',
    water: isAnimal ? '喷雾' : '浇水',
    clean: '擦拭',
    play: isAnimal ? '玩耍' : '抚育'
  };

  const userActions = logs.filter(
    (item) => item.logType === 'user_action'
  );

  const guardianActions = logs.filter(
    (item) => item.logType === 'co_care'
  );

  const chatMessages = logs
    .filter(
      (item) =>
        item.logType === 'chat_user' ||
        item.logType === 'chat_npc'
    )
    .sort((first, second) => first.timestamp - second.timestamp);

  const metricItems = [
    {
      label: isAnimal ? '湿度' : '水分',
      value: habitat.moisture
    },
    {
      label: isAnimal ? '饱腹' : '养分',
      value: habitat.nutrients
    },
    {
      label: '洁净',
      value: habitat.sanitation
    }
  ];

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ color: 'var(--text-main)' }}
    >
      <div className="relative flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <button
          type="button"
          onClick={onBack}
          title="返回温室"
          aria-label="返回温室"
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--card-border)'
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          title="编辑生命档案"
          aria-label="编辑生命档案"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--card-border)'
          }}
        >
          <Settings className="h-4 w-4" />
        </button>

        <section
          className="relative overflow-hidden rounded-[2rem] border px-4 pb-5 pt-16"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--card-border)',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <div
            className="flex items-center justify-center gap-2 border-b pb-3 text-center text-[10px] font-semibold"
            style={{
              color: 'var(--text-sub)',
              borderColor: 'var(--divider)'
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
            <span>{statusMessage}</span>
          </div>

          <div className="relative flex min-h-[250px] flex-col items-center justify-center py-6">
            {interactionText && (
              <div
                className="absolute top-3 left-1/2 z-10 w-fit max-w-[88%] -translate-x-1/2 rounded-full border border-dashed px-3 py-1.5 text-center text-[10px] font-semibold"
                style={{
                  color: 'var(--accent-foreground)',
                  backgroundColor: 'var(--accent-color)',
                  borderColor: 'var(--card-border)'
                }}
              >
                {interactionText}
              </div>
            )}

            <div
              className="relative flex h-40 w-40 items-center justify-center rounded-full border"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                boxShadow: 'var(--card-shadow)'
              }}
            >
              <div
                className="absolute inset-3 rounded-full border"
                style={{ borderColor: 'var(--divider)' }}
              />

              <img
                src={habitat.avatar}
                alt={habitat.name}
                className="relative z-10 h-24 w-24 object-contain animate-float-gentle"
              />

              {sprayActive && (
                <div
                  className="absolute inset-0 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--control-soft-bg)' }}
                />
              )}
            </div>

            <div className="mt-5 text-center">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--text-muted)' }}
              >
                {isAnimal ? '共生动物个体' : '共生植物个体'}
              </p>

              <h2 className="mt-1 font-serif text-2xl font-semibold">
                {habitat.name}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metricItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border p-3"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.label}
                </p>

                <p className="mt-1 text-lg font-semibold">{item.value}%</p>

                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--control-soft-bg)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, item.value))}%`,
                      backgroundColor: 'var(--accent-color)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-4 overflow-hidden rounded-2xl border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--card-border)'
          }}
        >
          <div
            className="grid grid-cols-3 border-b"
            style={{ borderColor: 'var(--divider)' }}
          >
            {[
              { id: 'care', label: '照料' },
              { id: 'chat', label: '聊天' },
              { id: 'ledger', label: '手账' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="py-3 text-xs font-semibold transition-opacity"
                style={{
                  color:
                    activeTab === tab.id
                      ? 'var(--text-main)'
                      : 'var(--text-muted)',
                  backgroundColor:
                    activeTab === tab.id
                      ? 'var(--control-soft-bg)'
                      : 'transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'care' && (
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                disabled={isCaring || isAiResponding}
                onClick={() => handleAction('feed')}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <Apple
                  className="h-4 w-4"
                  style={{ color: 'var(--accent-color)' }}
                />
                {labels.feed}
              </button>

              <button
                type="button"
                disabled={isCaring || isAiResponding}
                onClick={() => handleAction('water')}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <Droplets
                  className="h-4 w-4"
                  style={{ color: 'var(--accent-color)' }}
                />
                {labels.water}
              </button>

              <button
                type="button"
                disabled={isCaring || isAiResponding}
                onClick={() => handleAction('clean')}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <Sparkles
                  className="h-4 w-4"
                  style={{ color: 'var(--accent-color)' }}
                />
                {labels.clean}
              </button>

              <button
                type="button"
                disabled={isCaring || isAiResponding}
                onClick={() => handleAction('play')}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)'
                }}
              >
                <Heart
                  className="h-4 w-4"
                  style={{ color: 'var(--accent-color)' }}
                />
                {labels.play}
              </button>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="p-3">
              <div className="max-h-[270px] space-y-3 overflow-y-auto pr-1">
                {chatMessages.length === 0 ? (
                  <p
                    className="py-8 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    还没有交流记录。试着和 {habitat.name} 说句话。
                  </p>
                ) : (
                  chatMessages.map((log) => {
                    const isUser = log.logType === 'chat_user';

                    return (
                      <article
                        key={log.id}
                        className="group rounded-xl border p-3"
                        style={{
                          backgroundColor: isUser
                            ? 'var(--control-soft-bg)'
                            : 'var(--card-bg)',
                          borderColor: 'var(--card-border)'
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className="flex items-center gap-1.5 text-[10px] font-semibold"
                            style={{ color: 'var(--text-sub)' }}
                          >
                            {isUser ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                            <span>{isUser ? '我' : habitat.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className="text-[9px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {new Date(log.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }
                              )}
                            </span>

                            {!isUser && (
                              <>
                                <button
                                  type="button"
                                  disabled={isAiResponding}
                                  onClick={() => handleReroll(log.id)}
                                  title="重新生成"
                                  aria-label="重新生成"
                                  className="opacity-100 transition-opacity active:scale-95 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                                  style={{ color: 'var(--text-sub)' }}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => requestDeleteChat(log)}
                                  title="删除这条对话"
                                  aria-label="删除这条对话"
                                  className="opacity-100 transition-opacity active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
                                  style={{ color: 'var(--text-sub)' }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <p
                          className="mt-2 text-xs leading-relaxed"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {log.content}
                        </p>
                      </article>
                    );
                  })
                )}

                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendMessage}
                className="mt-3 flex gap-2 border-t pt-3"
                style={{ borderColor: 'var(--divider)' }}
              >
                <input
                  type="text"
                  value={inputText}
                  disabled={isAiResponding || isCaring}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder={
                    isAiResponding
                      ? `${habitat.name} 正在回应...`
                      : `和 ${habitat.name} 说句话`
                  }
                  className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-xs outline-none"
                  style={{
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                />

                <button
                  type="submit"
                  disabled={
                    !inputText.trim() ||
                    isAiResponding ||
                    isCaring
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
                  style={{
                    color: 'var(--accent-foreground)',
                    backgroundColor: 'var(--accent-color)'
                  }}
                  title="发送"
                  aria-label="发送"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="p-3">
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: 'var(--divider)' }}
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLedgerSubTab('user')}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold"
                    style={{
                      color:
                        ledgerSubTab === 'user'
                          ? 'var(--accent-foreground)'
                          : 'var(--text-sub)',
                      backgroundColor:
                        ledgerSubTab === 'user'
                          ? 'var(--accent-color)'
                          : 'var(--control-soft-bg)'
                    }}
                  >
                    <User className="h-3 w-3" />
                    我做的 {userActions.length}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerSubTab('guardian')}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold"
                    style={{
                      color:
                        ledgerSubTab === 'guardian'
                          ? 'var(--accent-foreground)'
                          : 'var(--text-sub)',
                      backgroundColor:
                        ledgerSubTab === 'guardian'
                          ? 'var(--accent-color)'
                          : 'var(--control-soft-bg)'
                    }}
                  >
                    <Users className="h-3 w-3" />
                    角色做的 {guardianActions.length}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => requestClearLedger(ledgerSubTab)}
                  className="flex items-center gap-1 text-[10px] font-semibold transition-transform active:scale-95"
                  style={{ color: 'var(--text-sub)' }}
                >
                  <Trash2 className="h-3 w-3" />
                  清空
                </button>
              </div>

              <div className="mt-3 max-h-[250px] space-y-2 overflow-y-auto pr-1">
                {ledgerSubTab === 'user' &&
                  (userActions.length === 0 ? (
                    <p
                      className="py-7 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      你还没有留下照料记录。
                    </p>
                  ) : (
                    userActions.map((log) => (
                      <article
                        key={log.id}
                        className="rounded-xl border p-3"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          borderColor: 'var(--card-border)'
                        }}
                      >
                        <div
                          className="flex items-center justify-between text-[10px] font-semibold"
                          style={{ color: 'var(--text-sub)' }}
                        >
                          <span>我的照料</span>
                          <span
                            className="font-normal"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <p
                          className="mt-1.5 text-xs leading-relaxed"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {log.content}
                        </p>
                      </article>
                    ))
                  ))}

                {ledgerSubTab === 'guardian' &&
                  (guardianActions.length === 0 ? (
                    <p
                      className="py-7 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      绑定角色暂时还没有留下照料纸条。
                    </p>
                  ) : (
                    guardianActions.map((log) => (
                      <article
                        key={log.id}
                        className="rounded-xl border p-3"
                        style={{
                          backgroundColor: 'var(--control-soft-bg)',
                          borderColor: 'var(--card-border)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {log.avatar ? (
                            <img
                              src={log.avatar}
                              alt={log.operatorName}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-full"
                              style={{
                                color: 'var(--accent-foreground)',
                                backgroundColor: 'var(--accent-color)'
                              }}
                            >
                              <Users className="h-3 w-3" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold">
                              {log.operatorName}
                            </p>
                            <p
                              className="text-[9px]"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <p
                          className="mt-2 text-xs leading-relaxed"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {log.content}
                        </p>
                      </article>
                    ))
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {showEditModal && (
        <AdoptionAndEditModal
          habitat={habitat}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdate}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};

export default HabitatRoom;
