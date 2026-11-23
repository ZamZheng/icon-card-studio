# ICON Card Studio

固定蓝白母版的「康复小纸条」排版工具。输入本期文案和处理好的肖像，使用本地真实字体生成 **2160×2700 PNG、预览、检查报告和复现包**。

当前版本：`0.1.1`。版式与字体已实现，**首版视觉验收待完成**；用户上传的原始 ICON Logo 已原样接入并登记摘要。工具不是字体识别器，不把近似字体声称为原图字体。

## 日常入口

- [私有 Logo 上传页面](https://icon-card-assets-zamzheng.mutedmixer64.chatgpt.site)
- [字体分析与选择](docs/typography.md)
- [母版拆解](docs/master.md)
- [GPT / Notion 操作流程](docs/workflow.md)
- [实际验证记录](docs/validation.md)

## 安装

Node.js 24。在仓库根目录执行：

```bash
npm ci
npm run setup:browser
```

字体和浏览器版本均由依赖锁固定。精简 Linux 如缺少浏览器共享库，按 Playwright 的实际错误安装系统依赖；GitHub Actions 使用 `npx playwright install --with-deps chromium`。

受限云环境可设置 `npm_config_cache=/tmp/icon-card-npm`、`PLAYWRIGHT_BROWSERS_PATH=/tmp/icon-card-browsers`。这些是运行环境设置，无需修改母版。

## 固定 Logo

当前固定Logo为用户上传的原文件 `assets/brand/icon-logo.v1.png`，随工具包保存并由摘要锁保护。日常出图无需再次上传或访问素材站点。上传页面用于接收未来候选；更换长期品牌标准需另行发布资产版本。

如需在单次运行环境测试另一个明确指定的Logo，可执行：

```bash
npm run import:logo -- --input /tmp/run/icon-logo.png
```

原文件字节和 SHA-256 保留，Logo 不重新绘制。临时导入文件默认不提交GitHub；当前已确认采用的固定v1资产随工具包分发。PNG、JPEG、WebP 均可使用。当前不支持直接导入 SVG。

## 每期生产

以 `examples/content.json` 为字段示例。每期文案、肖像保存在临时目录，不写入源码目录。

```bash
npm run preview -- --input /tmp/run/content.json --portrait /tmp/run/portrait.png --output /tmp/run/card.html
npm run render -- --input /tmp/run/content.json --portrait /tmp/run/portrait.png --output /tmp/run/card.png
```

默认使用工具包内固定Logo。测试时也可用 `--logo /tmp/run/icon-logo.png` 显式传入素材，报告会记录实际摘要。肖像路径可写在文案的 `portrait.file`，相对文案 JSON 所在目录解析。可选 `positionX / positionY` 为 0–100 的裁切焦点百分比，默认中心；原图不被改写。

`render` 先保存自包含预览与报告，再在检查通过后写入 PNG。报告包含实际字体、素材摘要、内容完整性、区域位置、运行环境与审核状态。正式 PNG 失败时不覆盖此前成功文件。

`card.bundle/` 同时保存本次用稿、原始 Logo、原始肖像、报告、工具摘要锁及 `manifest.json`。将成品和复现包保存到同一期 Notion；换环境时从指定工具版本重新安装并读取复现包。

## 固定与变化

固定：背景、品牌栏、字号与字重、四色肖像框、编号色条、知识列表网格、提醒条、社区落款。

变化：期数、标题、标题强调词、引导语及强调词、3或4条知识点、提醒正文、肖像、语义图标选择。3条和4条各有固定预设，没有空白第四项。

知识点提供 `iconId`，或从注册表映射 `iconSemantic`。未知ID报错，未知语义明确回退到通用信息符号。工具不调用AI决定图标。

容量：标题最多2行、引导语2行、小标题1行、每条正文2行、提醒正文2行。实际是否可容纳由浏览器测量决定；不通过删字、截断、自动缩字或重排内容适配。超长内容需回到文案确认步骤。

## 工程检查

```bash
npm test
# 无Logo/肖像时，仅检查母版与字体的工程预览
npm run sample
```

工程样张使用通用文字和 `NO.000`，明显标记品牌资产未齐，不作为正式业务成品。单独诊断：

```bash
npm run preview -- --input examples/content.json --output output/diagnostic.html --diagnostic
```

HTML中的文字通过 `textContent` 注入。渲染时禁止外部HTTP资源，字体与图片嵌入预览。生产调用不运行 `npm run seal`；该命令只供明确的工具维护任务在修改、测试后更新软件摘要锁。

`reviewStatus` 只照录外部人工结论；程序通过不等于视觉确认或医学审核通过，报告不自行标记可发布。GPT负责读取/回写Notion；Node程序不保存Notion Token，也未内置自动发布服务。

## 源码结构

```text
config/       固定母版、图标映射、软件摘要锁
template/     HTML与固定CSS排版
src/          内容校验、本地字体、渲染与完整性检查
assets/       通用图标、固定社区标识
scripts/      CLI、原始Logo导入、工程样张
tests/        真实Chromium回归测试
site/         私有Logo上传页源码，R2持久化
docs/         字体分析、母版、工作流与验证记录
```

字体由 Fontsource 的锁定开源字体包提供，SIL OFL 1.1 随包附带。通用图标与社区双瓣图形沿用用户已有工具的实现，来源与边界见 `docs/provenance.md`。ICON Logo使用用户提供的原文件，不包含仿制Logo。每期输入、输出和上传文件均不自动进入 GitHub。
