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

    // 监听 tabBar 中间按钮点击：进入记账页（slide-in-bottom 模拟由下弹出的录入面板）
    uni.onTabBarMidButtonTap(() => {
      console.log('点击了中间按钮')
      uni.navigateTo({
        url: '/pages/add/index',
        animationType: 'slide-in-bottom',
        animationDuration: 150,
      })
    })
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
}

/* 深色（跟手调暗：文字降不刺眼、主色与收入红调亮一档保证可读） */
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

/* #endif */
</style>
