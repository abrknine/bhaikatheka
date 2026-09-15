// Each theme supplies its scene, cast, refill mechanic, dialogue, music and HUD colours.
// The hand-tracking / pouring / drinking engine in game.js is shared by all of them.
import theka from './theka.js';
import room from './room.js';
import her from './her.js';

export const THEMES = [theka, room, her];
export const DEFAULT_THEME = 'theka';
export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
