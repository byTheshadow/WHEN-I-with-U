// src/apps/fiction/FictionSegmentFigures.jsx
//
// 一段正文下面的配图，放在这一段正文的最后、「编辑这一段」之前。
// 一段可以有好几张（重新生成不会覆盖旧图），按生成顺序从上到下排。
//   done      显示图片，点一下由 onOpen 打开大图
//   pending   虚线占位框，写着「正在配图」，剧情照常可读可点
//   error     原因 + 「重试」+ 「删除这张图」（失败的图没有内容，直接删，不再确认）
//   done 但原图找不到（恢复备份后原图不会带回来）：说明一句 + 「删除这张图」
// 没有图时什么都不渲染，不占版面。

import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

import { FICTION_IMAGE_STATUS } from './fictionImageService';
import FictionReplaceNotice from './FictionReplaceNotice';
import FictionLazyImage from './FictionLazyImage';
import './fictionImages.css';

const Figure = ({ image, replaced, onOpen, onNeedUrl, onRetry, onDelete }) => {
  if (image.status === FICTION_IMAGE_STATUS.PENDING) {
    return (
      <figure className="fic-img is-pending" aria-busy="true" aria-live="polite">
        <div className="fic-img-ph">正在配图…</div>
      </figure>
    );
  }

  if (image.status === FICTION_IMAGE_STATUS.ERROR) {
    return (
      <figure className="fic-img is-error">
        <p className="fic-img-err" role="alert">{image.errorMessage || '这张图没有生成出来。'}</p>
        <div className="fic-img-actions">
          <button type="button" className="fic-btn-reset fic-img-btn" onClick={() => onRetry(image)}>
            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
            重试
          </button>
          <button type="button" className="fic-btn-reset fic-img-btn is-danger" onClick={() => onDelete(image)}>
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            删除这张图
          </button>
        </div>
      </figure>
    );
  }

  if (image.urlState === 'missing') {
    return (
      <figure className="fic-img is-error">
        <p className="fic-img-err">这张图的原图已经不在了（图片不会随备份恢复回来）。</p>
        <div className="fic-img-actions">
          <button type="button" className="fic-btn-reset fic-img-btn is-danger" onClick={() => onDelete(image)}>
            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
            删除这张图
          </button>
        </div>
      </figure>
    );
  }

  return (
      <figure className="fic-img is-ready">
      {replaced ? <FictionReplaceNotice image={image} /> : null}
      <button
        type="button"
        className="fic-btn-reset fic-img-open"
        aria-label="查看大图"
        onClick={() => onOpen(image)}
      >
             <FictionLazyImage image={image} onNeedUrl={onNeedUrl} />
      </button>
    </figure>
  );
};

const FictionSegmentFigures = ({ images, onOpen, onNeedUrl, onRetry, onDelete }) => {
  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <div className="fic-img-list">
      {images.map((image) => (
          <Figure
          key={image.id}
          image={image}
          replaced={image.replacesImageId != null && images.some((other) => other.id === image.replacesImageId)}
                  onOpen={onOpen}
          onNeedUrl={onNeedUrl}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default FictionSegmentFigures;