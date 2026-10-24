// Couleurs de l'extension (panneau et réglages), en clair et en sombre.
import { useColorScheme } from 'react-native';

const LIGHT = {
  bg: '#f6f5f1', surface: '#ffffff', fg: '#1d1d1f', muted: '#66666e', line: '#e7e5e0', soft: '#efeeea',
  accent: '#284b8f', accentFg: '#ffffff', star: '#e0a100',
  ok: '#1f7a4d', okBg: '#e5f3eb', wait: '#9a5b00', waitBg: '#fcf0dc', info: '#285e8f', infoBg: '#e6eef7',
  none: '#7a7a82', noneBg: '#efeeea', err: '#b42318', errBg: '#fbe9e7',
};

const DARK = {
  bg: '#151517', surface: '#1d1d21', fg: '#f1f1f3', muted: '#a3a3ad', line: '#34343a', soft: '#26262b',
  accent: '#8fb0ff', accentFg: '#10131c', star: '#f2c94c',
  ok: '#5fd39a', okBg: 'rgba(95, 211, 154, 0.14)', wait: '#f2b55c', waitBg: 'rgba(242, 181, 92, 0.14)',
  info: '#8fb7e8', infoBg: 'rgba(143, 183, 232, 0.14)', none: '#a3a3ad', noneBg: '#2c2c31', err: '#ff8a7a', errBg: 'rgba(255, 138, 122, 0.12)',
};

export const palette = (scheme) => (scheme === 'dark' ? DARK : LIGHT);

export function useColors() {
  return palette(useColorScheme());
}

/** Couleurs d'un ton de résumé (« ok », « wait »… comme la pastille de l'extension). */
export function toneColors(c, tone) {
  switch (tone) {
    case 'ok': return { fg: c.ok, bg: c.okBg };
    case 'wait': return { fg: c.wait, bg: c.waitBg };
    case 'info': case 'load': return { fg: c.info, bg: c.infoBg };
    case 'setup': return { fg: c.accentFg, bg: c.accent };
    case 'err': return { fg: c.err, bg: c.errBg };
    default: return { fg: c.none, bg: c.noneBg };
  }
}
