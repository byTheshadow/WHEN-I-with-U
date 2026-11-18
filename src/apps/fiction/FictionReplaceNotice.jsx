// src/apps/fiction/FictionReplaceNotice.jsx
//
// 重新生成出新图后，显示在新图上方的一条提示：
//   「这是重新生成的图，旧图还在。要删除旧图吗？」  [删除旧图] [保留两张]
// 一直不点就是保留；点任何一个按钮后提示消失（新图记录上的 replacesImageId 被清掉）。
// 是否显示由调用方判断（新图已完成，并且旧图还在）。

import React, { useEffect, useRef, useState } from 'react';

import { resolveReplacement } from './fictionImageReplace';
import './fictionImageRegen.css';

const FictionReplaceNotice = ({ image }) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
    };
  }, []);

  const handle = async (deleteOld) => {
    if (busy) return;

    setBusy(true);
    setFailed(false);

    try {
      await resolveReplacement(image.id, { deleteOld });
    } catch (error) {
      console.warn('[Fiction] 处理旧图失败：', error);

      if (aliveRef.current) {
        setFailed(true);
        setBusy(false);
      }
    }
  };

  return (
    <div className="fic-rn" role="group" aria-label="重新生成的图">
      <p className="fic-rn-text">
        {failed ? '没能处理旧图，请再试一次。' : '这是重新生成的图，旧图还在。要删除旧图吗？'}
      </p>
      <div className="fic-rn-actions">
        <button
          type="button"
          className="fic-btn-reset fic-rn-btn is-danger"
          disabled={busy}
          onClick={() => handle(true)}
        >
          删除旧图
        </button>
        <button
          type="button"
          className="fic-btn-reset fic-rn-btn"
          disabled={busy}
          onClick={() => handle(false)}
        >
          保留两张
        </button>
      </div>
    </div>
  );
};

export default FictionReplaceNotice;