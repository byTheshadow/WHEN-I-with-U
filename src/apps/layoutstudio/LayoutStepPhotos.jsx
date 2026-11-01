// src/apps/layoutstudio/LayoutStepPhotos.jsx
// 第 2 步：放照片（1 到 9 张），顺便提醒视觉模型。

import React, { useRef, useState } from 'react';
import { Eye, Plus, X } from 'lucide-react';

import { MAX_PHOTOS } from './layoutConstants';

const LayoutStepPhotos = ({
  photos,
  charName,
  visionReady,
  busy,
  onAddFiles,
  onRemove,
  onMakeMain,
  onOpenSettings,
}) => {
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);

  const slots = Array.from({ length: Math.max(3, Math.min(MAX_PHOTOS, photos.length + 1)) }, (_, i) => photos[i] || null);

  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer?.files?.length) onAddFiles(e.dataTransfer.files);
  };

  return (
    <>
      <h2 className="ls-q">把照片放进来</h2>
      <p className="ls-g">
        放 1 到 {MAX_PHOTOS} 张都可以。第一张是主图，其余的会被 {charName} 当作小图点缀。点一张小图，可以把它设为主图。
      </p>

      <div
        className={`ls-card ls-drop${over ? ' ls-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
      >
        <div className="ls-pgrid">
          {slots.map((photo, i) =>
            photo ? (
              <div
                key={photo.id}
                className="ls-slot ls-filled ls-pop"
                style={{ backgroundImage: `url(${photo.thumb})` }}
                onClick={() => i > 0 && onMakeMain(i)}
                role="button"
                tabIndex={0}
              >
                {i === 0 && <span className="ls-badge">主图</span>}
                <button
                  type="button"
                  className="ls-rm"
                  aria-label="移除这张照片"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                key={`empty-${i}`}
                type="button"
                className={`ls-slot ls-empty${i === 0 ? ' ls-first' : ''}`}
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                aria-label="添加照片"
              >
                <Plus size={22} />
              </button>
            )
          )}
        </div>
      </div>

      <div className="ls-dropbar">
        <span>
          已放 <b>{photos.length}</b> / {MAX_PHOTOS} 张
        </span>
      </div>

      <div className="ls-card ls-notice">
        <div className="ls-ic">
          <Eye size={18} />
        </div>
        <div>
          {visionReady ? (
            <>
              <b>视觉模型已就绪</b>
              {charName} 会看着你的照片来写字和点评。
            </>
          ) : (
            <>
              <b>建议先配置视觉模型</b>
              没配置时，{charName} 看不到照片，只能按人设来排版和写字，评价也会比较泛。
              {onOpenSettings && (
                <>
                  <br />
                  <button type="button" className="ls-pbtn ls-soft" onClick={onOpenSettings}>
                    去配置
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
};

export default LayoutStepPhotos;
