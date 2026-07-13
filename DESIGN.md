---
name: "ArchResearch"
description: "问题启动、图像优先的建筑研究工作台，证据始终贴近图纸。"
colors:
  studio-canvas: "#EEF0ED"
  paper: "#FFFFFF"
  surface-subtle: "#F6F7F5"
  graphite: "#171A18"
  ink-secondary: "#5E6661"
  ink-tertiary: "#626A65"
  ink-disabled: "#8B938E"
  line: "#D5DAD6"
  line-strong: "#ADB5B0"
  blueprint: "#2F5BFF"
  blueprint-hover: "#2449D8"
  blueprint-soft: "#EDF1FF"
  blueprint-line: "#B6C3EF"
  marker: "#FFD84D"
  marker-ink: "#413500"
  focus: "#2F5BFF"
  evidence: "#1F7A5A"
  evidence-soft: "#E7F3ED"
  restriction: "#D6533C"
  restriction-ink: "#A63827"
  restriction-soft: "#FFF0EC"
  restriction-line: "#E6B4AA"
  image-well: "#E5E8E5"
  overlay: "#171A1847"
typography:
  display:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "normal"
  body:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.375rem"
    letterSpacing: "normal"
  body-compact:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  label:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "normal"
  caption:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "normal"
  metadata:
    fontFamily: '"Cascadia Mono", Consolas, monospace'
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "normal"
rounded:
  sheet: "12px"
  control: "8px"
  popover: "12px"
  dialog: "16px"
  pill: "999px"
spacing:
  "0": "0"
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
  "48": "48px"
  "56": "56px"
  "64": "64px"
  "80": "80px"
components:
  button-primary:
    backgroundColor: "{colors.blueprint}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  research-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.popover}"
    padding: "12px 16px"
    height: "48px"
  drawing-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.sheet}"
    padding: "0"
  evidence-drawer:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.sheet}"
    padding: "24px"
    width: "500px"
---

# Design System: ArchResearch

## Overview

**Creative North Star: “轻快的数字建筑评图桌”**

ArchResearch 是建筑学生和青年设计师使用的研究工作面。首页像工作室里一张刚铺开的蓝图桌：问题入口醒目、语气轻快、起点容易尝试；进入结果后则回到克制的浅色评图墙，图纸是第一层，项目与方法句是第二层，来源证据在当前图纸旁按需展开。视觉记忆点来自蓝图任务面、少量标记纸、真实图纸比例与小型“来源钉”，不是渐变、玻璃或指标面板。

**产品原则**

- **图像先于控制器：** 默认视图把空间留给图纸；筛选、进度、Trace 和导出不得形成永久仪表盘。
- **证据贴着资产：** 来源钉打开当前图纸的证据抽屉；事实、观察、推断、边界与权利状态保持分栏和独立命名。
- **渐进披露：** 卡面只显示图纸、项目、类型、证据层级和一句方法判断；其余内容始终在一次明确操作内可达。
- **入口轻快，证据克制：** 首页允许一个明确的蓝图任务面和一个标记黄提示；结果、证据和权利状态仍采用短标签、细结构线与功能性色彩。
- **熟悉的工具行为：** 使用标准按钮、表单、菜单、抽屉与键盘顺序；一致性高于新奇交互。
- **问题先于结果：** 默认首页以问题输入为主，不直接展开研究结果；允许显示研究方式、问题示例、资料入口和任务级历史摘要，帮助首次开始或继续任务。已完成结果只能通过明确操作进入，仅未结束的运行可以直接恢复到进度/结果状态。

**全局布局规则**

