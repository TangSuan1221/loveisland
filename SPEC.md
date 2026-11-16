# 残酷小岛 · 实现规格（SPEC）

> **读者**：接手实现的 AI / 工程师。读完这份文档 + 跑通 `sim/`，即可直接开工，不需要再问设计。
> **真值来源**：本目录 `sim/` 是可运行的参考实现，`data/*.csv` 是全部数值表。**文档与代码冲突时，以代码为准**，并提 issue 修文档。
> **根目录分层**：本文（SPEC）> `../残酷小岛-v3-Tomodachi原生逻辑改造.md`（设计意图与实证）> 更早两份（已部分作废）。

---

## 0. 一分钟概览

做一款 **《朋友收集 梦想生活》的关系系统 + 环世界式的资源压力** 的上帝视角生存模拟。

- **模仿对象**：Tomodachi Life（关系/事件/烦恼/记忆/三角色场景）＋ RimWorld（资源/死亡/管理）
- **玩家**：岛的意志。没有化身，无生理条。只做**指派 / 配给 / 偏袒 / 调解 / 放逐**。
- **规模**：12 NPC / 岛。60 天一个循环（4 季 × 15 天）。
- **核心断言**（已由仿真验证）：治理得当 60 天全员存活；关掉冬季储备则全员冻死；劳动力跌到 30% 则饥荒→冲突→团灭。
- **戏剧不是脚本**：全部由「资源压力 → 关系数值 → 加权事件分支」涌现。

**技术栈**：TypeScript + Three.js（WebGPURenderer）。`sim-core` 必须零 `three` 依赖，能在 Node 里 headless 跑。

---

## 1. 七层架构（严格分层，禁止跨层调用）

```
L6 玩家层     指派 / 配给 / 偏袒 / 调解 / 放逐 / 时间倍率
                ↓ 只写 policy，不直接改 NPC 状态
L5 事件层     Trouble 生成 → 三角色场景 → 加权分支 → 结果回写
                ↓ 只通过 effects 序列改 L4/L3/L1
L4 关系层     有向 Bond[0,200] + 15 类型标签 + Strain[0,100] + 记忆
                ↓ 只读
L3 需求层     5 条生存存量 + 10 种 Feeling
                ↓ 只读
L2 行为层     日常行为仲裁（Score 公式）+ 岗位分配
                ↓ 只读/写 store
L1 资源层     食物 / 水 / 柴火 三行库存
L0 时间层     固定步长 tick（1 小时 / tick）
```

**铁律**：
1. **只有 L5 能改 L4**（关系只能由事件结果改，禁止直接赋值）。
2. **只有 L2 能消耗 L1**，L5 通过 `feed/drink/transfer` 效果间接消耗。
3. **L6 不直接改任何 NPC 状态**，只写 `policy` 对象。
4. **L2 的打分器不决定关系**（这是 v1 的最大错误，务必避免）。

---

## 2. 时间模型

| 常量 | 值 | 说明 |
|---|---|---|
| `TICK` | 1 游戏小时 | 固定步长，与渲染帧率完全解耦 |
| `HOURS_PER_DAY` | 24 | |
| `SEASON_DAYS` | 15 | 4 季 = 60 天一轮 |
| `realSecondsPerDay` | 1200（20 分钟） | 1× 速度；4× 时 300s/天 |
| 睡眠窗 | 22:00–05:59（8h） | |
| 三餐 | 08 / 13 / 19 | |
| 饮水 | 10 / 16 | |
| 工作 | 09–17（9h） | |
| 岗位分配 | 06:00 | |
| 烦恼抽取 | 20:00 | 每天一次 |
| 日终结算 | 23:00 | |

**主循环顺序（顺序不可改，否则数值漂移）**：
```
1. griefDays 递减（每小时，0 点时 -1）
2. 06:00 → burnFirewood() → allocateJobs()
3. envTick()          计算温度
4. 每个存活 NPC → stockTick()      存量结算 + 临界伤害
5. 若当前小时 ∈ MEAL_HOURS  → consumeMeal(food)
6. 若当前小时 ∈ DRINK_HOURS → consumeMeal(water)
7. 若当前小时 ∈ WORK_HOURS  → produce()
8. 若当前小时 == 20        → rollTrouble()
9. 每个存活 NPC → updateFeeling()
10. checkDeaths()
11. 若当前小时 == 23       → endOfDay()
```

---

## 3. 数据结构（TypeScript 契约）

```ts
// ── L3 需求层 ──────────────────────────────
type StockKey = 'Satiety' | 'Hydration' | 'Rest' | 'Warmth' | 'Health';

interface StockDef {
  key: StockKey;
  max: number;              // 100
  perHourWake: number;      // 每小时衰减
  perHourSleep: number;     // 睡眠时的变化（Rest 为正）
  warnThreshold: number;    // 触发 Feeling=Worry
  critThreshold: number;    // 开始累积伤害
  zeroDamageHp: number;     // 每次伤害量
  zeroDamagePeriodHours: number; // 每 N 小时扣一次
}

// ── L4 关系层 ──────────────────────────────
type RelationTag =
  | 'Know' | 'Friend' | 'ExFriend' | 'Lover' | 'ExLover' | 'Couple'
  | 'Parent' | 'Child' | 'GrandParent' | 'GrandChild'
  | 'BrotherSisterOlder' | 'BrotherSisterYounger' | 'Relative' | 'Other' | 'Divorce'
  // ★ 生存扩展
  | 'Debtor' | 'Creditor' | 'Suspect';

interface Relation {          // 有向：a → b
  bond: number;               // [0, 200]，初始 100
  strain: number;             // [0, 100]，玩家不可见
  tags: Set<RelationTag>;
}
// 存储：Map<`${aId}>${bId}`, Relation>，n×n 全量预建，a→a 不存在

interface MemoryEntry {
  id: string;                 // H01..H20
  permanent: boolean;         // AbandonMe 类不可淡忘
  day: number;
  // 台词在渲染时按「当前关系」取 good_line / bad_line
}

// ── NPC ────────────────────────────────────
interface Npc {
  id: number;
  name: string;
  alive: boolean;
  stocks: Record<StockKey, number>;
  traits: { consc: number; agree: number; neuro: number; extra: number; grit: number };
  feeling: FeelingName;
  job: 'food' | 'water' | 'firewood' | 'idle';
  sleeping: boolean;
  // 临界累积计数（不是持久化数据，可重算）
  satietyZeroHours: number; dehydrateHours: number; hypothermiaHours: number;
  satietyZeroDays: number;
  memories: MemoryEntry[];
  _shortToday?: boolean; _rationCut?: boolean;   // 日内标记，日终清空
}

// ── L1 资源层 ──────────────────────────────
interface Store { food: number; water: number; firewood: number }

// ── L6 玩家政策 ─────────────────────────────
interface Policy {
  rationPerPerson: number;       // 默认 1.0，范围 [0, 2.0]
  favor: Set<number>;            // 被偏袒的 npcId（权重 2.0）
  winterPrep: boolean;           // 秋季为冬季储备柴火
  workforceScale: number;        // 默认 1.0（调试/疫病）
  managerStrain: number;         // [0,100] 全岛对管理者的怨气
}
```

---

## 4. L1 资源层

### 4.1 三行库存

| 资源 | 单位 | 初值 | 每人每天 | 每人每天产出 | 季 mod（春/夏/秋/冬） |
|---|---|---|---|---|---|
| food | 份 | 12 | 1.0 | **1.5** | 1.0 / 1.3 / 1.0 / **0.85** |
| water | 份 | 12 | 1.0（夏 ×1.5） | **6.0** | 1.0 / 1.0 / 1.0 / **0.7** |
| firewood | 捆 | 6 | 冬季 0.5 | **3.0** | 1.0 / 1.0 / 1.0 / 1.0 |

### 4.2 岗位分配（06:00）—— 冬季必然超订

```ts
need.food  = N * 1.0
need.water = N * 1.0 * (夏季 ? 1.5 : 1.0)
need.firewood = (冬季) ? N * 0.5 : 0

// 秋季冬储（policy.winterPrep）
if (秋季 && winterPrep) {
  const daysLeft = 15 - (day % 15)
  const winterNeed = N * 0.5 * 15          // 冬季总需求
  need.firewood = max(0, winterNeed - store.firewood) / max(1, daysLeft)
}

// 短缺时加派（NPC 自救，非玩家指令）
for (k of ['food','water'])
  if (store[k] / (N * perPersonDay[k]) < 2) need[k] *= 1.5

// 换算人数
workersFor(k) = ceil(need[k] / (perWorkerDay[k] * seasonMod[k]))

// 超订时按权重比例缩放，每项至少 1 人（防止某一项被饿死）
weight = { food:1, water:1, firewood: 秋季 ? 2.0 : 1.0 }
L = 真实可用劳力（able 人数 + 被精准指派锁定在岗的人）   // P0-1：不再用存活人数 N
if (总需求 > L) {
  floor.water = workersFor(water, 真实日需求)          // P0-1：水是 4h 致死，先保底（不含 1.5x 加派）
  rest = L - floor.water                               // 底线装不下（> L-1）则 floor=0
  for k: alloc[k] = need[k] > 0 ? max(1, floor[k] + floor((need[k]-floor[k])*weight[k]/Σ * rest)) : 0
  while (Σalloc > L) 从「超出底线最多」的项减 1（不低于底线与 1）
} else alloc = need
// 柴火不进底线：冬季柴火必须靠秋储（关冬储必冻死），这是残酷发动机

// 余力只补食物，且不超过 6 天储备目标
surplus = min(可劳动人数 - 已分配, ceil(max(0, N*6 - store.food) / 1.5))
```

**P0-1 为什么必须按 L 而不是 N 缩放**：旧写法按 N 定名额，再按 food→water→firewood 顺序把名额发给 `able`。
一旦 `able < N`（疫病、饿倒），排在后面的水岗被整段截断 —— 这正是铁律 8 禁止的「贪心」，只是藏在发名额那一步。
5% 的劳力损失由此变成"水岗归零 → 4 小时掉血 → 全员同一小时脱水"。

