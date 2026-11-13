# 动漫捏脸 Round 8：独立最终整体视觉验收

- 日期：2026-11-13
- 性质：新一次、有限范围的独立视觉验收；不是上一轮中央刘海测试的复述。
- 范围：提供的原参考可见正面，与最终正面、细节及真实入口完整界面。已实际使用 `view_image` 查看下列五张源图；未修改生产代码，未改其他报告，未重跑或代为确认功能测试。

## 结论

**当前没有充分依据称为“精确还原”。可见正面的主要比例与识别特征已近似匹配，但仍有 1 项在正常界面显示尺度可辨认的整体还原阻断。** 这不是因缺少侧面、截图不是像素级一致或屏摄颜色不同而判失败。

| 验收问题 | 本次判断 |
| --- | --- |
| （1）是否与先前局部放行矛盾？ | **不否定中央双刘海直 V 问题的解除。** 本次不要求撤回该局部修正；但若将“所给可见正面范围 PASS”解释成“整个可见正面已无显著差距”，本次不沿用这一扩张解释。局部通过不能替代整体通过。 |
| （2）是否还有真实整体阻断？ | **有，只有下述 1 项。** 指阻断“整体精确还原”的视觉验收，不指功能不可用，也不否认目前已经较接近。 |
| （3）原用户的“精确还原”是否证实？ | **尚未证实。** 现有证据支持“可见正面主要特征近似匹配”，不支持“已精确还原”或像素级一致。 |

## 唯一阻断（优先级 1）：下颌后缘的连续包覆轮廓没有匹配

**可见证据：** 原参考的左右下颊至下巴下方存在一条连续、有可见宽度的后缘带，与下颌后方较成片的深色区域相接，形成内外两层轮廓。当前正面和真实入口里，下颌主要以一条很细的线结束；其后只露出少量分离的发尖，下面直接显出颈部。因此参考的下半头部呈现“被后缘包住”的体积关系，而当前呈现单层面部收边。这一差别在 E1、E2、E4 中均可定位，在 E5 的 A/C 等瞳距灰度比较中仍成立，并不依赖细节图放大才看得出来。

**可执行修正：** 保持已匹配的头部大比例、五官位置与已放行刘海，集中调整正面可见的下颌后缘厚度表现及后方发片／遮挡关系，使两侧下颊到下巴形成连续、有宽度的次级轮廓，而不是仅留细线和孤立发尖。不要把整张脸的外轮廓统一加粗来代替这一层次。复验以真实入口正常显示尺度和等瞳距正面对照为准。

**证据边界：** 原图不足以唯一确定该后缘带由头部厚度、后发或二者的明暗共同构成，因此不指定未经证实的建模来源，也不要求照抄其棕色或暗度。可确认的是可见带状区域的连续性、宽度与包覆关系，而非曝光或色值；不据此强行指定颈长数值或不可见结构。

## 不追加第二项

头顶主轮廓、面部宽度与眼距、金色同心环眼、点鼻和微笑嘴的主要关系已经接近。剩余睫毛细分、细小发束尖端与材质色差，不足以在本次证据条件下另立一个稳定显著的结构性阻断。参考界面装饰、文字和衣服印字不作为本次捏脸结构阻断；不可见侧面也不作为失败依据。

## 证据路径与检查方式

