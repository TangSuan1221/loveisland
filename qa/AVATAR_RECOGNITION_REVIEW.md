# 12 角色组件表达能力验收

本基准是手动捏脸能力研究，不是照片识别准确率测试，也不是授权角色素材包。所有角色只使用工作室可编辑的真实 appearance 字段和共享模型；没有 QA 专属几何、贴图或后期画脸。命名、配色和衣服不能替代头脸形似。这里的“达到”仅指所列关键特征覆盖，不表示 1:1 还原或通过真人盲测。

## 复现与证据

- 配置：`avatar-recognition-benchmarks.js`；场景：`avatar-recognition-benchmarks.html`。
- 启动项目至 `http://127.0.0.1:5188` 后运行 `node qa/avatar-recognition-browser.mjs final`。
- 每组四角，正面 + 41°；另有隐藏标签的正面 + 严格 90°侧面。后三维视角必须与正面一并检查，不能只挑最像的视角。
- `recognition-initial-*.png` 是扩库迭代前真实保存的截图，不能从后来模型重新生成充当旧版。
- `recognition-iteration1-*.png` 保留第一次新增家族复拍，暴露了猫耳尖发和稀疏针状白发等缺陷。
- `recognition-final-appearances.json` 保存归一化后的完整可重现参数；`recognition-avatars/` 提供工作室可导入 JSON。
- WebGPU / 无未知组件 ID / 无浏览器异常的 PASS 是技术校验，不代表视觉验收通过。

## 可核验参考与判据

以下网页由验收时检索核验。判据是根据角色公开形象制定的视觉审核要求，不是原站的相似度评分。各版本衣装/发型可能不同，本次明确选取经典造型，不混用多个版本掩饰缺陷。

