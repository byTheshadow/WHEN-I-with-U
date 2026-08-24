// src/components/PolaroidLoader.jsx

import React from 'react';
import './polaroid-loader.css';

export const PolaroidLoader = () => {
  return (
    <section
      className="polaroid-loader"
      aria-label="A polaroid photograph is developing"
      role="img"
    >
      <div className="polaroid-loader__ambient" aria-hidden="true" />
      <div className="polaroid-loader__mist" aria-hidden="true" />

      <div className="polaroid-loader__shadow" aria-hidden="true" />

      <div className="polaroid-loader__photo">
        <div className="polaroid-loader__frame">
          <div className="polaroid-loader__image">
            <div className="polaroid-loader__image-haze" />
            <div className="polaroid-loader__horizon" />
            <div className="polaroid-loader__sun" />

            <div className="polaroid-loader__mountain polaroid-loader__mountain--far" />
            <div className="polaroid-loader__mountain polaroid-loader__mountain--near" />

            <div className="polaroid-loader__mark">
              <span className="polaroid-loader__mark-orbit" />
              <span className="polaroid-loader__mark-core" />
            </div>

            <div className="polaroid-loader__image-copy">
              <span>WHEN I</span>
              <strong>with U.</strong>
            </div>
          </div>

          <div className="polaroid-loader__caption">
            <span>MEMORY No. 01</span>
            <span>DEVELOPING</span>
          </div>
        </div>
      </div>

      <p className="polaroid-loader__note" aria-hidden="true">
        A moment comes into focus.
      </p>
    </section>
  );
};

export default PolaroidLoader;
