// TensionScore（SPEC §11.4）：决定事件进事件卡 / 编年史红点 / 只计数。
// 纯函数、只看场景元数据，不读模拟状态。Worker 与主线程共用。
const CAT_BASE: Record<string, number> = {
  Fight: 80, Steal: 75, Abandon: 90, Mourn: 70, Family: 65, Explore: 50,
  Food: 40, Water: 40, Warmth: 45, Relation: 25,
};

export function tensionOf(s: { scene: string; branch: string; cat: string; effect?: string }): number {
  let t = CAT_BASE[s.cat] ?? 15;
  const e = s.effect ?? '';
  if (/react:R1[4-7]/.test(e)) t += 25;          // 大恶：偷窃被抓 / 抢配给 / 见死不救
  if (/react:R0[18]|react:R28|react:R35/.test(e)) t += 15;   // 救命之恩
  if (/couple:|breakup:|birth:/.test(e)) t += 25;
  if (/\+Lover|\+ExLover|\+ExFriend|\+Suspect/.test(e)) t += 20;
  if (/discover:/.test(e)) t += 25;
  if (/health:[FTA]:-/.test(e)) t += 10;
  if (/S11_confession/.test(s.scene)) t += 20;
  return Math.max(0, Math.min(100, t));
}
