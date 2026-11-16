// 文本层：把快照与场景元数据翻成玩家能读的中文。
// 数值可见性铁律（SPEC §11.3）：档位「标签」可见；数值不可见；Strain 完全不可见。
import type { Snapshot, SceneLogEntry } from '@cruel-isle/sim-core';
import type { Meta } from '../bridge/protocol.ts';

export const SEASON_ZH = ['春', '夏', '秋', '冬'];
export const JOB_ZH = ['闲着', '采集', '取水', '砍柴'];
export const CAUSE_ZH: Record<string, string> = {
  hypothermia: '冻死', dehydration: '渴死', starvation: '饿死', injury: '伤重不治', exile: '被放逐',
};
export const RES_ZH = ['食物', '水', '柴火'];

const COND_ZH: Record<string, string> = {
  any: '日常相处', food_scarce: '最近吃不饱', water_scarce: '最近缺水', food_le_1: '粮仓见底',
  bond_lt_40: '两人关系很差', bond_lt_60: '两人关系冷淡', bond_ge_160: '两人亲密无间', romance_ok: '两人亲密无间、且没有血缘',
  winter_cold: '冬夜有人在挨冻', target_sick: '对方病着', dying: '有人快撑不住了', after_death: '岛上刚死了人',
  strain_ge_60: '心里积怨很深', bond_40_99: '关系不冷不热', target_depress: '对方很消沉', low_health: '有人受了伤',
  is_lover: '两人是恋人', has_lover: '岛上有恋人', is_couple: '两人是伴侣', has_unknown_site: '岛上还有没去过的地方',
};

/** 「为什么」三行（SPEC §11.3：因子分解）：①触发条件 ②发生了什么 ③会被记住什么 */
export function whyLines(meta: Meta, s: SceneLogEntry, snap: Snapshot | null): string[] {
  const name = (i: number | null) => (i == null ? '' : meta.names[i] ?? `#${i}`);
  const cond = COND_ZH[meta.sceneConds[s.scene]] ?? meta.sceneConds[s.scene];
  const lines: string[] = [];
  // ① 为什么会发生：条件 + 当时的资源压力（只给定性描述，不给数字）
  const rp = s.rp ?? 1;
  const pressure = rp >= 2.5 ? '岛上正在闹饥荒' : rp >= 2 ? '物资紧张到开始互相提防' : rp > 1.2 ? '物资有点紧' : '物资还算宽裕';
  lines.push(`起因：${cond}；${pressure}。`);
  // ② 发生了什么：从效果 token 里挑最重的一项
  const eff = s.effect ?? '';
  const what: string[] = [];
  for (const tok of eff.split(';')) {
    const [k, a, b] = tok.split(':');
    if (k === 'react') { const r = meta.reactions[a]; if (r) what.push(r.note.split('：')[0]); }
    else if (k === 'tag' && b?.startsWith('+')) what.push(`${name(roleId(s, a.split('>')[0]))} 对 ${name(roleId(s, a.split('>')[1]))} 有了新身份：${TAG_ZH[b.slice(1)] ?? b.slice(1)}`);
    else if (k === 'couple') what.push('两人成了伴侣');
    else if (k === 'breakup') what.push('两人分开了');
    else if (k === 'birth') what.push('一个孩子出生了');
    else if (k === 'discover') what.push(`${name(roleId(s, a))} 发现了新的${b === 'random' ? '地方' : RES_ZH[['food', 'water', 'firewood'].indexOf(b)] + '来源'}`);
    else if (k === 'health' && b?.startsWith('-')) what.push(`${name(roleId(s, a))} 受了伤`);
    else if (k === 'feed') what.push(`${name(roleId(s, a))} 吃上了一口`);
    else if (k === 'drink') what.push(`${name(roleId(s, a))} 喝上了水`);
    else if (k === 'scout') { /* 代价不单列 */ }
  }
  lines.push(`经过：${what.length ? what.slice(0, 2).join('；') : '没有大事'}。`);
  // ③ 会被记住什么：记忆台词按「当前关系」选 good/bad（SPEC §6.6）
  const mem = eff.match(/mem:(H\d+)/)?.[1];
  if (mem && meta.historyLines[mem]) {
    const h = meta.historyLines[mem];
    const good = snap ? bondTierOf(snap, s.T, s.F) >= 6 : true;
    lines.push(`${name(s.T)} 会记住「${h.label}」——「${good ? h.good : h.bad}」`);
  } else {
    lines.push('这件事很快会被淡忘。');
  }
  return lines;
}

function roleId(s: SceneLogEntry, r: string): number | null {
  return r === 'F' ? s.F : r === 'T' ? s.T : r === 'A' ? s.A : null;
}

/** a→b 的档位索引（快照边表查找；-1 = 无） */
export function bondTierOf(s: Snapshot, a: number, b: number): number {
  for (let e = 0; e < s.edgeCount; e++) if (s.edgeFrom[e] === a && s.edgeTo[e] === b) return s.edgeTier[e];
  return -1;
}