### 4.2b 承载力（P0-1，`resources.csv` 的 `carry_ref / carry_k / carry_max`）

```ts
carry = min(carry_max, (carry_k + carry_ref) / (carry_k + 存活人数))   // 每小时产出 × carry
```
当前值 `carry_ref=16, carry_k=2, carry_max=1.5`：存活 16 人时 = 1.0；12 人 ≈ 1.29；8 人 = 1.8 → 封顶 1.5。
**语义**：同一片林子/泉眼，人越少人均越宽裕。这是"死人之后岛能缩编活下去"的负反馈——
没有它，任何减产都是单向螺旋（少产→饿→产出减半→更少产）。**只用四则运算**（铁律 11）。

> 消融实验（20 种子 × ws∈{0.95,0.9,0.85,0.8}）：三条改动缺任何一条，"部分死亡"格都 ≤ 13/80；
> 用平坦的 ×1.15~1.25 产出加成代替承载力，只有 4~7/20 —— **梯度来自结构，不是来自多给资源**。

**设计意图（务必保留）**：冬季 `need` 总数 ≈ 17 > 12 → 必然 5 人份缺口 → 必然取舍 → 必然冲突。**这是整个残酷感的发动机，不要为了"平衡"把它改小。**

### 4.3 生产中的人工系数

每人每小时产出 = `seasonMod × perWorkerDay / 9 × feeling.work`。
`feeling.work` 见 `data/feeling.csv`（0.5–1.1）。**Starving/Desperate 的 NPC 产出减半**，这是饥荒螺旋的推力。

### 4.4 进食：按需取食（关键，不要改成固定份额）

```ts
// 每人只取"补满自己所需"，且单餐不超过上限
maxShare = 单餐上限 * ratio          // food: 0.5，water: 0.6
want[i] = min(maxShare, (100 - stock) / nutrition)   // food 营养 62/份，water 100/份
totalDemand = Σ want[i]
taken = min(totalDemand, store)
ratio = taken / totalDemand

// 充足时按各自需求分；短缺时按优先序依次补满（P0-1）
share[i] = (ratio >= 0.999) ? want[i] : 按序分配(taken)
//   序 = 被偏袒者 → 在岗劳力 → Health 高者 → id 小者；每人最多拿到自己的 want[i]
stock += share * nutrition

_shortToday = ratio < 0.7
_rationCut  = share < want[i] * ratio * 0.9   // 拿到明显少于应得
```

**P0-1 为什么短缺时不再"全员按比例少分"**：比例分配让所有人的存量同步下滑、在同一小时一起跌破临界、一起死——
这就是 `0 死 / 12 死` 二值结局的直接原因。按序分配后先倒下的是闲置/体弱者，在岗劳力保住 → 产出保住 →
岛缩编活下来。被偏袒者排第一，所以 `favor` 的政治代价（`_rationCut` → `managerStrain`）语义不变，只是更锋利。

**为什么必须"按需"**：固定份额会导致「产量过剩 → 吃饱浪费 → 消耗低于预期 → 库存无限增长」的正反馈。v3 仿真踩过这个坑（食物堆到 209）。

### 4.5 资源点位与探索（P1-2，`data/explore-sites.csv`）

| 点位 | 资源 | 容量 | 再生/天 | 难度 | 冬季 | 开局 | 可发现季节 |
|---|---|---|---|---|---|---|---|
| E01 北泉 | water | 40 | 18 | 1 | 1.0 | 已知 | 任意 |
| E02 东泉 | water | 25 | 9 | 2 | 1.4 | 未知 | 任意 |
| E03 西林 | firewood | 60 | 9 | 1 | 1.0 | 已知 | 任意 |
| E04 南林 | firewood | 45 | 7 | 3 | 1.8 | 未知 | **仅冬季** |
| E05 浆果丛 | food | 45 | 20 | 2 | 0.85 | 已知 | 任意 |
| E06 渔湾 | food | 35 | 8 | 4 | 0.5 | 未知 | 任意 |

```ts
// 生产（每工作小时）：劳力产能照旧，但被已知点位的可采量封顶
gain = harvest(res, buckets[res] * per)   // 按表序从 known 点位扣 stock；采空 → depleted
// 日终：known/depleted 点位 stock += regen × (冬季且 winter_penalty<1 ? winter_penalty : 1)，封顶 capacity
// winter_penalty > 1：冬季去该点位探索会受伤 −round((p−1)×20) HP；< 1：冬季再生倍率
```
- **未发现的点位产出恒为 0**（`validate.mjs` 断言 + 变异测试证明）。全部点位未知时 60 天全灭（5 种子 0 存活 vs 基线 80）。
- **发现只走场景管线**（不另开系统）：`Explore` 类烦恼 → 场景 → `discover:<角色>:<资源|random>` 回写点位状态。目标按 1/难度加权抽取（结算段消耗 1 次 RNG，由存档状态唯一决定，确定性不变）。
- **探索代价** `scout:<角色>:<资源|random>`：Rest −25；次日 06:00 不排岗（`scoutRestUntil`）；冬季走向 winter_penalty>1 的点位扣血。
- 坐标只用于 UI 与快照（`siteX/siteY/siteResource/siteState/siteFill`），**不做寻路**。
- 开局状态可用 `WorldOptions.sitesStart = 'csv' | 'unknown' | 'known'` 覆盖（测试用）。
- **调参依据**：浆果丛 regen 16 时 200 天长跑只有 15/20 种子零死亡（P1-2 前为 18/20），提到 20、容量 45 后为 17/20。夏秋余粮被点位封顶会让第二年春荒提前，这是点位上限的固有代价。

---

## 5. L3 需求层

### 5.1 五条存量与结算

| 存量 | 每小时（醒） | 每小时（睡） | 临界阈值 | 伤害 | 说明 |
|---|---|---|---|---|---|
| Satiety | −2.58 | **−2.58**（睡着也饿） | 20 | 3 HP / 6h | |
| Hydration | −4.17 | **−4.17**（睡着也渴） | 10 | 6 HP / 4h | 最快致死 |
| Rest | −4.0 | **+7.2** | 0 | 无 | 净 −6.4/天，逼出睡眠需求 |
| Warmth | 见下 | 见下 | 20 | 4 HP / 4h | 冬季主轴 |
| Health | — | — | 30 | — | 到 0 即死 |

**Satiety/Hydration 必须 24 小时都衰减**。若睡眠时停下，日消耗会从 62 掉到 41，与 `perPersonDay = 1.0` 不自洽（v3 踩过）。

### 5.2 体温用「趋近模型」，不要用线性衰减

```ts
target = fireActive ? 100 : clamp(0, 100, (temp + 5) * 5)
if (!fireActive) target /= effectiveFrail          // P1-3：体弱/年老者无火时的平衡点更低
d = (target - warmth) * 0.15                       // 每小时收敛 15%
if (d < 0) d *= effectiveFrail                     // P1-3 修正：原为 d /= frail（方向反了）
warmth += d
// effectiveFrail = 性格 frail（0.85 + (1−grit)×0.5，婴儿 1.25）× ageFrail（见 §5.5）
```
- `temp ≥ 15` → target = 100（体温满）
- `temp = 5` → target = 50
- `temp ≤ -5` → target = 0（深冬夜无火 → 失温）

温度：`base = {春18, 夏26, 秋14, 冬2}`，夜间（<6 或 ≥20 点）`-8`，冬季夜间 `-10`。

**线性衰减会导致秋季夜间就冻死全员**（v3 踩过：−10/h × 8h = −80）。

### 5.3 Health 恢复

`Satiety>40 && Hydration>40 && Rest>40 && Warmth>30` → `Health += 1/h`（上限 100）。

**必须存在自体恢复**，否则一次受伤就永不愈合，玩家只能看着人死。

### 5.5 衰老（P1-3，`packages/sim-core/src/aging.ts`）

| 常量 / 函数 | 值 | 说明 |
|---|---|---|
| `DAYS_PER_YEAR` | 4 | 4 天 = 1 岁：60 天一局每人老 15 岁 |
| 年龄 | `(day − born) / 4` | 开局 `born` 按家庭代际打散（见下） |
| `ageFrail(age)` | `1 + 0.8 × smoothstep(20, 70, age)` | 1.0 → 1.8，**只乘在体温上**（掉速 + 平衡点） |
| `ageOutput(age)` | `1 − 0.4 × smoothstep(60, 85, age)` | 1.0 → 0.6，乘在 `produce()` 的个人产能上 |
| `ELDER_AGE` | 60 | `isElder(n)`；场景抽 T（被照顾的一方）时权重 ×1.3 |

- `smoothstep` 用 64 点 LUT + 线性插值，LUT 只用乘法生成（铁律 11）。
- **开局年龄与家庭代际一致**（每人 1 次 `rng.int`，改变了全局随机序列 → 本轮所有基准数字都变了）：
  祖辈 0,1 → 48–61 岁；子辈 2,3,5 → 22–29；孙辈 4 → 0–5；另一家 8,9 → 24–33、其子 6,7 → 1–7；无血缘者 → 16–45。
- **只在失温方向生效**：饥饿/脱水掉速与年龄无关（`validate.mjs` 断言）。所以老人在缺柴的冬天先冻死，而不是先饿死。
- **为什么要改平衡点**：只改掉速时，一夜过去所有人都冻到临界以下、掉血相同，实测老人死亡率仅比非老人高 1%；
  降低平衡点后，「柴火只够一部分人」的冷冬里老人死亡率 90% vs 非老人 38%。
- **任务卡原参数为 45–70 岁 / 产出减半**：实测基准 2/10 种子有人饿死、劳力 0.95 均存活仅 2.3，故改为 60–85 / 0.4。
- 开关 `WorldOptions.aging`（默认 true）。`false` = 退回 P1-2 全部规则（含旧的 `d /= frail`），供 `tools/parity.mjs` 对照。

