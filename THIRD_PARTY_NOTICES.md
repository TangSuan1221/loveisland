# 第三方许可与参考

游戏中的人物、建筑、地形、植物、道具、图标、程序纹理和环境声为本项目原创实现，没有使用任天堂游戏资产、角色、音乐或标识。

运行依赖 Three.js 0.180.0，MIT License；开发与构建工具 Vite 6.4.6，MIT License。完整依赖版本由 package-lock.json 固定。Three.js 原始许可随源项目保存在 `licenses/three-LICENSE.txt`，Vite 原始许可保存在 `licenses/vite-LICENSE.md`。

质量研究参考《朋友收集 梦想生活》与《集合吧 动物森友会》的任天堂官方截图，原始来源记录在 qa/VISUAL_QA.md。参考图片仅作为本地审查材料，不打包到发布站点，不作为本项目原创资产出售。两款游戏及其标识归原权利人所有。

界面使用系统中文字体回退，不下载或分发商业字体。

人物工作室参考研究了 datkat21/mii-creator、zhouxiyu1997/friendmaker、zziying/stackchan-face-editor、M3-org/CharacterStudio 的数据与编辑架构，没有复制上述项目源码或模型。准确的源码链接、许可核查与技术选择见 qa/AVATAR_TECHNICAL_DECISION.md。浏览器测试工具 Playwright 1.65.0（Apache-2.0）仅供开发验收，不打包到游戏。

照片匹配使用 Google MediaPipe Tasks Vision 0.10.32（Apache-2.0）及官方 Face Landmarker float16 第1版模型。运行时/WASM及模型随游戏本地发布，许可证位于 public/vendor/mediapipe/LICENSE；未修改库内容，仅将CJS文件复制为经典worker可加载的JS文件名。运行 npm run sync:vision 可从锁定npm依赖重新复制运行时；构建前自动执行。模型来源：https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task 。照片参数映射是本项目原创实现。

qa/fixtures/face-portrait.jpg 是官方测试资源 https://storage.googleapis.com/mediapipe-assets/portrait.jpg，仅用于实际检测测试，不复制到生产dist。照片匹配不执行人脸身份识别。


本地头发/眼镜分割使用 yakhyo/face-parsing 发布的 ResNet18 ONNX 权重（上游项目声明 MIT；模型由 CelebAMask-HQ 训练），来源 https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx ，上游许可证随 public/vendor/face-parsing/LICENSE 保存。预处理按上游 onnx_inference.py 的 RGB/512×512/ImageNet归一化实现。ONNX Runtime Web 1.22.0（MIT），许可证随 public/vendor/onnxruntime/LICENSE 保存。发型候选排序、颜色采样和六脸型有界拟合为本项目实现；不包含GPT或其他云端API调用。

本轮动漫捏脸研究另参考 ariankordi/FFL.js 的面部遮罩架构（仓库 AGPLv3）、Konva 的独立图形变换（MIT）及 pixiv/three-vrm 的 MToon 明暗设计（MIT）。仅研究架构与设计思路，没有复制上述项目源码、增加上述运行依赖，或下载/引入 FFL 游戏资源。具体来源、实现边界和实际效果见 qa/AVATAR_ANIME_REDESIGN_REVIEW.md。qa 中的动漫角色研究图用于本地效果审查，不代表相关作品授权或精确复刻。
