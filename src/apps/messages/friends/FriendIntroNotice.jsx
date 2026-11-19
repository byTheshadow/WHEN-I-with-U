import React from 'react';
import { UserPlus } from 'lucide-react';

// 角色在聊天里介绍了一位朋友之后留下的痕迹：居中一条小药丸，纯公告，
// 不可点击（申请本身在聊天列表右上角的 + → 「新的朋友」里处理），
// 跟戳一戳 / 异地任务挑战同一个视觉语言。
const FriendIntroNotice = ({ message }) => {
  const text = message?.content || '介绍了一位朋友，可在 + 里查看';

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
        <UserPlus size={11} />
        <span>{text}</span>
      </div>
    </div>
  );
};

export default FriendIntroNotice;