**已知局限（见 §16.1）**：生育规则未随衰老调整。开局 3 对夫妻老了以后就没有新的婚姻来源，
**长跑 300 天岛会老化断代、最后饿死**（实测 12 种子 0–4 个存活；关衰老时 11/12）。

### 5.4 Feeling（10 种，互斥，优先级从高到低）

| 优先级 | Feeling | 触发 | work | social |
|---|---|---|---|---|
| 1 | `Starving` | Satiety < 20 | 0.5 | 0.7 |
| 2 | `Desperate` | strainMax ≥ 90 或 satietyZeroDays ≥ 2 | 0.5 | 0.4 |
| 3 | `Depress` | griefDays > 0 | 0.7 | 0.7 |
| 4 | `Angry` | strainMax ≥ 70 | 0.75 | 0.6 |
| 5 | `Deject` | strainMax ≥ 55 且 avgBond < 110 | 0.8 | 0.85 |
| 6 | `Irritate` | strainMax ≥ 40 | 0.85 | 0.8 |
| 7 | `Worry` | Warmth < 45 或 supplyRatio < 0.33 | 0.9 | 0.95 |
| 8 | `Careless` | Rest < 40 | 0.85 | 0.9 |
| 9 | `Good` | Satiety>60 && strainMax<30 && Health>70 | 1.1 | 1.15 |
| 10 | `Normal` | 默认 | 1.0 | 1.0 |

`strainMax(n)` = n 对所有 `bond < 160` 的对象中最大的 strain。

---

## 6. L4 关系层

### 6.1 数值阶梯（`data/relation-ladder.csv`）

Bond ∈ [0, 200]，初始 **100**。12 档，**成对阈值**（见设计文档公理 3）。

| Bond | 档 | 语义 | 可分享稀缺资源 |
|---|---|---|---|
| 0 | T0 绝交 | 见死不救 | ✗ |
| 1–19 | T1 仇敌 | 可能主动伤害 | ✗ |
| 20–39 | T2 敌对 | 抢夺配额 | ✗ |
| 40–59 | T3 恶感 | 可能偷取 | ✗ |
| 60–79 | T4 冷淡 | 拒绝协助 | ✗ |
| 80–99 | T5 疏远 | 隐瞒资源位置 | ✗ |
| **100–119** | **T6 认识** | 等价交换（初始） | ✗ |
| 120–139 | T7 友好 | 一起行动 | ✗ |
| 140–159 | T8 亲近 | 告知资源位置 | ✗ |
| **160–179** | **T9 挚友** | 可分我最后一份食物 | ✓ |
| 180–199 | T10 血亲 | 无条件共享 | ✓ |
| 200 | T11 誓约 | 生死与共 | ✓ |

### 6.2 `IsNoChangeRank`（**全系统最重要的一个语义，不许简化**）

```ts
function applyBond(a, b, delta, noRank) {
  const r = rel(a, b);
  let next = r.bond + delta;
  if (delta < 0 && noRank) {
    const tier = tierOf(r.bond);
    next = Math.max(tier.min, next);   // 掉到本档下限为止，不跨档
  }
  r.bond = clamp(next, 0, 200);
}
```
**效果**：连续小恶（−20/−40）只让数值在档内下滑 + Strain 上涨，**档位标签不变**；直到一次 −80 才跨档崩塌。这是"温水煮青蛙"，玩家看到"关系还挺好"然后突然决裂。

### 6.3 Strain

- 范围 [0,100]，玩家**完全不可见**（UI 只用关系连线粗细暗示）。
- **来源**：① 负面事件（`data/relation-reaction.csv` 的 `strain_delta`）② **资源短缺的集体记仇**（见 6.5）。
- **衰减**：当天无任何负面互动 → 每对 −1/天。**有互动则不衰减**（`conflictToday` 标志）。
- **效果**：驱动 Feeling、影响 `strainMax`、`≥90` 触发 Desperate。

### 6.4 关系反应表（`data/relation-reaction.csv`，35 条）

关键行（其余照表）：
| id | 事件 | ΔBond | 不降档 | ΔStrain |
|---|---|---|---|---|
| R01 | 分我最后一份食物 | **+80** | ✗ | −20 |
| R08 | 把我从饿倒中救起 | +80 | ✗ | −30 |
| R14 | 偷我食物被抓 | **−80** | ✗ | +40 |
| R16 | 见我饿倒不施救 | −80 | ✗ | +60 |
| **R17** | **见死不救（濒死）** | **→ 强制归零** | ✗ | +100 |
| R10 | 拒绝给我水 | −20 | **✓** | +20 |
| R11 | 隐瞒食物位置被抓 | −40 | **✓** | +30 |
| R18 | 饿时看他吃饭 | −40 | **✓** | +35 |

### 6.5 短缺 → 集体记仇（**Strain 的唯一稳定来源，不许删**）

```ts
// endOfDay
const sr = supplyRatio();           // 最近 12 次进食的最低满足率
if (sr < 0.5) {
  const amount = (0.5 - sr) * 40;   // sr=0 → +20/天
  for (all pairs with bond < 160) strain += amount;
  managerStrain += amount * 0.5;
}
for (n of alive) if (n._rationCut) { managerStrain += 1; n._rationCut = false }
if (favor.size > 0) managerStrain += 未偏袒人数 * 0.3   // 偏袒本身就有政治代价
```

**`supplyRatio` 必须用「最近 12 次实际进食满足率的最低值」**，**不能**用库存天数——即时生产的经济体库存天然低，会误判成永久饥荒（v3 踩过）。

### 6.6 记忆（`data/history-param.csv`，55 条）

- 每条记忆有 `good_line` / `bad_line` 两套台词。
- **渲染时按当前 Bond 选**：`bond ≥ 100 → good_line`，否则 `bad_line`。这实现了 Tomodachi 的 `BalloonTalkRelationCond`（同一条记忆在不同关系下说不同话）。
- `is_permanent = 1` 的记忆（目前只有 `H05 AbandonMe`）**永不过期，且不能被后续正面事件覆盖**。这是关系的不可逆点。

---

### 6.7 关系标签的两条来源（**不要把血缘交给概率**）

18 个标签分两类，**实现时必须分开**：

**A. 事件写入（情感类，由 `effect` 的 `tag:` / `couple:` / `breakup:` 写入）**

| 标签 | 写入时机 |
|---|---|
| `Know` | 开局全员自带（索引创建时 `tags: new Set(['Know'])`） |
| `Friend` | S17_shelter_talk B2、S23_share_secret B2、S61_show_treasure B2、S52_cloth_gift B2 |
| `ExFriend` | **S74_friendship_breaks** B1/B2（先 `-Friend` 再 `+ExFriend`） |
| `Lover` | S11_confession B1（需 `romance_ok` = `bond ≥ 160` **且无共同祖先**，P1-3） |
| `ExLover` | S11_confession B3（告白被拒） |
| `Couple` | S71_become_couple（`couple:F>T` 效果，需 `is_lover`） |
| `Divorce` | S73_breakup（`breakup:F>T`，需 `is_lover`；同时删 Lover/Couple） |
| `Debtor` / `Creditor` | **"给别人食物/水"这个动作本身就是债务**：S02/S33（最后一份食物）、S03 B3、S34 B1、S38 B1。`tag:F>T:+Debtor`（T 欠 F）+ `tag:T>F:+Creditor` |
| `Suspect` | S05/S19/S21/S32/S41/S47/S48/S62（偷窃与怀疑） |

**B. 结构推导（血缘类，由 `family` 图算出，`recomputeKinship()`）**

```
family = { parents: Map<childId, Set<parentId>>, children: Map<parentId, Set<childId>> }
```

对每一有序对 (a,b) 按顺序判定，命中即 `continue`：

| 顺序 | 条件 | a→b 标签 |
|---|---|---|
| 1 | `children[a] ∋ b` | `Parent` |
| 2 | `parents[a] ∋ b` | `Child` |
| 3 | `∃c: children[a] ∋ c ∧ children[c] ∋ b` | `GrandParent` |
| 4 | `∃p: parents[a] ∋ p ∧ children[b] ∋ p` | `GrandChild` |
| 5 | `parents[a] ∩ parents[b] ≠ ∅` | `born` 早者为 `BrotherSisterOlder`，晚者为 `BrotherSisterYounger` |
| 6 | `bloodDistance(a,b,4) ≠ ∞` | `Relative` |
| 7 | 无血缘且 `bond ≥ 180` | `Other`（"选择的家人"，由 `updateOtherTag()` 在每日结算维护，**因为它随 bond 变化**） |

`bloodDistance` 是无向 BFS，只走父子边，深度上限 4。

> **为什么血缘必须推导而不是抽取**：血缘是客观事实。若把"成为父子"做成 5% 概率的随机事件，
> 会出现"昨天还是陌生人，今天成了爹"的荒谬，而且玩家用上帝视角会立刻看出来。
> 情感可以掷骰子，血缘不行。

**开局家庭（`initFamilies()`，12 人时）** —— 这一步保证 7 个血缘标签从第 1 天就存在：

```
Couple(0,1) → 孩子 2, 5          # 2 与 5 同胞
Couple(2,3) → 孩子 4             # 于是 0,1 是 4 的祖辈；5 是 4 的姑/舅（Relative）
Couple(8,9) → 孩子 6, 7          # 6 与 7 同胞
10, 11 无血缘（只有 Know）
```

亲代↔子代初始 Bond = **180（T10 血亲档）**，不是 200。
Tomodachi 原值 `ParentChildInitialValue = 200`，但本作 200 = 誓约（最高档，应靠事件挣得），
用 200 会让 8 条边开局即封顶、把阶梯顶部的稀缺性抹掉。180 语义正好是"血亲"，且留出上升空间。

