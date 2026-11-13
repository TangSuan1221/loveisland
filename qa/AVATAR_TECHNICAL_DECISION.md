# 人物工作室技术选择

核查日期：2026-11-12。目标为可在本游戏中保存、编辑、复制并上岛的原创人物；渲染约束为 WebGPU。下列参考用于技术设计研究，不表示已获得任天堂角色资源，也不表示已验证与商业游戏逐项等同。

| 参考 | 核查结果 | 采用的设计思路 | 不直接整套接入的原因 |
|---|---|---|---|
| [datkat21/mii-creator](https://github.com/datkat21/mii-creator) | README 标注旧源码、不再支持，当前产品已不再开源；package.json 使用 Three.js 0.169 系列、kaitai、localforage 等。根目录未发现明确 LICENSE。 | 分类别组合五官、身份和外观分离、实时可视化调整。 | 源码可见不等于模型及所有代码可任意复用；也不是现成 WebGPU 插件。未复制其代码或模型。 |
| [zhouxiyu1997/friendmaker](https://github.com/zhouxiyu1997/friendmaker) | GPL-3.0-or-later；已核查类型、像素化、量化及预览源码。Electron 工作台将图片转为像素预览及 ESP32 手柄绘制操作；源码按 profile 的宽高处理，不能将常用 256×256 配置说成处理器硬编码。使用 sharp/image-q。 | 彩绘画布、颜色与笔刷、预览后应用的流程。 | 核心解决外部设备自动绘画，而非岛上角色建模；本游戏不需要串口与硬件脚本。未复制源码。 |
| [zziying/stackchan-face-editor](https://github.com/zziying/stackchan-face-editor) | MIT。已核查 FaceDoc 类型、C++ Renderer、WASM 导出入口、浏览器 Preview 和 editDoc。实际由同一 ParamFace 渲染器输出 RGB565，再转绘至浏览器画布；基础参数与表情差量分离。 | 预览与游戏共享同一外观结构和同一模型生成器；用户基础脸型不被眨眼等动画永久覆盖。 | 主要面向机器人二维屏幕脸，C++ 图元与像素帧并非 Three.js 三维模型或 WebGPU 材质。未复制源码。 |
| [M3-org/CharacterStudio](https://github.com/M3-org/CharacterStudio) | MIT（LICENSE: Atlas Foundation, 2022）。README 明确 Three.js/WebGL；独立资产包。characterManager.js 包含根模型、avatar/storedAvatar、trait 选择及导出边界。 | 资产与角色参数分离、草稿与已保存形象分离、完整角色导入导出。 | VRM 拼装需要另行配套资产、骨架与材质适配，对现有可动人物与 WebGPU 不是直接替代。 |

## 补充源码证据：stackchan-face-editor

独立审查固定提交 `5ef10f1da988dad7be001dd23a8bc5743866e93f`。GitHub API 目录成功取得后读取 raw 源码；未下载其素材或接入其实现。

- [web/src/face/types.ts](https://github.com/zziying/stackchan-face-editor/blob/5ef10f1da988dad7be001dd23a8bc5743866e93f/web/src/face/types.ts)：`FaceDoc` 分列 version、canvas、palette、parts、animation、expressions、overlay；`eyeL/eyeR/browL/browR/mouth` 是可分别编辑的零件，镜像关联另行声明。该 TypeScript 结构有意宽松，注释将真正校验交给 C++ 解析器。因此本项目借鉴结构分离，但不能照搬宽松类型后省略输入校验。
- [lib/ParamFace/src/Renderer.cpp](https://github.com/zziying/stackchan-face-editor/blob/5ef10f1da988dad7be001dd23a8bc5743866e93f/lib/ParamFace/src/Renderer.cpp)：`drawEye`、`drawBrow`、`drawMouth` 组合二维图元和精灵帧；`render` 按画布尺寸做等比居中，再依次绘制眼、眉、嘴及 overlay。眼睛的像素帧与眼睑覆盖可同时存在，表情专属帧缺失则退回基础帧。适合借鉴彩绘与基础零件叠加、动画不破坏基础定义；不能直接提供三维侧脸、头发或服装。
- [lib/ParamFace/wasm/pf_wasm.cpp](https://github.com/zziying/stackchan-face-editor/blob/5ef10f1da988dad7be001dd23a8bc5743866e93f/lib/ParamFace/wasm/pf_wasm.cpp)：21 行把 JSON 交给 `g_face.load`，29–35 行调用 `tick/render` 并返回 RGB565 帧缓冲；[Preview.tsx](https://github.com/zziying/stackchan-face-editor/blob/5ef10f1da988dad7be001dd23a8bc5743866e93f/web/src/components/Preview.tsx) 94–129 行经 RAF 读取 `HEAPU16` 并 `putImageData`。这验证“共享渲染器”确实落地，但渲染通路是 WASM 软件绘制加 Canvas2D，不是 WebGPU。
- [web/src/face/editDoc.ts](https://github.com/zziying/stackchan-face-editor/blob/5ef10f1da988dad7be001dd23a8bc5743866e93f/web/src/face/editDoc.ts)：基础页直接设值；表情页数值保存相对基础值的差量，相等时删除差量。适合借鉴基础形象与运行时表情分层；本次不声称实现其全部表情编辑系统。

## 补充源码证据：friendmaker

独立审查固定提交 `d81b34546894ce6f51345336575cbfb2108221bd`。GitHub API 达到公共限额后，从仓库网页的目录数据定位文件，再读取对应提交 raw 源码；没有下载图片、固件或复制代码。

- [apps/desktop/src/types.ts](https://github.com/zhouxiyu1997/friendmaker/blob/d81b34546894ce6f51345336575cbfb2108221bd/apps/desktop/src/types.ts)：`PixelMap` 是含坐标、颜色索引、颜色值及 alpha 的二维数组；`DrawingProfile` 将画布尺寸、笔刷、色板和串口/手柄时序集中配置，`ResumePlan` 是绘图命令恢复信息。此格式解决像素绘制任务，不含角色身份、骨架或岛上 NPC 数据。
- [apps/desktop/src/image/pixelize.ts](https://github.com/zhouxiyu1997/friendmaker/blob/d81b34546894ce6f51345336575cbfb2108221bd/apps/desktop/src/image/pixelize.ts)：256–313 行是读取配置尺寸、可选去背景、缩放、遮罩、颜色量化、按笔刷格聚合及限制色数的处理管线；50–172 行按每个笔刷区域的颜色频数选主色。适合参考“先预览实际笔刷结果”，不适合直接用于保留连续曲线的脸部彩绘；大笔刷聚合会主动丢失细节。
- [apps/desktop/src/image/quantize.ts](https://github.com/zhouxiyu1997/friendmaker/blob/d81b34546894ce6f51345336575cbfb2108221bd/apps/desktop/src/image/quantize.ts)：12 行设置透明阈值 16；78–152 行使用 image-q 的 WuQuant 与 nearest 量化；155–234 行将固定色板模式映射到最近色。该做法服务受限色板，不能直接替代本项目自由十六进制颜色及透明彩绘。
- [apps/desktop/src/image/renderPreview.ts](https://github.com/zhouxiyu1997/friendmaker/blob/d81b34546894ce6f51345336575cbfb2108221bd/apps/desktop/src/image/renderPreview.ts)：8–45 行按实际笔刷覆盖范围构造 RGBA Buffer，48–69 行经 sharp 最近邻放大并导出 PNG。它保证预览反映设备笔刷网格；依赖 Node Buffer/sharp，不是可直接塞进浏览器 WebGPU 人物预览的模块。本项目采用同源参数生成三维预览，保留这一一致性原则。

## 选定架构

- `avatar-schema.js`：版本化外观数据、合法样式、数值边界与输入清洗；没有任意脚本或模型 URL。
- `characters.js` 与人物模型模块：同一套参数驱动预览、头像和岛上演员；标准几何和材质、CanvasTexture 彩绘可进入 WebGPU 材质路径。
- `avatar-editor.js`：独立草稿、历史撤销/重做、分类编辑、实时预览、人物库与 JSON 导入导出。
- `production-engine.js`：自建人物使用独立身份；外观编辑不重启 NPC 模拟、不改资金/关系/事件历史。
- `gpu-renderer.js`：异步初始化并核验实际 `isWebGPUBackend`；不能把 WebGL fallback 报告为 WebGPU。

## 本地版本和迁移核查

本项目固定 Three.js 0.180.0。检查了该版本 WebGPURenderer、Renderer、WebGPUBackend、StandardNodeLibrary、ShadowNode 源码：当前场景的标准材质、顶点动画、透明纹理和 PCFSoftShadowMap 可进入该版本的 WebGPU 路径。头像及素材捕获必须初始化完成，并在 render 后的同一同步任务中读取画布。

原项目主入口确实是 WebGLRenderer，因此本次包含主场景、头像与编辑器预览的迁移，不能仅修改说明文字。独立 Edge 测试已取得 WebGPU adapter，海岛烟雾测试使用原生 WebGPU 并从同帧画布读到非空、多色像素。完整编辑/存档及视觉证据记录在后续验收报告中。

## 参考功能与验收边界

[任天堂官方创作功能介绍](https://www.nintendo.com/au/news-and-articles/its-time-to-get-creative-in-the-latest-trailer-for-tomodachi-life-living-the-dream/)明确提到脸型、发型、眉毛以及自由绘制和印章彩绘。本项目按这些可核实能力建设编辑流程；没有原作完整零件资产、全部数值规则或实机逐项对照数据，不能把功能数量和单次截图作为“1:1 商业水准”的证据。

## 补充：逐文件源码研究（角色模型 agent）

- [Mii Creator / Eye.ts](https://github.com/datkat21/mii-creator/blob/dev/src/ui/tabs/Eye.ts)：眼型为 60 个索引，颜色分基础与扩展色；位置、间距、旋转、等比缩放、垂直拉伸是独立数据字段。采用其数据驱动的组件独立变换思路，本项目保留独立 x/y 比例、位置与旋转；没有复制代码或图标。
- [Mii Creator / 3DScene.ts](https://github.com/datkat21/mii-creator/blob/dev/src/class/3DScene.ts)：使用 WebGLRenderer、定制 GLTFLoader 和 FFL/Miitomo GLSL ShaderMaterial，依赖 render server 获取头模型与脸纹理。不能直接换个 renderer 就宣称迁移完成。
- [Mii Creator / MiiRendering.ts](https://github.com/datkat21/mii-creator/blob/dev/src/util/MiiRendering.ts)：本地 getHeadModel 是返回红方块的 TODO 实现。此旧公开源码不是可离线复用的完整头部生成引擎。根 README 说明旧 source-available、不再支持，未发现明确覆盖整个仓库的开源许可证。因此没有引入模型/代码/素材。
- [Friend Maker / drawingTemplates.ts](https://github.com/zhouxiyu1997/friendmaker/blob/main/apps/desktop/src/drawingTemplates.ts)：通过 sharp 读取 PNG 蒙版，nearest 重采样并提取 alpha，蒙版缓存按模板和尺寸分别索引。是二维绘图区域方案，不提供 3D 脸部模型。
- [Friend Maker / brushGrid.ts](https://github.com/zhouxiyu1997/friendmaker/blob/main/apps/desktop/src/brushGrid.ts)：将指定笔刷大小映射到居中像素网格，检查边界；[types.ts](https://github.com/zhouxiyu1997/friendmaker/blob/main/apps/desktop/src/types.ts) 明确 pen/eraser/fill/stamp/text/shape、六档笔刷、PixelMap 与 DrawingMask。参考独立绘画数据与可复现坐标体系；本项目使用归一化矢量笔画和本地 512² CanvasTexture，没引入 GPL 源码。

最终模型实现采用原创程序几何、标准 MeshStandardMaterial/MeshBasicMaterial 和 CanvasTexture。没有 WebGL-only GLSL、自定义 ShaderMaterial、外部渲染服务或第三方专有头部资源依赖。18 款发型与 6 款衣服独立组合；头/五官/饰物/画纹均从同一规范数据创建，预览和岛上角色调用同一函数。所有自建资源有独立所有权和 dispose，更新外观保留演员对象引用和场景位置。此为功能覆盖实现，不能凭源码研究宣称参考产品所有款式与视觉质量 1:1。