- 4px 是最小单位，8px 是主要节奏。组件内部优先使用 8/12/16，组件之间优先使用 16/24/32，页面区段使用 32/48。新尺寸必须先成为语义 token，不在单个组件里临时发明。
- 主画布最大宽度 1440px，正文段落最大 72ch。页面不得产生横向滚动；仅对比表、阶段轨等局部区域允许显式横向滚动。
- 断点固定为：单列 `≤620px`、双列 `621–860px`、三列 `861–1180px`、四列 `>1180px`。页面边距依次为 12/16/24px，图纸间距为 12/16px。
- 桌面可显示 56px 瘦工具轨；中屏及以下并入顶部工具菜单。来源、Trace 和完整筛选器永远不常驻在工具轨内。
- 图纸墙必须保持资源原始长宽比，并按排序后的 DOM/键盘顺序从左到右、从上到下排列；不使用 CSS columns 破坏相关度次序，不用 `order` 制造视觉顺序。

## Colors

颜色采用“首页一个 committed 蓝图任务面，结果页保持中性”的分区策略。首页的 `blueprint` 可占首屏约 12–20%，只承载当前研究启动器；结果、证据、对比和导出视图中高饱和色面积仍不得超过 10%。色彩只表达任务焦点、动作、选择、证据或限制。

| 语义 token | 用法 |
| --- | --- |
| `studio-canvas` / `paper` / `surface-subtle` | 应用底、图纸与抽屉、低优先级分区。图像查看面始终使用 `paper`。 |
| `graphite` / `ink-secondary` / `ink-disabled` | 主文字、补充文字、不可交互文字。正文不得降到 `ink-disabled`。 |
| `line` / `line-strong` | 分隔与静态边界、可交互控件边界。禁止用阴影代替所有结构线。 |
| `blueprint` / `blueprint-hover` / `blueprint-soft` | 主动作、当前选择与选择底色；仅首页任务启动器可作大面积背景。 |
| `marker` / `marker-ink` | 首页“还不知道怎么描述”提示纸及其文字；单屏不超过 2%，永不表达系统状态、证据或权利。 |
| `focus` | 所有键盘焦点的 3px 外轮廓，偏移 2px；焦点不得只靠颜色变化。 |
| `evidence` / `evidence-soft` | 已核验证据及其低强度底色，只表示核验，不表示收藏或版权。 |
| `restriction` / `restriction-ink` / `restriction-soft` | 权利限制、拒绝、冲突和错误。小字必须使用对比度更高的 `restriction-ink`。 |
| `overlay` | 抽屉与对话框遮罩；不得叠加模糊玻璃效果。 |

**证据与权利分离规则。** “部分核验”和“视觉线索”使用中性图标加文字；不得用限制红表达低可信度，也不得用核验绿表达可公开分享。

**蓝色稀缺规则。** 结果和证据区域只允许一个蓝色主动作。首页任务启动器是唯一的大面积例外；启动器内部蓝色仍只负责外层焦点、主动作和明确选择，不把普通说明、每个图标和每条边界都染蓝。

## Typography

全产品只使用系统无衬线；等宽字体只服务于证据编号、时间、尺寸和 Trace。字号固定，不使用 `clamp()`；中文正文按 14/22px 起步，任何可操作标签不得小于 12/16px。

| 层级 | 角色 |
| --- | --- |
| `display` | 页面唯一主标题或大型空状态；每屏最多一次。 |
| `headline` | 抽屉、对比视图或主要区段标题。 |
| `title` | 研究问题、结果组标题。 |
| `subtitle` | 图纸标题、项目标题、面板小标题。 |
| `body` | 事实、观察、推断、说明文本；长文控制在 65–72ch。 |
| `body-compact` | 图纸方法句、菜单说明和密集列表。不得承载关键错误说明。 |
| `label` | 按钮、字段、筛选、状态；使用句式大小写，不默认全大写。 |
| `caption` | 次级时间、计数与辅助说明。 |
| `metadata` | ID、页码、尺寸、耗时、阶段事件；不得用于正文或按钮。 |

**两层卡面规则。** 图纸卡面只允许一个 `subtitle` 和一个最多两行的 `body-compact`；项目名、类型和证据层级使用 `label/caption`。更多文字必须进入抽屉。

**字重规则。** 正文 400，强调和标签 600，一级标题 700。禁止用 800/900 或连续三种加粗层级制造层次。

## Elevation