**出生（`birth(aId,bId)`）**：`maxNpc = 16` 封顶（按历史总人数）→ P1-3：双亲有共同祖先则拒绝 → 新生儿继承双亲 traits 均值 ±0.1 抖动 →
建立双向 Parent/Child（Bond 180）→ `recomputeKinship()` → 写 `births` 并记 `BIRTH` 日志。
人口增长本身是**压力源**：每多一人就多 1.0 food/天、冬季多 0.5 firewood/天，
所以"生得越多越难活"是系统自然涌现的，不需要额外写规则。

---

## 7. L5 事件层
### 7.1 烦恼生成（每天 20:00 一次）

```ts
const rp = resourcePressure();   // clamp(0.5, 3.0, 1 + (1 - supplyRatio) * 2)
const weights = []
for (const c of troubleCategory) {
  let eff = 0
  if (c.gateMode === 'always')      eff = c.base * rp
  if (c.gateMode === 'gated')       eff = max(0, c.base * (rp - c.gateRP) * c.gateScale)
  if (c.gateMode === 'winter')      eff = (季节===冬) ? c.base * rp : 0
  if (c.gateMode === 'after_death') eff = (griefDays>0) ? 400 : 0
  if (eff > 0) weights.push({ cat: c.cat, eff })
}
const n = clamp(2, 6, round(2 + (rp - 1) * 1.6))
for (let i = 0; i < n; i++) {
  const cat = weightedPick(weights)
  tryScene(cat)
}
```

### 7.2 `ResourcePressure` 是"饥荒才打架"的实现

| 库存状态 | supplyRatio | RP | 效果 |
|---|---|---|---|
| 3 天以上 | 1.0 | **1.0** | Fight/Steal/Abandon 权重 = 0 → **岛上温馨，就是 Tomodachi** |
| 1.5 天 | 0.5 | **2.0** | 战斗类权重刚好从 0 起步 |
| 见底 | 0.0 | **3.0** | 战斗类权重 600，成为主要烦恼 |

`gated` 类的公式：`max(0, base × (RP − 2.0) × 3)`，base = 200。RP < 2.0 时恒为 0（此即"因果约束"）。

### 7.3 参与者选择（**必须按关系加权，不能纯随机**）

```ts
const F = 均匀随机抽一个存活者
const T = 从其余存活者中按权重抽：x = bond(F,T)/100; w = 1 + x*x   // bond 200→5, bond 0→1（用乘法，禁 Math.pow）
const A = 三角色场景时，按同法从剩余者中抽
```
**为什么必须加权**：纯随机配对会让每对关系都被"摊薄"，Strain 永远积累不起来，"温水煮青蛙"整条链路失效（v3 踩过）。真实的人也只和有关系的人互动。

### 7.4 场景匹配（**绝不能死循环**）

```ts
function tryScene(cat) {
  if (_trySceneCat(cat)) return
  if (cat !== 'Relation') _trySceneCat('Relation')  // 兜底，避免"空掷"
  filteredScenes++
}
function _trySceneCat(cat) {
  const candidates = scenesOf(cat)
  for (let attempt = 0; attempt < 80; attempt++) {   // ★ 硬上限，绝不 while(true)
    if (alive.length < scene.party) return false
    const F = ..., T = ..., A = ...
    if (!meetsCond(scene.cond, ctx)) continue
    resolveScene(scene, ctx)
    return true
  }
  return false
}
```

### 7.5 场景条件 DSL（`scene_cond` 列）

| 条件 | 语义 |
|---|---|
| `any` | 恒真 |
| `food_scarce` | `ratioOf('food') < 0.8`（最近 12 次进食最低满足率） |
| `water_scarce` | `ratioOf('water') < 0.8` |
| `food_le_1` | `store.food <= 1.0` |
| `bond_lt_40` / `bond_lt_60` / `bond_ge_160` | `bond(F,T)` 比较 |
| `romance_ok` | `bond(F,T) ≥ 160` 且 F、T 无共同祖先（≤4 代）。P1-3 修正：此前父女可以告白→成为伴侣→生子（参考实现 7 种子 25 次出生全部是血亲父母） |
| `winter_cold` | 冬季 且 任一方 Warmth < 45 |
| `target_sick` | `T.Health < 60` |
| `dying` | 任一方 `Health ≤ 15` 或 `satietyZeroHours ≥ 2` |
| `after_death` | `griefDays > 0` |

### 7.6 效果 DSL（`effect` 列，`;` 分隔）

| 记号 | 语义 |
|---|---|
| `bond:F>T:+80` | F→T 的 Bond（第三段为负且需不降档时用 `react`） |
| `strain:T>F:+30` | T→F 的 Strain |
| `strain:F>P:+20` | **P = 管理者**（政治压力） |
| `react:R01` | 应用 `relation-reaction.csv` 的该行，作用于 **F>T**（`IsNoChangeRank` 一并生效；R17 特殊：Bond 强制归零） |
| `tag:F>T:+Lover` | 加/删关系标签 |
| `feeling:F:Good` | 直接设定 Feeling（下一次 tick 会被 updateFeeling 覆盖，仅用于本场景内表达） |
| `health:F:-10` | 加减 Health |
| `mem:ShareLastFood` | 给所有参与者追加记忆（已存在且 permanent 则跳过） |
| `feed:F` / `drink:F` | 从仓库取 0.333 food / 0.5 water 当场喂给 F（库存不足则无效果，**不报错**） |
| `transfer:F>T:water:-1` | 从仓库扣 1 水 |
| `trouble:Food` | 标记"由本事件挂出的烦恼"（用于统计与调试） |
| `none` | 空 |

**所有效果必须 try/catch 包裹并记录 `EFFECT_ERR`，单条失败不得中断世界。**

### 7.7 分支抽取

```ts
const valid = scene.branches.filter(b => meetsCond(scene.cond, ctx))
const chosen = weightedPick(valid, b => b.rate)   // rate 为 0 则永不被选
if (!chosen) { filteredScenes++; return }
```

---

## 8. 死亡与哀悼

### 8.1 三种死法（**只有这三种，不许加随机死亡**）

| 死因 | 条件 | 可预防手段 |
|---|---|---|
| `hypothermia` | Health 归零 且 `hypothermiaHours > 0` | 建火堆 / 冬季前储柴 |
| `dehydration` | Health 归零 且 `dehydrateHours > 0` | 加派取水 |
| `starvation` | Health 归零 且 `satietyZeroHours > 0` | 加派采集 / 降低配给 |
| `injury` | 以上都不满足 | （兜底） |

**明确不做**：直接饿死（只会"倒下"，被救起后写 `Collapse` 记忆）、病死、意外死。

### 8.2 死亡结算

```ts
npc.alive = false
deaths.push({ id, day, hour, cause })
griefDays = 3
for (m of alive) {
  rel(m, npc).bond = min(200, +20)      // 死者为大（美化记忆）
  policy.managerStrain += 15            // 怨恨管理者
}
```

### 8.3 哀悼期（3 天）

`TroubleCategory.Mourn` 的 `gateMode = 'after_death'`，权重 400。所有 NPC 的 Feeling 被压到 `Depress`。

> **设计意图**：残酷之后必须给温情空间。这 3 天是玩家补关系的窗口。**不要删掉这一段**，否则玩家会在团灭后直接关游戏。

---

## 9. 边界情况登记表（**实现时逐条对照，每条都要有处理**）

| # | 情况 | 必须有行为 |
|---|---|---|
| 1 | 全部 NPC 死亡 | 停止 tick，进入 `GAME_OVER`，展示编年史，允许读档 |
| 2 | 只剩 1 人 | 所有 `party ≥ 2` 的场景跳过（`filteredScenes++`），不报错 |
| 3 | 某烦恼类别无任何满足条件的场景 | 兜底到 `Relation`；仍无 → 跳过，不阻塞 |
| 4 | 连续 80 次采样都无满足条件的参与者 | 放弃本场景，记 `filteredScenes`，继续下一个 |
| 5 | 关系 `a→a`（自己对自己） | **禁止创建**，访问返回 `null` |
| 6 | Bond 超出 [0,200] | `clamp`；Strain 超出 [0,100] → `clamp` |
| 7 | 资源为负 | `max(0, ...)`；`transfer` 正向（amt>0）当前无效果，勿依赖 |
| 8 | 场景进行中某参与者死亡 | 场景照常结算完（事件已发生），死亡在 `checkDeaths` 统一处理；渲染层改用"遗照"表现 |
| 9 | 同一 tick 多人死亡 | 逐个结算，`griefDays` 只置 3（不叠加） |
| 10 | 玩家在场景播放中暂停 | 模拟暂停，场景状态机停在当前 beat，恢复后继续。**已实现（P1-1）**：`advance()` 返回 `'scene'` 即停在「已抽签未结算」，渲染层播完卡再调 `advance()` |
| 11 | 玩家在场景播放中存档 | 存档包含"待结算的场景 + 已选分支"，读档后从该处继续。**已实现（P1-1）**，见 §10 |
| 12 | 时间倍率切换（1×→8×） | 只改"每真实秒推进多少 tick"，**tick 内部逻辑完全不变**，保证确定性 |
| 13 | 镜头外发生 Major 事件 | 必须进入事件卡队列（见 §11），不能丢失 |
| 14 | `favor` 里的人死亡 | 从 `favor` 集合中移除（或保留但无效果，二选一，需一致） |
| 15 | `rationPerPerson = 0` | 允许（极端政策），所有人 `_rationCut`，政治压力飙升，最终饿死 |
| 16 | 冬季 `firewood = 0` 且有人在户外 | `fireActive = false`，全员体温向 0 收敛，4h 后开始扣血 |
| 17 | 存档版本不匹配 | 拒绝加载并提示，不要静默迁移 |
| 18 | 数值出现 NaN | 每次 `endOfDay` 断言所有 store/stocks 为有限数；失败则记录诊断并 `clamp(0, ...)` |
| 19 | LLM 服务不可用 | 台词降级为 CSV 模板，**不影响模拟** |
| 20 | 浏览器标签页失焦 | `requestAnimationFrame` 暂停，但模拟 Worker 继续按固定步长跑（或按设置暂停） |

