// 调色板与图集（一次性生成，CanvasTexture）。头顶图标用一张图集 + 实例化 sprite，1–2 draw。
import { CanvasTexture, Color, SRGBColorSpace } from 'three/webgpu';

/** relation-ladder 12 档色带：绝交(深红) → 认识(灰) → 誓约(金) */
export const TIER_COLORS = [
  '#5a0a0a', '#9b1c1c', '#c2410c', '#d97706', '#a3a3a3', '#94a3b8',
  '#e5e7eb', '#86efac', '#22c55e', '#38bdf8', '#a78bfa', '#facc15',
].map(c => new Color(c));
export const TIER_CSS = [
  '#5a0a0a', '#9b1c1c', '#c2410c', '#d97706', '#a3a3a3', '#94a3b8',
  '#e5e7eb', '#86efac', '#22c55e', '#38bdf8', '#a78bfa', '#facc15',
];

/** feeling.csv 行序：Normal Good Careless Worry Irritate Angry Deject Depress Desperate Starving */
export const FEELING_GLYPH = ['·', '☺', '~', '?', '!', '💢', '…', '☁', '‼', '◌'];
export const FEELING_COLOR = ['#e5e7eb', '#86efac', '#a5b4fc', '#fde68a', '#fdba74', '#f87171', '#93c5fd', '#64748b', '#ef4444', '#b45309'];

/** 需求图标：饥饿 口渴 疲惫 寒冷 伤病 */
export const NEED_GLYPH = ['🍖', '💧', '💤', '❄', '✚'];

/**
 * 图集布局：一行 16 格，每格 64px。
 *   第 0 行：10 种情绪
 *   第 1 行：5 种需求 × 3 级严重度（黄/橙/红）= 15 格
 */
export const ATLAS_COLS = 16, ATLAS_ROWS = 2, CELL = 64;
export const atlasFeeling = (f: number) => f;
export const atlasNeed = (need: number, sev: number) => ATLAS_COLS + need * 3 + sev;

export function buildAtlas(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * CELL; cv.height = ATLAS_ROWS * CELL;
  const g = cv.getContext('2d')!;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const disc = (cx: number, cy: number, fill: string) => {
    g.beginPath(); g.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
    g.lineWidth = 4; g.strokeStyle = 'rgba(15,23,42,0.85)'; g.stroke();
  };
  FEELING_GLYPH.forEach((glyph, i) => {
    const cx = i * CELL + CELL / 2, cy = CELL / 2;
    disc(cx, cy, FEELING_COLOR[i]);
    g.fillStyle = '#0f172a'; g.font = `bold ${CELL * 0.5}px system-ui, "Segoe UI Emoji", sans-serif`;
    g.fillText(glyph, cx, cy + 2);
  });
  const sevColor = ['#facc15', '#fb923c', '#ef4444'];
  NEED_GLYPH.forEach((glyph, need) => {
    for (let sev = 0; sev < 3; sev++) {
      const idx = need * 3 + sev;
      const cx = idx * CELL + CELL / 2, cy = CELL + CELL / 2;
      disc(cx, cy, sevColor[sev]);
      g.font = `${CELL * 0.48}px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif`;
      g.fillStyle = '#0f172a';
      g.fillText(glyph, cx, cy + 2);
    }
  });
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
