// src/apps/hub/hubPageLayouts/heartbreak/HbStickerBook.jsx
//
// 角色贴纸册：横向滑动的一排「头像加贴纸描边」。点贴纸翻出名字和上次聊天
// 时间，「继续聊」打开信息应用（信息应用没有从外部直达某个会话的入口，
// 所以只能打开应用本身）。没有角色时整个区域不显示。

import React, { useState } from 'react';
import { formatLastChat } from '../../useHubCharacters';
import { HbText } from './HbEditable';

export const HbAvatarSticker = ({ character, size = 150, rotate = 0 }) => (
  <span className="hb-avsk" style={{ width: size, height: size, rotate: `${rotate}deg` }}>
    {character.avatar ? (
      <img src={character.avatar} alt="" draggable={false} loading="lazy" decoding="async" />
    ) : (
      <b aria-hidden="true">{Array.from(character.name)[0]}</b>
    )}
  </span>
);

const ROTATIONS = [-4, 3, -2, 5, -5, 2];

export const HbStickerBook = ({ characters, onOpenApp }) => {
  const [openId, setOpenId] = useState(null);
  if (characters.length === 0) return null;

  return (
    <section className="hb-book-wrap" aria-label="角色贴纸册">
      <div className="hb-shelf-head">
        <h2>
          <HbText id="bookTitle" fallback="Sticker Book" maxLength={20} label="贴纸册标题" />
        </h2>
        <span>{characters.length} 位</span>
      </div>
      <div className="hb-book">
        {characters.map((character, index) => {
          const open = openId === character.id;
          return (
            <div key={character.id} className="hb-stk" data-open={open ? 'true' : 'false'}>
              <button
                type="button"
                className="hb-stk-btn"
                aria-expanded={open}
                aria-label={`${character.name}，点一下查看`}
                onClick={() => setOpenId(open ? null : character.id)}
              >
                <HbAvatarSticker character={character} rotate={ROTATIONS[index % ROTATIONS.length]} />
              </button>
              <span className="hb-stk-name">{character.name}</span>
              {open && (
                <div className="hb-stk-more">
                  <small>{formatLastChat(character.lastChatAt)}</small>
                  <button type="button" onClick={() => onOpenApp('messages')}>
                    继续聊
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HbStickerBook;