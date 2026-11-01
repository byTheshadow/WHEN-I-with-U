// src/apps/layoutstudio/LayoutStepCharacter.jsx
// 第 1 步：选一位修图师。

import React from 'react';
import { Check } from 'lucide-react';

export const charInitial = (character) =>
  String(character?.name || '?').trim().slice(0, 1).toUpperCase() || '?';

const LayoutStepCharacter = ({ characters, loading, selectedId, onSelect }) => (
  <>
    <h2 className="ls-q">谁来帮你修这张图？</h2>
    <p className="ls-g">
      选一位角色。TA 会按自己的口味挑模板、写上面的字，修完还会告诉你为什么这样修。
    </p>
    {!loading && characters.length === 0 && (
      <div className="ls-card ls-notice">
        <div>
          <b>还没有角色</b>
          先回主页创建一位角色，再来修图。
        </div>
      </div>
    )}
    <div className="ls-cgrid">
      {characters.map((character) => (
        <button
          key={character.id}
          type="button"
          className={`ls-card ls-cc${character.id === selectedId ? ' ls-on' : ''}`}
          onClick={() => onSelect(character.id)}
        >
          <span className="ls-tick">
            <Check size={14} />
          </span>
          <div className="ls-av">{charInitial(character)}</div>
          <b>{character.name || `角色 ${character.id}`}</b>
          <small>{character.id === selectedId ? '已选择' : '点一下选 TA'}</small>
        </button>
      ))}
    </div>
  </>
);

export default LayoutStepCharacter;
