import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  ArrowLeft,
  BookOpen,
  Download,
  FilePlus2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload
} from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import db from '../../db';

import MemoryCard from './MemoryCard';
import MemoryExportModal from './MemoryExportModal';
import MemoryImportModal from './MemoryImportModal';
import MemoryRevisionModal from './MemoryRevisionModal';

import {
  MEMORY_CANDIDATE_PROPOSAL_LABELS,
  MEMORY_CANDIDATE_PROPOSALS,
  MEMORY_STATUS_OPTIONS,
  MEMORY_TYPE_OPTIONS
} from './memoryConstants';


import {
  acceptMemoryCandidate,
  archiveMemory,
  createMemory,
  dismissMemoryCandidate,
  getChatMemory,
  getChatMemoryCandidates,
  permanentlyDeleteMemory,
  refreshChatMemorySourceStates,
  restoreMemory,
  updateMemory,
  withdrawMemory
} from './memoryService';

import {
  runMemoryProcessingNow
} from './memoryScheduler';

import './memory.css';

const EMPTY_FORM = {
  title: '',
  content: '',
  type: 'fact',
  importance: 3
};

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const sortChats = (items) => (
  [...items].sort((a, b) => (
    new Date(b.updatedAt || 0).getTime()
    - new Date(a.updatedAt || 0).getTime()
  ))
);

const getChatLabel = (chat) => (
  chat?.title || `消息框 ${chat?.id ?? ''}`
);

const getCandidateProposalLabel = (candidate) => (
  MEMORY_CANDIDATE_PROPOSAL_LABELS[
    candidate?.proposalType
  ] || MEMORY_CANDIDATE_PROPOSAL_LABELS[
    MEMORY_CANDIDATE_PROPOSALS.CREATE
  ]
);

const getCandidateProposalClassName = (candidate) => {
  const proposalType = candidate?.proposalType;

  if (
    proposalType === MEMORY_CANDIDATE_PROPOSALS.CORRECT_EXISTING
  ) {
    return 'memory-candidate-item-correction';
  }

  if (
    proposalType === MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING
  ) {
    return 'memory-candidate-item-update';
  }

  if (
    proposalType === MEMORY_CANDIDATE_PROPOSALS.CONFLICT
  ) {
    return 'memory-candidate-item-conflict';
  }

  if (
    proposalType === MEMORY_CANDIDATE_PROPOSALS.DUPLICATE
  ) {
    return 'memory-candidate-item-duplicate';
  }

  return '';
};


const getProcessingResultMessage = (result) => {
  if (!result) {
    return '本次记忆整理已完成。';
  }

  if (result.error) {
    return result.error;
  }

  if (result.skipped) {
    const messageByReason = {
      no_usable_messages: '当前没有可用于整理的有效消息。',
      no_valid_source_batch: '当前没有可用于整理的有效消息。',
      checkpoint_not_reached:
        '尚未达到自动整理阈值；你可以继续聊天后再试。',
      document_hidden:
        '页面当前不在前台，暂未执行自动整理。',
      already_running_or_invalid:
        '当前消息框的记忆整理正在进行中。'
    };

    return (
      messageByReason[result.reason]
      || '本次没有执行新的记忆整理。'
    );
  }

  const memoryCount = Number(result.createdMemories || 0);
  const candidateCount = Number(result.createdCandidates || 0);
  const duplicateCount = Number(result.skippedDuplicates || 0);
  const updateCount = Number(result.proposedUpdates || 0);
const correctionCount = Number(result.proposedCorrections || 0);
const conflictCount = Number(result.proposedConflicts || 0);


  const parts = [];

  if (memoryCount > 0) {
    parts.push(`新增 ${memoryCount} 条正式记忆`);
  }

  if (candidateCount > 0) {
    parts.push(`新增 ${candidateCount} 条待确认片段`);
  }

  if (duplicateCount > 0) {
    parts.push(`跳过 ${duplicateCount} 条重复内容`);
  }
  if (updateCount > 0) {
  parts.push(`提出 ${updateCount} 条更新建议`);
}

if (correctionCount > 0) {
  parts.push(`提出 ${correctionCount} 条更正建议`);
}

if (conflictCount > 0) {
  parts.push(`保留 ${conflictCount} 条待判断冲突`);
}


  if (parts.length === 0) {
    return '整理完成，但没有发现适合新增的长期记忆。';
  }

  return `整理完成：${parts.join('，')}。`;
};

