<!--
  @file 我的页（pages/my/index.vue）
  @description 个人中心页面：
               1. 顶部个人信息区：装饰背景、消息铃铛、头像与昵称（点击可修改昵称 /
                  更换头像）、加入产品天数提示；
               2. 记账统计：记账总笔数、记账总天数、账本数量（跨 bill / book store 实时联动）；
               3. 功能菜单：邀请好友、设置（设置页承载记账提醒 / 意见反馈 / 关于 /
                  检查更新 / 退出登录等应用级配置）。
               用户资料持久化在 user store，统计数字不落地存储。
  @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-20
-->
<template>
  <view class="my">
    <!-- 顶部个人信息区 -->
    <view class="header">
      <!-- 背景装饰：双圆 + 两枚小点 -->
      <view class="decor decor-arc"></view>
      <view class="decor decor-circle"></view>
      <view class="decor decor-dot dot-jade"></view>
      <view class="decor decor-dot dot-clay"></view>

      <!-- 消息铃铛 -->
      <view class="notice-btn" @click="onNotice">
        <uni-icons type="notification" size="23" color="#eaf3ee"></uni-icons>
        <view class="notice-dot"></view>
      </view>

      <!-- 用户资料 -->
      <view class="profile">
        <image
          class="avatar"
          :src="avatarSrc"
          mode="aspectFill"
          @click="onEditProfile"
          @error="onAvatarError"
        ></image>
        <view class="profile-info">
          <view class="name-row">
            <text class="name">{{ profile.name }}</text>
            <uni-icons
              class="edit-icon"
              type="compose"
              size="23"
              color="#8fe2bd"
              @click="onEditProfile"
            ></uni-icons>
          </view>
          <text class="welcome">小绿记账陪伴你的第 {{ joinDays }} 天</text>
        </view>
      </view>

      <!-- 记账统计 -->
      <view class="stats">
        <view class="stat-item">
          <text class="stat-num">{{ stats.records }}</text>
          <text class="stat-label">记账总笔数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.days }}</text>
          <text class="stat-label">记账总天数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.books }}</text>
          <text class="stat-label">账本数量</text>
        </view>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu">
      <view
        v-for="item in menuList"
        :key="item.title"
        class="menu-item"
        hover-class="row-hover"
        :hover-stay-time="60"
        @click="onMenuTap(item)"
      >
        <view class="menu-icon">
          <uni-icons :type="item.icon" size="23" color="#2f6b54"></uni-icons>
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
</template>

<script setup>
/**
 * 我的页脚本模块
 * 模块说明：
 * - useProfile()：取得用户资料、加入天数、跨模块统计（来自 GET /users/me/stats），
 *   以及修改昵称（PATCH /users/me）/ 更换头像（POST /users/me/avatar）动作；
 * - 功能菜单仅保留邀请好友占位入口与设置页跳转。
 */
import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useProfile } from "@/composables/useBookkeeping";
import { DEFAULT_AVATAR, useUserStore } from "@/store";

// 用户资料 / 统计来自 user store（接口缓存）
const { profile, avatar, joinDays, stats, editName, changeAvatar } =
  useProfile();
const userStore = useUserStore();

// 进入页面时拉取用户资料与统计（App.vue 已预热，此处刷新统计）
onShow(() => {
  userStore.fetchMe().catch(() => {});
  userStore.fetchStats().catch(() => {});
});

// 头像加载失败（如历史持久化的临时路径重启后失效）时回退默认头像，保证头像位不留白
const avatarLoadFailed = ref(false);
const avatarSrc = computed(() =>
  avatarLoadFailed.value ? DEFAULT_AVATAR : avatar.value,
);
// 更换头像后重置失败标记，给新地址一次加载机会
watch(avatar, () => {
  avatarLoadFailed.value = false;
});
const onAvatarError = () => {
  avatarLoadFailed.value = true;
};

