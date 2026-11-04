# 液态玻璃设计系统（macOS 26 / iOS 26 Liquid Glass）

本文档说明「小绿记账」在 2026-11 视觉重构后使用的玻璃材质体系。它对应 Apple
在 macOS 26 / iOS 26 上引入的 Liquid Glass 语言：内容在玻璃下方滚动、玻璃
通过折射与高光呈现厚度，而不是一块半透明色块。

> 关于 Kyant0/AndroidLiquidGlass（Backdrop）：那是 Kotlin + Compose
> Multiplatform 的渲染库（`drawBackdrop` / `lens` / `blur` / `vibrancy`），
> 只能用于 Android / iOS / Desktop 的 Compose 工程。本项目是 uni-app + Vue3
> 的 WebView 应用，无法直接依赖它，因此按其效果链
> （colorFilter ⇒ blur ⇒ lens）在 CSS 层做了等价实现。

## 一、玻璃的四层结构

| 层 | 作用 | 实现 |
| --- | --- | --- |
| 壁纸 | 给玻璃提供可折射的内容 | `components/GlassBackground`：固定极光渐变 + 三团缓慢漂移的高斯模糊色斑 + 颗粒噪点 |
| 折射 | ~~实时模糊~~ → 静态玻璃（见下方真机结论） | 半透明底色 + 斜向 sheen + 亮边；**不使用 `backdrop-filter`** |
| 色调 + 高光 | 玻璃本色与斜向高光 | 半透明底色 + `linear-gradient(135deg, …)` 叠加 |
| 边缘 + 投影 | 厚度感 / 悬浮感 | 1rpx 亮边 + `inset 0 1rpx 0` 内高光 + `inset 0 -1rpx 0` 内暗边 + 大范围低透明度投影 |

Backdrop 的 `lens()`（逐像素透镜位移 + 色散）在 WebView 中没有等价能力，
本项目用「亮边 + 内高光 + 内暗边」近似玻璃边缘的折射观感。

### 真机结论：改用「静态玻璃」

2026-11-04 在小米 10（Android 13 / WebView 116 / 90Hz）上用
`adb forward` + WebView DevTools 实测：

| 方案 | 滚动帧率 |
| --- | --- |
| 实时 `backdrop-filter` + 三团 56px 模糊色斑 | 31.8 fps（后台 webview 数据，仅作参考） |
| 可见页面 · 当前构建（实时模糊） | 90 fps |
| 可见页面 · 去掉 `backdrop-filter` | 86–90 fps |

结论：`backdrop-filter` 与大面积 `filter: blur()` 属于**持续 GPU 开销**
（滚动、切页、待机都在烧电/发热），在可见页面上帧率接近满帧时收益也不明显，
因此整体改为**静态玻璃**：半透明底色 + sheen + 亮边 + 柔投影，壁纸改为
四层纯 CSS 渐变（无 `filter`、无动画）。观感接近，合成成本大幅下降。

## 二、Token（定义在 `uni.scss` 与 `App.vue`）

SCSS 变量（`uni.scss`，编译期注入每个组件的 `<style lang="scss">`）：

| 变量 | 用途 |
| --- | --- |
| `$glass-blur` / `$glass-blur-thin` / `$glass-blur-thick` | 26px / 14px / 44px 三档模糊 |
| `$glass-bg` / `$glass-bg-strong` / `$glass-bg-subtle` | 玻璃底色三档浓度 |
| `$glass-border` / `$glass-highlight` / `$glass-shade` | 亮边 / 顶部高光 / 底部暗边 |
| `$glass-shadow` / `$glass-shadow-soft` / `$glass-shadow-lift` | 悬浮投影三档 |
| `$glass-radius*` | 24 / 36 / 48 / 56rpx 与胶囊 |
| `@mixin glass-surface($blur, $bg, $radius)` | 一次性写出标准玻璃面 |
| `@mixin glass-pill($blur)` | 玻璃胶囊 |
| `@mixin glass-pressable` | 按压下沉 + 过渡 |
| `@mixin glass-rim($radius)` | 只加高光边（已有圆角容器上叠加时用） |

CSS 变量（`App.vue` 的 `theme-vars-light` / `theme-vars-dark`，挂在 `page`
与 `.theme-light` / `.theme-dark` 上）：

`--c-glass-bg` `--c-glass-strong` `--c-glass-subtle` `--c-glass-border`
`--c-glass-border-soft` `--c-glass-hi` `--c-glass-shade` `--c-glass-inner`
`--c-glass-hover` `--c-glass-highlight-soft` `--shadow-glass*`
`--g-wallpaper` `--c-wall-a|b|c` `--c-wall-base` `--c-wall-vignette`