export const TAG_ZH: Record<string, string> = {
  Know: '认识', Friend: '朋友', ExFriend: '绝交的朋友', Lover: '恋人', ExLover: '前恋人', Couple: '伴侣',
  Parent: '父母', Child: '子女', GrandParent: '祖父母', GrandChild: '孙辈',
  BrotherSisterOlder: '兄姐', BrotherSisterYounger: '弟妹', Relative: '亲戚', Other: '家人般的人', Divorce: '分手',
  Debtor: '欠我人情', Creditor: '我欠他人情', Suspect: '怀疑他偷东西',
};
export const TAG_ORDER = ['Couple', 'Lover', 'Parent', 'Child', 'GrandParent', 'GrandChild', 'BrotherSisterOlder', 'BrotherSisterYounger',
  'Relative', 'Other', 'Friend', 'ExFriend', 'ExLover', 'Divorce', 'Creditor', 'Debtor', 'Suspect', 'Know'];

/** 场景 id → 可读标题（S11_confession → 告白） */
const SCENE_TITLE: Record<string, string> = {
  S01: '一起吃饭', S02: '分最后一份食物', S03: '为水起争执', S04: '饿急了打起来', S05: '偷吃被抓', S06: '照顾病人',
  S07: '冬夜挤在一起', S10: '背后议论', S11: '告白', S15: '一起喝水', S16: '守夜', S17: '避寒时聊天',
  S22: '夜谈', S23: '分享秘密', S24: '安慰消沉的人', S28: '三角关系', S30: '一起做饭', S33: '分最后一份食物',
  S35: '排队打水', S36: '为配水打架', S37: '接雨水', S38: '帮忙挑水', S39: '喝了脏水', S40: '守火堆',
  S41: '偷烧别人的柴', S42: '冻伤了手', S43: '一起垒墙', S70: '一起唱歌', S71: '成为伴侣', S72: '生孩子',
  S73: '分手', S74: '友情破裂', S75: '结伴探路', S76: '独自探路', S77: '缺水时找泉', S78: '冬季找林',
  S79: '为路线吵架', S80: '护送伤者回营',
  S08: '为配给争吵', S09: '埋葬与哀悼', S12: '见死不救', S13: '一起干活', S14: '平常的一餐', S18: '为食物打架',
  S19: '偷食物', S20: '为水打架', S21: '偷水', S25: '教手艺', S26: '旧怨重提', S27: '道歉', S29: '保护弱者',
  S31: '分享做法', S32: '囤积食物', S34: '喂病人吃饭', S44: '为物资打架', S45: '三人混战', S46: '目睹打架',
  S47: '偷库存', S48: '偷药', S49: '衣服破了', S50: '分衣服', S51: '洗衣服', S52: '送衣服', S53: '搭棚子',
  S54: '挖坑', S55: '开荒', S56: '标记小路', S57: '问起过去', S58: '问起死去的人', S59: '问为什么留下',
  S60: '交换物品', S61: '展示宝贝', S62: '丢了东西', S63: '布置住处', S64: '重新整理', S65: '合住', S66: '扫墓',
  S67: '讲死者的故事', S68: '把人丢下', S69: '一起看星星',
};
export function sceneTitle(id: string): string {
  const key = id.slice(0, 3);
  if (SCENE_TITLE[key]) return SCENE_TITLE[key];
  return id.replace(/^S\d+_/, '').replace(/_/g, ' ');
}

/** 管理者怨气：只给定性档位，不给数字 */
export function moodOf(managerStrain: number): { label: string; color: string } {
  if (managerStrain >= 85) return { label: '怨声载道', color: '#ef4444' };
  if (managerStrain >= 55) return { label: '颇有怨言', color: '#f97316' };
  if (managerStrain >= 25) return { label: '有些不满', color: '#facc15' };
  return { label: '信任你', color: '#86efac' };
}

/** 库存只给「够几天」的粗档，不给精确数（岛民也只知道个大概） */
export function stockWord(amount: number, perDay: number): string {
  if (perDay <= 0) return amount > 0 ? '有存货' : '没有';
  const d = amount / perDay;
  if (d < 0.5) return '见底';
  if (d < 2) return '撑一两天';
  if (d < 6) return '几天份';
  return '充足';
}

export const BEHAVIOR_ZH: Record<string,string> = {
  EatHand:'吃随身口粮', SeekFood:'寻找食物', BegFood:'向同伴讨食', StealFood:'抢夺口粮',
  EatRot:'吃腐食', EatNonFood:'嚼草根', DrinkClean:'喝净水', BoilWater:'烧水',
  DrinkDirty:'喝生水', WarmAtFire:'烤火', BurnFurniture:'拆家具取暖', Huddle:'依偎取暖',
  SelfTreat:'包扎', CallHelp:'呼救', Rest:'休息', Retry:'寻找自救办法', Dying:'濒死', Flee:'逃离危险', FirstAid:'紧急自救', Scene:'与同伴互动',
  SurviveSatiety:'饥饿倒地', SurviveHydration:'脱水倒地', SurviveWarmth:'严重失温', SurviveHealth:'伤重自救'
};
