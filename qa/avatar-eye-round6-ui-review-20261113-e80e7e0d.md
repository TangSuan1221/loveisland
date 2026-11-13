# 真实人物工作室入口与眼形保存复核

## 最终结论

- 用户通知 face-only 阴影源已改后，确认 avatar-model.js 不同于前轮，再次执行本次最终有界真实 UI 测试：1/1 PASS，7 个检查点；fail/cancelled/skipped 均为 0；总耗时 27.8009297 秒。
- 实际路径：http://127.0.0.1:5188/ → 角色工作室 → 角色研究 → 金环赤发。不带 ?qa、不用诊断入口、替代场景或 UI mock。
- 全新非持久化浏览器 context，初始 cookies/origins 为空。只在隔离环境经 UI 导入、导出、新建、保存；没有读取用户浏览器档案或触碰真实存档。
- 源码已经解冻。本任务文件名与合成人物名中的 Round6 只是任务标识，不是截图版本声明。本次截图是采集时生产候选（可能属第7轮候选），不能声称为 round6 冻结图，也不承担相似度或 Hume 验收。
- 未修改 src、预设、Hume 报告，未阻止并行写入，未重跑原来的 14 项全量套件。

## 实际检查

- PASS：普通游戏首页进入真实角色工作室，存在角色研究入口
- PASS：既存默认人物及独立旧式自建人物，在重载后外观未被自动替换
- PASS：真实金环赤发按钮加载当前自由眼形、弧顶刘海、贴颈侧帘和折角轮廓；完整导出与本次开始读取的生产预设逐字段一致
- PASS：六个原生鼠标拖拽均改变控制点，十个参数进入真实导出且其他外观字段保持
- PASS：保存写入隔离存档；关闭并重开人物工作室，六柄数据完整恢复且没有残留撤销历史
- PASS：整页刷新后十参数和六个可见手柄仍一致；所有既存存档人物及两个人物UI导出保持原值
- PASS：浏览器实际加载生产模块；截图逐张记录采集时间与实际加载源码指纹；没有未捕获页面异常

金环赤发实际导出选择：eyeStyle=anime_designed；hairFront=anime_arcfringe；hairBack=anime_frame；faceShape=anime_pentagon；irisPattern=rings；hairColor=#cc5025。完整 appearance 与该次开始读取的生产预设逐字段一致。

六柄十参数通过原生鼠标拖拽变更，进入实际下载的 JSON；保存后对照隔离存档，再关闭重开及整页刷新，完整 JSON 与各手柄位置一致，未残留撤销历史：

```json
{
  "eyeInnerY": 0.12,
  "eyeOuterY": 0.17,
  "eyeUpperInnerX": -0.53,
  "eyeUpperInnerY": 1.43,
  "eyeUpperOuterX": 0.59,
  "eyeUpperOuterY": 1.37,
  "eyeLowerInnerX": -0.52,
  "eyeLowerInnerY": -0.72,
  "eyeLowerOuterX": 0.63,
  "eyeLowerOuterY": -0.81
}
```

既存人物保护：13 位人物的 id/name/appearance 逐字段不变，包含默认人物和事先经 UI 保存的合成旧式人物。分别重开导出默认人物及旧式人物再次确认；选预设的草稿没有静默写入存档。

限制：合成旧式人物不等于用户真实旧版本档案，不能覆盖全部历史版本迁移；保护的是存档参数，不保证全局渲染变化后旧人物像素不变。画布字节变化只证明预览更新，不证明相似度。

## 实际截图来源

每张图记录采集时间、文档代次、截图 SHA256、加载模块逐文件 SHA256、磁盘观察哈希和 sourceFingerprint。sourceFingerprint 对该文档实际加载的全部 /src JS/CSS 响应按路径排序形成 path → response SHA256 JSON，再取 SHA256；不是根据当前磁盘文件反推历史。

### avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-01-current-preset-studio.png
- 采集完成：2026-11-13T10:36:31.823Z / 2026-11-13T18:36:31.823000+08:00（北京时间）。
- sourceFingerprint：`59e1e1c6dfba67b722fafdbb7c2cc328b7cf853e679b024729d5074d034fccfc`。
- 实际加载模块数：35；文档代次：2 → 2；采集前后开发更新次数：0 → 0。
![完整工作室](C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-01-current-preset-studio.png)

### avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-02-saved-reloaded-studio.png
- 采集完成：2026-11-13T10:36:43.681Z / 2026-11-13T18:36:43.681000+08:00（北京时间）。
- sourceFingerprint：`59e1e1c6dfba67b722fafdbb7c2cc328b7cf853e679b024729d5074d034fccfc`。
- 实际加载模块数：35；文档代次：3 → 3；采集前后开发更新次数：0 → 0。
![完整工作室](C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-02-saved-reloaded-studio.png)

最终运行 pageErrors=0，devServerChanges=0；重点源文件在运行中变化列表=[]。这只是观察，没有源文件锁定。
七个重点源文件的实际加载实现与本次开始源码比较全部一致：True。

## 中间运行及修正（原证据均保留）

- 10:28:44Z 首轮：1/1 PASS，7 个检查点，27.2380774 秒；随后看图发现眼形图下半部未完整进入滚动视口。
- 10:30:28Z 补拍轮：1/1 FAIL，5 个检查点，27.2483112 秒。新增可见性断言发现保存重载截图中的 lowerOuter 中心 y=929.01986 被页脚遮挡；前置的保存/重载数据断言已通过。失败报告和截图原样保留。
- 只修取证脚本：在真实面板用原生滚轮居中六柄跨度，继续用 elementFromPoint 断言六柄无覆盖；没有修改产品样式、布局或削弱断言。视口仍为 1680×1120。
- 根据用户解除冻结要求，将“源文件必须不变”的环境前提改成逐截图来源指纹与时间记录；入口、存档、十参数、旧人物保护断言保持。
- 10:33:29Z：1/1 PASS，7 个检查点，27.8317705 秒，两张图完整显示工作室及六柄。
- 用户通知 face-only 源变更，读取发现 avatar-model.js 哈希不同，再跑 10:36:17Z 最终轮：1/1 PASS，7 个检查点，27.8009297 秒。最新两张完整截图已实际查看。
- 本次未发现需要修改生产源的入口或眼编辑保存问题；中间截图修正不是生产修复声明。

## 后续截图

建议最终发型与皮肤候选确定并冻结后，再补一张真实工作室入口截图并记录指纹，作为最终版本入口证据；不必因此重跑全部交互，也不能替代 Hume 相似度验收。本任务不预约、不自动执行该后续工作。

## 执行命令

```powershell
Set-Location -LiteralPath "C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant"
node --check qa/avatar-eye-round6-ui-check-20261113.mjs
node --test qa/avatar-eye-round6-ui-check-20261113.mjs
```

浏览器通过正常审批启动。

## 全部落盘文件

- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-28-44-858Z-8d37f2c9-01-current-preset-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-28-44-858Z-8d37f2c9-02-saved-reloaded-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-28-44-858Z-8d37f2c9-report.json`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-30-28-940Z-0677d308-01-current-preset-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-30-28-940Z-0677d308-failure-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-30-28-940Z-0677d308-report.json`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-33-29-649Z-5868e932-01-current-preset-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-33-29-649Z-5868e932-02-saved-reloaded-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-33-29-649Z-5868e932-report.json`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-01-current-preset-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-02-saved-reloaded-studio.png`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-2026-11-13T10-36-17-282Z-e80e7e0d-report.json`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-check-20261113.mjs`
- `C:\Users\Lenovo\Desktop\同事聚会美好生活\ratings-tyrant\qa\avatar-eye-round6-ui-review-20261113-e80e7e0d.md`

任务完成，停止写入。
