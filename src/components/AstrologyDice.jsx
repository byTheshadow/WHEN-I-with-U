import React from 'react';

export const AstrologyDice = () => {
  return (
    <div
      className="animate-dice-roll relative flex h-32 w-32 items-center justify-center"
      aria-label="Astrology dice animation"
      role="img"
    >
      <svg
        viewBox="0 0 160 160"
        className="h-full w-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="diceFace" x1="28" y1="19" x2="129" y2="141">
            <stop stopColor="#FFFFFF" stopOpacity="0.98" />
            <stop offset="0.48" stopColor="#D7D7D3" stopOpacity="0.98" />
            <stop offset="1" stopColor="#8D8D8A" stopOpacity="0.98" />
          </linearGradient>

          <linearGradient id="diceSide" x1="53" y1="58" x2="135" y2="130">
            <stop stopColor="#B9B9B5" />
            <stop offset="1" stopColor="#666663" />
          </linearGradient>

          <linearGradient id="diceTop" x1="47" y1="24" x2="105" y2="79">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#C7C7C2" />
          </linearGradient>

          <radialGradient id="diceGlow" cx="0" cy="0" r="1">
            <stop stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <filter id="diceShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="8"
              floodColor="#000000"
              floodOpacity="0.22"
            />
          </filter>
        </defs>

        <ellipse
          cx="81"
          cy="139"
          rx="43"
          ry="9"
          fill="#111111"
          opacity="0.15"
        />

        <g filter="url(#diceShadow)">
          <path
            d="M80 18L129 47L128 104L79 135L30 105L31 48L80 18Z"
            fill="url(#diceFace)"
            stroke="#545452"
            strokeWidth="1.2"
          />

          <path
            d="M80 18L129 47L80 77L31 48L80 18Z"
            fill="url(#diceTop)"
            stroke="#6C6C69"
            strokeWidth="1.1"
          />

          <path
            d="M80 77L129 47L128 104L79 135L80 77Z"
            fill="url(#diceSide)"
            stroke="#555552"
            strokeWidth="1.1"
          />

          <path
            d="M31 48L80 77L79 135L30 105L31 48Z"
            fill="#B3B3AF"
            stroke="#666663"
            strokeWidth="1.1"
          />

          <path
            d="M80 18L129 47L128 104"
            stroke="#FFFFFF"
            strokeOpacity="0.56"
            strokeWidth="1.15"
          />

          <ellipse
            cx="59"
            cy="42"
            rx="31"
            ry="20"
            fill="url(#diceGlow)"
            opacity="0.52"
            transform="rotate(-23 59 42)"
          />

          <circle
            cx="80"
            cy="50"
            r="15"
            stroke="#262624"
            strokeWidth="1.35"
            opacity="0.88"
          />

          <path
            d="M80 36V64M66 50H94"
            stroke="#262624"
            strokeWidth="1.1"
            opacity="0.62"
          />

          <path
            d="M80 39C74 43 74 57 80 61C86 57 86 43 80 39Z"
            fill="#262624"
            opacity="0.78"
          />

          <path
            d="M101 87C106 82 114 82 118 87C114 92 106 92 101 87Z"
            stroke="#F8F8F6"
            strokeWidth="1.2"
            opacity="0.86"
          />

          <circle cx="109.5" cy="87" r="1.8" fill="#F8F8F6" />

          <path
            d="M57 92L61 99L69 99L73 92L69 85L61 85L57 92Z"
            stroke="#2A2A28"
            strokeWidth="1.1"
            opacity="0.74"
          />

          <path
            d="M74 113L79 105L84 113L79 121L74 113Z"
            fill="#2A2A28"
            opacity="0.68"
          />
        </g>
      </svg>
    </div>
  );
};

export default AstrologyDice;