export const MemoryApp = ({
  onBackHub
}) => {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [memories, setMemories] = useState([]);
  const [candidates, setCandidates] = useState([]);

  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [processingCandidateId, setProcessingCandidateId] = useState(null);
  const [processingMemoryId, setProcessingMemoryId] = useState(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const [editingMemory, setEditingMemory] = useState(null);
  const [revisionMemory, setRevisionMemory] = useState(null);

  const [showEditor, setShowEditor] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [showChatPicker, setShowChatPicker] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const selectedChat = useMemo(
    () => (
      chats.find((chat) => chat.id === selectedChatId)
      || null
    ),
    [chats, selectedChatId]
  );

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => (
      candidate.status === 'pending'
    )),
    [candidates]
  );

  const memoryById = useMemo(
  () => new Map(
    memories
      .filter((memory) => memory?.memoryId)
      .map((memory) => [memory.memoryId, memory])
  ),
  [memories]
);


  const loadChats = useCallback(async () => {
    try {
      const result = await db.chats.toArray();
      const sorted = sortChats(result);

      setChats(sorted);

      setSelectedChatId((currentChatId) => {
        if (
          isValidChatId(currentChatId) &&
          sorted.some((chat) => chat.id === currentChatId)
        ) {
          return currentChatId;
        }

        return sorted.length > 0
          ? sorted[0].id
          : null;
      });
    } catch (error) {
      setErrorMessage('读取消息框失败。');

      console.error(
        '[MemoryApp] load chats failed:',
        error
      );
    }
  }, []);

  const loadMemoryData = useCallback(async () => {
    if (!isValidChatId(selectedChatId)) {
      setMemories([]);
      setCandidates([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      /*
       * 在显示档案前刷新来源状态。
       * 若原始聊天消息已删除，卡片可以及时显示
       * “原始消息已删除”或“原始消息部分缺失”。
       */
      await refreshChatMemorySourceStates(selectedChatId);

      const [
        memoryList,
        candidateList
      ] = await Promise.all([
        getChatMemory(selectedChatId),
        getChatMemoryCandidates(selectedChatId)
      ]);

      setMemories(memoryList);
      setCandidates(candidateList);
    } catch (error) {
      setErrorMessage(
        error?.message || '读取记忆失败。'
      );

      console.error(
        '[MemoryApp] load memory data failed:',
        error
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    void loadMemoryData();
  }, [loadMemoryData]);

  const visibleMemories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return memories.filter((memory) => {
      const matchesType = (
        selectedType === 'all' ||
        memory.type === selectedType
      );

      const matchesStatus = (
        selectedStatus === 'all' ||
        memory.status === selectedStatus
      );

      const text = [
        memory.title,
        memory.content,
        memory.type
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        matchesType &&
        matchesStatus &&
        (!query || text.includes(query))
      );
    });
  }, [
    memories,
    searchQuery,
    selectedStatus,
    selectedType
  ]);

  const resetMessages = () => {
    setNoticeMessage('');
    setErrorMessage('');
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingMemory(null);
    setForm(EMPTY_FORM);
  };

  const selectChat = (chatId) => {
    setSelectedChatId(chatId);
    setShowChatPicker(false);
    setShowCandidates(false);
    setSelectedType('all');
    setSelectedStatus('active');
    setSearchQuery('');
    closeEditor();
    setRevisionMemory(null);
    resetMessages();
  };

  const openCreateEditor = () => {
    if (!isValidChatId(selectedChatId)) {
      setErrorMessage('请先选择一个消息框。');
      return;
    }

    setEditingMemory(null);
    setForm(EMPTY_FORM);
    setShowEditor(true);
  };

  const openEditEditor = (memory) => {
    if (!memory) {
      return;
    }

    setEditingMemory(memory);

    setForm({
      title: memory.title || '',
      content: memory.content || '',
      type: memory.type || 'fact',
      importance: memory.importance || 3
    });

    setShowEditor(true);
  };

  const handleSaveMemory = async (event) => {
    event.preventDefault();

    if (
      !isValidChatId(selectedChatId) ||
      isSavingMemory
    ) {
      if (!isValidChatId(selectedChatId)) {
        setErrorMessage('请先选择一个消息框。');
      }

      return;
    }

    if (!form.content.trim()) {
      setErrorMessage('记忆内容不能为空。');
      return;
    }

    setIsSavingMemory(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      if (editingMemory) {
        await updateMemory(
          editingMemory.memoryId,
          {
            title: form.title,
            content: form.content,
            type: form.type,
            importance: form.importance
          },
          {
            note: '用户在记忆空间中修改。'
          }
        );

        setNoticeMessage('记忆已更新。');
      } else {
        await createMemory({
          chatId: selectedChatId,
          title: form.title,
          content: form.content,
          type: form.type,
          importance: form.importance
        });

        setNoticeMessage('记忆已保存。');
      }

      closeEditor();

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '保存记忆失败。'
      );
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleWithdraw = async (memory) => {
    if (!memory || processingMemoryId) {
      return;
    }

    setProcessingMemoryId(memory.memoryId);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      await withdrawMemory(
        memory.memoryId,
        {
          note: '用户在记忆空间中撤回。'
        }
      );

      setNoticeMessage('记忆已撤回。');

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '撤回记忆失败。'
      );
    } finally {
      setProcessingMemoryId(null);
    }
  };

  const handleRestore = async (memory) => {
    if (!memory || processingMemoryId) {
      return;
    }

    setProcessingMemoryId(memory.memoryId);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      await restoreMemory(
        memory.memoryId,
        {
          note: '用户在记忆空间中恢复。'
        }
      );

      setNoticeMessage('记忆已恢复。');

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '恢复记忆失败。'
      );
    } finally {
      setProcessingMemoryId(null);
    }
  };

  const handleArchive = async (memory) => {
    if (!memory || processingMemoryId) {
      return;
    }

    setProcessingMemoryId(memory.memoryId);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      await archiveMemory(
        memory.memoryId,
        {
          note: '用户在记忆空间中归档。'
        }
      );

      setNoticeMessage('记忆已归档。');

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '归档记忆失败。'
      );
    } finally {
      setProcessingMemoryId(null);
    }
  };


