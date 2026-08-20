import React, { useEffect, useState } from 'react';
import { Plus, User, Edit3, Sparkles } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

export const CharacterLibrary = ({ onSelectCharacter, onCreateNew }) => {
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    const loadCharacters = async () => {
      const list = await db.characters.toArray();
      setCharacters(list);
    };
    loadCharacters();
  }, []);

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-bold text-sm">角色库 (Characters)</h3>
        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold text-xs active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建角色</span>
        </button>
      </div>

      {characters.length === 0 ? (
        <GlassCard className="py-10 text-center space-y-2 opacity-60">
          <User className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-xs">暂无任何角色，请点击上方“新建角色”开始配置。</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {characters.map((char) => (
            <GlassCard key={char.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                {char.avatar ? (
                  <img src={char.avatar} alt={char.name} className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold shrink-0">
                    {char.name?.[0]}
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-bold text-sm truncate">{char.name}</h4>
                    {char.isAutoMessageActive && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Auto
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-60 truncate">{char.bio || '无简介'}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectCharacter(char)}
                className="p-2 rounded-full bg-black/5 dark:bg-white/10 opacity-70 hover:opacity-100 shrink-0"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default CharacterLibrary;
