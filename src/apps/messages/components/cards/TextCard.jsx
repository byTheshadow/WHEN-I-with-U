import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export const TextCard = ({ content = '' }) => {
  return (
    <div className="markdown-content text-xs leading-relaxed tracking-wide font-sans break-words select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),

          code: ({ inline, children, ...props }) => {
            if (inline) {
              return (
                <code
                  {...props}
                  className="rounded bg-black/10 px-1 py-0.5 font-mono"
                >
                  {children}
                </code>
              );
            }

            return (
              <code {...props} className="font-mono text-[0.9em]">
                {children}
              </code>
            );
          },

          pre: ({ children }) => (
            <pre className="my-2 max-w-full overflow-x-auto rounded-lg bg-black/10 p-3">
              {children}
            </pre>
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

