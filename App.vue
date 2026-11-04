<!--
  @file 应用根组件 App.vue
  @description uni-app 生命周期入口与全局样式入口：
               1. onLaunch：应用启动时注册 tabBar 中间凸起按钮（+）的点击事件，
                  以底部滑入动画跳转记账页 /pages/add/index；并执行登录态检查
                  （pages.json 入口页为首页）：已登录 → 停留首页并预热用户资料 /
                  账本 / 字典；未登录 → reLaunch 到登录页 /pages/login/index；
               2. onShow / onHide：应用前后台切换钩子（当前仅日志输出）；
               3. style：引入 uni-ui 基础样式，并在 page 根节点声明整套主题
                  CSS 变量（浅色默认 + prefers-color-scheme: dark 深色盘 +
                  .theme-light/.theme-dark 手动切换类，供页面根节点挂类覆盖）。
               注意：条件编译 #ifndef APP-NVUE 内的样式不会编译到 nvue 原生页面。
  @author 夏季 <2937375029@qq.com>
  * @date 2026-09-14
  * @modify 2026-09-16
  * @modify 2026-10-12 深色模式：page 变量声明 / 深色 media query / 主题类
-->
<script>
/**
 * 应用级生命周期配置（Options API，uni-app App 入口固定写法）
 */
import { useAppUpdate } from '@/composables/use-app-update'
import { reportInstallResult } from '@/utils/app-update/install-result'
import { initNetworkType } from '@/utils/app-update/device'
import { isLoggedIn, ensureLoggedIn } from '@/utils/auth'
import { useUserStore, useBookStore, useCategoryStore } from '@/store'

