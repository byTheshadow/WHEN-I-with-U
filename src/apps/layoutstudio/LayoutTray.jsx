// src/apps/layoutstudio/LayoutTray.jsx
//
// 取景框下面的托盘，随步骤切换：
//   1 一排镜头（每个角色一枚）   2 胶卷（最多 9 格）
//   3 模板缩略图                 4 三个收尾动作（保存 / 相册 / 发回聊天室）
// 只负责展示，所有数据和操作都从外面传进来。

import React, { useId, useMemo } from 'react';
import { Check, Download, Images, Plus, Send, X } from 'lucide-react';

import LayoutMiniPreview from './LayoutMiniPreview';
import { MAX_PHOTOS } from './layoutConstants';
import { charExif, charInitial, charTint } from './layoutCharStyle';
import { createDefaultSpec } from './layoutSpec';
import { TEMPLATES } from './templates';

const pad2 = (n) => String(n).padStart(2, '0');

const LayoutTray = ({
  step,
  characters,
  loadingChars,
  charId,
  onSelectChar,
  photos,
  busy,
  onPickFile,
  onRemove,
  onMakeMain,
  spec,
  charName,
  onPickTemplate,
  onOpenTemplateInfo,
  character,
  saved,
  albumSaving,
  albumSaved,
  sending,
  sent,
  notesLoading,
  onSave,
  onSaveAlbum,
  onOpenAlbum,
  onSend,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hasResult = Boolean(spec);

  const chipSpecs = useMemo(
    () =>
      TEMPLATES.map((tpl) => ({
        tpl,
        spec: createDefaultSpec(tpl.id, { photoCount: photos.length, seed: 7 }),
      })),
    [photos.length]
  );

  return (
    <section className="ls-tray">
      {/* 1 镜头 */}
      <div className={`ls-tp${step === 1 ? ' ls-on' : ''}`}>
        {!loadingChars && characters.length === 0 ? (
          <p className="ls-tnote ls-tnote-pad">还没有角色，先回主页创建一位角色，再来修图。</p>
        ) : (
          <div className="ls-lenses">
            {characters.map((c) => {
              const name = c.name || `角色 ${c.id}`;
              const exif = charExif(c);
              const ring = `${name.slice(0, 12).toUpperCase()} ${exif.lens} ${exif.f} · `.repeat(2);
              const pathId = `ls-rp-${uid}-${c.id}`;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ls-lb${c.id === charId ? ' ls-on' : ''}`}
                  onClick={() => onSelectChar(c.id)}
                >
                  <span className="ls-lens" style={{ '--tint': charTint(c) }}>
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <defs>
                        <path id={pathId} d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
                      </defs>
                      <text>
                        <textPath href={`#${pathId}`}>{ring}</textPath>
                      </text>
                    </svg>
                    <i>{charInitial(c)}</i>
                  </span>
                  <span>
                    <b>{name}</b>
                    <small>{c.id === charId ? '已装上' : '点一下装上'}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2 胶卷 */}
      <div className={`ls-tp${step === 2 ? ' ls-on' : ''}`}>
        <div className="ls-film" style={{ '--fw': '674px' }}>
          <div className="ls-frames">
            {Array.from({ length: MAX_PHOTOS }, (_, i) => {
              const photo = photos[i];
              if (photo) {
                return (
                  <div
                    key={photo.id}
                    className={`ls-fr ls-filled${i === 0 ? ' ls-main' : ''}`}
                    style={{ backgroundImage: `url(${photo.thumb})` }}
                    role="button"
                    tabIndex={0}
                    aria-label={`第 ${i + 1} 张${i === 0 ? '，主图' : '，点一下设为主图'}`}
                    onClick={() => i > 0 && onMakeMain(i)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && i > 0) {
                        e.preventDefault();
                        onMakeMain(i);
                      }
                    }}
                  >
                    <em>{`${i === 0 ? '主' : ''}${pad2(i + 1)}`}</em>
                    <button
                      type="button"
                      className="ls-rm"
                      aria-label="移除这张照片"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(i);
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              }
              if (i === photos.length) {
                return (
                  <button
                    key={`add-${i}`}
                    type="button"
                    className="ls-fr ls-add"
                    disabled={busy}
                    onClick={onPickFile}
                    aria-label="装入照片"
                  >
                    <Plus size={20} />
                  </button>
                );
              }
              return <div key={`empty-${i}`} className="ls-fr ls-empty" aria-hidden="true" />;
            })}
          </div>
        </div>
        <div className="ls-stripbar">
          <span>
            已装 <b>{photos.length}</b> / {MAX_PHOTOS} 张，点一格设为主图
          </span>
        </div>
      </div>

      {/* 3 模板 */}
      <div className={`ls-tp${step === 3 ? ' ls-on' : ''}`}>
        <div className="ls-tchips">
          {chipSpecs.map(({ tpl, spec: chipSpec }) => (
            <button
              key={tpl.id}
              type="button"
              className={`ls-tc${hasResult && spec.templateId === tpl.id ? ' ls-on' : ''}`}
              disabled={busy || photos.length === 0}
              onClick={() => onPickTemplate(tpl.id)}
            >
              <LayoutMiniPreview photos={photos} spec={chipSpec} active={step === 3} />
              <span>{tpl.label}</span>
            </button>
          ))}
        </div>
        <p className="ls-tnote">
          {`按快门让 ${charName} 挑，或者直接点一个模板。`}
          <button type="button" className="ls-lnk" onClick={onOpenTemplateInfo}>
            模板说明
          </button>
        </p>
      </div>

      {/* 4 收尾 */}
      <div className={`ls-tp${step === 4 ? ' ls-on' : ''}`}>
        <div className="ls-acts">
          <button type="button" className={`ls-ac${saved ? ' ls-done' : ''}`} onClick={onSave}>
            <span className="ls-ic">{saved ? <Check size={18} /> : <Download size={18} />}</span>
            <b>{saved ? '已保存' : '保存到设备'}</b>
            <small>导出 PNG</small>
          </button>
          <button
            type="button"
            className={`ls-ac${albumSaved ? ' ls-done' : ''}`}
            disabled={albumSaving || notesLoading || !character}
            onClick={albumSaved ? onOpenAlbum : onSaveAlbum}
          >
            <span className="ls-ic">{albumSaved ? <Check size={18} /> : <Images size={18} />}</span>
            <b>{albumSaved ? '已入相册' : albumSaving ? '正在存...' : '存进相册'}</b>
            <small>{albumSaved ? '点这里去看看' : '只存成品图'}</small>
          </button>
          <button
            type="button"
            className={`ls-ac${sent ? ' ls-done' : ' ls-hl'}`}
            disabled={sending || sent || !character}
            onClick={onSend}
          >
            <span className="ls-ic">{sent ? <Check size={18} /> : <Send size={18} />}</span>
            <b>{sent ? '已发送' : sending ? '正在发送...' : '发回聊天室'}</b>
            <small>{`${charName} 会记住它`}</small>
          </button>
        </div>
      </div>
    </section>
  );
};

export default LayoutTray;
