import React, { useEffect, useState } from 'react';
import { Clock3, X } from 'lucide-react';

import { MEMORY_REVISION_ACTIONS } from './memoryConstants';
import { getMemoryRevisions } from './memoryService';

const ACTION_LABELS = {
  [MEMORY_REVISION_ACTIONS.CREATED]: '初次保存',
  [MEMORY_REVISION_ACTIONS.EDITED]: '内容修订',
  [MEMORY_REVISION_ACTIONS.WITHDRAWN]: '已撤回',
  [MEMORY_REVISION_ACTIONS.RESTORED]: '已恢复',
  [MEMORY_REVISION_ACTIONS.ARCHIVED]: '已归档',
  [MEMORY_REVISION_ACTIONS.DORMANT]: '暂不调用',
  [MEMORY_REVISION_ACTIONS.CORRECTED]: '已被更正',
  [MEMORY_REVISION_ACTIONS.SUPERSEDED]: '已由新理解替代',
  [MEMORY_REVISION_ACTIONS.CANDIDATE_ACCEPTED]: '候选已采纳',
  [MEMORY_REVISION_ACTIONS.DELETED]: '永久删除',
  [MEMORY_REVISION_ACTIONS.IMPORTED]: '导入记录'
};


const formatDateTime = (value) => {
  if (!value) return '时间未记录';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '时间未记录';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const MemoryRevisionModal = ({
  memory,
  onClose
}) => {
  const [revisions, setRevisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRevisions = async () => {
      if (!memory?.memoryId) {
        if (isMounted) {
          setRevisions([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const result = await getMemoryRevisions(memory.memoryId);

        if (isMounted) {
          setRevisions(result);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error?.message || '读取修订记录失败。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRevisions();

    return () => {
      isMounted = false;
    };
  }, [memory?.memoryId]);

  if (!memory) return null;

  return (
    <div className="memory-modal-backdrop">
      <section
        className="memory-modal memory-revision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-revision-title"
      >
        <div className="memory-modal-header">
          <div>
            <p className="memory-eyebrow">EDITORIAL HISTORY</p>
            <h2 id="memory-revision-title">这一页如何被改写</h2>
          </div>

          <button
            type="button"
            className="memory-modal-close"
            onClick={onClose}
            aria-label="关闭修订记录"
          >
            <X className="memory-icon" />
          </button>
        </div>

        <div className="memory-revision-intro">
          <span>当前记忆</span>
          <strong>{memory.title || '未命名记忆'}</strong>
        </div>

        {isLoading && (
          <div className="memory-empty-state">
            <Clock3 className="memory-empty-icon memory-spin" />
            <p>正在翻阅这页的修订痕迹...</p>
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="memory-message memory-message-error">
            <span>{errorMessage}</span>
          </div>
        )}

        {!isLoading && !errorMessage && revisions.length === 0 && (
          <div className="memory-empty-state">
            <Clock3 className="memory-empty-icon" />
            <p>暂时没有可显示的修订记录。</p>
          </div>
        )}

        {!isLoading && !errorMessage && revisions.length > 0 && (
          <div className="memory-revision-list">
            {revisions.map((revision) => {
              const snapshot = revision.snapshot || {};

              return (
                <article
                  className="memory-revision-item"
                  key={revision.revisionId || revision.id}
                >
                  <div className="memory-revision-topline">
                    <span>
                      {ACTION_LABELS[revision.action] || '记录更新'}
                    </span>
                    <time>{formatDateTime(revision.createdAt)}</time>
                  </div>

                  {snapshot.title && (
                    <h3>{snapshot.title}</h3>
                  )}

                  {snapshot.content && (
                    <p>{snapshot.content}</p>
                  )}

                  {snapshot.status && (
  <span className="memory-revision-status">
    状态：{snapshot.status}
  </span>
)}


                  {revision.note && (
                    <small>说明：{revision.note}</small>
                  )}

{snapshot.supersededByMemoryId && (
  <small>
    后续替代记录：{snapshot.supersededByMemoryId}
  </small>
)}


                </article>
              );
            })}
          </div>
        )}

        <div className="memory-modal-actions">
          <button
            type="button"
            className="memory-secondary-button"
            onClick={onClose}
          >
            返回档案
          </button>
        </div>
      </section>
    </div>
  );
};

export default MemoryRevisionModal;