---

## 10. 存档格式

**双层**：

```ts
interface SaveV1 {
  version: 1;
  meta: { savedAt: number; day: number; hour: number; rngState: string; seed: number };
  policy: Policy;                        // Set → Array
  store: Store;
  fireActive: boolean;
  griefDays: number;
  ticks: number;
  npcs: Array<{
    id, name, alive, stocks, traits, feeling, job, sleeping,
    satietyZeroHours, dehydrateHours, hypothermiaHours, satietyZeroDays,
    memories: Array<{ id, permanent, day }>,
  }>;
  relations: Array<{ from, to, bond, strain, tags: string[] }>;  // 只存非默认值（bond≠100 或 strain>0 或 tags 非空）
  sceneLog: Array<{ day, hour, scene, cat, branch, F, T, A }>;   // 编年史，可截断到最近 200 条
  // ── P1-1（2026-11-13 实现；三键可选，旧存档无它们照常加载）──
  dayState?: {                       // 日内中间量：缺了它 20–23 点存档会分叉（实测改前 37/508 个存档点分叉）
    conflictToday, jobDemand, prod, cons, pendingTrouble,
    npcFlags: Array<[_shortToday, _rationCut, jobLockedToday]>,
  };
  trouble?: { rp, weights: Array<{cat, eff}>, remaining } | null;   // 20:00 烦恼阶段进度
  pendingScene?: {                   // 已抽签、未结算的那一场
    sceneId, branchId, participants: number[], focus, target, another,
    rp, rolledAt: { day, hour },
    rngCursor: string,               // 抽完签后的 RNG 状态；load 时必须 === meta.rngState，否则拒绝加载
  } | null;
}
```

**硬要求**：
- `rngState` 必须存（BigInt 转 string），否则读档后随机序列断裂。
- 关系只存**偏离默认**的边（12 人 = 132 边，通常只有几十条非默认）→ 存档体积小。
- 存档用 `IndexedDB`（结构化克隆），**不要用 localStorage**（容量与同步阻塞）。

**场景中途存档的语义（P1-1）**：
- 每场场景拆成两段：**抽签**（类别 → 模板 → 参与者 → 分支，消耗 RNG）与 **结算**（`applyEffect` + 写编年史，**不消耗 RNG**）。两段之间就是 `pendingScene`。
- 存档时若停在场景中途，该 tick 的前半段（第 1–7 步）已执行、后半段（第 9–11 步）未执行；`trouble` 记录本晚还剩几场。
- 读档后**不重新抽签**：直接按 `branchId` 结算，然后继续抽本晚剩余场次 → 与不存档路径逐位相同。
- `rngCursor` 是自检：抽签到存档之间不允许再有任何随机消耗；不相等即存档损坏，拒绝加载。
- 类别权重在本晚开场时算一次并存进 `trouble.weights`（中途某场写了 Lover 也不重算），与一次性结算语义一致。
- 读档时关系 Map 按「开局 a×b + 每次出生追加」的真实插入顺序重建 —— `endOfDay` 的浮点求和依赖键序。
- 数值表改动导致存档里的场景/分支不存在 → 记 `PENDING_LOST` 跳过，不崩。

---

## 11. 渲染层契约（Three.js + WebGPU）

### 11.1 边界

```
Worker: sim-core（固定步长，无 three 依赖）
  ↓ 每帧投递快照（Transferable ArrayBuffer 双缓冲，1 帧延迟）
主线程: render-three（只读快照，不反向写）
```

**绝不允许**渲染层修改模拟状态（除了通过 `policy` 指令队列）。

### 11.2 快照格式（SoA typed array，禁止对象数组）

**已实现**：`packages/sim-core/src/snapshot.ts`，类型见 `types.ts` 的 `Snapshot`。每次 `snapshot()` 分配新 buffer，
`postMessage(snap, transferList(snap))` 整体 Transferable 投递（1 帧延迟双缓冲）。

```
Float32Array  store      [3]       // food, water, firewood（RESOURCE_KEYS 顺序）
Uint8Array    id, alive  [n]
Float32Array  posX, posY [n]       // P1-2 空间点位前恒为 0
Float32Array  satiety, hydration, rest, warmth, health [n]
Uint8Array    feeling    [n]       // feeling.csv 行序
Uint8Array    job        [n]       // JOB_INDEX = idle, food, water, firewood
Uint8Array    edgeFrom, edgeTo [m] // 稀疏边表：只含双方存活的有向边（16 人 ≤ 240）
Float32Array  edgeBond, edgeStrain [m]
Uint8Array    edgeTier   [m]       // 0–11，relation-ladder.csv 行序
Uint32Array   edgeTags   [m]       // TAG_BITS 位掩码（18 个标签）
+ 标量：tick, day, hour, seasonIdx, fireActive, griefDays, count, edgeCount
+ 标量（P1-1）：pendingSceneIdx, pendingBranchIdx, pendingF, pendingT, pendingA   // -1 = 无待结算场景
```
与早期草案的差异：stocks 拆成 5 个独立数组（渲染层按需取）；边用 Float32 而不是 Q8.8（16 人规模无带宽压力，且免掉定点换算）；
`goalIcon` / `pendingEvents` 待行为层与事件卡队列（P2-1）落地时**在末尾追加**。
**⚠️ `edgeStrain` 只能映射线粗，UI 绝不显示数值。**

### 11.3 可读性（**上帝视角没有微表情，全靠信息层**）

| 信息 | 载体 | 规格 |
|---|---|---|
| 需求 | 头顶图标 | 仅 `stock < warnThreshold` 时显示；颜色按缺口比例黄→橙→红 |
| 情绪 | 头顶表情图标 | 10 种 Feeling 各一图 |
| **关系** | 选中一人 → 展开其所有边 | 颜色 = Bond 12 档色带；**线粗 = Strain 0→100 映射 1→6px**；虚线 = 单向；箭头 = 方向 |
| 意图 | 头顶小图标（可关） | 直接读该 NPC 当前行为 |
| 事件 | 屏幕右下事件卡 | Major 场景 + 三行"为什么"（因子分解） |
| 编年史 | 底部时间轴 | 可点击回放 |

**数值可见性铁律**：
- 档位**标签**可见（"亲近"）
- 数值**不可见**
- **Strain 完全不可见**（只有线条变粗这种模糊线索）

### 11.4 镜头外事件

| TensionScore | 处理 |
|---|---|
| ≥ 85 | 强制推送事件卡 + 可选自动暂停并聚焦 |
| 55–84 | 只进编年史（时间轴红点） |
| < 55 | 只进统计，不打扰 |

每条事件卡带"回放"按钮（3–5 秒摘要镜头）。

### 11.5 渲染预算（12 NPC 岛）

| 层 | 技术 | draw |
|---|---|---|
| 地形 | 合并 mesh + 顶点色 | 1 |
| 建筑 | InstancedMesh | ~20 |
| NPC 近景（≤12） | SkinnedMesh 16 骨 | ≤12 |
| NPC 远景 | Impostor billboard | 1 |
| 关系连线 | LineSegments | 1 |
| 头顶图标 | InstancedMesh | 1–2 |

---

## 12. 确定性规范（**违反会导致回归测试失效**）

| 规则 | 原因 |
|---|---|
| 禁止在模拟层使用 `Math.random` | 用 `Rng`（splitmix64，纯整数） |
| 禁止在决策路径使用 `Math.pow/exp/sin/log` | 跨引擎差 1 ulp → 不同设备出不同世界 |
| 曲线查询用 **64 点 LUT + 线性插值** | 同上 |
| 存量累加可考虑 Q16.16 定点 | 长期累积漂移（当前 float32 已够用，但存档需注意） |
| 绝不遍历 `Object` 属性做决策 | 用 `TypedArray` + 索引 |
| 主循环顺序固定（§2） | 换序会改变结果 |

**验证**：同种子跑两次，`rngState` 必须完全相同（`run-30d.mjs` 已验证）。

---

## 13. API 契约（sim-core 对外暴露）

**已实现**：`packages/sim-core`（`@cruel-isle/sim-core`，TypeScript，`dependencies: {}`）。入口 `src/index.ts`。

```ts
export class World {
  constructor(opts: WorldOptions)
  run(): Report                    // headless 用（从 tick 0 跑到 maxDays 或全灭）
  step(): void                     // 结算当前 tick（不推进 tick，测试脚本自行 tick++）；场景中途调用会抛错
  tickOnce(): boolean              // 完整推进 1 tick（场景即抽即结算）；结束（全灭/跑满）返回 false
  advance(): 'scene' | 'tick' | 'over'  // P1-1：可中断推进。'scene' = 停在待结算场景（this.pendingScene），可播卡/暂停/存档
  pendingScene: PendingScene | null     // P1-1：当前待结算场景（只读）
  snapshot(): Snapshot             // 给渲染层（SoA，§11.2）
  applyCommand(cmd: Command): CommandResult // 玩家指令
  save(): SaveV1
  static load(s: SaveV1, data?: GameData): World
}

interface WorldOptions {
  days?: number; seed?: number; npcCount?: number;
  ration?: number; favor?: number[]; winterPrep?: boolean;
  workforceScale?: number; startScale?: number; maxNpc?: number;
  data?: GameData;   // 数值表注入；缺省用构建期生成的 data.generated.ts
}

type Command =
  | { type: 'setRation'; value: number }
  | { type: 'setFavor'; ids: number[] }
  | { type: 'setWinterPrep'; value: boolean }
  | { type: 'setWorkforceScale'; value: number }       // 调试/疫病
  | { type: 'assignJob'; npcId: number; job: Job }      // 精准指派（K 最高档）
  | { type: 'mediate'; a: number; b: number }           // 调解：尝试降低 strain
  | { type: 'exileVote'; targetId: number }             // 放逐投票
  | { type: 'setSpeed'; value: 0 | 1 | 2 | 4 | 8 | 16 };
```

