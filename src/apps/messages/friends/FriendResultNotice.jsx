import React from 'react';
import { UserCheck, UserX } from 'lucide-react';

// 用户处理完角色介绍的好友申请之后，留在聊天里的一条居中小药丸。
// 文案由 metadata 决定（content 故意留空，不让它被当成聊天内容吸收进记忆）。
const FriendResultNotice = ({ message }) => {
  const meta = message?.metadata || {};
  const accepted = meta.result === 'accepted';
  const Icon = accepted ? UserCheck : UserX;
  const text = accepted
    ? `通过了「${meta.alias || '一位朋友'}」的好友申请`
    : '没有通过一位朋友的好友申请';

  return (
    <div className="my-2 flex justify-center">
      <div
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-center text-[11px]"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <Icon size={11} />
        <span>{text}</span>
      </div>
    </div>
  );
};

export default FriendResultNotice;