- **E1 原参考（完整原图，877 × 1299）**：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png`
- **E2 最终真实 WebGPU 正面（840 × 980）**：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round8-portrait.png`
- **E3 最终细节（文件 1000 × 1137，含标题条）**：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round8-detail.png`
- **E4 真实入口完整界面（1680 × 1120）**：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round8.png`
- **E5 已有等瞳距对照（A 原参考／B round7／C round8）**：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-review-round8/01-same-D-gray-head-color-fringe.png`

完整图是判断基础，E3 与 E5 仅用于确认形态；采用用户说明的 E5 对齐边界（原参考仅旋转及等比缩放，未非等比拉伸）。另外实际查看了 E4 的原生 1:1 角色区域裁切，以及 E5 等比缩小至接近入口眼距的对照，以排除只在放大图成立的差异。临时检查图仅保存在系统临时目录，不改变项目证据图：

- `C:/Users/Lenovo/AppData/Local/Temp/codex-anime-holistic-audit-round8/ui-avatar-native-1to1.png`
- `C:/Users/Lenovo/AppData/Local/Temp/codex-anime-holistic-audit-round8/aligned-ui-scale.png`

本报告不提供虚构匹配百分比，不把屏摄模糊、透视或光色不确定性转化为精细建模指标，也不声称已经重现或检验真实运行时的所有状态。

---

# Round 9 冻结版：完整参考独立复验（追加记录）

- 日期：2026-11-13。以上 Round 8 失败记录原样保留。
- 已再次实际使用 `view_image` 查看完整原参考、Round 9 正面、细节、完整真实入口，另查看 Round 8 正面及本次原生 UI 大小对照。不是仅凭实现说明、闭合弧面或回归测试作结论。

## 明确结论：FAIL（可见正面限定还原验收）

**原阻断部分解决，但尚未完全解除：后缘的连续性通过，后方包覆面的可见面积与层次仍不足。没有另立新阻断，未观察到其余主要正面特征的连带回退。**

| 问题 | Round 9 独立判断 |
| --- | --- |
| 原先中央刘海的局部放行是否保留？ | **保留。** 不要求重做已放行的刘海；头冠、前侧发、五官主比例没有可见回退。 |
| Round 8 唯一整体阻断是否解除？ | **部分解除，整体仍 FAIL。** 原来分离发尖之间的断续已变为连续弧带，但并未充分恢复参考下颌后方较成片的包覆区域。 |
| 正常 UI 大小是否仍能看出差别？ | **能。** 本次 B/C 使用真实入口截图的原生 1:1 裁切；A 仅旋转、统一缩放和平移至近似相同瞳距。无需依赖细节图放大或精确色值即可辨认该区域的轮廓面积差别。 |
| 可见正面限定还原是否达标？ | **尚未达标；主要特征近似匹配，但仍留 1 项可信结构差异。** |
| 任意人物、未知完整 3D 的精确还原是否证实？ | **未证实，也不在本次证据可证明的范围。** 即使以后本张参考的可见正面获得 PASS，也不能外推至任意人物、未知侧后面或像素级精确一致；缺失这些证据本身不作为本次 FAIL 的原因。 |

## 唯一剩余可信差异：同一后颈包覆区域仍过于窄带化

**观察：** 参考中，从两侧下颊到下颌后的后缘不仅是一条弧线；其下方还有较宽的成片区域向颈部两侧／领口上方延伸，形成下半头部后方的包覆体量。Round 9 相比 Round 8 确实补上了连续的第二轮廓，但弧带接近颈部时很快收窄、消失，颈部两侧仍主要是露出的背景。因而当前更像“脸下加了一条窄边”，而参考是“脸后还有一片包覆面”。这在本次彩色及灰度原生 UI 对照中均清楚可见。

**与上轮标准的关系：** Round 8 已明确要求“连续、有可见宽度的后缘带，与下颌后方较成片区域相接”，并非只要连成一条线就通过。Round 9 已满足连续性；此次保留的是原要求中的后方成片面积与遮挡关系，不是追加一个新的精细目标。

**可执行修正与复验终点：** 若继续修正，仅集中调整已改动后发的正面投影和遮挡范围：保留已经形成的连续后缘，让其下部在颈部左右形成可辨认的成片后发区域，而不是只保留狭窄弧边。保持头冠、刘海、五官与前侧发不动。复验终点是在同瞳距、原生 UI 大小下，连续带与后方成片区域能共同构成参考的包覆关系；不要求逐像素追踪边缘、指定三角尖片形状、照抄暗度或新增不可见侧后面结构。

**不确定性边界：** 参考的肤色下缘细窄层究竟来自头部厚度、阴影还是混合效果，仍不能唯一判定；本次不据此指定材质或精确颜色。保留差异依赖的是颈部两侧可见占据区域与背景露出范围，而不是棕色深浅、光照强弱或单个模糊像素。

## 连带回退检查

- 目视 Round 8 / Round 9 正面和真实 UI：头冠外形、中央刘海、左右前侧发、眉眼与同心环、鼻嘴、面部主轮廓均未见新的显著回退。
- 辅助核对：同尺寸正面 PNG 的变化只落在坐标框 `[217, 650, 623, 777)`；原生 UI 角色裁切内的变化只落在 `[76, 311, 263, 369)`。这些差异框仅证明变化的图像范围，不构成相似度评分，也不替代上述视觉判断。
- 不增加第二项阻断。睫毛细分、微小发尖、精确色值及未知视角不升级为本次失败条件。

## 本次证据与来源核对

### 直接查看的源图

- 原参考：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png`
- Round 9 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round9-portrait.png`
- Round 9 细节：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round9-detail.png`
- Round 9 完整真实入口：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round9.png`
- Round 8 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round8-portrait.png`
- Round 8 入口裁切来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round8.png`

### 独立输出并实际查看的对照图

- Round 9 原生入口角色裁切：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round9/01-round9-ui-native-1to1.png`
- A 原参考 / B Round 8 / C Round 9，近似等瞳距彩色对照：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round9/02-reference-round8-round9-ui-scale.png`
- 同组灰度对照：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round9/03-reference-round8-round9-ui-scale-gray.png`

