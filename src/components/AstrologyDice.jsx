import React from 'react';

const stars = [
  { x: '-104px', y: '-56px', size: '4px', delay: '0s', type: 'dot' },
  { x: '-68px', y: '76px', size: '3px', delay: '0.02s', type: 'cross' },
  { x: '102px', y: '-47px', size: '5px', delay: '0.04s', type: 'dot' },
  { x: '82px', y: '68px', size: '3px', delay: '0.06s', type: 'cross' },
  { x: '-128px', y: '16px', size: '3px', delay: '0.08s', type: 'dot' },
  { x: '132px', y: '12px', size: '3px', delay: '0.1s', type: 'dot' },
  { x: '-24px', y: '-102px', size: '3px', delay: '0.03s', type: 'dot' },
  { x: '25px', y: '104px', size: '4px', delay: '0.05s', type: 'dot' }
];

const diceFaces = [
  { className: 'astrology-dice__face--front', symbol: '☉', label: 'Sun' },
  { className: 'astrology-dice__face--back', symbol: '☽', label: 'Moon' },
  { className: 'astrology-dice__face--right', symbol: '♄', label: 'Saturn' },
  { className: 'astrology-dice__face--left', symbol: '♃', label: 'Jupiter' },
  { className: 'astrology-dice__face--top', symbol: '✦', label: 'Star' },
  { className: 'astrology-dice__face--bottom', symbol: '♆', label: 'Neptune' }
];

export const AstrologyDice = () => {
  return (
    <div
      className="astrology-dice-stage"
      aria-label="正在投掷占星骰子"
      role="img"
    >
      <div className="astrology-dice-shadow" />

      <div className="astrology-dice-stars" aria-hidden="true">
        <span className="astrology-dice-impact-ring" />

        {stars.map((star, index) => (
          <span
            key={`${star.x}-${star.y}-${index}`}
            className={`astrology-dice-star ${
              star.type === 'cross' ? 'astrology-dice-star--cross' : ''
            }`}
            style={{
              '--star-x': star.x,
              '--star-y': star.y,
              '--star-size': star.size,
              '--star-delay': star.delay
            }}
          />
        ))}
      </div>

      <div className="astrology-dice-thrower" aria-hidden="true">
        <div className="astrology-dice">
          {diceFaces.map((face) => (
            <div
              key={face.className}
              className={`astrology-dice__face ${face.className}`}
              title={face.label}
            >
              <span className="astrology-dice__symbol">{face.symbol}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AstrologyDice;

