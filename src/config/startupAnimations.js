// src/config/startupAnimations.js

export const STARTUP_ANIMATION_STORAGE_KEY = 'whenIWithU.preloaderType';
export const STARTUP_ANIMATION_SETTING_KEY = 'preloaderConfig';

export const DEFAULT_STARTUP_ANIMATION_ID = 'astrology';

export const STARTUP_ANIMATIONS = [
  {
    id: 'astrology',
    title: 'Astrology Dice',
    description: 'Aligning constellations before opening your room.',
    archiveDescription: 'Existing default opening sequence',
    status: 'ACTIVE',
    isAvailable: true
  },
 {
  id: 'vinyl',
  title: 'Vinyl Groove',
  description: 'Headphones connect. The stylus drops. A private frequency begins.',
  archiveDescription: 'Music archive startup sequence',
  status: 'READY',
  isAvailable: true
},

  {
    id: 'polaroid',
    title: 'Polaroid Development',
    description: 'A memory gradually develops from the quiet grain.',
    archiveDescription: 'Reserved for future development',
    status: 'SOON',
    isAvailable: false
  },
  {
    id: 'letter',
    title: 'Sealed Letter',
    description: 'A private airmail letter is folded for the next arrival.',
    archiveDescription: 'Reserved for future development',
    status: 'SOON',
    isAvailable: false
  },
  {
    id: 'pebble',
    title: 'Pebble Balance',
    description: 'Small stones settle into a quiet and steady arrangement.',
    archiveDescription: 'Reserved for future development',
    status: 'SOON',
    isAvailable: false
  }
];

export const getStartupAnimationById = (id) => {
  return (
    STARTUP_ANIMATIONS.find((animation) => animation.id === id) ||
    STARTUP_ANIMATIONS.find(
      (animation) => animation.id === DEFAULT_STARTUP_ANIMATION_ID
    )
  );
};

export const isAvailableStartupAnimation = (id) => {
  return STARTUP_ANIMATIONS.some(
    (animation) => animation.id === id && animation.isAvailable
  );
};