B/C 均直接裁切原入口 `[558, 197, 898, 677)`，不缩放。A 使用既有对齐记录的人工估计瞳孔中心 `(482,808)`、`(724,785)`，通过单一相似变换映射到 `(112,236)`、`(224.5,236)`，目标瞳距 112.5 像素；只旋转、统一缩放、平移及常规重采样，没有非等比拉伸、透视矫正或重绘。人工瞳孔估计仅用于公平显示，不是精确 3D 标定。灰度图不改变几何；参考原有裁切、角度与屏摄不确定性保留。

### 冻结截图与源码记录

- 正面/细节记录：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round9.json`
- 真实入口记录：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round9.json`
- 两份记录的捕获时间分别为 2026-11-13 19:28:04.654、19:28:11.752（UTC+08:00）。已核对本次三张 PNG 的 SHA-256 与各自 JSON 中记录一致。
- 正面记录中的 40 个 `sourceFiles` 项、入口记录中的 39 个 `sourceFiles` 项均与审计时磁盘文件哈希相符；两者共有的 39 项也一致。这是来源一致性核对，不是对渲染正确性或视觉还原的认证。
- 用户说明的两个后发 mesh、113 节点 guard，以及主线另行进行的回归／构建／浏览器检查，不作为本次视觉 PASS 的替代证据。本次未重跑这些检查，也没有以本报告认证未知完整 3D。

**本次仅追加此报告并输出上述独立对照图；未修改制作源码、原始截图、来源 JSON 或其他报告。**

---

# Round 10 冻结版：独立整体复验（追加，不覆盖 Round 8 / 9）

- 日期：2026-11-13。
- 已重新实际 `view_image` 完整原参考、Round 10 正面／细节／完整工作室截图，并查看 Round 9 正面及两轮原生 UI 对照。判断以正常 UI 尺度为主；回归、构建和 guard 不作为视觉证据。

## 明确结论：FAIL（所给参考的可见正面限定验收）

**第9轮的“颈侧缺少成片后发”已经得到实质改善，但原包覆关系仍未收敛：第10轮不再过窄，转为下颌外侧的包覆面积扩张过量。只保留这 1 项，不追加第二项。** 这不是否认已经相当接近，也不是要求像素级或不可见视角一致。

