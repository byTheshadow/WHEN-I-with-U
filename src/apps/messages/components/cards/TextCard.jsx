import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const NO_PLUGINS = [];
const NO_COMPONENTS = {};

export const TextCard = ({
  content = '',
  extraRemarkPlugins = NO_PLUGINS,
  extraComponents = NO_COMPONENTS,
}) => {
  return (
        <div
      className="markdown-content max-w-full text-xs leading-relaxed tracking-wide font-sans break-words select-text"
      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, ...extraRemarkPlugins]}
        components={{
          ...extraComponents,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 break-all"
            >
              {children}
            </a>
          ),

          code: ({ inline, children, ...props }) => {
            if (inline) {
              return (
                <code
                  {...props}
                  className="rounded bg-black/10 px-1 py-0.5 font-mono break-all"
                >
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className="font-mono text-[0.9em] break-all">
                {children}
              </code>
            );
          },

          pre: ({ children }) => (
            <pre className="my-2 max-w-full overflow-x-auto rounded-lg bg-black/10 p-3">
              {children}
            </pre>
          ),

          // GFM 表格天生按内容最小宽度排版，光靠父级 max-width 挡不住——
          // 太宽的表格会把整个气泡、聊天窗一起撑开（这就是用户反馈的那个
          // bug）。所以表格自己包一层横向滚动容器，撑不开的部分自己内部
          // 滚，不连累外面的气泡和聊天窗。
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-lg">
              <table className="text-left">{children}</table>
            </div>
          ),

          th: ({ children }) => (
            <th className="border border-current/20 px-2 py-1 font-bold">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="border border-current/20 px-2 py-1">
              {children}
            </td>
          ),

          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-current/40 pl-3 opacity-80">
              {children}
            </blockquote>
          ),

          ul: ({ children }) => (
            <ul className="my-1 list-disc pl-5">{children}</ul>
          ),

          ol: ({ children }) => (
            <ol className="my-1 list-decimal pl-5">{children}</ol>
          ),

          p: ({ children }) => (
            <p className="my-1">{children}</p>
          ),

          h1: ({ children }) => (
            <h1 className="my-2 text-base font-bold">{children}</h1>
          ),

          h2: ({ children }) => (
            <h2 className="my-2 text-sm font-bold">{children}</h2>
          ),

          h3: ({ children }) => (
            <h3 className="my-1 text-xs font-bold">{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default TextCard;