系统默认是平的：底色、1px 结构线和局部遮罩负责分层。阴影只在当前图纸、浮层和抽屉离开工作面时出现；静态图纸不得全部漂浮。

| 层级 | 阴影 | 用法 |
| --- | --- | --- |
| Flat | `none` | 画布、静态图纸、内联分区。 |
| Task island | `0 5px 0 rgba(23, 26, 24, 0.12)` | 仅首页蓝图任务启动器，形成一张落在桌面的工作纸。 |
| Marker note | `3px 3px 0 rgba(23, 26, 24, 0.16)` | 仅首页一个标记黄问题提示，不复制到普通卡片。 |
| Sheet active | `0 8px 24px rgba(23, 26, 24, 0.08)` | 仅 hover、键盘聚焦或选中的当前图纸。 |
| Popover | `0 12px 32px rgba(23, 26, 24, 0.14)` | 菜单、工作区选择器、比较停靠条。 |
| Drawer | `-16px 0 42px rgba(23, 26, 24, 0.16)` | 右侧证据与 Trace 抽屉。 |
| Modal | `0 24px 64px rgba(23, 26, 24, 0.22)` | 必须阻断当前任务的对话框；优先使用内联或抽屉。 |

**语义 z-index**

`base 0` → `sheet-active 10` → `sticky 100` → `dropdown 200` → `comparison-dock 300` → `backdrop 400` → `drawer 500` → `modal 600` → `toast 700` → `tooltip 800`。禁止使用 999/9999 或组件私有的任意层级。

**浮起规则。** 图纸 hover 只允许 `translateY(-2px)` 配合 Sheet active 阴影；图像本身不缩放，周围图纸不移动。

## Components

### App shell 与研究栏

- 顶栏最小高度 60px，保持稳定定位；品牌、工作区、研究入口和工具菜单在一行内建立主次。
- 首页与结果页互斥显示：首页可以显示任务级历史摘要，但不得显示图纸缩略图、证据卡或旧结果墙；结果页使用“发起新研究”返回问题输入。
- 首页工作面桌面最大宽度 1040px。蓝图任务启动器由蓝色标题区和内嵌白色输入纸组成；主输入、三种研究方式、资料入口和一个主动作仍属于同一表单，研究深度和具体附件字段渐进展开，不另建设置面板。
- 任务启动器下方采用“常见问题起点 + 最近研究”两栏：桌面并排、`≤860px` 单列。问题起点最多 4 条，点击只填入并聚焦问题；最近研究最多 3 条，显示问题、方式、深度、状态和可用图纸数，点击后才加载完整结果。
- 首页分区使用 1px 结构线和 16/24/32px 间距，不使用指标卡、模板商城、资讯流或营销型功能卡。只有任务启动器与一个标记提示可使用已定义的硬阴影；最近研究保持 Flat。
- 运行状态是一条紧凑状态带，直接保留取消/重试；详细阶段与 Trace 折叠，不使用指标卡片。

### Drawing sheet 与来源钉

- 图纸保持原始长宽比，`object-fit: contain`；白色纸面使用 12px 圆角和 1px 结构线。说明区使用 12px 纵向、16px 横向内边距。
- 默认只出现项目、图纸类型、证据层级和一句方法判断。操作收在图纸边缘，hover、focus 或选择后才显示次要动作。
- 来源钉采用 16px 图标和文字/可读名称。已核验用勾选，部分核验用半圆，视觉线索用眼睛；不得只显示彩色圆点。
- 加载使用保持预期比例的骨架屏；预览失败保留纸张尺寸并给出“重试/打开来源”，不以中央 spinner 替代内容。

### Evidence drawer

- 桌面宽 500px，紧凑屏占满视口；头部与关闭动作粘滞。抽屉打开后，焦点进入标题/关闭按钮，关闭后返回触发来源钉。
- “来源支持的事实 / 观察 / 推断 / 使用边界 / 权利状态”必须使用固定词汇与独立区段。每条正式事实旁必须有 URL、PDF 页码或图像区域定位。
- 来源详情可以折叠，但“核验层级”和“打开原始来源”始终可见。抽屉内禁止再嵌套卡片墙。

