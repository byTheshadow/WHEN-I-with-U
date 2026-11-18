// src/apps/fiction/WizardImagePromptsRow.jsx
//
// 向导「文生图」区块里，三个模式药丸下面的「配图要求」入口行。
// 点开是 ImagePromptsSheet 抽屉。配图要求是全局设置，不写进存档表单，
// 所以这里自己读、自己存，不走 onChange。

import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import ImagePromptsSheet from './ImagePromptsSheet';
import { loadImagePrompts, readImageBackend } from './fictionImagePrompts';
import { EMPTY_IMAGE_PROMPTS, countModifiedPrompts } from './fictionImagePromptDefaults';
import './fictionThinkingEditor.css';

const WizardImagePromptsRow = () => {
  const [prompts, setPrompts] = useState(EMPTY_IMAGE_PROMPTS);
  const [backend, setBackend] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([loadImagePrompts(), readImageBackend()]).then(([nextPrompts, nextBackend]) => {
      if (!alive) return;

      setPrompts(nextPrompts);
      setBackend(nextBackend);
    });

    return () => {
      alive = false;
    };
  }, []);

  const modified = countModifiedPrompts(prompts);

  return (
    <>
      <button type="button" className="fic-btn-reset fic-th-entry" onClick={() => setOpen(true)}>
        <span className="fic-w-pick-text">
          <span className="fic-w-pick-name">配图要求</span>
          <span className="fic-w-pick-sub">
            自动配图 · 手动配图 · {modified > 0 ? `已改过 ${modified} 项` : '全部用默认'}
          </span>
        </span>
        <ChevronRight size={18} className="fic-th-chev" aria-hidden="true" />
      </button>

      {open && (
        <ImagePromptsSheet
          prompts={prompts}
          backend={backend}
          onSaved={setPrompts}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default WizardImagePromptsRow;