export default {
  /** 应用初始化完成时触发（全局只触发一次）：登录态检查 + 中间按钮 + 在线更新 */
  onLaunch: function () {
    console.log('App Launch')

    uni.hideTabBar()

    // —— APP 在线更新（仅 APP-PLUS 端实际执行，内部已做条件编译）——
    // 1. 缓存网络类型（升级事件上报用）
    initNetworkType()
    // 2. 新版本首次启动：回补 install_success/new_version_launch（必须在 check 之前）
    reportInstallResult()
    // 3. 启动静默检查（内部带 6 小时节流，无更新/失败不打扰、不阻断启动）
    useAppUpdate().check({ silent: true })

    // —— 登录态检查（pages.json 入口页为 pages/index/index）——
    if (!isLoggedIn()) {
      // 未登录：清登录态（缺失时为无副作用的空操作）并跳转登录页
      ensureLoggedIn()
    } else {
      // 已登录：停留在首页，后台预热用户资料 / 账本 / 字典（失败不阻塞）。
      // 冷启动时内存 access token 已失、仅存 refresh token：这些请求会在
      // api/http.js 的冷启动闸门处共享同一次静默 refresh，拿到新 access
      // 后才真正发出；rt 失效时由闸门统一清态并跳登录页，无需在此特殊处理。
      try {
        const userStore = useUserStore()
        const bookStore = useBookStore()
        const categoryStore = useCategoryStore()
        userStore.fetchMe().catch(() => {})
        bookStore.fetchBooks().catch(() => {})
        bookStore.fetchPayMethods().catch(() => {})
        categoryStore.fetchAll().catch(() => {})
        userStore.fetchStats().catch(() => {})
      } catch (e) {
        // pinia 未就绪等极端情况，忽略，首页 onShow 会再拉
      }
    }

    // 预加载「记一笔」：这是最高频的二级页，uni-app App 端每个页面是独立 webview，
    // 首次打开要创建 webview + 执行页面脚本，会有 200~600ms 的空白/掉帧；
    // preloadPage 提前把 webview 准备好，点 + 时基本即时打开（H5 无此 API，已用条件编译隔离）。
    // #ifdef APP-PLUS
    if (isLoggedIn()) {
      setTimeout(() => {
        try {
          uni.preloadPage({ url: '/pages/add/index' })
        } catch (e) {
          // 低版本基座不支持时忽略，不影响正常跳转
        }
      }, 1200)
    }
    // #endif

    // 底部导航已改为自定义玻璃组件（pages.json tabBar.custom = true），
    // 中间「+」按钮的事件在 GlassTabBar 内部处理，这里不再监听原生 midButton，
    // 否则自定义 tabBar 下该事件不会触发，只会留下无效回调。
  },
  /** 应用从后台进入前台 / 启动时显示 */
  onShow: function () {
    console.log('App Show')
  },
  /** 应用从前台进入后台 */
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style lang="scss">
/* 每个页面公共 css：uni-ui 基础变量/样式 */
@import '@/uni_modules/uni-scss/index.scss';
/* #ifndef APP-NVUE */

/**
 * 主题变量 mixin（浅色 / 深色整套 CSS 自定义属性声明）。
 * uni.scss 中的主题 token 均为 var(--c-xxx, 浅色回退值) 形式，
 * 这里在 page 上声明浅色默认值，深色由 media query / .theme-dark 覆写；
 * .theme-light / .theme-dark 挂在页面根 view 上覆盖（手动切换与 auto
 * 跟随系统均走此机制，useTheme 按当前模式/系统主题解析返回），
 * 重新声明整套变量即可覆盖 page 继承（并抵消系统深色的 media query）。
 * 深色盘：页面底 #0f1512、卡片 #18201b、主文字 #e8efe9、
 * 头部渐变 #0f2f26→#081f18（稍亮变体，头部内文字保持白）、主色 #4caf87。
 */

/* 浅色（默认，取值与重构前各页硬编码一致，不在 uni.scss 重复声明） */
@mixin theme-vars-light {
  --c-bg: #f3f5f2;
  --c-card: #ffffff;
  --c-input-bg: #f6f8f5;
  --c-hover: #f6f9f6;
  --c-tint: #e9f0eb;
  --c-tint-icon: #e9f3ed;
  --c-toggle: #e4eae4;
  --c-fallback: #eef1ec;
  --c-text-title: #1e2521;
  --c-text: #202622;
  --c-text-strong: #222924;
  --c-text-2: #6c736b;
  --c-text-3: #98a099;
  --c-text-placeholder: #8b938d;
  --c-text-body: #4b534c;
  --c-border: #e6ebe6;
  --c-border-strong: #c3ccc4;
  --c-divider: #edf0ec;
  --c-divider-strong: #dbe1db;
  --c-primary: #175142;
  --c-primary-strong: #1c6450;
  --c-primary-mid: #2f6b54;
  --c-primary-btn: #175142;
  --c-tint-text: #56645c;
  --c-danger: #d54e3c;
  --c-danger-soft: #df543f;
  --c-danger-bg: #fcebe8;
  --c-danger-btn: #e06651;
  --c-income: #c04a36;
  --c-error-text: #c24a39;
  --c-gold: #c08a3e;
  --c-paper: #f8f4ea;
  --c-paper-hover: #f4eede;
  --c-paper-border: #ece4d3;
  --c-paper-text: #4a443c;
  --c-paper-sub: #a3947b;
  --g-header: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
  --g-page: linear-gradient(160deg, #175142 0%, #0c3a2e 100%);
  --g-submit: linear-gradient(150deg, #1c6450 0%, #0c3a2e 100%);
  --g-save: linear-gradient(90deg, #175142 0%, #246b56 100%);
  --shadow-float: 0 4rpx 16rpx rgba(28, 54, 45, 0.08);
  --shadow-card: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);
  --shadow-card-lg: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);
  --shadow-raised: 0 12rpx 36rpx rgba(28, 54, 45, 0.08);
  --shadow-paper: 0 6rpx 20rpx rgba(94, 74, 40, 0.05);

  /* —— Liquid Glass：玻璃面颜色 / 高光 / 投影 —— */
  --c-glass-bg: rgba(255, 255, 255, 0.26);
  --c-glass-strong: rgba(255, 255, 255, 0.52);
  --c-glass-subtle: rgba(255, 255, 255, 0.18);
  --c-glass-bar: rgba(255, 255, 255, 0.45);
  --c-glass-border: rgba(255, 255, 255, 0.75);
  --c-glass-border-soft: rgba(255, 255, 255, 0.6);
  --c-glass-hi: rgba(255, 255, 255, 0.92);
  --c-glass-shade: rgba(12, 58, 46, 0.05);
  --c-glass-inner: rgba(255, 255, 255, 0.36);
  --c-glass-hover: rgba(255, 255, 255, 0.42);
  --shadow-glass: 0 18rpx 50rpx rgba(18, 42, 33, 0.14);
  --shadow-glass-soft: 0 10rpx 28rpx rgba(18, 42, 33, 0.1);
  --shadow-glass-lift: 0 26rpx 70rpx rgba(18, 42, 33, 0.16);
  --c-scrim: rgba(10, 20, 16, 0.32);
  --c-danger-glass: rgba(223, 84, 63, 0.1);

  /* —— 壁纸：接近白的底 + 很软的淡彩 —— */
  --g-wallpaper:
    radial-gradient(
      130% 100% at 8% -14%,
      rgba(150, 214, 186, 0.34) 0%,
      rgba(150, 214, 186, 0) 70%
    ),
    radial-gradient(
      120% 90% at 104% -4%,
      rgba(246, 214, 178, 0.3) 0%,
      rgba(246, 214, 178, 0) 68%
    ),
    radial-gradient(
      140% 110% at 50% 118%,
      rgba(160, 190, 226, 0.3) 0%,
      rgba(160, 190, 226, 0) 72%
    ),
    linear-gradient(180deg, #fbfdfb 0%, #f8f9f7 46%, #f3f5f7 100%);
  --c-wall-base: #fafcfa;
  --c-wall-vignette: rgba(255, 255, 255, 0.42);
}

@mixin theme-vars-dark {
  --c-bg: #0f1512;
  --c-card: #18201b;
  --c-input-bg: #1c2420;
  --c-hover: #202a24;
  --c-tint: #22302a;
  --c-tint-icon: #1f2e27;
  --c-toggle: #24302a;
  --c-fallback: #232b26;
  --c-text-title: #e8efe9;
  --c-text: #dfe7e1;
  --c-text-strong: #eef4ef;
  --c-text-2: #9aa39c;
  --c-text-3: #79837c;
  --c-text-placeholder: #6f7872;
  --c-text-body: #b3bcb4;
  --c-border: #2a332d;
  --c-border-strong: #46514a;
  --c-divider: #262f2a;
  --c-divider-strong: #333d36;
  --c-primary: #4caf87;
  --c-primary-strong: #5fc29a;
  --c-primary-mid: #58b992;
  --c-primary-btn: #2e8b6b;
  --c-tint-text: #a8b8ad;
  --c-danger: #ef6f5c;
  --c-danger-soft: #f08371;
  --c-danger-bg: #3a2723;
  --c-danger-btn: #ef8172;
  --c-income: #e8796a;
  --c-error-text: #e88a7c;
  --c-gold: #d9a05b;
  --c-paper: #252b25;
  --c-paper-hover: #2c332c;
  --c-paper-border: #3a4038;
  --c-paper-text: #cfc9bb;
  --c-paper-sub: #8f8878;
  --g-header: linear-gradient(150deg, #0f2f26 0%, #081f18 100%);
  --g-page: linear-gradient(160deg, #0f2f26 0%, #081f18 100%);
  --g-submit: linear-gradient(150deg, #2e8b6b 0%, #14503f 100%);
  --g-save: linear-gradient(90deg, #2e8b6b 0%, #3fa57f 100%);
  --shadow-float: 0 4rpx 16rpx rgba(0, 0, 0, 0.45);
  --shadow-card: 0 8rpx 28rpx rgba(0, 0, 0, 0.35);
  --shadow-card-lg: 0 8rpx 28rpx rgba(0, 0, 0, 0.4);
  --shadow-raised: 0 12rpx 36rpx rgba(0, 0, 0, 0.45);
  --shadow-paper: 0 6rpx 20rpx rgba(0, 0, 0, 0.3);

  --c-glass-bg: rgba(30, 39, 34, 0.44);
  --c-glass-strong: rgba(40, 50, 44, 0.6);
  --c-glass-subtle: rgba(30, 39, 34, 0.32);
  --c-glass-bar: rgba(24, 30, 27, 0.62);
  --c-glass-border: rgba(255, 255, 255, 0.14);
  --c-glass-border-soft: rgba(255, 255, 255, 0.08);
  --c-glass-hi: rgba(255, 255, 255, 0.16);
  --c-glass-shade: rgba(0, 0, 0, 0.3);
  --c-glass-inner: rgba(255, 255, 255, 0.1);
  --c-glass-hover: rgba(255, 255, 255, 0.14);
  --shadow-glass: 0 20rpx 54rpx rgba(0, 0, 0, 0.42);
  --shadow-glass-soft: 0 10rpx 26rpx rgba(0, 0, 0, 0.3);
  --shadow-glass-lift: 0 30rpx 80rpx rgba(0, 0, 0, 0.5);
  --c-scrim: rgba(0, 0, 0, 0.52);
  --c-danger-glass: rgba(232, 121, 106, 0.16);

  --g-wallpaper:
    radial-gradient(
      92% 70% at 4% -10%,
      rgba(58, 150, 118, 0.42) 0%,
      rgba(58, 150, 118, 0) 62%
    ),
    radial-gradient(
      84% 60% at 104% 2%,
      rgba(172, 122, 80, 0.26) 0%,
      rgba(172, 122, 80, 0) 60%
    ),
    radial-gradient(
      120% 92% at 56% 114%,
      rgba(66, 100, 152, 0.34) 0%,
      rgba(66, 100, 152, 0) 64%
    ),
    linear-gradient(165deg, #101815 0%, #0d1412 58%, #0a1010 100%);
  --c-wall-base: #0f1512;
  --c-wall-vignette: rgba(0, 0, 0, 0.3);
}

/* 设置 page 根节点尺寸：全高扣除状态栏、webview 顶部与底部 tabBar 占位；
   同时声明全局主题变量默认值（浅色）与页面底色 */
page {
  width: 100%;
  height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - var(--window-bottom)
  );
  background: var(--c-bg, #f3f5f2);
  color: var(--c-text, #202622);
  @include theme-vars-light;
}

/* 跟随系统：系统深色时整体切换（手动「浅色」时由根节点 .theme-light 抵消） */
@media (prefers-color-scheme: dark) {
  page {
    @include theme-vars-dark;
  }
}

/* 手动切换：页面根 view 类重新声明整套变量即可覆盖 page 继承 */
.theme-dark {
  @include theme-vars-dark;
}

.theme-light {
  @include theme-vars-light;
}

/* ======================================================================
 * Liquid Glass 全局样式层
 * ----------------------------------------------------------------------
 * 1. .glass-wallpaper：每页首帧铺底的「壁纸」（macOS 26 桌面式极光渐变 +
 *    颗粒噪点），玻璃面靠它产生折射内容；固定定位、不拦截事件。
 * 2. .g-glass：玻璃面通用基类（模糊折射 / 斜向高光 / 高光边 / 双层投影），
 *    页面与组件用它替代原来的纯色卡片背景。
 * 3. .g-* 变体：--thin / --thick / --strong / --pill / --float / --press。
 * 说明：webview 无法逐像素做透镜位移，玻璃边缘的「折射感」由
 * 1rpx 亮边 + 顶部内高光 + 底部内暗边近似（Backdrop 官方 lens 的视觉替身）。
 * ==================================================================== */
.glass-wallpaper {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* 壁纸是整屏静态层：提前提升为合成层，滚动时不再重绘 */
  will-change: transform;
  transform: translateZ(0);
  background-color: var(--c-wall-base, #f2f5ef);
  background-image: var(--g-wallpaper);

  &__grain {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  &__vignette {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      120% 80% at 50% 0%,
      var(--c-wall-vignette, rgba(255, 255, 255, 0.35)) 0%,
      rgba(255, 255, 255, 0) 60%
    );
  }
}

/* 隐藏 WebView 滚动条：内容仍可滚动，只是不画滚动条（移动端更干净） */
::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}

uni-scroll-view .uni-scroll-view,
uni-scroll-view .uni-scroll-view-content,
uni-page-body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

/* 玻璃面基类：默认标准厚度 */
.g-glass {
  position: relative;
  border-radius: 36rpx;
  background-color: var(--c-glass-bg, rgba(255, 255, 255, 0.5));
  background-image: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.26) 0%,
    rgba(255, 255, 255, 0.04) 34%,
    rgba(255, 255, 255, 0) 62%
  );
  -webkit-backdrop-filter: blur(26px) saturate(190%);
  backdrop-filter: blur(26px) saturate(190%);
  border: 1rpx solid var(--c-glass-border, rgba(255, 255, 255, 0.72));
  box-shadow:
    var(--shadow-glass-soft, 0 10rpx 28rpx rgba(22, 48, 38, 0.08)),
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
}

/* 薄玻璃：导航条 / 小胶囊 / 标签 */
.g-glass--thin {
  background-color: var(--c-glass-subtle, rgba(255, 255, 255, 0.3));
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  backdrop-filter: blur(14px) saturate(180%);
}

/* 悬浮导航条：固定层，用更强的模糊把下面滚过的内容糊掉 */
.g-glass--bar {
  background-color: var(--c-glass-bar, rgba(255, 255, 255, 0.55));
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  backdrop-filter: blur(16px) saturate(170%);
}

/* 厚玻璃：浮层 / 弹窗 / 底部面板 */
.g-glass--thick {
  background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.72));
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
}

/* 强玻璃：需要承托文字的小面积实心玻璃 */
.g-glass--strong {
  background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.72));
}

/* 兜底：内核不支持实时模糊时退回高不透明玻璃，避免文字穿透 */
@supports not (backdrop-filter: blur(1px)) {
  .g-glass,
  .g-glass--thin,
  .g-glass--bar,
  .g-glass--thick {
    background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.72));
  }
}

/* 主按钮：纸面 + 四色细环 + 墨色字（与底部记账按钮同一套语言） */
.g-btn-primary {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background-image:
    linear-gradient(160deg, #ffffff 0%, #faf9f5 52%, #ebe8e1 100%),
    conic-gradient(from 210deg, #f0995f, #5fbedc, #a27fc2, #eddf55, #f0995f);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  border: 3rpx solid transparent;
  color: #171512;
  box-shadow:
    0 16rpx 36rpx rgba(23, 21, 18, 0.2),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
}

/* 胶囊/圆角变体 */
.g-pill {
  border-radius: 999rpx;
}

.g-radius-lg {
  border-radius: 48rpx;
}

/* 悬浮：更大的投影，用于底部导航 / 中间按钮 / 浮层 */
.g-float {
  box-shadow:
    var(--shadow-glass, 0 20rpx 56rpx rgba(22, 48, 38, 0.16)),
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
}

/* 按压反馈（玻璃的「可交互」手感） */
.g-press {
  transition:
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.g-press:active {
  transform: scale(0.985);
}

.theme-dark .flow-icon-wrap,
.theme-dark .menu-icon {
  filter: brightness(0.88) saturate(0.9);
}

/* 列表行 / 菜单行在玻璃卡内不再自带底色，用透明按压高光即可 */
.flow-item,
.menu-item {
  background: transparent;
}

/* ======================================================================
 * 自定义 tabBar 的兜底（H5）
 * ----------------------------------------------------------------------
 * pages.json 里 tabBar.custom = true 时，H5 仍会渲染原生 uni-tabbar 节点
 * （只是被运行时的 bottom:-50px 挪到视口外，其内层 .uni-tabbar 依旧可见），
 * 并且继续预留 --window-bottom: 50px，导致页面比视口矮一截、底部露出原生
 * 深色条。这里在 H5 端把原生条彻底隐藏，并把预留高度归零——底部导航完全
 * 由 GlassTabBar 承担；App 端 custom 由原生实现，不需要这段兜底。
 * ==================================================================== */
/* #ifdef H5 */
uni-tabbar,
uni-tabbar .uni-tabbar,
.uni-tabbar {
  display: none !important;
}

page,
uni-page,
uni-page-wrapper,
uni-page-body {
  --window-bottom: 0px !important;
}

/* #endif */

/* #endif */
</style>
