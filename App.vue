<script>
export default {
  onLaunch: function () {
    console.log("App Launch");
    uni.onTabBarMidButtonTap(() => {
      console.log("点击了中间按钮");
      uni.navigateTo({
        url: "/pages/add/index",
        animationType: "slide-in-bottom",
        animationDuration: 150,
      });
    });
  },
  onShow: function () {
    console.log("App Show");
  },
  onHide: function () {
    console.log("App Hide");
  },
};
</script>

<style lang="scss">
/*每个页面公共css */
@import "@/uni_modules/uni-scss/index.scss";
/* #ifndef APP-NVUE */
@import "@/static/customicons.css";

// 设置整个项目的背景色
page {
  width: 100%;
  height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - var(--window-bottom)
  );
}

/* #endif */
</style>