| 必须区分的判断 | 本轮结论 |
| --- | --- |
| 先前局部放行是否有矛盾？ | **无。** 中央刘海问题的局部放行、Round 9 连续性改善继续保留；此前从未据此证明完整正面已经通过。 |
| 是否仍有真实整体阻断？ | **有，1 项：后发包覆面积的分布仍不匹配。** 不是继续指控“没有发面”，而是新增面积过多落在下颌外半部。 |
| “精确还原”是否已证实？ | **未证实。** 当前仅能确认所给正面主要识别特征近似匹配。本次限定验收尚未通过；任意人物、未知完整 3D 或像素级精确还原更未被这些证据验证。缺失视角本身不算失败项。 |

## 唯一剩余阻断（优先级 1）：下颌外侧过度下鼓，颈侧包覆分布仍有差距

**可见依据：** 在完整参考及本轮同瞳距原生 UI 对照中，参考的后方区域更接近“沿下颌的较窄连续后缘，再在颈侧下延”，前侧长发内缘与后发之间保留较开敞的背景间隙。Round 10 则从左右下颌外侧向衣领方向铺出较宽、连续的扇形发面；新增面积不只集中在颈旁，还把外半部整体向下填满，明显挤窄上述背景间隙。彩色及灰度的正常大小对照均能辨认这一分布差别，不依赖放大追踪发尖或精确颜色。

**改善与遮挡检查：** 两侧后发确已连成片并到达颈侧／衣领附近，第9轮“窄弧边即消失”的状态已解除。未见后发越过前侧长发外轮廓，也未见其遮住脸面、颈部正面或盖到衣领前面。因此本次不另立“遮挡顺序错误”；问题是后发占据背景的范围过宽，而非只要变宽就算正确。

**可执行修正：** 保留已形成的连续后缘和颈侧发面，收回下颌外半部向下鼓出的面积，让新增包覆更集中于颈旁，恢复后发与前侧长发之间较开敞的背景间隙。不要整体缩回第9轮的细弧带，也不要为了追求尖角去改已通过的头冠、刘海、脸或五官。复验仍看正常 UI 大小下“连续后缘＋颈侧发面＋两者外侧留白”的组合，不指定逐像素轮廓、尖片形状、精确厚度、色值或未知侧后视图。

## 连带回退与证据边界

- 固定视图正面对比未见头冠、刘海、前侧长发、眉眼与金色同心环、鼻嘴或脸部主比例的新增显著回退；本次仍不增加第二项。
- 辅助图像差分：Round 9 → 10 正面变化框为 `[222, 678, 621, 821)`，细节为 `[185, 715, 817, 973)`。仅用于核对变化位置，不是相似度评分，也不代替目视。
- 两轮真实 UI 的角色大小与位置略有不同。三联图用于观察演变，最终宽度判断另以 Round 10 原生 UI 与重新匹配其瞳距的参考双联图确认，不把捕获构图差异误判成头冠回退。
- 参考的屏摄、透视、模糊和光色不确定性仍然保留；不能唯一确定的下颌细窄层建模来源不作要求。本次依据是成片区域和背景间隙，而非棕色深浅、精细发尖或无法看见的结构。

## 本轮证据路径

### 直接查看的原始图与来源记录

- 完整原参考：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png`
- Round 10 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round10-portrait.png`
- Round 10 细节：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round10-detail.png`
- Round 10 完整真实入口：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round10.png`
- Round 9 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round9-portrait.png`
- Round 9 UI 对照来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round9.png`
- 正面／细节来源 JSON：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round10.json`
- 入口来源 JSON：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round10.json`

JSON 记录为 WebGPU 正面；两次捕获分别为 2026-11-13 19:47:18.184、19:47:25.075（UTC+08:00）。三张本轮 PNG 的 SHA-256 与记录一致；正面记录的 40 项、入口记录的 39 项源码哈希均与审计时磁盘相符。这仅确认来源一致性，不构成视觉通过或完整 3D 认证。

### 独立生成并实际查看的对照图

- 原生 UI 1:1 裁切：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/01-round10-ui-native-1to1.png`
- A 参考／B Round 9／C Round 10 演变对照：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/02-reference-round9-round10-ui-scale.png`
- 三联灰度：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/03-reference-round9-round10-ui-scale-gray.png`
- **本轮判定主对照（参考匹配 Round 10 原生 UI 瞳距）**：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/04-reference-round10-native-eye-aligned.png`
- 同组灰度：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/05-reference-round10-native-eye-aligned-gray.png`
- 对齐参数记录：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round10/alignment-round10.txt`

