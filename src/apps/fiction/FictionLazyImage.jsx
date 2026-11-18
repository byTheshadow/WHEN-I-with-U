// src/apps/fiction/FictionLazyImage.jsx
//
// 一段正文下面一张已完成的图。原图还没读出来时，先用生成时存的小缩略图占位（比例和原图一样，
// 版面不会跳）；这张图滚到离屏幕一屏左右时，才调 onNeedUrl 读原图，读好后换成原图。
// 没有缩略图的话，用同比例的浅色空块占位。

import React, { useEffect, useRef } from 'react';

import './fictionImageLazy.css';

const NEAR_MARGIN = '700px 0px';
const SCROLL_ROOT = '.fic-p-scroll';

const ratioOf = (image) => (
  image.width > 0 && image.height > 0 ? `${image.width} / ${image.height}` : '3 / 2'
);

const FictionLazyImage = ({ image, onNeedUrl }) => {
  const ref = useRef(null);
  const needsLoad = !image.url && image.urlState === 'idle';

  useEffect(() => {
    if (!needsLoad || !onNeedUrl) return undefined;

    const element = ref.current;

    if (!element) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      void onNeedUrl(image.id);

      return undefined;
    }

    // 正文在 .fic-p-scroll 里滚动，要以它为准，rootMargin 才会按这个滚动区域算。
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void onNeedUrl(image.id);
      }
    }, { root: element.closest(SCROLL_ROOT) || null, rootMargin: NEAR_MARGIN });

    observer.observe(element);

    return () => observer.disconnect();
  }, [needsLoad, image.id, onNeedUrl]);

  if (image.url) {
    return <img src={image.url} alt="" loading="lazy" decoding="async" />;
  }

  if (image.thumbnail) {
    return (
      <img
        ref={ref}
        className="fic-lazy-thumb"
        src={image.thumbnail}
        alt=""
        decoding="async"
        style={{ aspectRatio: ratioOf(image) }}
      />
    );
  }

  return <div ref={ref} className="fic-lazy-wait" style={{ aspectRatio: ratioOf(image) }} />;
};

export default FictionLazyImage;