**模块边界**（`packages/sim-core/src/`）：
| 文件 | 内容 |
|---|---|
| `index.ts` | 对外出口（只暴露本节 API + 索引常量 + `transferList` / `parseCsv`） |
| `world.ts` | `World`，由 `sim/world.mjs` 逐函数搬运，方法名/字段名/调用顺序/Map 插入顺序全部不变 |
| `rng.ts` | splitmix64 |
| `kinship.ts` | 亲属图 + `recomputeKinship` / `updateOtherTag` / `bloodDistance`（纯函数） |
| `snapshot.ts` | SoA 快照 + `transferList` |
| `data.ts` | `num/bool/parseCsv` + CSV 行 → 运行时结构 |
| `data.generated.ts` | **构建期生成**（`node tools/gen-data.mjs`），勿手改 |
| `constants.ts` / `types.ts` | 常量、快照索引表、全部类型 |

**CSV 加载策略 = A（构建期生成）**：零运行时 IO，Worker 里直接 import 无路径问题；行保持原始字符串，数值转换仍由 `num()` 在 sim 内完成，与参考实现逐位一致。
`validate-data.mjs` 照旧读原始 CSV，并比对 `DATA_HASH` —— **改了 CSV 忘了 `gen-data` 会直接报错**。运行期 `fetch` + `parseCsv` 也可通过 `opts.data` 注入。

**运行**：Node ≥ 22.18（本机 24.14）原生擦除 `.ts` 类型，无需 tsx / 构建。源码只用可擦除语法（`erasableSyntaxOnly`，无 enum / namespace / 参数属性）。
类型检查：`cd packages/sim-core && npm install && npx tsc -p tsconfig.json`（strict，0 错误）。

**等价性**：`node tools/parity.mjs` → `PARITY OK`。8 种子 × 10 情景的 `report()` 全字段 + sceneLog + 每条边 bond/strain/tags + 每个 NPC 完整状态 + RNG；
存档交叉读写；玩家指令序列；`tickOnce ≡ run`；快照与对象状态一致。共 92 组 0 差异。变异测试（积怨腐蚀 −5 改 −4）→ 28 组报错，证明比对有效。

**参考实现**：`sim/world.mjs` 保留为对照组。五套回归默认跑 TS 版；`SIM=ref node validate.mjs` 切回参考实现。两者都必须全绿。
**之后的任务（P1-x）只改 `packages/sim-core`**；参考实现冻结，parity 届时会按预期失败 → 届时删掉 `tools/parity.mjs` 的旧实现对照或冻结它的基线。

**`mediate` 的行为**（已实现，`sim/world.mjs` → `World.mediate`）：
```
前置：a、b 均存活且 a≠b，关系边存在
冷却：同一对（无序）3 天内只能调解一次
代价：managerStrain += 5（被干预的不快），立即生效
判定：worst = max(strain(a,b), strain(b,a))
  worst ≥ 90 → 失败：双方 strain += 10，bond(a→b) -= 20，记 MEDIATE_FAIL
  否则       → 成功：双方 strain -= 30（下限 0），记 MEDIATE_OK
返回：{ ok, reason?, strain }
```

**`exileVote` 的行为**（已实现，`sim/world.mjs` → `World.exileVote`）：
```
投票者 = 存活且 ≠目标 且 rel(投票者→目标).bond < 40
needed = ceil(其他存活者数 / 2)
成功（votes ≥ needed 且 votes > 0）：
  目标 alive=false，deaths.push({cause:'exile'})，griefDays=3
  所有存活者对目标的 bond += 20（死者为大）
  managerStrain += 20
失败：
  所有投票者对目标的 strain += 40
  managerStrain += 8
返回：{ ok, reason?, votes, needed }
```

---

## 14. 验收测试

**五套脚本，共 82 条断言 + 数据引用完整性 + `tools/parity.mjs`，当前全部通过（`exit code 0`）**。
默认跑 TS 版 `packages/sim-core`；`SIM=ref` 前缀切到参考实现 `sim/world.mjs`（两者都绿）：

### `node validate-data.mjs` — 数据表引用完整性（静态检查）
在任何仿真之前跑。逐 token 校验 10 张 CSV 的交叉引用（P1-2 起含 `explore-sites.csv`、`gate_mode` 合法性、`discover:/scout:` 目标）：
关系阶梯 0–200 是否连续无断层 / 场景类别是否都在 trouble-category 里 / 每个场景分支概率和是否 =100 /
`mem:` 是否都存在于 history-param / `react:` 是否都存在于 relation-reaction /
`feeling:` 是否是 10 种之一 / `tag:` 是否在 18 个标签内 / 效果 token 是否合法 /
**每个关系标签是否至少有事件写入或结构推导（否则永远不会出现）**。
输出 18 类烦恼的场景覆盖直方图。

> 这一套是**接手的第二道闸**：`mem:` 拼错一个字母，运行时只会静默跳过，
> 而 validate-data 会直接报错退出。

### `node run-30d.mjs` — 单情景回归（10/10）
跑满 60 天无死锁 / 场景非空 / 丰年不打架 / 丰年无冤气 / 关系向好（119）/ 关系分化 8 档 / 事件 10 类 / 治理得当零死亡 / **冬季劳动力超订（峰值 26/16）** / 资源无 NaN。

### `node validate.mjs` — 多情景结构验证（23/23；`SIM=ref` 时 16/16）
| 情景 | 存活 | 出生 | 死亡 | 均 Bond | 政压 | 死因 |
|---|---|---|---|---|---|---|
| ① 正常治理 | 16/12 | 4 | 0 | 119.0 | 17.3 | — |
| ② 关闭冬储 | 0 | 4 | **16** | 128.8 | 100 | hypothermia:16 |
| ③ 偏袒 4 人 | 16/12 | 4 | 0 | 119.0 | **100** | — |
| ④ 劳动力 30% | 0 | 1 | **13** | 112.9 | 100 | dehydration:13 |
| ⑤ 疫病+无冬储 | 0 | 1 | **13** | 112.9 | 100 | dehydration:13 |

（P1-3 后的数字。开局年龄打散多消耗了随机数，所以全部情景的数字都变了。基准政压 17.3 来自探索场景里的口角。）

**衰老断言（P1-3 新增 4 条）**：缺柴冬天死因以 hypothermia/dehydration 为主（实测 147 例全是 hypothermia）/
死亡顺序与「性格×年龄」脆弱度正相关（先死一半 1.55 > 后死一半 1.18）/ 冷冬里老人死亡率 ≥ 1.5 倍非老人（90% vs 38%）/
`ageFrail` 只作用于体温（同条件 80 岁与 20 岁饥饿、脱水掉速完全相同）。

② 死亡数（16）高于 ④⑤（14）是因为它多生了 2 个孩子、人多嘴多、且没有冬储 → **人口增长本身就是压力源**。

**经济容错带（P0-1 新增 4 条）**：
| workforceScale | 改前（种子 20260101） | 改后 |
|---|---|---|
| 1.00 | 16 活 0 死 | 16 活 0 死 |
| 0.95 / 0.90 | 0 活 16 死 | 16 活 0 死 |
| 0.85 | 0 活 13 死 | **8 活 8 死** |
| 0.80 | 0 活 13 死 | **1 活 15 死** |
| 0.70 | 0 活 12 死 | 0 活 14 死 |

10 种子 × 4 档（0.95/0.9/0.85/0.8）中"有人死有人活"的格：改前 1/40 → 改后 24/40；所有种子基准仍零死亡。

结构断言含：基准可存活 / 关冬储必冻死 / 饥荒必出冲突 / 饥荒必降关系 / 饥荒必出青蛙 / 丰年零冲突 / 偏袒必生政治压力 / 绝境死亡高于基准与偏袒 / 所有情景正常终止 / 关系分化 ≥6 档 / **存在渐进死亡档位 / 基准零死亡 / 多种子渐进死亡 ≥40% / 多种子基准零死亡**。

### `node test-save.mjs` — 存档与边界（39/39；`SIM=ref` 时 22/22）
- 存读档后 **RNG 序列、关系总量、存活人数完全一致**（真确定性）
- 存档 19.8 KB，只存 68 条偏离默认的边（默认边含 `Know`，不算偏离）
- `setRation` / `setFavor` / `assignJob` / `mediate` / `exileVote` 全部路径（含冷却、失败分支、非法输入）
- 只剩 1 人跑 10 天不崩 / 全灭后 `run()` 正常返回 / 配给 0 全员饿死且无 NaN
- **单 tick 0.048 ms**（12 NPC，远低于 0.5 ms 预算）
- **P1-1 新增 11 条（仅 TS 版）**：存档含已选分支且 `rngCursor = rngState` / 读档后前 10 个随机数与对照组一致 / **穿越 pendingScene 后 10 天 RNG 序列逐 tick 一致** / 关系总量一致 / 结算的正是存档分支 / 结算不耗 RNG / 8 情景逐场存读档 22/22 全等 / 20–23 点 dayState 存档 6/6 一致 / 篡改 rngCursor 拒绝加载 / 旧存档兼容 / 快照暴露待结算场景
- **P0-2 新增 4 条（仅 TS 版）**：sim-core 只有相对 import 且 `dependencies` 为空 / `snapshot()` 全为 typed array / 边表只含存活者有向边 / `tickOnce()` 推进且全灭返回 false
- **铁律 11 静态扫描**：去注释后模拟层源码（TS 版扫 `packages/sim-core/src/*.ts` 6 个文件）不得出现 `Math.random/pow/exp/sin/cos/tan/log/sqrt/cbrt/atan/hypot`（2026-11-13 修掉参与者加权里唯一一处 `Math.pow`，改为 `x*x`，RNG 终态逐位不变）

