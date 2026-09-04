import React, { useEffect, useState } from 'react';
import {
  Clock3,
  FileClock,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import {
  deleteScheduledMessageArchiveItem,
  getScheduledMessageArchive,
  getScheduledMessageDisplayState,
  getScheduledMessageTypeLabel,
  getScheduledMessageCancelLabel,
  formatScheduledMessageDate,
  retryScheduledMessageArchiveItem
} from '../scheduledMessageArchiveService';
import './ScheduledMessageArchive.css';

const ScheduledMessageArchive = ({
  chatId,
  character,
  onClose
}) => {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [retryingRecordId, setRetryingRecordId] = useState(null);

  const loadRecords = async () => {
    setIsLoading(true);

    try {
      const nextRecords =
        await getScheduledMessageArchive(chatId);

      setRecords(nextRecords);
    } catch (error) {
      console.error(
        '[ScheduledMessageArchive] 读取预约存档失败：',
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [chatId]);

  const handleDelete = async () => {
    if (!deletingRecord?.id) {
      return;
    }

    try {
      await deleteScheduledMessageArchiveItem(
        deletingRecord.id
      );

      setRecords((previous) => (
        previous.filter(
          (item) => item.id !== deletingRecord.id
        )
      ));
    } catch (error) {
      console.error(
        '[ScheduledMessageArchive] 删除预约存档失败：',
        error
      );
    } finally {
      setDeletingRecord(null);
    }
  };

  const handleRetry = async (record) => {
    if (!record?.id || retryingRecordId) {
      return;
    }

    setRetryingRecordId(record.id);

    try {
      const success =
        await retryScheduledMessageArchiveItem(
          record.id
        );

      if (!success) {
        return;
      }

      setRecords((previous) => (
        previous.map((item) => (
          item.id === record.id
            ? {
                ...item,
                status: 'pending',
                attemptCount: 0,
                cancelledReason: '',
                sentMessageId: null,
                updatedAt: new Date().toISOString()
              }
            : item
        ))
      ));
    } catch (error) {
      console.error(
        '[ScheduledMessageArchive] 重新安排预约失败：',
        error
      );
    } finally {
      setRetryingRecordId(null);
    }
  };

  return (
    <>
      <div
        className="scheduled-archive-overlay"
        role="presentation"
      >
        <section
          className="scheduled-archive-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scheduled-archive-title"
        >
          <header className="scheduled-archive-header">
            <div>
              <p className="scheduled-archive-kicker">
                PRIVATE RECORD
              </p>

              <h2 id="scheduled-archive-title">
                {character?.name || '伴侣'}留下的时间票据
              </h2>

              <p className="scheduled-archive-subtitle">
                这里保存着曾经约定过的稍后联系。
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="scheduled-archive-close"
              title="关闭预约存档"
              aria-label="关闭预约存档"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="scheduled-archive-paper">
            <div className="scheduled-archive-paper-mark">
              <FileClock className="h-4 w-4" />
              <span>SCHEDULED MESSAGE</span>
            </div>

            {isLoading && (
              <div className="scheduled-archive-empty">
                正在翻阅这份记录。
              </div>
            )}

            {!isLoading && records.length === 0 && (
              <div className="scheduled-archive-empty">
                还没有被留下的预约记录。
              </div>
            )}

            {!isLoading && records.length > 0 && (
              <div className="scheduled-archive-list">
                {records.map((record) => {
                  const state =
                    getScheduledMessageDisplayState(
                      record
                    );

                  const canRetry =
                    record.status === 'failed' ||
                    record.status === 'cancelled';

                  const isRetrying =
                    retryingRecordId === record.id;

                  return (
                    <article
                      className={`scheduled-ticket scheduled-ticket--${state.tone}`}
                      key={record.id}
                    >
                      <div className="scheduled-ticket-topline">
                        <span className="scheduled-ticket-type">
                          {getScheduledMessageTypeLabel(
                            record
                          )}
                        </span>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {canRetry && (
                            <button
                              type="button"
                              className="scheduled-ticket-retry"
                              onClick={() => (
                                void handleRetry(record)
                              )}
                              disabled={Boolean(
                                retryingRecordId
                              )}
                              title="重新安排这次预约"
                              aria-label="重新安排这次预约"
                              style={{
                                opacity: isRetrying
                                  ? 0.55
                                  : 1,
                                cursor: retryingRecordId
                                  ? 'wait'
                                  : 'pointer'
                              }}
                            >
                              <RotateCcw
                                className="h-3.5 w-3.5"
                              />
                              <span>
                                {isRetrying
                                  ? '安排中'
                                  : '重试'}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="scheduled-ticket-delete"
                            onClick={() => (
                              setDeletingRecord(record)
                            )}
                            title="删除这张票据"
                            aria-label="删除这张票据"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="scheduled-ticket-status">
                        <span className="scheduled-ticket-status-dot" />
                        {state.label}
                      </div>

                      <div className="scheduled-ticket-time">
                        <Clock3 className="h-3.5 w-3.5" />

                        <span>
                          预计：
                          {formatScheduledMessageDate(
                            record.scheduledFor
                          )}
                        </span>
                      </div>

                      <p className="scheduled-ticket-intent">
                        {record.intent ||
                          '自然地延续之前尚未说完的关心。'}
                      </p>

                      <div className="scheduled-ticket-meta">
                        <span>
                          写下：
                          {formatScheduledMessageDate(
                            record.createdAt
                          )}
                        </span>

                        <span>
                          {getScheduledMessageCancelLabel(
                            record
                          )}
                        </span>
                      </div>

                      {record.cancelledReason && (
                        <p className="scheduled-ticket-reason">
                          记录备注：{record.cancelledReason}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="scheduled-archive-tear" />
          </div>

          <p className="scheduled-archive-footer">
            删除票据只会清理这份预约记录，不会抹去已经抵达的聊天消息。
          </p>
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(deletingRecord)}
        title="删除这张时间票据？"
        message="删除后，这份预约记录将从本地存档中移除。已经发送到聊天里的消息不会受到影响。"
        confirmText="删除票据"
        cancelText="暂不删除"
        onConfirm={handleDelete}
        onCancel={() => setDeletingRecord(null)}
      />
    </>
  );
};

export default ScheduledMessageArchive;