/**
 * 功能菜单配置（title 文案 + icon 为 uni-icons 类型名，全应用图标语言统一）
 * 记账提醒 / 意见反馈 / 关于 / 检查更新等应用级配置已收敛至设置页
 */
const menuList = ref([
  { title: "邀请好友", icon: "staff" },
  { title: "设置", icon: "gear" },
]);

/**
 * 菜单项点击：设置跳转设置页，其余当前为占位反馈
 * @param {{title: string, icon: string}} item 被点击的菜单项
 */
const onMenuTap = item => {
  if (item.title === "设置") {
    uni.navigateTo({ url: "/pages/settings/index" });
    return;
  }
  uni.showToast({ title: item.title, icon: "none" });
};

/** 消息铃铛点击（占位） */
const onNotice = () => {
  uni.showToast({ title: "消息通知", icon: "none" });
};

/** 头像 / 昵称编辑入口：弹出 ActionSheet 选择修改昵称或更换头像 */
const onEditProfile = () => {
  uni.showActionSheet({
    itemList: ["修改昵称", "更换头像"],
    success: res => {
      if (res.tapIndex === 0) editName();
      if (res.tapIndex === 1) changeAvatar();
    },
  });
};
</script>

<style lang="scss" scoped>
.my {
  min-height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - 160rpx
  );
  background: #f3f5f2;
  padding-bottom: 160rpx;
}

// 顶部个人信息区
.header {
  position: relative;
  padding: calc(var(--status-bar-height) + 12rpx) 32rpx 96rpx;
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
  width: 460rpx;
  height: 460rpx;
  left: -200rpx;
  top: -210rpx;
  background: rgba(255, 255, 255, 0.06);
}

.decor-circle {
  width: 400rpx;
  height: 400rpx;
  right: -130rpx;
  top: -140rpx;
  background: rgba(255, 255, 255, 0.05);
}

.decor-dot {
  width: 22rpx;
  height: 22rpx;

  &.dot-jade {
    right: 208rpx;
    top: 86rpx;
    background: rgba(143, 226, 189, 0.45);
  }

  &.dot-clay {
    width: 32rpx;
    height: 32rpx;
    right: 86rpx;
    top: 210rpx;
    background: rgba(216, 122, 99, 0.4);
  }
}

// 消息铃铛
.notice-btn {
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: 64rpx;
  padding: 0 8rpx;

  .notice-dot {
    position: absolute;
    top: 6rpx;
    right: 4rpx;
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background-color: #e06651;
    border: 3rpx solid #133f34;
    box-sizing: content-box;
  }
}

// 用户资料
.profile {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 28rpx;

  .avatar {
    width: 124rpx;
    height: 124rpx;
    border-radius: 32rpx;
    border: 3rpx solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .profile-info {
    margin-left: 26rpx;

    .name-row {
      display: flex;
      align-items: center;

      .name {
        font-size: 40rpx;
        font-weight: 700;
        color: #f1f7f3;
        letter-spacing: 1rpx;
      }

      .edit-icon {
        margin-left: 14rpx;
      }
    }

    .welcome {
      display: block;
      margin-top: 12rpx;
      font-size: 24rpx;
      color: rgba(237, 245, 240, 0.55);
    }
  }
}

// 记账统计
.stats {
  position: relative;
  display: flex;
  margin-top: 58rpx;
  padding: 24rpx 0;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.06);

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    & + & {
      border-left: 1rpx solid rgba(255, 255, 255, 0.12);
    }

    .stat-num {
      font-size: 42rpx;
      font-weight: 700;
      color: #f1f7f3;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      margin-top: 12rpx;
      font-size: 22rpx;
      color: rgba(237, 245, 240, 0.52);
    }
  }
}

// 功能菜单（上浮白卡，压住头部圆角，层级更清晰）
.menu {
  position: relative;
  z-index: 2;
  margin: -52rpx 24rpx 0;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);
  overflow: hidden;

  .row-hover {
    background: #f6f9f6;
  }

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
}
</style>