UI 均直接裁切 `[558, 197, 898, 677)`，未缩放。最终双联图以原参考人工估计瞳心 `(482,808)`、`(724,785)` 对齐 Round 10 裁切内约 `(114.28,229.59)`、`(223.72,229.59)`；只有统一缩放、旋转、平移和常规重采样，没有非等比拉伸、透视矫正或重绘。对齐坐标只服务于公平显示，不是精确建模目标或验收数值阈值。

**本轮仅追加此报告并新增独立 Round 10 对照文件；Round 8 / 9 原文保留，未修改生产源码、历史截图、来源 JSON 或其他报告，未重跑主线测试。**


---

# Round 11 冻结版：独立可见正面复验（追加）

- 日期：2026-11-13。
- 本轮重新实际查看完整原参考、Round 11 正面／细节／普通工作室完整截图，以及 Round 10 正面；实际查看原生 UI 裁切、等瞳距彩色／灰度双联图和 Round 10／11 三联图。未将实现说明、guard 或并行回归作为视觉依据。

## 结论：FAIL（所给参考的可见正面限定验收）

**有改善，但唯一后发阻断尚未解除。** 外端下鼓有所收回，前侧长发内侧的背景间隙比 Round 10 更开敞；连续后缘及颈侧成片后发仍在，没有退回 Round 9 的细弧带。然而，中间过渡区仍较早向下展开为宽三角面，参考中的“较窄后缘沿下颌延续，再在颈旁下延”的面积分布尚未匹配。

| 分层判断 | 本轮结论 |
| --- | --- |
| 与既有局部放行是否矛盾？ | **不矛盾。** 刘海局部放行、后缘连续性改善和颈侧面积补足均保留；本轮承认外侧间隙改善，不把这些进展抹掉。 |
| 是否仍有真实整体阻断？ | **仍有 1 项，仍是原后发包覆面积分布。** 不新增第二项，也不以未知视图或精确颜色判失败。 |
| 原用户“精确还原”是否证实？ | **未证实。** 本次仅能确认所给人物正面主要特征近似匹配，限定整体验收仍未通过。任意人物、未知完整 3D、像素级精确还原不在本证据可认证范围；缺失侧后视图本身不是本次失败项。 |

## 唯一剩余项：下颌中段的下延仍偏早、偏宽

**正常 UI 尺度的可见证据：** 对照图左侧参考里，从下颊转角朝颈部走，后发先呈一段随下颌走向延续的较窄后缘，明显下延的成片区域更靠近颈侧。右侧 Round 11 虽已去掉 Round 10 的外侧圆鼓感，但后发下边缘仍较早朝衣领斜落，留下较大的三角面。两者在前侧长发与后发之间的背景间隙上仍有可辨认差别：Round 11 已放开外端，中间一段仍被下延发面较多占据。该判断在原生 UI 彩色和灰度图中均成立，不靠细节图放大、发尖逐像素形状或颜色深浅。

**可执行终点不变：** 保留外端较窄且连续的后缘、现有颈旁下延发面与正确遮挡，继续收回两者之间过早下落的面积，使后缘在下颌中段延续得更长，明显下延更集中于颈旁。不是把全部后发统一缩窄，也不是把当前三角外缘做得更直、更尖。正常 UI 大小下同时满足“较窄连续后缘＋颈侧成片下延＋前侧长发间较开敞背景”即可；不指定数值阈值、单个顶点或不可见 3D 形状。

## 连带回退检查与边界

