// Renner Garage — spend mission cash on the car and the crew.
// Three upgrade tracks, three levels each. Prices are tuned against the
// mission payouts ($150 to $1,500, $3,650 earnable in total), so no driver
// can max out everything: every purchase is a choice about how Dax runs.
import { CFG } from './config.js';

export const UPGRADES = {
  engine: {
    name: 'ENGINE',
    blurb: 'Top speed +13% and sharper acceleration per level.',
    prices: [200, 450, 800],
  },
  armor: {
    name: 'ARMOR',
    blurb: '+25 max health per level, fitted with a full repair.',
    prices: [150, 400, 750],
  },
  weapon: {
    name: 'WEAPON',
    blurb: 'Pistol +12 damage and a faster trigger per level.',
    prices: [150, 350, 650],
  },
};

export function freshUpgrades() {
  return { engine: 0, armor: 0, weapon: 0 };
}

export function maxLevel(kind) {
  return UPGRADES[kind].prices.length;
}

export function nextPrice(kind, level) {
  if (level >= maxLevel(kind)) return null;
  return UPGRADES[kind].prices[level];
}

// Effective car tuning at an engine level (0 = stock).
export function engineTopSpeed(level) {
  return CFG.carMaxSpeed * (1 + 0.13 * level);
}
export function engineAccel(level) {
  return CFG.carAccel * (1 + 0.1 * level);
}
export function engineReverse(level) {
  return CFG.carMaxReverse * (1 + 0.1 * level);
}

// Dax's health ceiling and pistol at an armor / weapon level.
export function maxHealth(level) {
  return CFG.playerHealth + 25 * level;
}
export function pistolDamage(level) {
  return CFG.pistolDamage + 12 * level;
}
export function fireInterval(level) {
  return Math.max(0.2, 0.32 - 0.04 * level);
}
