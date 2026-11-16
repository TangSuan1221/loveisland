// 布局：把「岗位/作息」映射成岛上的位置。纯渲染层推导，不写回模拟（铁律 12）。
// sim 没有寻路（SPEC §16：坐标只用于 UI），所以 NPC 位置 = 当前岗位对应的已知点位 / 营地，附带确定性的环形错位。
import { BEHAVIOR_INDEX } from '@cruel-isle/sim-core';
import type { Snapshot } from '@cruel-isle/sim-core';

/** 点位坐标 0..400 → 世界坐标（米）。岛中心 = 营地 */
import {slotPosition} from '../../../packages/sim-core/src/space.ts';
export {CAMP, WORLD_SCALE, siteWorld} from '../../../packages/sim-core/src/space.ts';
/** JOB_INDEX: idle=0 food=1 water=2 firewood=3；RESOURCE_KEYS: food=0 water=1 firewood=2 */
const JOB_TO_RES = [-1, 0, 1, 2];

/** 每个 NPC 的目标位置（x, z），写入 out[2i], out[2i+1] */
export function targetPositions(s: Snapshot, out: Float32Array) {
  const sleeping = s.hour >= 22 || s.hour < 6;
  const working = s.hour >= 9 && s.hour <= 17;
  // 各岗位 → 第一个已知点位（与 sim 的 harvest 顺序一致：按表序先采）
  const siteFor: number[] = [-1, -1, -1];
  for (let k = 0; k < s.siteCount; k++) {
    if (s.siteState[k] === 0) continue;
    const r = s.siteResource[k];
    if (siteFor[r] < 0) siteFor[r] = k;
  }
  const slot = [0, 0, 0, 0];
  for (let i = 0; i < s.count; i++) {
    const group=s.job[i];
    const site=working && !sleeping && group>0 ? siteFor[JOB_TO_RES[group]] : -1;
    const anchor=slotPosition(group,slot[group]++,site>=0?{x:s.siteX[site],y:s.siteY[site]}:undefined);
    out[2*i]=anchor.x;
    out[2*i+1]=anchor.z;
  }
  // 双人行为共用对方在本次快照的落点，避免双方相互追逐。
  const anchors=out.slice(0,2*s.count);
  for(let i=0;i<s.count;i++){
    const target=s.currentTarget[i];
    if(target<0 || !s.alive[target])continue;
    const behavior=BEHAVIOR_INDEX[s.currentBehavior[i]];
    if(!['BegFood','StealFood','CallHelp','Huddle'].includes(behavior))continue;
    out[2*i]=anchors[2*target]+(i<target?-0.65:0.65);
    out[2*i+1]=anchors[2*target+1];
  }
}