- 目视未见头冠、刘海、左右前侧长发、眉眼与同心环、点鼻、微笑嘴、脸部主比例的新增显著回退。
- 未见后发遮入脸面、颈部正面或衣领前面；连续后缘未断开，颈侧发面未消失。本次不新增遮挡顺序错误项。
- 不要求复制参考下颌肤色细边的精确层数／色值，不以屏摄模糊、透视、光色或不可见侧面追加指标。
- 辅助差分仅确认修改所在图像区域：Round 10 → 11 正面 `[222, 678, 621, 821)`，细节 `[185, 715, 817, 973)`，原生 UI 裁切内 `[80, 315, 260, 380)`。这些框不是视觉相似度或通过证据。

## 可直接展示用户的等瞳距对照

**主对照左为原参考，右为 Round 11 原生 UI，不缩放右图：**

`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round11/02-reference-round11-native-eye-aligned.png`

- 原生 UI 裁切：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round11/01-round11-ui-native-1to1.png`
- 同组灰度：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round11/03-reference-round11-native-eye-aligned-gray.png`
- A 参考／B Round 10／C Round 11：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round11/04-reference-round10-round11-native-ui.png`
- 对齐参数：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round11/alignment-round11.txt`

UI 裁切框为 `[558,197,898,677)`，保持原生像素大小。原参考人工估计瞳心 `(482,808)`、`(724,785)`，对应 Round 11 UI 裁切内估计瞳心 `(114.28,229.59)`、`(223.72,229.59)`。原参考仅作统一缩放、旋转、平移及常规重采样，没有非等比拉伸、透视矫正、局部扭曲或重绘。估计坐标只用于公平对照，不是几何标定或验收指标。

## 原始证据与来源核对

- 完整原参考：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png`
- Round 11 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round11-portrait.png`
- Round 11 细节：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round11-detail.png`
- Round 11 普通工作室完整截图：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round11.png`
- Round 10 正面对照来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round10-portrait.png`
- Round 10 UI 对照来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round10.png`
- 正面／细节 JSON：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round11.json`
- 入口 JSON：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round11.json`

记录的两次捕获时间为 2026-11-13 20:06:30.606、20:06:37.474（UTC+08:00）。本轮三张 PNG 哈希与各自 JSON 一致；正面记录的 40 项、入口记录的 39 项源码哈希与审计时磁盘一致。仅据此核对来源，没有把哈希、实现约束或主线功能检查当作视觉认证。

**只追加本报告并新增上述独立 Round 11 对照文件；第8／9／10轮原文逐字节保留。未编辑生产源码、历史图片、证据 JSON 或其他报告，未运行主线回归。**


---

# Round 12 冻结版：独立可见正面整体复验（追加）

- 日期：2026-11-13（UTC+08:00）。
- 本轮实际使用 `view_image` 重新查看完整原参考、Round 12 正面、细节、完整普通工作室 UI，以及 Round 11 正面；另查看本轮原生 UI 等瞳距彩色、灰度和参考／11／12 三栏对照。
- 沿用既定标准：较窄连续下颌后缘＋颈侧成片下延＋与前侧长发之间的背景间隙。不以实现说明、来源核验或功能测试替代视觉判断。

## 明确结论：PASS（所给参考的可见正面限定还原验收）

**第11轮唯一剩余结构阻断已解除。本轮没有足够可见证据继续保留“中段早下落的宽三角”阻断，也未见过度收回到细弧带或其他已接受部位的显著回退。剩余可信、可执行阻断：0项。**

| 必须区分的问题 | Round 12 独立判断 |
| --- | --- |
| 先前局部放行是否有矛盾？ | **没有。** 中央刘海等既有放行保持；Round 8／9／10／11 的 FAIL 是各轮当时图像的记录，本次不删除、不改判那些历史图。 |
| 当前是否仍有真实整体阻断？ | **在本张参考可见正面及普通 UI 尺度内，未发现足以维持 FAIL 的显著结构差异。** 本次 PASS 来自完整图与对照图目视，不是因为“实现者已改动”或测试通过。 |
| 原用户不加限定的“精确还原”是否证实？ | **未证实。** 可表述为“该参考可见正面的主要结构近似匹配，限定验收达标”，不能表述为像素级一致、任意人物或未知完整 3D 精确还原；未知侧后面不作为本次失败理由。 |

