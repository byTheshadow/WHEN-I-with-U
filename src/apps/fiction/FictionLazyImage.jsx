// src/apps/fiction/FictionLazyImage.jsx
//
// 一段正文下面一张已完成的图。原图还没读出来时，先用生成时存的小缩略图占位（比例和原图一样，
// 版面不会跳）；这张图滚到离屏幕一屏左右时，才调 onNeedUrl 读原图，读好后换成原图。
// 没有缩略图的话，用同比例的浅色空块占位。
// 原图已经读出之后，如果这张图又滚到离屏幕很远（约 2600px 以外），调 onRelease 把原图释放掉，
// 换回缩略图占位，滚回来时再读。释放前后版面高度不变（占位和原图同比例），所以不会跳。

import React, { useEffect, useRef } from 'react';

import './fictionImageLazy.css';

const NEAR_MARGIN = '700px 0px';
const SCROLL_ROOT = '.fic-p-scroll';
// 比 NEAR_MARGIN 大得多：读出来的图滚出这个范围才释放，不会在边界上反复读、释放。
const FAR_MARGIN = '2600px 0px';

const ratioOf = (image) => (
  image.width > 0 && image.height > 0 ? `${image.width} / ${image.height}` : '3 / 2'
);

const FictionLazyImage = ({ image, onNeedUrl, onRelease }) => {
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

  // 只有存在本机的原图（有 fileId）、并且知道宽高（释放后占位比例才和原图一致）的图才释放；
  // 只有外链的图没有 object URL，不用管。
  const canRelease = Boolean(image.url)
    && image.fileId != null
    && image.width > 0
    && image.height > 0
    && Boolean(onRelease);

  useEffect(() => {
    if (!canRelease) return undefined;

    const element = ref.current;

    if (!element || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.every((entry) => !entry.isIntersecting)) onRelease(image.id);
    }, { root: element.closest(SCROLL_ROOT) || null, rootMargin: FAR_MARGIN });

    observer.observe(element);

    return () => observer.disconnect();
  }, [canRelease, image.id, onRelease]);

  if (image.url) {
    return <img ref={ref} src={image.url} alt="" loading="lazy" decoding="async" />;
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