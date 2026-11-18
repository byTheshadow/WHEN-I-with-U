// src/apps/fiction/FictionImageWarning.jsx
//
// 图片页顶部的「图片太多了」提示条。所有存档的原图加起来到了 100 张就出现，
// 200 张以上语气加重。图的数量变化（生成、删除）时会重新数。
// 本存档里有图时带一个「选择要删的图」按钮，直接进入图片页的多选；
// 本存档没有图，就提示去其他存档清理。

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { FICTION_IMAGE_CHANGED_EVENT } from './fictionImageService';
import { IMAGE_USAGE_LEVEL, getImageUsage } from './fictionImageQuota';
import './fictionImageWarning.css';

const FictionImageWarning = ({ saveId, selecting, onSelect }) => {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await getImageUsage(saveId);

        if (!cancelled) setUsage(next);
      } catch (error) {
        console.warn('[Fiction] 统计图片数量失败：', error);
      }
    };

    void refresh();

    const handler = () => void refresh();

    window.addEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);

    return () => {
      cancelled = true;
      window.removeEventListener(FICTION_IMAGE_CHANGED_EVENT, handler);
    };
  }, [saveId]);

  if (!usage || usage.level === IMAGE_USAGE_LEVEL.OK) return null;

  const strong = usage.level === IMAGE_USAGE_LEVEL.STRONG;

  return (
    <div className={`fic-iw ${strong ? 'is-strong' : ''}`} role="status">
      <AlertCircle className="fic-iw-icon" size={16} strokeWidth={1.8} aria-hidden="true" />
      <div className="fic-iw-body">
        <p className="fic-iw-title">
          {strong ? '图片已经很多了' : '图片有点多了'}
        </p>
        <p className="fic-iw-text">
          所有存档加起来存了 {usage.total} 张图，本存档 {usage.inSave} 张。
          原图都存在这台设备上，积累太多会让应用变慢，严重时可能无法正常打开。
          {strong ? '建议尽快清理。' : '建议清理一些不要的图。'}
          {usage.inSave === 0 ? '本存档没有图，可以到其他存档的图片页清理。' : ''}
        </p>
        {usage.inSave > 0 && !selecting && (
          <button type="button" className="fic-btn-reset fic-iw-btn" onClick={onSelect}>
            选择要删的图
          </button>
        )}
      </div>
    </div>
  );
};

export default FictionImageWarning;