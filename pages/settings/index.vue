<!--
  @file 设置页（pages/settings/index.vue）
  @description 应用设置中心：
               1. 通用：记账提醒、意见反馈（当前为占位反馈）；
               2. 关于：关于我们；App 端额外提供「检查更新」入口（右侧展示
                  当前运行时版本号，点击走在线更新流程，弹窗为全局单例
                  update-popup，与本页共同挂载后可直接弹出）；
               3. 退出登录：二次确认后吊销服务端 token（失败不阻断），
                  清空本地存储全部键（bk: 持久化数据、refresh token、
                  更新模块标记等），并重置内存中的接口缓存 store，
                  最后 reLaunch 回登录页。
               视觉延续全站设计语言：深松绿渐变头 + 暖灰背景 + 白卡。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-16
-->
<template>
  <view class="settings">
    <!-- 顶部导航区 -->
    <view class="header">
      <view class="decor decor-arc"></view>
      <view class="decor decor-circle"></view>

      <view class="nav">
        <view class="back-btn" @click="onBack">
          <uni-icons type="left" size="20" color="#eaf3ee"></uni-icons>
        </view>
        <text class="nav-title">设置</text>
      </view>
    </view>

    <view class="content">
      <!-- 通用 -->
      <view class="group">
        <text class="group-label">通用</text>
        <view class="card">
          <view
            v-for="item in commonMenu"
            :key="item.title"
            class="menu-item"
            hover-class="row-hover"
            :hover-stay-time="60"
            @click="onMenuTap(item)"
          >
            <view class="menu-icon">
              <uni-icons
                :type="item.icon"
                size="23"
                color="#2f6b54"
              ></uni-icons>
            </view>
            <text class="menu-title">{{ item.title }}</text>
            <text v-if="item.extra" class="menu-extra">{{ item.extra }}</text>
            <uni-icons
              class="menu-arrow"
              type="right"
              size="14"
              color="#c2c9c3"
            ></uni-icons>
          </view>
        </view>
      </view>

      <!-- 关于 -->
      <view class="group">
        <text class="group-label">关于</text>
        <view class="card">
          <view
            v-for="item in aboutMenu"
            :key="item.title"
            class="menu-item"
            hover-class="row-hover"
            :hover-stay-time="60"
            @click="onMenuTap(item)"
          >
            <view class="menu-icon">
              <uni-icons
                :type="item.icon"
                size="23"
                color="#2f6b54"
              ></uni-icons>
            </view>
            <text class="menu-title">{{ item.title }}</text>
            <text v-if="item.extra" class="menu-extra">{{ item.extra }}</text>
            <uni-icons
              class="menu-arrow"
              type="right"
              size="14"
              color="#c2c9c3"
            ></uni-icons>
          </view>
        </view>
      </view>

      <!-- 退出登录 -->
      <button class="logout" :loading="loggingOut" @click="onLogout">
        退出登录
      </button>

      <text class="slogan">小绿记账 · 记一笔，知一月</text>
    </view>

    <!-- APP 在线更新弹窗（全局单例状态，本页手动检查时可直接弹出） -->
    <!-- #ifdef APP-PLUS -->
    <update-popup />
    <!-- #endif -->
  </view>
</template>

<script setup>
/**
 * 设置页脚本
 * - 通用 / 关于两组菜单（「检查更新」仅 App 端注入）；
 * - 退出登录：服务端吊销 token → 清空本地存储 → 重置内存缓存 → 回登录页。
 */
import { ref } from "vue";
import { authApi } from "@/api";
import {
  useAppStore,
  useBookStore,
  useCategoryStore,
  useUserStore,
} from "@/store";
import { useAppUpdate } from "@/composables/use-app-update";
import { getCurrentVersion } from "@/utils/app-update/device";
import UpdatePopup from "@/components/update-popup.vue";

// APP 在线更新：手动检查入口
const { check: checkAppUpdate } = useAppUpdate();

// 退出登录需重置的接口缓存 store（避免换号登录后闪现上一位用户的数据）
const userStore = useUserStore();
const appStore = useAppStore();
const bookStore = useBookStore();
const categoryStore = useCategoryStore();

/** 通用菜单（title 文案 + icon 为 uni-icons 类型名，全应用图标语言统一） */
const commonMenu = ref([
  { title: "记账提醒", icon: "notification" },
  { title: "意见反馈", icon: "email" },
]);

/** 关于菜单 */
const aboutMenu = ref([{ title: "关于我们", icon: "info" }]);

// 「检查更新」入口仅 App 端展示，右侧显示当前运行时版本号
// #ifdef APP-PLUS
const currentVersionName = getCurrentVersion().versionName;
aboutMenu.value.push({
  title: "检查更新",
  icon: "download",
  extra: currentVersionName ? `v${currentVersionName}` : "",
});
// #endif

/**
 * 菜单项点击：检查更新走在线更新流程，其余当前为占位反馈
 * @param {{title: string, icon: string, extra?: string}} item 被点击的菜单项
 */