### Controls

- 默认控件高 36px，研究主输入高 48px；紧凑屏触摸目标不得小于 44×44px。主按钮只承载当前区域最重要动作。
- 按钮、输入、选择器、标签与菜单必须覆盖 default、hover、focus-visible、active、disabled、loading、error。disabled 同时取消指针动作并保留可读标签。
- 输入框使用 `paper`、`line-strong` 和全局 `control` 8px 圆角；error 同时显示图标、边界和具体修复文字。placeholder 按正文对比度处理。
- 筛选器使用一行紧凑选择/分段控件，溢出项进入“更多筛选”；不把每个资产类型做成同等抢眼的按钮。
- 比较选择达到 1 项后出现底部停靠条；2–6 项可打开比较。停靠条不得覆盖最后一行图纸，页面底部预留 80px。

### Icons, motion 与响应

- 统一使用同一套 1.75px 线性图标：行内 16px、控件 20px、主要导航/空状态 24px。32px 及以上只用于说明性空状态；禁止混用实心、表情和线性图标。
- 无文字的图标按钮必须有可访问名称和 tooltip；tooltip 不能替代关键标签。桌面图标按钮视觉框 36px，移动端命中区 44px。
- 快速反馈 120ms、常规状态 160ms、抽屉/浮层 220ms，统一使用 `cubic-bezier(0.22, 1, 0.36, 1)`。只动画 `opacity`、`transform`、颜色和阴影，不动画布局尺寸。
- “开始研究”主动作允许一次 300ms 的点击火花作为任务已启动的轻量反馈；实现改编自 React Bits `ClickSpark`，只在完整指针点击后运行、结束即停，不创建持续动画循环。
- “添加资料和研究设置”展开时允许一次 8px→0、220ms 的低位移揭示；借鉴 React Bits `AnimatedContent` 的状态连续性，但用原生 CSS 实现，不引入 GSAP/滚动触发依赖。
- 禁止页面入场编排、弹跳、弹性和环境动效。`prefers-reduced-motion: reduce` 下取消位移与缩放，持续时间降至 1ms，并保留即时状态反馈。

## Do's and Don'ts

### Do

- **Do** 先让用户看到保持原比例的建筑图纸，再提供筛选、证据与高级工具。
- **Do** 严格从 4/8 间距、固定字阶、语义色与 z-index 标尺取值；新数值必须先进入全局 token。
- **Do** 让来源钉、图纸、证据层级和正式事实形成可追踪关系，并用图标加文字表达状态。
- **Do** 在 390、640、1024、1440px 验证无页面级横向溢出、完整键盘操作和合理图纸列数。
- **Do** 用骨架、空状态和具体错误文案告诉用户下一步，而不是只显示“暂无数据”或 spinner。
- **Do** 把活力集中在首页启动任务和选择问题的瞬间；进入研究与证据核验后让真实图纸重新成为视觉主角。

### Don't

- **Don't** 做聊天优先界面、永久完整仪表盘、指标磁贴、暗色外壳或常驻证据侧栏。
- **Don't** 使用通用圆角 SaaS 卡片、嵌套卡片、装饰性渐变、玻璃拟态、渐变文字或彩色侧条。
- **Don't** 把图纸裁成统一 4:3、在每张静态图纸上加重阴影，或让 hover 缩放图像并扰动图纸墙。
- **Don't** 把来源可信度、事实归属、收藏状态和版权/权利状态混成一个分数、一种颜色或一个徽章。
- **Don't** 用全大写等宽小字作为视觉主题，或在按钮、标签和数据中引入展示字体。
- **Don't** 用装饰性动效、非标准表单、定制滚动条或模态框重新发明成熟工具行为。
- **Don't** 使用持续运行的粒子、鼠标尾迹、磁吸按钮、页面入场编排或 React Bits 背景特效干扰输入和图纸阅读。
- **Don't** 使用任意间距、任意圆角、999 层级或只靠颜色表达焦点和状态。
