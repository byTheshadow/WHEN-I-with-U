import React, { useState } from 'react';
import { Newspaper, ChevronRight, X } from 'lucide-react';

export const ArticleCard = ({ content = '', metadata = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const title = metadata?.title || '未命名短文';
  const summary = metadata?.summary || content.slice(0, 60) + '...';

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="w-[250px] rounded-2xl border border-white/20 bg-black/5 dark:bg-white/5 p-4 space-y-3 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
      >
        <div className="flex items-center justify-between opacity-50 text-[9px] font-mono tracking-wider uppercase">
          <div className="flex items-center gap-1">
            <Newspaper className="w-3 h-3" />
            <span>ESSAY / ARTICLE</span>
          </div>
          <ChevronRight className="w-3 h-3" />
        </div>

        <h4 className="font-serif text-sm font-semibold leading-snug line-clamp-2">{title}</h4>
        
        <p className="text-[10px] opacity-60 leading-relaxed line-clamp-3">{summary}</p>
      </div>

      {/* 极简风文章展开 Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in-up">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-[2rem] border border-white/20 bg-white dark:bg-neutral-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">PUBLISHED ARTICLE</span>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full opacity-60 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
            <div className="text-xs leading-relaxed space-y-3 opacity-90 font-serif whitespace-pre-wrap">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArticleCard;