## 原唯一阻断的复验结果

1. **中段过早下落已得到实质收回。** 在原生 UI 等瞳距对照中，Round 12 的后发外端沿下颌保持较窄后缘，中段不再像 Round 11 那样以大斜面直接朝领口下落；明显的下延集中在更靠近颈部的位置。前侧长发与后发之间的背景间隙向内打开，不再被上一轮的宽三角面大面积占据。彩色和灰度对照都支持这一判断。
2. **没有以“全部缩薄”换取通过。** 颈部两侧仍各有可辨认的成片后发与上方连续后缘相接，不是仅剩描边，也未见断开成孤立发尖。两片发面没有重新向外鼓成 Round 10 式宽扇面；没有遮入脸面、颈部正面或衣领前方。

以上三种关系已能在正常 UI 大小同时成立，因此本轮解除原项，不提出继续收窄／加宽后发的制作任务。参考的细窄下颌边层及发缘转折仍不等同于逐像素重合；但在屏摄透视、模糊和明暗成因不确定的条件下，没有充分依据把它们另立为稳定显著的结构阻断。

## 其余 accepted 部位与范围边界

- 目视 Round 11／12 与完整参考，未见头冠、中央刘海、前侧长发、眉眼及同心环、点鼻、微笑嘴、面部主比例的新增显著回退。保留既有近似匹配判断，不把“没有回退”夸大为每一细节均精确一致。
- 参考游戏的界面装饰、文字、衣服印字仍不属于本次捏脸结构验收；不追加未知视角、精确色值或模糊像素级目标。
- 未运行主线回归／构建，也未代为确认其结果。来源记录仅供定位截图，不是视觉 PASS 的理由。

## 用户可直接查看的等瞳距对照

**主图左为原参考，右为 Round 12 原生 UI 裁切，右图不缩放：**

![原参考与Round12原生UI等瞳距对照](C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round12/02-reference-round12-native-eye-aligned.png)

- 原生 1:1 UI 裁切：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round12/01-round12-ui-native-1to1.png`
- 彩色主对照：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round12/02-reference-round12-native-eye-aligned.png`
- 同组灰度：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round12/03-reference-round12-native-eye-aligned-gray.png`
- A 参考／B Round 11／C Round 12：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/independent-holistic-round12/04-reference-round11-round12-native-ui.png`

**对齐方法：** UI 取原截图 `[558,197,898,677)` 的 340×480 裁切，原生像素未缩放。原参考人工估计瞳心为 `(482,808)`、`(724,785)`，对应 UI 裁切内估计瞳心 `(114.28,229.59)`、`(223.72,229.59)`。参考只做统一缩放、旋转和平移及常规双三次重采样，未非等比拉伸、透视矫正、局部扭曲、描边或重绘。输出到原参考的映射为 `x=2.2110901071*u+0.2101449275*v+181.0793950851`、`y=-0.2101449275*u+2.2110901071*v+324.3787019534`；两轴等长且正交。坐标是公平展示的近似对齐参数，不是验收阈值或相似度分数。灰度副本只用于排除颜色干扰。

## 本轮源证据

- 完整原参考：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png`
- Round 12 正面：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round12-portrait.png`
- Round 12 细节：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round12-detail.png`
- Round 12 完整普通 UI：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round12.png`
- Round 11 正面对照来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round11-portrait.png`
- Round 11 UI 对照来源：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round11.png`
- 正面／细节来源记录：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/anime-independent-round12.json`
- UI 来源记录：`C:/Users/Lenovo/Desktop/同事聚会美好生活/ratings-tyrant/qa/avatar-studio-round12.json`

两份 JSON 记录的捕获时间分别为 2026-11-13 20:21:00.942、20:21:07.584（UTC+08:00）。本审计只读取这些记录以定位来源，不复签主线来源核验结论。

**本轮仅追加本报告及新增 `qa/independent-holistic-round12/` 内四张图片。Round 8／9／10／11 报告原文逐字节保留；未编辑生产源码、旧图、证据 JSON 或其他报告。**