const onMenuTap = item => {
  // #ifdef APP-PLUS
  if (item.title === "检查更新") {
    onManualCheck();
    return;
  }
  // #endif
  uni.showToast({ title: item.title, icon: "none" });
};

/** 手动检查更新：带 loading，无更新/失败由更新模块给出 toast */
const onManualCheck = () => {
  uni.showLoading({ title: "检查中…" });
  checkAppUpdate({ silent: false }).finally(() => uni.hideLoading());
};

/** 返回上一页（页面栈只有当前页时兜底回首页） */
const onBack = () => {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: "/pages/index/index" });
  }
};

/** 退出登录：二次确认后执行登出流程 */
const onLogout = () => {
  uni.showModal({
    title: "退出登录",
    content: "退出后将清空本机的登录信息与本地数据",
    confirmText: "退出",
    confirmColor: "#e06651",
    success: ({ confirm }) => {
      if (confirm) doLogout();
    },
  });
};

const loggingOut = ref(false);

/**
 * 登出流程：
 * 1. 调服务端吊销 refresh token（内部已吞错并清本地 token，失败不阻断）；
 * 2. 清空本地存储全部键（bk: 持久化数据、refresh token、更新模块标记等）；
 * 3. 重置内存中的接口缓存 store；
 * 4. reLaunch 回登录页（清空页面栈，杜绝返回键回到已登出的页面）。
 */
async function doLogout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  uni.showLoading({ title: "退出中…", mask: true });
  try {
    await authApi.logout();
  } catch (e) {
    // 防御：logout 内部已吞错，任何异常都不阻断本地清理
  } finally {
    // 清空本地存储（含 bk:rt / bk:app_ui / 更新模块标记等全部键）
    try {
      uni.clearStorageSync();
    } catch (e) {
      // ignore：极端环境清理失败也不阻断登出
    }
    // 重置内存缓存（book / category 的加载标记随 reset 一并复位）
    userStore.resetProfile();
    appStore.resetUI();
    bookStore.reset();
    categoryStore.reset();
    uni.hideLoading();
    uni.reLaunch({
      url: "/pages/login/index",
      complete: () => {
        loggingOut.value = false;
        uni.showToast({ title: "已退出登录", icon: "none" });
      },
    });
  }
}
</script>

<style lang="scss" scoped>
.settings {
  min-height: 100vh;
  background: #f3f5f2;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

// 顶部导航区
.header {
  position: relative;
  padding: calc(var(--status-bar-height) + 20rpx) 32rpx 148rpx;
  background: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
  border-radius: 0 0 36rpx 36rpx;
  overflow: hidden;
}

// 背景装饰
.decor {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.decor-arc {
  width: 480rpx;
  height: 480rpx;
  left: -210rpx;
  top: -220rpx;
  background: rgba(255, 255, 255, 0.06);
}

.decor-circle {
  width: 420rpx;
  height: 420rpx;
  right: -150rpx;
  top: -150rpx;
  background: rgba(255, 255, 255, 0.05);
}

.nav {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  height: 96rpx;

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-title {
    margin-left: 22rpx;
    font-size: 36rpx;
    font-weight: 700;
    color: #f1f7f3;
    letter-spacing: 1rpx;
  }
}

// 内容区（白卡上浮压住头部圆角）
.content {
  position: relative;
  z-index: 2;
  margin: -64rpx 24rpx 0;
}

.group {
  & + & {
    margin-top: 32rpx;
  }

  .group-label {
    display: block;
    margin: 0 8rpx 12rpx;
    font-size: 24rpx;
    color: #98a099;
  }

  .card {
    background: #fff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);
    overflow: hidden;

    .row-hover {
      background: #f6f9f6;
    }
  }
}

// 菜单行（与「我的」页同一套行样式）
.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;

  &::after {
    content: "";
    position: absolute;
    left: 104rpx;
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: #edf0ec;
  }
  &:last-child::after {
    display: none;
  }

  .menu-icon {
    width: 64rpx;
    height: 64rpx;
    margin-right: 22rpx;
    border-radius: 18rpx;
    background: #e9f3ed;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .menu-title {
    flex: 1;
    font-size: 29rpx;
    font-weight: 500;
    color: #202622;
  }

  .menu-extra {
    font-size: 23rpx;
    color: #98a099;
    margin-right: 10rpx;
    font-variant-numeric: tabular-nums;
  }

  .menu-arrow {
    flex-shrink: 0;
  }
}

// 退出登录
.logout {
  margin-top: 48rpx;
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #e06651;
  background: #fff;
  border-radius: 24rpx;
  border: none;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);

  &::after {
    border: none;
  }

  &[loading] {
    opacity: 0.85;
  }
}

.slogan {
  display: block;
  margin-top: 36rpx;
  text-align: center;
  font-size: 22rpx;
  letter-spacing: 1rpx;
  color: #a9b3a9;
}
</style>