const handleDelete = async (memory) => {
  if (!memory || processingMemoryId) {
    return;
  }

  setProcessingMemoryId(memory.memoryId);
  setErrorMessage('');
  setNoticeMessage('');

  try {
    await permanentlyDeleteMemory(memory.memoryId);

    if (revisionMemory?.memoryId === memory.memoryId) {
      setRevisionMemory(null);
    }

    setNoticeMessage('记忆及其修订记录已永久删除。');

    await loadMemoryData();
  } catch (error) {
    setErrorMessage(
      error?.message || '删除记忆失败。'
    );
  } finally {
    setProcessingMemoryId(null);
  }
};


  const handleAcceptCandidate = async (candidate) => {
    if (!candidate || processingCandidateId) {
      return;
    }

    setProcessingCandidateId(candidate.candidateId);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      await acceptMemoryCandidate(candidate.candidateId);

      setNoticeMessage(
        '这段片段已采纳为正式记忆。'
      );

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '采纳候选失败。'
      );
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const handleDismissCandidate = async (candidate) => {
    if (!candidate || processingCandidateId) {
      return;
    }

    setProcessingCandidateId(candidate.candidateId);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      await dismissMemoryCandidate(
        candidate.candidateId,
        {
          note: '用户在记忆空间中忽略。'
        }
      );

      setNoticeMessage(
        '这段片段已从待确认列表移除。'
      );

      await loadMemoryData();
    } catch (error) {
      setErrorMessage(
        error?.message || '忽略候选失败。'
      );
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const handleProcessNow = async () => {
    if (
      !isValidChatId(selectedChatId) ||
      isProcessing
    ) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setNoticeMessage('');

    try {
      const result = await runMemoryProcessingNow(
        selectedChatId
      );

      if (result?.error) {
        setErrorMessage(result.error);
      } else {
        setNoticeMessage(
          getProcessingResultMessage(result)
        );

        await loadMemoryData();
      }
    } catch (error) {
      setErrorMessage(
        error?.message || '记忆整理失败。'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportCompleted = async (message) => {
    setShowImportModal(false);
    setNoticeMessage(message || '记忆导入完成。');

    await loadChats();
    await loadMemoryData();
  };

  const statusOptions = [
    {
      id: 'all',
      label: '全部状态'
    },
    ...MEMORY_STATUS_OPTIONS
  ];

  return (
    <div className="memory-app">
      <div className="memory-orbit memory-orbit-one" />
      <div className="memory-orbit memory-orbit-two" />

      <header className="memory-header">
        <button
          type="button"
          onClick={onBackHub}
          className="memory-back-button"
        >
          <ArrowLeft className="memory-icon" />
          <span>返回主页</span>
        </button>

        <div className="memory-header-mark">
          <span className="memory-kicker">
            PRIVATE ARCHIVE
          </span>
          <span className="memory-page-number">
            01
          </span>
        </div>
      </header>

      <section className="memory-intro">
        <div>
          <p className="memory-eyebrow">
            MEMORY ROOM
          </p>

          <h1>共同生活留下的页片</h1>

          <p className="memory-intro-text">
            只属于当前消息框的理解、片段与约定。
            你可以查看、修订，也可以让某些记忆安静地退场。
          </p>
        </div>

        <BookOpen className="memory-intro-icon" />
      </section>

      <section className="memory-chat-section">
        <div className="memory-section-label">
          <span>当前消息框</span>
          <span className="memory-section-line" />
        </div>

        <button
          type="button"
          className="memory-chat-selector"
          onClick={() => {
            setShowChatPicker((value) => !value);
          }}
        >
          <div className="memory-chat-selector-copy">
            <span className="memory-chat-selector-kicker">
              THIS ARCHIVE BELONGS TO
            </span>

            <strong>
              {selectedChat
                ? getChatLabel(selectedChat)
                : '请选择消息框'}
            </strong>
          </div>

          <Filter className="memory-icon" />
        </button>

        {showChatPicker && (
          <div className="memory-chat-picker">
            {chats.length === 0 ? (
              <p className="memory-empty-copy">
                还没有可以整理的消息框。
              </p>
            ) : (
              chats.map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  className={[
                    'memory-chat-option',
                    chat.id === selectedChatId
                      ? 'memory-chat-option-active'
                      : ''
                  ].join(' ')}
                  onClick={() => selectChat(chat.id)}
                >
                  <span>{getChatLabel(chat)}</span>

                  <small>
                    {chat.mode === 'rp'
                      ? 'RP'
                      : 'REAL'}
                  </small>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {selectedChat && (
        <section className="memory-overview">
          <div>
            <span className="memory-overview-number">
              {memories.length}
            </span>
            <span className="memory-overview-label">
              已保存记忆
            </span>
          </div>

          <div>
            <span className="memory-overview-number">
              {pendingCandidates.length}
            </span>
            <span className="memory-overview-label">
              待确认片段
            </span>
          </div>

          <div className="memory-overview-actions">
            <button
              type="button"
              onClick={openCreateEditor}
              className="memory-tool-button"
            >
              <Plus className="memory-icon" />
              新增
            </button>

            <button
              type="button"
              onClick={handleProcessNow}
              className="memory-tool-button"
              disabled={isProcessing}
            >
              <Sparkles className="memory-icon" />
              {isProcessing
                ? '整理中'
                : '立即整理'}
            </button>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="memory-tool-button"
            >
              <Upload className="memory-icon" />
              导入
            </button>

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="memory-tool-button"
            >
              <Download className="memory-icon" />
              导出
            </button>

            <button
              type="button"
              onClick={() => {
                void loadMemoryData();
              }}
              className="memory-tool-button"
              title="刷新"
              disabled={isLoading}
            >
              <RefreshCw className={[
                'memory-icon',
                isLoading ? 'memory-spin' : ''
              ].join(' ')} />
            </button>
          </div>
        </section>
      )}

      {errorMessage && (
        <div className="memory-message memory-message-error">
          <span>{errorMessage}</span>

          <button
            type="button"
            onClick={() => setErrorMessage('')}
          >
            知道了
          </button>
        </div>
      )}

      {noticeMessage && (
        <div className="memory-message memory-message-success">
          <span>{noticeMessage}</span>

          <button
            type="button"
            onClick={() => setNoticeMessage('')}
          >
            收起
          </button>
        </div>
      )}

      {selectedChat && (
        <>
          <section className="memory-filter-section">
            <div className="memory-search-box">
              <Search className="memory-icon" />

              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                }}
                placeholder="在这间消息框里寻找一页..."
                aria-label="搜索记忆"
              />
            </div>

            <div className="memory-filter-scroll">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={[
                  'memory-filter-button',
                  selectedType === 'all'
                    ? 'memory-filter-button-active'
                    : ''
                ].join(' ')}
              >
                全部
              </button>

              {MEMORY_TYPE_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedType(item.id)}
                  className={[
                    'memory-filter-button',
                    selectedType === item.id
                      ? 'memory-filter-button-active'
                      : ''
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="memory-status-row">
              {statusOptions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSelectedStatus(item.id);
                  }}
                  className={[
                    'memory-status-button',
                    selectedStatus === item.id
                      ? 'memory-status-button-active'
                      : ''
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <div className="memory-editorial-grid">

          <section className="memory-list-section">
            <div className="memory-section-heading">
              <div>
                <span className="memory-eyebrow">
                  THE COLLECTION
                </span>

                <h2>
                  {selectedStatus === 'active'
                    ? '正在生长的记忆'
                    : '记忆档案'}
                </h2>
              </div>

              <span className="memory-list-count">
                {visibleMemories.length} 页
              </span>
            </div>

            {isLoading ? (
              <div className="memory-empty-state">
                <RefreshCw className="memory-empty-icon memory-spin" />
                <p>正在翻阅这间档案室...</p>
              </div>
            ) : visibleMemories.length === 0 ? (
              <div className="memory-empty-state">
                <FilePlus2 className="memory-empty-icon" />
                <p>这里还没有符合条件的记忆。</p>

                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="memory-inline-button"
                >
                  写下第一条
                </button>
              </div>
            ) : (
              <div className="memory-list">
                {visibleMemories.map((memory) => (
                  <MemoryCard
                    key={memory.memoryId || memory.id}
                    memory={memory}
                    onEdit={openEditEditor}
                    onWithdraw={handleWithdraw}
                    onRestore={handleRestore}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onViewRevisions={(item) => {
                      setRevisionMemory(item);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="memory-candidate-section">
            

            <button
              type="button"
              className="memory-candidate-heading"
              onClick={() => {
                setShowCandidates((value) => !value);
              }}
            >
              <div>
                <span className="memory-eyebrow">
                  UNFINISHED NOTES
                </span>

                <h2>尚未定稿的片段</h2>
              </div>

              <span className="memory-candidate-count">
                {pendingCandidates.length}
              </span>
            </button>

            {showCandidates && (
              <>
                {pendingCandidates.length === 0 ? (
                  <p className="memory-empty-copy">
                    目前没有等待确认的片段。
                  </p>
                ) : (
                  pendingCandidates.map((candidate) => {
                    const isCandidateProcessing = (
                      processingCandidateId === candidate.candidateId
                    );

                    return (
                     <div
  className={[
    'memory-candidate-item',
    getCandidateProposalClassName(candidate)
  ].filter(Boolean).join(' ')}
  key={candidate.candidateId || candidate.id}
>

                       <div className="memory-candidate-label-row">
  <span className="memory-candidate-type">
    {MEMORY_TYPE_OPTIONS.find(
      (item) => item.id === candidate.type
    )?.label || '待整理'}
  </span>

  <span className="memory-candidate-proposal">
    {getCandidateProposalLabel(candidate)}
  </span>
</div>

                        <strong>
                          {candidate.title || '未命名片段'}
                        </strong>

                       <p>{candidate.content}</p>

{candidate.conflictReason && (
  <p className="memory-candidate-reason">
    {candidate.conflictReason}
  </p>
)}

{candidate.targetMemoryId && (
  <div className="memory-candidate-target">
    <span>关联档案</span>

    <strong>
      {memoryById.get(candidate.targetMemoryId)?.title
        || memoryById.get(candidate.targetMemoryId)?.content
        || '原有记忆已不在当前列表'}
    </strong>

    {candidate.similarityScore > 0 && (
      <small>
        相似程度 {Math.round(candidate.similarityScore * 100)}%
      </small>
    )}
  </div>
)}

<small>
  优先程度 {candidate.priority || 3} / 5
</small>


                        <div className="memory-candidate-actions">
                          <button
                            type="button"
                            className="memory-inline-button"
                            onClick={() => {
                              void handleAcceptCandidate(candidate);
                            }}
                            disabled={isCandidateProcessing}
                          >
                          {isCandidateProcessing
  ? '处理中...'
  : candidate.proposalType ===
    MEMORY_CANDIDATE_PROPOSALS.UPDATE_EXISTING
    ? '更新已有记忆'
    : candidate.proposalType ===
      MEMORY_CANDIDATE_PROPOSALS.CORRECT_EXISTING
      ? '更正旧理解'
      : candidate.proposalType ===
        MEMORY_CANDIDATE_PROPOSALS.CONFLICT
        ? '保留这条新理解'
        : candidate.proposalType ===
          MEMORY_CANDIDATE_PROPOSALS.DUPLICATE
          ? '确认重复'
          : '采纳为记忆'}

                          </button>

                          <button
                            type="button"
                            className="memory-candidate-dismiss-button"
                            onClick={() => {
                              void handleDismissCandidate(candidate);
                            }}
                            disabled={isCandidateProcessing}
                          >
                            忽略此片段
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </section>
           </div>
        </>
        
      )}

      {!selectedChat && (
        <div className="memory-empty-state memory-empty-state-large">
          <BookOpen className="memory-empty-icon" />
          <p>
            先选择一个消息框，才能翻阅它留下的记忆。
          </p>
        </div>
      )}

      {showEditor && (
        <div className="memory-modal-backdrop">
          <section
            className="memory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-editor-title"
          >
            <div className="memory-modal-header">
              <div>
                <span className="memory-eyebrow">
                  EDITING ROOM
                </span>

                <h2 id="memory-editor-title">
                  {editingMemory
                    ? '修订这一页'
                    : '写下一页记忆'}
                </h2>
              </div>

              <button
                type="button"
                className="memory-modal-close"
                onClick={closeEditor}
                disabled={isSavingMemory}
              >
                关闭
              </button>
            </div>

            <form
              onSubmit={handleSaveMemory}
              className="memory-editor-form"
            >
              <label>
                <span>标题</span>

                <input
                  value={form.title}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      title: event.target.value
                    });
                  }}
                  maxLength={80}
                  placeholder="给这段记忆一个名字"
                  disabled={isSavingMemory}
                />
              </label>

              <label>
                <span>内容</span>

                <textarea
                  value={form.content}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      content: event.target.value
                    });
                  }}
                  maxLength={500}
                  rows={6}
                  placeholder="写下希望未来聊天可以理解的事情..."
                  required
                  disabled={isSavingMemory}
                />
              </label>

              <label>
                <span>记忆类型</span>

                <select
                  value={form.type}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      type: event.target.value
                    });
                  }}
                  disabled={isSavingMemory}
                >
                  {MEMORY_TYPE_OPTIONS.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>
                  重要程度：{form.importance} / 5
                </span>

                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.importance}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      importance: Number(event.target.value)
                    });
                  }}
                  disabled={isSavingMemory}
                />
              </label>

              <div className="memory-modal-actions">
                <button
                  type="button"
                  className="memory-secondary-button"
                  onClick={closeEditor}
                  disabled={isSavingMemory}
                >
                  取消
                </button>

                <button
                  type="submit"
                  className="memory-primary-button"
                  disabled={isSavingMemory}
                >
                  {isSavingMemory
                    ? '保存中...'
                    : '保存这一页'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showImportModal && (
        <MemoryImportModal
          chats={chats}
          initialChatId={selectedChatId}
          onClose={() => setShowImportModal(false)}
          onCompleted={handleImportCompleted}
          onError={(message) => {
            setErrorMessage(message);
          }}
        />
      )}

      {showExportModal && (
        <MemoryExportModal
          currentChat={selectedChat}
          onClose={() => setShowExportModal(false)}
          onCompleted={(message) => {
            setNoticeMessage(message);
          }}
          onError={(message) => {
            setErrorMessage(message);
          }}
        />
      )}

      {revisionMemory && (
        <MemoryRevisionModal
          memory={revisionMemory}
          onClose={() => setRevisionMemory(null)}
        />
      )}
    </div>
  );
};

export default MemoryApp;