### `node test-tags.mjs` — 关系标签与场景覆盖（8/8）
5 种子 × 10 情景（丰年/饥荒/疫病/无冬储/偏袒/冬荒崩坏/部分损失/急性缺水/冷冬存活/未知之地）× 60 天 = 50 次完整仿真，**4897 场事件**：
（P1-3：急性缺水改为零开局库存、新增「未知之地」——随机序列变化后 S03 争水 / S79 探路争吵 原情景里触发不稳）
（9/9 条断言；新增「场景模板 100% 触发」严格断言，模板总数改为从数值表动态读取）
- 15 个 Tomodachi 原版标签**全部真实出现**（`Know/Friend/ExFriend/Lover/ExLover/Couple/Parent/Child/GrandParent/GrandChild/BrotherSisterOlder/BrotherSisterYounger/Relative/Other/Divorce`）
- 3 个生存扩展标签全部出现（`Debtor/Creditor/Suspect`）
- 血缘成组（Parent+Child、GrandParent+GrandChild）、同胞双向（Older+Younger）
- 场景模板覆盖 **80/80 = 100%**（`SIM=ref` 下 74/74）
- 出生系统生效（50 次共 127 个新生儿）、人口不超上限 16

> **为什么必须跑混合情景**：`Debtor/Creditor/Suspect` 只在短缺时触发，`Mourn` 三人场景要"有人死但还剩 3 人"。
> 只跑丰年会误判为"标签没实现"——本轮就是靠这个测试发现了 `Other` 根本没写、
> `Child/GrandChild` 反向推导缺失、`Depress`/`dying` 条件永不成立、`bond_lt_60` 被
> `IsNoChangeRank` 卡死四个真问题。
>
> **情景设计本身就是设计工具**：为了让"部分损失"情景成立，必须先给 NPC 加个体脆弱度，
> 否则冬季永远全死或全活。测试逼出了设计。

**待实现后必须补的测试**：
1. 12 NPC × 60 天 full-run 在浏览器 Worker 中的耗时
2. LLM 断网降级不影响模拟
3. 出生基因混合的长期遗传漂移（当前只看 60 天，未看 10 代）

---

## 15. 反模式清单（**这些做法会毁掉系统，实现时主动拒绝**）

| ✗ 不要做 | 为什么 |
|---|---|
| 用效用打分器决定"爱上谁" | NPC 变成市场，不是人。关系只能由事件结果改（§1 铁律 1） |
| 给 `IsNoChangeRank` 做简化（"既然数值掉了就降档吧"） | 温水煮青蛙是全系统最好的戏剧装置 |
| 让 Fight/Steal 有基础生成率 | 会破坏"打架必有前因"，变成随机暴力 |
| 场景参与者纯随机抽 | Strain 永远摊薄，"青蛙"链路失效 |
| 用库存天数判断饥荒 | 即时生产经济体库存天然低 → 误判永久饥荒 |
| 固定份额进食 | 产量过剩 → 浪费 → 消耗低于预期 → 库存无限增长 |
| 体温线性衰减 | 秋季夜间就冻死全员 |
| 睡眠时停止饱食/水分衰减 | 日消耗 41 ≠ 配平用的 62 |
| 删掉死亡后的 3 天哀悼 | 玩家在团灭后直接关游戏 |
| 在模拟层用 `Math.random` / `Math.pow` | 跨设备不确定，回归测试失效 |
| 用 `while(true)` 找场景参与者 | 必死循环。用 80 次上限 |
| 让渲染层写模拟状态 | 双写战争，无解 |

---

## 16. 已知缺口（诚实清单，接手者按优先级处理）

> **三项 P1 已全部关闭**（2026-11 本轮完成），见 §16.0。

### 16.0 本轮已关闭的 P1（附验收方式）

| 原缺口 | 现状 | 验收 |
|---|---|---|
| 场景 21 个太少 | **74 个场景 / 219 条分支**，5 种子×7 情景 **74/74 = 100% 全部触发过** | `test-tags.mjs` |
| 三角色场景只有 3 个 | **21 个三人场景**（两人 53） | `validate-data.mjs` 打印计数 |
| 15 个关系标签只用 5 个 | **18 个标签全部真实出现**（15 原版 + 3 生存扩展） | `test-tags.mjs` 8/8 |
| `Debtor/Creditor` 无生成规则 | 挂到"分享食物/水"动作上（S02/S03/S33/S34/S38） | `test-tags.mjs` |
| 无出生/世代系统 | `birth()` + `maxNpc=16` + 亲属图 + 隔代推导 | `validate.mjs` 出生列 |
| 烦恼类别有空壳 | 17 类**全部有场景**（Depress/Introduction 生成率 0，故意如此） | `validate-data.mjs` 直方图 |
| **经济容错带过窄（P0-1，2026-11-13 关闭）** | ws=0.95 由"全员灭绝"变为"16 活 0 死"；0.85 → 8 活 8 死；0.80 → 1 活 15 死。10 种子×4 档部分死亡格 1/40 → 24/40，基准零死亡不变（RNG 终态逐位一致）。**实测根因与原诊断不同**：死因是 dehydration/starvation 而不是失温，柴火峰值 106 从未短缺；真因是 ① 岗位按 N 定名额再顺序发给 able → 水岗被截断 ② 短缺时全员同比例少分 → 同一小时一起死 ③ 无人口负反馈。修法见 §4.2 / §4.2b / §4.4 | `validate.mjs` 新增 4 条；`tools/probe-capacity.mjs` |
| **无衰老维度（P1-3，2026-11-13 关闭）** | 4 天 = 1 岁；开局年龄按家庭代际打散；`ageFrail` 1.0→1.8 只作用于体温（掉速 + 无火平衡点），`ageOutput` 1.0→0.6；Elder（≥60 岁）作为场景 T 位权重 ×1.3；存档带 `aging` 开关，快照带 `age/elder`。**顺带修正两个既有 bug**：① 体温 `d /= frail` 方向反了（越脆弱越抗冻 → 冬天孩子先于老人冻死），改为乘法 ② 告白/成家/生子不查血缘（参考实现 25/25 次出生的父母是血亲），新增 `romance_ok` 条件与 `isKin()` 共同祖先判定。详见 §5.5 | `validate.mjs` 新增 4 条；`tools/parity.mjs`（aging:false 对照） |
| **无发现/探索机制（P1-2，2026-11-13 关闭）** | `data/explore-sites.csv` 6 个空间点位（每资源 2 个，开局各知 1 个）；**产出 = min(劳力产能, 已知点位可采量)**，未发现点位恒为 0；日终按 regen 再生。发现只走场景管线：新类别 `Explore`（`has_unknown_site` 门控，权重 × 1/最易未知点位难度）+ 5 个探索场景 + `S78` 归保暖类；新效果 `discover:` / `scout:`（耗 Rest 25、次日休整不排岗、冬季去危险点位扣血）；南林 `discover_season=winter`。存档/快照带点位。详见 §4.5 | `validate.mjs` 新增 3 条；`test-save.mjs` 新增 2 条；`test-tags.mjs` 80/80 |
| **场景中途存档 pendingScene（P1-1，2026-11-13 关闭）** | 场景拆为「抽签（耗 RNG）/ 结算（不耗 RNG）」两段；`advance()` 可停在两段之间；存档带 `pendingScene + trouble + dayState`，读档后不重抽、直接结算。**顺带修掉两个既有缺陷**：① 日内中间量（`conflictToday` 等）不存档 → 20–23 点存档有 37/508 会分叉 ② 读档后关系 Map 键序错乱 → 浮点求和末位漂移。改后 1080 个存档点（540 个在场景中途）0 分叉；不存档路径数值不变（RNG 终态 `1703913871457947532`，parity 0 差异） | `test-save.mjs` 新增 11 条 |
| **sim-core 未独立（P0-2，2026-11-13 关闭）** | `packages/sim-core`：TS strict、零依赖（`npm ls three` 空，`dependencies: {}`）、零 IO，CSV 构建期生成 + 哈希过期检测，SoA `snapshot()` + `tickOnce()`。数值语义一字未改：`tools/parity.mjs` 92 组 0 差异。五套回归默认跑 TS 版。见 §13 | `node tools/parity.mjs`；`test-save.mjs` 新增 4 条；`npx tsc` |

### 16.0b 本轮顺带修掉的三个"死内容"（做覆盖率测试才暴露）

内容表里有、但**永远不会触发**的场景，等于没写。这三条是靠"每个条件实际成立几次"的探针查出来的：

| 症状 | 真因 | 修法 |
|---|---|---|
| `Depress` 情绪从未出现 → S24 永不触发 | 原逻辑里 `Depress` 只由"丧亲"赋值，而饥荒时 `Starving/Desperate` 优先级更高把它全遮住了 | 新增**社交性抑郁**：`avgBond<105 && strain≥40` 或 `Health<45 && avgBond<115`，排在 `Irritate` 之前 |
| `dying` 条件从未成立 | 场景每天 20:00 只生成一次，等 `Health` 掉到 15 时人已经冻死/脱水死了（几小时内） | 放宽为 `Health≤30 || satietyZeroHours≥2 || dehydrateHours≥2 || hypothermiaHours≥2` |
| `bond_lt_60` / `bond_lt_40` 从未成立 | **这不是 bug，是铁律 2 的正确行为**：`IsNoChangeRank` 把 Bond 卡在档位下限，只有 −80 的大恶才能降档。于是低 bond 需要"第二次大事"，而那时人已经快死了 | 见下：打架门槛改用 Strain + 积怨腐蚀 Bond |

**由此产生的一处设计改进（重要）**：

打架/偷窃的门槛从 **Bond** 改为 **Strain**。
理由：Bond 是"好感"，Strain 是"积怨"。两个人可以**好感很高但积怨很深**——这正是"温水煮青蛙"要表达的状态。
原先用 Bond 做门槛，导致青蛙链路（Bond≥100 但 Strain≥70）**没有任何终局事件**，憋在那不炸。
改成 Strain 门槛后，长期积怨会自己引爆 → S04/S05 变成青蛙链路的出口。

