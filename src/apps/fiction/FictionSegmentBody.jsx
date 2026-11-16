// src/apps/fiction/FictionSegmentBody.jsx
//
// 游玩页每一段的正文：分段 + 引号高亮 + 配图位置。
//
// 引号高亮只改渲染，不动数据库里的文字，旧存档也立刻生效。
// 认的引号：“…”  「…」  『…』  "…"（英文直引号）。
// 每一段落单独判断：中文多段对话的习惯是每段都重新写开头引号、不写结尾引号，
// 所以开着的引号会一直高亮到这一段落结束，不会漏到下一段去。
//
// 配图位置（给后面接入文生图留的）：
//   images = [{ id, afterParagraph, status, src, caption }]
//     afterParagraph  图放在第几段正文后面（从 0 开始）；不填或超出范围就放在这一段最后
//     status          'ready'（有 src，显示图片）| 其他（显示占位，保留好版面）
//   现在没有传入任何图，所以不会渲染任何东西，也不占版面。接入生图时只需要
//   把这一段的图整理成上面的数组传进来，不用再改正文的排版。

import React, { useMemo } from 'react';

const OPEN_TO_CLOSE = {
  '“': '”',
  '「': '」',
  '『': '』',
  '"': '"',
};

export const splitParagraphs = (text) => String(text || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

// 把一个段落切成 [{ text, quoted }]，引号本身算在高亮里。
export const splitQuoted = (paragraph) => {
  const parts = [];
  let buffer = '';
  let quoted = false;
  let closer = null;

  const flush = () => {
    if (buffer) parts.push({ text: buffer, quoted });
    buffer = '';
  };

  Array.from(String(paragraph || '')).forEach((char) => {
    if (!quoted) {
      if (OPEN_TO_CLOSE[char]) {
        flush();
        quoted = true;
        closer = OPEN_TO_CLOSE[char];
        buffer = char;
      } else {
        buffer += char;
      }

      return;
    }

    buffer += char;

    if (char === closer) {
      flush();
      quoted = false;
      closer = null;
    }
  });

  flush();

  return parts;
};

const renderParagraphContent = (paragraph, highlight) => {
  if (!highlight) return paragraph;

  const parts = splitQuoted(paragraph);

  if (parts.every((part) => !part.quoted)) return paragraph;

  return parts.map((part, index) => (
    part.quoted
      // eslint-disable-next-line react/no-array-index-key
      ? <span key={index} className="fic-q">{part.text}</span>
      // eslint-disable-next-line react/no-array-index-key
      : <React.Fragment key={index}>{part.text}</React.Fragment>
  ));
};

const FictionFigure = ({ image }) => {
  const ready = image.status === 'ready' && Boolean(image.src);

  return (
    <figure className={`fic-p-figure ${ready ? 'is-ready' : 'is-pending'}`} aria-busy={!ready}>
      {ready
        ? <img src={image.src} alt={image.caption || ''} loading="lazy" decoding="async" />
        : <div className="fic-p-figure-ph" aria-hidden="true" />}
      {image.caption ? <figcaption>{image.caption}</figcaption> : null}
    </figure>
  );
};

const FictionSegmentBody = ({ text, highlightQuotes = true, images = [] }) => {
  const paragraphs = useMemo(() => splitParagraphs(text), [text]);
  const figures = Array.isArray(images) ? images : [];

  const isInText = (image) => (
    Number.isInteger(image.afterParagraph)
    && image.afterParagraph >= 0
    && image.afterParagraph < paragraphs.length
  );

  const tail = figures.filter((image) => !isInText(image));

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={index}>
          <p className="fic-p-para">{renderParagraphContent(paragraph, highlightQuotes)}</p>
          {figures
            .filter((image) => isInText(image) && image.afterParagraph === index)
            .map((image) => <FictionFigure key={image.id ?? `fig-${index}`} image={image} />)}
        </React.Fragment>
      ))}
      {tail.map((image, index) => (
        <FictionFigure key={image.id ?? `tail-${index}`} image={image} />
      ))}
    </>
  );
};

export default FictionSegmentBody;