| 目标 | 参考 | 必须观察的特征 |
| --- | --- | --- |
| 悟空（常态黑发） | [Dragon Ball 官方赛亚人篇图文，含悟空与贝吉塔](https://en.dragon-ball-official.com/news/01_3929.html) | 向外不等长尖发；额前尖束；浓眉与坚定眼型。不能是等距梳齿或长发。 |
| 贝吉塔（常态黑发） | [Dragon Ball 官方角色专栏](https://en.dragon-ball-official.com/news/01_3929.html) | 深 M 发际；中心向上火焰发体；窄眼浓斜眉。两只侧尖不能替代竖向发体。 |
| 初音未来（经典青绿双尾） | [Crypton / Piapro 官方角色与服装设计](https://piapro.net/intl/en_character.html) | 长青绿双尾；分束刘海；大青绿眼与纤细脸。 |
| 绫波丽（短发） | [EVANGELION STORE 官方角色分类](https://www.evastore.jp/shop/r/r1010/) | 蓝灰短碎发；红虹膜；纤细脸与清静表情。不能只有换色的规则锯齿帽。 |
| Homer Simpson | [Disney+ 官方角色图鉴](https://www.disneyplus.com/explore/articles/the-simpsons-characters) | 两根顶发；圆大眼；突出口鼻和棕口鼻区；秃顶轮廓。 |
| Marge Simpson | [Disney+ 官方角色图鉴](https://www.disneyplus.com/explore/articles/the-simpsons-characters) | 整体蓝色高筒密卷；细长黄色脸；圆大眼和细长鼻口。 |
| Spock（TOS） | [Star Trek 官方原初系列角色图](https://www.startrek.com/en-un/series/star-trek-the-original-series) | 尖耳；整齐短黑刘海；细长脸及斜眉。 |
| Elsa（首部电影侧辫） | [Disney 官方 Elsa 角色页](https://www.disney.co.jp/fc/anayuki/character/elsa) | 浅金后扫额发；肩前单侧编辫；冰蓝眼、尖下巴。 |
| 用户照片人物 | 用户输入：`C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-8669abe2-22e8-4ca5-b1b9-00e2c3b3adef.png` | 灰色短侧分；细矩形透明眼镜；柔和宽颌；小露齿笑。这里是手动能力展示，不能冒称全自动结果。 |
| Albert Einstein（晚年） | [NASA 官方肖像](https://science.nasa.gov/image-article/albert-einstein-1879-1955/)；[Nobel 官方照片集](https://www.nobelprize.org/prizes/physics/1921/einstein/photo-gallery/) | 两侧蓬松乱白发；宽额；浓白髭；眼袋和老年细节。 |
| Marilyn Monroe（经典短卷） | [英国国家肖像馆与其遗产管理方合作的肖像展](https://www.npg.org.uk/whatson/exhibitions/2026/marilyn-monroe-a-portrait) | 金色短侧分卷；弓唇；脸颊痣；上睫与弯眉。 |
| Audrey Hepburn（蒂凡尼造型研究） | [Paramount 官方电影页](https://www.paramount.com/movies/breakfast-at-tiffanys)；[UNICEF 官方人物页](https://www.unicef.org/goodwill-ambassadors/audrey-hepburn) | 深色高盘发与短侧分；浓长眉；大深色眼；纤细下颌。 |

## 初始缺口

悟空是竖梳齿加长发，贝吉塔为圆卷冠，玛姬为后置孤立椭圆发髻；爱因斯坦呈长白披发，梦露为额前卷冠加长直发。初音、绫波、Spock 有颜色和局部部件线索，但统一头盔侧轮廓仍很明显。Elsa 的后辫没有形成肩前标志轮廓。Homer 缺突出口鼻区，不能靠黄色和大眼判定达到。

## 最终逐角结论

已依据最终图复核：12 角、48 个真实 WebGPU 视图，未知组件 ID 与浏览器异常均为 0。11 个目标部分覆盖，Homer 的整体轮廓仍未达到。没有任何一角被评为“任意视角 1:1 达到”。颜色相同、写出名称或模型正常渲染均不计为形似通过。

| 目标 | 结论 | 已覆盖 | 尚缺的形似证据 |
| --- | --- | --- | --- |
| 悟空 | 部分 | 黑色不对称放射尖发、额前尖束、浓眉 | 整体尖束仍偏直硬且近皇冠；额前分束数量/弧度、眼眶形和面颊比例仍泛化。 |
| 贝吉塔 | 部分 | M 发际、连续向上发体、窄眼斜眉 | 发体分束较少、圆整实体较多；脸与鼻的比例和标志性的锐利轮廓未达到。 |
| 初音未来 | 部分 | 青绿长双尾、分束刘海、大青绿眼 | 双尾仍细薄，刘海与鬓角块面偏硬；眼部线条和颅面比例是通用角色。 |
| 绫波丽 | 部分 | 蓝灰短发、红虹膜、安静表情 | 刘海数束过规则、侧面仍圆帽；短发碎层、眼型和颊下轮廓不足。 |
| Homer Simpson | 未达到 | 黄色秃顶、两根可编辑顶发、大圆眼；新圆突鼻、完整棕色口鼻区和前突体积 | 最终色区遮挡已修复，但宽扁头比例与鼻口占比不似原角，口鼻区仍像小椭圆补丁；不能靠黄色大眼认定成功。 |
| Marge Simpson | 部分 | 整体蓝色高筒卷发、黄色长脸、圆眼睫毛 | 卷粒排列过规则，鼻口仍尖且纤小；侧面经典鼻口突出轮廓未表达。 |
| Spock | 部分 | 齐刘海、尖耳、斜眉和窄长脸 | 耳在严格侧面近薄片，鬓角与后脑发体较硬，鼻颊与真人角色仍不够相似。 |
| Elsa | 部分 | 浅金头发、肩前侧辫、蓝眼和尖下巴 | 前发像短帽，缺后扫层次；辫过细硬；眼眶、眉弓和唇部不够个体化。 |
| 用户照片人物 | 部分 | 灰短侧分、透明细矩镜框、露齿笑 | 发际、脸颊/下颌、鼻口和笑纹仍简化；即使手动使用新组件也不应宣称身份相似已解决。 |
| Albert Einstein | 部分 | 两侧白色蓬发、宽额、白髭、老年线条 | 蓬发偏大卷团，髭体积太薄，皱纹偏符号化；真实晚年眼鼻/脸颊比例未达到。 |
| Marilyn Monroe | 部分 | 金色短侧卷、红弓唇、脸颊痣、睫毛 | 额前卷发偏平，脸和唇的特征性不足；去掉痣和颜色后辨识证据明显减少。 |
| Audrey Hepburn | 部分 | 深色盘发、浓眉、大眼与细颌 | 盘发仍小圆髻；刘海、颧骨、鼻唇比例不够接近指定经典造型。 |

本轮扩库把多个“根本没有的结构”变成真实可组合结构，也通过实际截图抓到了高帽接缝、针状乱发、肩前辫缺失等缺陷；它并未证明“能捏出任何角色”。后续应优先提升发体分束与侧轮廓、脸颊/颅面形变和鼻口结构，而非继续只增加同族长度编号。

## 独立照片自动匹配回归

扩库冻结后另行执行 `photo-match-auto.mjs`，输入用户照片，直接点击自动应用并保存，手动候选选择为 0。结果 `hairFront: none`、`hairBack: taper_1`，细矩形眼镜与露齿笑保留；未误选高筒、火焰、乱蓬或双髻。浏览器异常 0，外部 HTTP 请求 0。实际证据为 `photo-match-expansion-final-automatic.png` 与 `photo-match-expansion-final-result.json`。该图仍有脸型/发际泛化问题，仅说明扩库没有把短灰发匹配退化为夸张发型，不证明身份相似度达标。
