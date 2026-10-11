<!--
  @file 应用根组件 App.vue
  @description uni-app 生命周期入口与全局样式入口：
               1. onLaunch：应用启动时注册 tabBar 中间凸起按钮（+）的点击事件，
                  以底部滑入动画跳转记账页 /pages/add/index；并执行登录态检查
                  （pages.json 入口页为首页）：已登录 → 停留首页并预热用户资料 /
                  账本 / 字典；未登录 → reLaunch 到登录页 /pages/login/index；
               2. onShow / onHide：应用前后台切换钩子（当前仅日志输出）；
               3. style：引入 uni-ui 基础样式，并设置 page 根节点的全局背景与高度。
               注意：条件编译 #ifndef APP-NVUE 内的样式不会编译到 nvue 原生页面。
  @author 夏季 <2937375029@qq.com>
  * @date 2026-09-14
  * @modify 2026-09-16
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
/* 设置 page 根节点尺寸：全高扣除状态栏、webview 顶部与底部 tabBar 占位 */
page {
  width: 100%;
  height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - var(--window-bottom)
  );
}

/* #endif */
</style>