## 三、全局类（`App.vue` 全局样式，任何页面可直接用）

| 类 | 场景 |
| --- | --- |
| `.g-glass` | 标准玻璃卡（26px 模糊、36rpx 圆角） |
| `.g-glass--thin` | 导航条、标签、小胶囊（14px 模糊） |
| `.g-glass--thick` | 弹窗、底部面板、浮层（44px 模糊） |
| `.g-glass--strong` | 需要承托密集文字的小面积玻璃 |
| `.g-pill` / `.g-radius-lg` | 胶囊 / 48rpx 大圆角 |
| `.g-float` | 更大投影，用于悬浮导航与中间按钮 |
| `.g-press` | 可按压元素的缩放反馈 |
| `.glass-wallpaper` | 壁纸容器（由 `GlassBackground` 渲染） |

## 四、页面落地规范

1. 页面根节点保留 `:class="themeClass"`，自身背景设为 `transparent`。
2. 第一个子节点放 `<GlassBackground />`；内容容器加 `position: relative; z-index: 1`。
3. 四个 tab 页（首页 / 流水 / 统计 / 我的）末尾放 `<GlassTabBar current="…" />`，
   内容底部留 `calc(200rpx + env(safe-area-inset-bottom))`。
4. 大面积背景一律换玻璃；卡片内部「凹陷」分区用
   `background: var(--c-glass-inner); box-shadow: inset 0 1rpx 0 var(--c-glass-hi);`。
5. 列表行按压态用 `var(--c-glass-hover)`，不要再写实色 `$bg-hover`。
6. 文字继续用原主题 token（`$text-title` / `$text-regular` / `$color-*`），
   玻璃只是背景层，不改变信息层级与语义色。
7. 旧内核降级：`@supports not (backdrop-filter: blur(1px))` 时玻璃退化为
   高不透明底色（`.g-glass--strong` 的取值），保证可读性。
8. 底部导航：`pages.json` 的 `tabBar.custom = true` 只负责「隐藏原生条 +
   保留 `uni.switchTab` 语义」，真正的玻璃条由 `GlassTabBar` 渲染。
   H5 端原生 `uni-tabbar` 的内层节点仍会露出来并占掉 50px（`--window-bottom`），
   所以 `App.vue` 里有 `/* #ifdef H5 */` 的兜底：隐藏 `uni-tabbar` 并把
   `--window-bottom` 归零；App 端由原生 custom 生效，不需要这段。

## 五、验证方式

- `node scripts/check-scss.mjs .`：用 HBuilderX 内置 dart-sass（可用
  `SASS_MODULE=/path/to/sass` 覆盖）编译全部 `<style lang="scss">`，
  确认 token / mixin 引用可编译。
- `node scripts/glass-audit.mjs pages/index/index.vue …`：静态审计——检查
  是否挂载 `GlassBackground` / `GlassTabBar`、是否残留大面积实色背景，
  并与 `git HEAD` 对比 `@click` / `v-model` / `v-if` / `v-for` 数量，
  防止改造过程中丢事件。
- 视觉回归：把 `App.vue`、页面与组件的样式编译成 CSS，按 750rpx → 视口宽度
  换算后渲染静态 HTML 截图，检查浅色与深色两套观感（本项目未引入自动化截图
  流水线，属于一次性人工核对）。

## 六、已知取舍

- **玻璃是 CSS 近似**：`backdrop-filter` 只能模糊/提饱和，做不出 Backdrop
  `lens()` 的逐像素折射与色散；边缘靠亮边 + 内高光模拟，近距离对比真机
  iOS 26 仍会有差距。
- **浅色比深色更难做**：浅色壁纸本身对比低，玻璃容易「发白」。当前取值
  （`--c-glass-bg: .26` + `saturate(215%)` + 强高光边）是实机截图调出来的
  平衡点；若觉得太艳，优先降 `saturate`，再降 `--c-wall-a/b/c` 的 alpha。
- **原生控件不跟玻璃走**：`<switch>`（记账提醒）是原生渲染，颜色由系统控制，
  只能改尺寸/位置，无法加折射；如需统一，要换成自绘开关。
- **性能**：一屏内多块 26–44px 的 `backdrop-filter` 在低端安卓上可能掉帧；
  降级顺序：先砍局部 blur（10–14px 的小元件），再降 `--c-glass-bg` 的模糊
  档位，最后关掉壁纸 blob 动画。
