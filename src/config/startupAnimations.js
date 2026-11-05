// src/config/startupAnimations.js
import { isHalloweenSeasonActive } from '../apps/messages/interactions/halloween/halloweenSeason';
import { isNovemberSeasonActive } from './novemberSeason';


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
     isAvailable: true,
  status: 'READY'
  },
  {
    id: 'letter',
    title: 'Sealed Letter',
    description: 'A private airmail letter is folded for the next arrival.',
    archiveDescription: 'Reserved for future development',
   isAvailable: true,
  status: 'READY'
  },
  {
    id: 'pebble',
    title: 'Pebble Balance',
    description: 'Small stones settle into a quiet and steady arrangement.',
    archiveDescription: 'A small cairn settles into balance',
    status: 'READY',
    isAvailable: true
  },
  {
    id: 'rose',
    title: 'Rose Under Glass',
    description: 'A small rose blooms beneath the glass, on a tiny distant planet.',
    archiveDescription: 'A quiet homage to the fox and the rose',
    status: 'READY',
    isAvailable: true
  },
  {
    id: 'halloween-dice',
    title: 'Cursed Dice',
    description: 'A six-faced relic tumbles through the dark before it will answer.',
    archiveDescription: 'Returns automatically every October',
    status: 'SEASONAL',
    isAvailable: isHalloweenSeasonActive(),
    seasonal: true
  },
  {
    id: 'halloween-ritual',
    title: 'Sealed Monolith',
    description: 'A sealed obelisk waits out a slow eclipse before it will open.',
    archiveDescription: 'Returns automatically every October',
    status: 'SEASONAL',
    isAvailable: isHalloweenSeasonActive(),
    seasonal: true
  },
  {
    id: 'winter-mirror',
    title: 'Frosted Mirror',
    description: 'Mist slides down a frosted mirror, and a small cabin lights up as the first snow falls.',
    archiveDescription: 'Returns automatically every November',
    status: 'SEASONAL',
    isAvailable: isNovemberSeasonActive(),
    seasonal: true
  },
  {
    id: 'winter-window',
    title: 'Lamplit Window',
    description: 'A lamp flickers on in a snowbound cabin, seen through an arched frosty window.',
    archiveDescription: 'Returns automatically every November',
    status: 'SEASONAL',
    isAvailable: isNovemberSeasonActive(),
    seasonal: true
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
