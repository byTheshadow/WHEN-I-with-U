// src/apps/stmemory/StSealPage.jsx
//
// 封存：ST 导入完成的瞬间。新雪花落在冰面上，荡开三圈涟漪，再沉下去。
// 动画都是一次性的（雪花落下、三圈涟漪），没有持续的粒子；只有主角光晕缓慢呼吸。
// 主按钮"去生成总结"，次级"回到冰面"。
import React, { useEffect, useRef } from 'react';

import Snowflake from './Snowflake';

const StSealPage = ({ info, onSummary, onClose }) => {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <div className="qc-scroll">
        <div className="qc-col">
          <div className="qc-seal">
            <div className="stage" aria-hidden="true">
              <div className="bloom" />
              <div className="rg" /><div className="rg b" /><div className="rg c" />
              <div className="land">
                <Snowflake size={240} arm="b" lit={0} hero ringLit />
              </div>
            </div>

            <h1 className="h serif" ref={headingRef} tabIndex={-1}>已封存</h1>
            <p className="d" role="status">
              <b>{info.added.toLocaleString()} 条</b>消息，
              {info.appended ? '已追加到' : '已封存为'}「{info.title}」
            </p>

            <div className="nums">
              <div>
                <div className="n serif">{info.added.toLocaleString()}</div>
                <div className="l">{info.appended ? '新增消息' : '消息'}</div>
              </div>
              <div>
                <div className="n serif">约 {info.tokens.toLocaleString()}</div>
                <div className="l">token（估算）</div>
              </div>
            </div>
            <p className="hint">总结是可选的，能大幅省 token，也可以以后再做。</p>
          </div>
        </div>
      </div>

      <div className="foot">
        <div className="foot-in">
          <button type="button" className="btn btn-pri btn-big" onClick={onSummary}>去生成总结</button>
          <button
            type="button"
            className="btn-text"
            style={{ marginTop: 6, letterSpacing: '.2em' }}
            onClick={onClose}
          >
            回到冰面
          </button>
        </div>
      </div>
    </>
  );
};

export default StSealPage;