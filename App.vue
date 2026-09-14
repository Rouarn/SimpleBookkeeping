<!--
  @file 应用根组件 App.vue
  @description uni-app 生命周期入口与全局样式入口：
               1. onLaunch：应用启动时注册 tabBar 中间凸起按钮（+）的点击事件，
                  以底部滑入动画跳转记账页 /pages/add/index；
               2. onShow / onHide：应用前后台切换钩子（当前仅日志输出）；
               3. style：引入 uni-ui 基础样式与自定义图标字体，并设置 page 根节点
                  的全局背景与高度（扣除状态栏、顶部窗口与底部 tabBar 高度）。
               注意：条件编译 #ifndef APP-NVUE 内的样式不会编译到 nvue 原生页面。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
<script>
/**
 * 应用级生命周期配置（Options API，uni-app  App 入口固定写法）
 */
export default {
  /** 应用初始化完成时触发（全局只触发一次）：注册中间记账按钮跳转 */
  onLaunch: function () {
    console.log("App Launch");
    // 监听 tabBar 中间按钮点击：进入记账页（slide-in-bottom 模拟由下弹出的录入面板）
    uni.onTabBarMidButtonTap(() => {
      console.log("点击了中间按钮");
      uni.navigateTo({
        url: "/pages/add/index",
        animationType: "slide-in-bottom",
        animationDuration: 150,
      });
    });
  },
  /** 应用从后台进入前台 / 启动时显示 */
  onShow: function () {
    console.log("App Show");
  },
  /** 应用从前台进入后台 */
  onHide: function () {
    console.log("App Hide");
  },
};
</script>

<style lang="scss">
/* 每个页面公共 css：uni-ui 基础变量/样式 + 自定义图标字体 */
@import "@/uni_modules/uni-scss/index.scss";
/* #ifndef APP-NVUE */
@import "@/static/customicons.css";

/* 设置 page 根节点尺寸：全高扣除状态栏、webview 顶部与底部 tabBar 占位 */
page {
  width: 100%;
  height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - var(--window-bottom)
  );
}

/* #endif */
</style>
