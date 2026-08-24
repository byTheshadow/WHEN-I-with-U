// src/components/LetterLoader.jsx

import React from 'react';
import './letter-loader.css';

export const LetterLoader = () => {
  return (
    <section
      className="letter-loader"
      role="img"
      aria-label="A private letter is being unsealed"
    >
      <div className="letter-loader__halo" aria-hidden="true" />
      <div className="letter-loader__mist" aria-hidden="true" />

      <div className="letter-loader__masthead" aria-hidden="true">
        <span>PRIVATE ARCHIVE</span>
        <span>NO. 02</span>
      </div>

      <div className="letter-loader__stage">
        <div className="letter-loader__shadow" aria-hidden="true" />

        <article className="letter-loader__paper" aria-hidden="true">
          <div className="letter-loader__paper-border" />

          <p className="letter-loader__date">A quiet note from here</p>

          <h2 className="letter-loader__paper-title">
            WHEN I
            <br />
            <span>with U.</span>
          </h2>

          <div className="letter-loader__paper-line" />

          <p className="letter-loader__signature">always nearby</p>
        </article>

        <div className="letter-loader__envelope" aria-hidden="true">
          <div className="letter-loader__flap" />
          <div className="letter-loader__fold letter-loader__fold--left" />
          <div className="letter-loader__fold letter-loader__fold--right" />
          <div className="letter-loader__front-fold" />

          <div className="letter-loader__seal">
            <span className="letter-loader__seal-ring" />
            <span className="letter-loader__seal-core" />
          </div>
        </div>
      </div>

      <p className="letter-loader__note" aria-hidden="true">
        A private frequency opens.
      </p>
    </section>
  );
};

export default LetterLoader;