同时新增**积怨腐蚀好感**（`endOfDay`）：`strain ≥ 80 → bond −5/天`。
这是 Bond 唯一能跌破档位下限的慢路径，语义是"忍久了感情就没了"。
两条合起来：小恶积累 Strain（不降档）→ Strain 到 80 腐蚀 Bond（慢降档）→ Strain 到 60 引爆冲突（S04/S05）→ 形成完整的怨恨生命周期。

### 16.1 仍未做

| 优先级 | 缺口 | 说明 |
|---|---|---|
| ~~**P1**~~ | ~~经济容错带过窄~~ | **已关闭（P0-1）**，见 §16.0。遗留：ws=0.95/0.90 在参考种子上零死亡，渐进区间集中在 0.80–0.87；长期（200 天）水库存单调上涨到 ~500（无腐败/容量上限），不影响生存但会削弱后期压力 |
| **P1** | **长期断代（P1-3 遗留，用户决定暂不做生育）** | 衰老上线后，开局 3 对夫妻过了生育年龄就再无出生（血亲恋爱已禁止，告白门槛 bond≥160 在无血缘者之间很少达到）。岛持续老化、产出下降，**300 天长跑 12 种子 0–4 个岛存活**（关衰老时 11/12）。60 天一局不受影响。候选方案：求偶场景（双方育龄、无血缘、单身，bond≥100）+ 育龄上限 + 人口上限按存活人数计——已试做，单靠它们只把均出生从 3 提到 4–5，仍断代；可能需要玩家「撮合」指令或更高生育率 |
| **P2** | 记忆只用于数据，未接台词渲染 | 需要把 `good_line/bad_line` 接进 LLM 或模板系统（55 条记忆已备好素材） |
| **P2** | 无"玩家声望"独立数值 | 目前只有 `managerStrain`（负面），缺正面声望 |
| **P2** | 天气系统只有温度 | 没有雨/雪对产出的影响（表里有季节 mod，未拆出天气） |
| **P2** | 行为层未接 `ai-priority.csv` | 24 档优先级表已给，sim 里岗位分配是简化版 |
| **P3** | 技能/等级系统未设计 | 你的原表有 8 项技能 0–20，本设计未使用 |
| **P3** | LLM 表达层未接 | 只预留了接口位置 |

> **已补齐（不再是缺口）**：`mediate` 调解、`exileVote` 放逐投票、`save()/load()` 全套存档、
> `assignJob` 精准指派（含当天锁定）、单 tick 性能（0.048 ms）。见 `test-save.mjs`。

---

## 17. 在这个目录里怎么跑

```bash
# ① 数据表引用完整性（先跑这个，改任何 CSV 之后都跑）
node validate-data.mjs

# ② 单情景 60 天完整报告（含逐日表、事件统计、断言）
node run-30d.mjs           # 默认 60 天
node run-30d.mjs 30        # 30 天
node run-30d.mjs 60 777    # 换种子

# ③ 多情景对比验证（16 条结构断言，含经济容错带）
node validate.mjs

# ④ 存档 / 玩家指令 / 极端边界（22 条断言，含铁律 11 静态扫描）
node test-save.mjs

# ⑤ 关系标签与场景覆盖（8 条断言，25 次完整仿真）
node test-tags.mjs

# 诊断工具（打印每日权重/条件）
node debug.mjs

# ⑥ sim-core（P0-2）
node tools/gen-data.mjs    # 改 CSV 后必跑（validate-data 会拦过期）
node tools/parity.mjs      # 新旧实现逐字段等价 → PARITY OK
cd packages/sim-core && npm install && npx tsc -p tsconfig.json   # 类型检查
SIM=ref node validate.mjs  # 任一套件前缀 SIM=ref → 改跑参考实现
node tools/probe-capacity.mjs  # workforceScale 生存曲线
```

五者都以 `exit code 0` 表示全绿。**改 CSV 后必须先跑 ①**，否则错误会以"某个场景莫名其妙不触发"的形式潜伏到运行时。

---

## 18. 文件清单

```
残酷小岛/
├── SPEC.md                      ← 本文
├── README.md                    入口说明
├── validate-data.mjs            数据表引用完整性（静态，无仿真）
├── run-30d.mjs                  单情景 60 天报告 + 10 条断言
├── validate.mjs                 5 情景对比 + 16 条结构断言
├── test-save.mjs                存档/指令/边界/场景中途存档 + 37 条断言
├── test-tags.mjs                标签与场景覆盖 + 9 条断言（45 次仿真）
├── debug.mjs                    诊断工具
├── sim.mjs                      套件统一入口（默认 sim-core，SIM=ref 切参考实现）
├── packages/sim-core/           ★ 主实现：TS 零依赖包（见 §13 模块表）
├── tools/
│   ├── gen-data.mjs             CSV → data.generated.ts
│   ├── parity.mjs               新旧实现等价性证明
│   └── probe-capacity.mjs       经济容错带探针
├── sim/
│   └── world.mjs                参考实现（冻结，作对照组）
└── data/
    ├── stocks.csv               5 条存量
    ├── resources.csv            3 种资源
    ├── relation-ladder.csv      12 档阶梯（0–200 连续）
    ├── relation-reaction.csv    35 条关系反应
    ├── trouble-category.csv     18 类烦恼（含生成率门控 + has_lover / has_unknown_site 门控）
    ├── scene-branch.csv         80 个场景 / 234 条加权分支（两人 57 · 三人 23）
    ├── history-param.csv        55 条记忆（含双面台词）
    ├── explore-sites.csv        6 个资源点位（P1-2）
    ├── feeling.csv              10 种情绪
    └── ai-priority.csv          24 档优先级（行为层用，当前 sim 未用）
```

### 场景分布（74 个）

| 类别 | 数量 | 类别 | 数量 |
|---|---|---|---|
| Relation 人际 | 14 | Cloth 衣物 | 4 |
| Food 食物 | 8 | IslandEdit 岛建 | 4 |
| Water 水 | 7 | Question 提问 | 3 |
| Warmth 保暖 | 7 | Goods 物品 | 3 |
| Fight 冲突 | 6 | RoomStyle 房间 | 3 |
| Steal 偷窃 | 5 | Mourn 哀悼 | 3 |
| Family 家族 | 3 | Other 其他 | 3 |
| Abandon 抛弃 | 2 | **Explore 探索** | **5** |
| | | **三人场景合计** | **23** |

（P1-2：Warmth 由 6 → 7，新增 `S78_find_grove` 归入保暖类——它的条件是「冬季有人挨冻」，与保暖烦恼同源；其余 5 个探索场景在 Explore 类。）
## L2.5 NPC 生存仲裁

每个游戏小时，世界先更新体温、饱食、水分和疲劳，再将缺口、可用手段和已分派岗位送入仲裁器。身体数值决定档位。能不能喝水、谁手里有饭、对谁开口，决定候选和同档得分。规则入口为 `packages/sim-core/src/needs.ts`，跨档与同档比较在 `arbiter.ts`。

| 岛民处境 | 决策与可见后果 |
|---|---|
| 两人都有点饿 | 有随身口粮的先吃。中度饥饿可寻找公共食物，也可找持有口粮且关系值至少 120 的人讨要。被拒绝后按对象冷却。 |
| 重度饥饿 | 比较能实际拿到的口粮、腐食和草根。抢夺会消耗对方的口粮，由受害者记下嫌疑标签，单向关系值降低 40。饥荒中的冲突优先从这些当事人里找对象。 |
| 冬夜失温 | 烤火需要现存火源。依偎取暖要求有愿意帮忙且比自己暖的同伴，热量由对方转移。持续失温归零时按小时损失健康。 |
| 所有重度手段失败 | 岛民进入 M02，停止生产。在同一小时配给和生产完成后按第一分钟重新观察可用手段。 |
| 物资宽裕 | 供给满足率至少 0.95、平均饱食至少 50 且无人处在 S 档时，闲暇小剧场才开放。恋爱考察参与双方的饱食和体温。 |
| 危机与濒死 | 零存量进入 M96，仍能使用可得的自救手段。健康低于 10 进入 M99；此时改派岗位会收到拒绝。 |

跨档使用候选 act 与当前 run。只有同档才按分数比较，切换到其他同档行为要求超过当前得分的 1.15 倍。存档保留行为、目标、冷却和副作用，快照用稳定的数字索引把行为传给角色面板。

运行 `node run-30d.mjs` 可看到正常治理和饥荒两个世界的实测记录。报告用双方 NPC 编号匹配争执与先前抢食，便于与同一天的其他冲突区别。

### 同档做什么、找谁

| 输入 | 决策中的作用 |
|---|---|
| 性格 | grit 影响开口讨要的倾向；agree 和稀缺度一起影响抢食意愿。 |
| 身体和情绪 | 饱食、水分、休息、体温和健康决定需求等级。濒饿、绝望和疼痛再影响同档手段。 |
| 技能 | 生火或医疗未达对应门槛时，烧水或包扎会被剔除。 |
| 关系 | 讨食须找到真正持有口粮的熟人；抢食有多个对象时，先考虑关系较疏远者。 |
| 记忆 | 求助遭拒会记住对方。腐食中毒会降低下一次选腐食的意愿。死亡会给幸存者留下指向逝者的哀悼记忆。 |
| 环境 | 火源、净水、家具、腐食和草根决定岛民眼前有什么办法。目击者与物资压力影响社交或冲突。 |

一个岗位持续一小时，喝水、进食等短动作只占行为表规定的秒数；剩余时间仍可工作。等不到任何手段、正在休息或身处生存危机时停止生产。
在工作时段，采集员可以从仍有食物的已知点位自行取食。资源直接从点位扣除；空仓、未知点位和已采空点位分别结算。
