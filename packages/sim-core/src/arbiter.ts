export interface Candidate {
  id: string;
  tierId: string;
  act: number;
  run: number;
  score: number;
  tag: string;
  target?: number;
}

export interface Decision {
  chosen: Candidate | null;
  reason: 'preempt' | 'keep' | 'stay-cooldown';
}

export function arbitrate(
  candidates: readonly Candidate[],
  current: Candidate | null,
  cooling: ReadonlySet<string> = new Set(),
): Decision {
  const active = current && !cooling.has(current.id) ? current : null;
  let best: Candidate | null = null;
  let peer = active;
  for (const candidate of candidates) {
    if (cooling.has(candidate.id)) continue;
    if (!best || candidate.act > best.act ||
        (candidate.tierId === best.tierId && candidate.score > best.score)) {
      best = candidate;
    }
    if (peer && candidate.tierId === peer.tierId && candidate.score > peer.score) {
      peer = candidate;
    }
  }
  if (!active) return { chosen: best, reason: best ? 'preempt' : 'stay-cooldown' };
  if (best && best.tierId !== active.tierId && best.act > active.run) {
    return { chosen: best, reason: 'preempt' };
  }
  if (peer && peer.id !== active.id && peer.score > active.score * 1.15) {
    return { chosen: peer, reason: 'preempt' };
  }
  return { chosen: active, reason: 'keep' };
}
