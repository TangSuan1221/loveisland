export type StageId = 'hanami' | 'cabin' | 'orb';
export type StageBlend = 'normal' | 'add';
export type StageLayer = {
  layer: string; depth: number; blur: number; parallax: number;
  opacity: number; blend: StageBlend; note: string;
};
export type StageLight = {
  role: 'key' | 'rim' | 'fill' | 'bounce' | 'ambient';
  dx: number; dy: number; dz: number; color: string;
  intensity: number; softness: number; actorOnly: boolean;
};
export type StageFx = {
  type: 'bokeh' | 'petal' | 'spark' | 'ember' | 'dust' | 'ring' | 'flame' | 'aura';
  count: number; x0: number; y0: number; x1: number; y1: number;
  sizeMin: number; sizeMax: number; speed: number; color: string;
  alpha: number; blend: StageBlend; seed: number;
};
export type StageGrade = {
  exposure: number; contrast: number; saturation: number; shadowTint: string; highTint: string;
  vignette: number; vigSoft: number; bloomThresh: number; bloomStrength: number;
  bloomRadius: number; grain: number; chroma: number; note: string;
};
export type StageDef = Readonly<{
  id: StageId; tone: 'deadpan' | 'warm' | 'bitter' | 'absurd' | 'ominous';
  aspect: number; stops: readonly Readonly<{ at: number; color: string }>[];
  glowColor: string; glowX: number; glowY: number; glowPower: number; glowRadius: number;
  hazeY: number; hazeColor: string; actorX: number; actorFeet: number; actorH: number;
  rimColor: string; note: string; layers: readonly Readonly<StageLayer>[];
  lights: readonly Readonly<StageLight>[]; fx: readonly Readonly<StageFx>[]; grade: Readonly<StageGrade>;
}>;
export const STAGES: Readonly<Record<StageId, StageDef>>;
export function loadStages(): typeof STAGES;
