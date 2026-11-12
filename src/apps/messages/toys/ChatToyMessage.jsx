// src/apps/messages/toys/ChatToyMessage.jsx
//
// 聊天里的小玩具卡片（消息类型 chat_toy，见 toyService.js）。四种状态：
//   making（制作中）/ ready（点"开始玩"打开全屏试玩）/ failed（可重试）/ deleted（已删除）。
// 试玩弹层用 React.lazy 延迟加载，聊天室页面本身不会因此变重。

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Gamepad2, RotateCcw } from 'lucide-react';

import { triggerGlobalToast } from '../../../components/NotificationToast';
import { TOY_STATUS } from './toyConstants';
import { reconcileInterruptedToy, retryToyMaking } from './toyService';
import './toys.css';

const ToyPlayer = lazy(() => import('./ToyPlayer'));

const ChatToyMessage = ({ message, character }) => {
  const [playerOpen, setPlayerOpen] = useState(false);

  const metadata = message?.metadata || {};
  const status = metadata.status || TOY_STATUS.MAKING;
  const characterName = character?.name || '对方';

  // 停在"制作中"但其实任务已经没了（页面被关掉过）：标成失败，让用户可以重试。
  useEffect(() => {
    if (status !== TOY_STATUS.MAKING || !message?.id) return;

    reconcileInterruptedToy(message)
      .then((changed) => {
        if (changed && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('new-local-message-inserted', { detail: { chatId: message.chatId } }),
          );
        }
      })
      .catch((error) => console.warn('检查小玩具状态失败：', error));
  }, [message, status]);

  const handleRetry = async () => {
    try {
      const result = await retryToyMaking({ messageId: message.id });

      if (!result.started && result.reason === 'busy') {
        triggerGlobalToast({ title: '还在制作中', content: '这个聊天里已经有一个小玩具在做了，稍等一下。' });
      }
    } catch (error) {
      console.warn('重试小玩具失败：', error);
    }
  };

  if (status === TOY_STATUS.DELETED) {
    return (
      <div className="toy-card toy-card--deleted">
        <div className="toy-card__head">
          <span className="toy-card__kicker">Toy</span>
          <span className="toy-card__state">已删除</span>
        </div>
        <div className="toy-card__sub">{metadata.title ? `「${metadata.title}」` : '这个小玩具'}已经被删除了。</div>
      </div>
    );
  }

  if (status === TOY_STATUS.READY) {
    return (
      <>
        <div className="toy-card">
          <div className="toy-card__head">
            <span className="toy-card__kicker">Toy</span>
            <span className="toy-card__state">可以玩了</span>
          </div>
          <div className="toy-card__title">{metadata.title}</div>
          <div className="toy-card__rules">{metadata.rules}</div>
          <div className="toy-card__foot">
            <span className="toy-card__meta">{characterName} 做的</span>
            <button type="button" className="toy-card__btn" onClick={() => setPlayerOpen(true)}>
              开始玩
              <Gamepad2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {playerOpen && (
          <Suspense fallback={null}>
            <ToyPlayer
              message={message}
              characterName={characterName}
              onClose={() => setPlayerOpen(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  if (status === TOY_STATUS.FAILED) {
    return (
      <div className="toy-card">
        <div className="toy-card__head">
          <span className="toy-card__kicker">Toy</span>
          <span className="toy-card__state">失败</span>
        </div>
        <div className="toy-card__title">这次没做成</div>
        <div className="toy-card__sub" style={{ paddingBottom: 6 }}>
          {metadata.errorText || '生成的内容不完整，没有保存。'}可以再试一次。
        </div>
        <div className="toy-card__foot" style={{ paddingTop: 0 }}>
          <span className="toy-card__meta" />
          <button type="button" className="toy-card__btn toy-card__btn--soft" onClick={handleRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="toy-card">
      <div className="toy-card__head">
        <span className="toy-card__kicker">Toy</span>
        <span className="toy-card__state">制作中</span>
      </div>
      <div className="toy-card__title">{characterName}正在做小玩具</div>
      <div className="toy-card__progress"><i /></div>
      <div className="toy-card__sub">做好之后这里会变成可以点开的卡片。</div>
    </div>
  );
};

export default ChatToyMessage;
