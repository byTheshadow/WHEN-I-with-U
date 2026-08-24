// src/components/VinylLoader.jsx

import React from 'react';
import './vinyl-loader.css';

const WaveBars = () => {
  return (
    <div className="vinyl-loader__wave" aria-label="Audio signal starting">
      {Array.from({ length: 13 }).map((_, index) => (
        <span
          key={index}
          className="vinyl-loader__wave-bar"
          style={{ '--wave-index': index }}
        />
      ))}
    </div>
  );
};

export const VinylLoader = () => {
  return (
    <div className="vinyl-loader" aria-hidden="true">
      <div className="vinyl-loader__halo" />
      <div className="vinyl-loader__dust" />

      <div className="vinyl-loader__turntable">
        <div className="vinyl-loader__record-shadow" />

        <div className="vinyl-loader__headphone-cable">
          <div className="vinyl-loader__headphone-plug">
            <span className="vinyl-loader__plug-band" />
            <span className="vinyl-loader__plug-band" />
            <span className="vinyl-loader__plug-tip" />
          </div>
        </div>

        <div className="vinyl-loader__connection-ring" />

        <div className="vinyl-loader__record">
          <div className="vinyl-loader__record-groove vinyl-loader__record-groove--outer" />
          <div className="vinyl-loader__record-groove vinyl-loader__record-groove--inner" />

          <div className="vinyl-loader__record-label">
            <span className="vinyl-loader__label-copy">SIDE U</span>
            <span className="vinyl-loader__label-ring" />
            <span className="vinyl-loader__label-hole" />
          </div>
        </div>

        <div className="vinyl-loader__tonearm">
          <div className="vinyl-loader__tonearm-pivot">
            <span />
          </div>

          <div className="vinyl-loader__tonearm-bar" />
          <div className="vinyl-loader__cartridge" />
        </div>
      </div>

      <WaveBars />
    </div>
  );
};

export default VinylLoader;
