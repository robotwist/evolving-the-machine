/**
 * Canvas fonts shared with the menus (see the @font-face rules in index.css).
 * Both families are size-adjusted there, so px sizes here render at roughly the
 * size a normal UI font would. Pixel fonts are drawn without faux bold.
 */
export const ARCADE_DISPLAY_FONT = '"Arcade Display", monospace';
export const ARCADE_BODY_FONT = '"Arcade Body", monospace';

/** Text this large or larger reads as a heading and uses the display font. */
export const DISPLAY_FONT_MIN_PX = 24;

export function arcadeFont(sizePx: number, kind: 'display' | 'body' | 'auto' = 'auto'): string {
  const display = kind === 'display' || (kind === 'auto' && sizePx >= DISPLAY_FONT_MIN_PX);
  return `${sizePx}px ${display ? ARCADE_DISPLAY_FONT : ARCADE_BODY_FONT}`;
}

/** Starts loading both fonts so the first canvas frames don't fall back to monospace. */
export function preloadArcadeFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all([
    document.fonts.load(`16px ${ARCADE_DISPLAY_FONT}`),
    document.fonts.load(`16px ${ARCADE_BODY_FONT}`),
  ]).catch(() => undefined);
}
