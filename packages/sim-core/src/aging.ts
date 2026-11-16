// P1-3 · 衰老维度
// 铁律 11：禁 Math.pow/exp。smoothstep 用 64 点 LUT + 线性插值（LUT 本身只用乘法生成），跨引擎逐位一致。

/** 4 天 = 1 岁：60 天一局每人老 15 岁；300 天长跑可见「婴儿 → 成年 → 老年」 */
export const DAYS_PER_YEAR = 4;
/** Elder 状态门槛（岁） */
export const ELDER_AGE = 60;

const LUT_N = 64;
/** smoothstep(0..1) 的 64 段表：t²(3−2t)，只用乘法 */
const SMOOTH_LUT: Float64Array = (() => {
  const a = new Float64Array(LUT_N + 1);
  for (let i = 0; i <= LUT_N; i++) {
    const t = i / LUT_N;
    a[i] = t * t * (3 - 2 * t);
  }
  return a;
})();

/** smoothstep(e0, e1, x)：查表 + 线性插值 */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (x <= e0) return 0;
  if (x >= e1) return 1;
  const f = ((x - e0) / (e1 - e0)) * LUT_N;
  const i = Math.floor(f);
  const r = f - i;
  return SMOOTH_LUT[i] + (SMOOTH_LUT[i + 1] - SMOOTH_LUT[i]) * r;
}

/** 年龄脆弱度 1.0 → 1.8（20 岁起、70 岁封顶）。只乘在失温方向（任务卡：不许变成全面削弱） */
export const ageFrailOf = (age: number): number => 1 + 0.8 * smoothstep(20, 70, age);

/**
 * 产出乘子 1.0 → 0.6（60 岁起衰减、85 岁到底）。
 * 任务卡草案为 45–70 岁 / 减半；实测在「4 天 = 1 岁」尺度下基准会有 2/10 种子饿死、劳力 0.95 均存活仅 2.3，
 * 改为 60–85 / 0.4 后基准 0/10 有死、渐进死亡格 14/40（见 SPEC §5.5）。
 */
export const ageOutputOf = (age: number): number => 1 - 0.4 * smoothstep(60, 85, age);
