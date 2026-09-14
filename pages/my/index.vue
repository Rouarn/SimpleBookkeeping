<!--
  @file 我的页（pages/my/index.vue）
  @description 个人中心页面：
               1. 顶部个人信息区：装饰背景、消息铃铛、头像与昵称（点击可修改昵称 /
                  更换头像）、加入产品天数提示；
               2. 记账统计：记账总笔数、记账总天数、账本数量（跨 bill / book store 实时联动）；
               3. 功能菜单：邀请好友、记账提醒、意见反馈、关于我们、设置
                  （当前为占位项，点击仅 toast 提示）。
               用户资料持久化在 user store，统计数字不落地存储。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
<template>
  <view class="my">
    <!-- 顶部个人信息区 -->
    <view class="header">
      <!-- 背景装饰圆 -->
      <view class="decor decor-arc"></view>
      <view class="decor decor-circle"></view>
      <view class="decor decor-dot-purple"></view>
      <view class="decor decor-dot-pink"></view>

      <!-- 消息铃铛 -->
      <view class="notice-btn" @click="onNotice">
        <uni-icons type="notification" size="26" color="#33343c"></uni-icons>
        <view class="notice-dot"></view>
      </view>

      <!-- 用户资料 -->
      <view class="profile">
        <image
          class="avatar"
          :src="profile.avatar"
          mode="aspectFill"
          @click="onEditProfile"
        ></image>
        <view class="profile-info">
          <view class="name-row">
            <text class="name">{{ profile.name }}</text>
            <uni-icons
              class="edit-icon"
              type="compose"
              size="26"
              color="#3d6bff"
              @click="onEditProfile"
            ></uni-icons>
          </view>
          <text class="welcome">欢迎来到小绿记账的第{{ joinDays }}天</text>
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
        v-for="(item, index) in menuList"
        :key="index"
        class="menu-item"
        @click="onMenuTap(item)"
      >
        <view class="menu-icon" :class="item.icon"></view>
        <text class="menu-title">{{ item.title }}</text>
        <text v-if="item.extra" class="menu-extra">{{ item.extra }}</text>
        <uni-icons
          class="menu-arrow"
          type="right"
          size="21"
          color="#7a7f8e"
        ></uni-icons>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 我的页脚本模块
 * 模块说明：
 * - useProfile()：取得用户资料、加入天数、跨模块统计，以及修改昵称 / 更换头像动作；
 * - 菜单与铃铛为静态入口，当前仅做占位反馈。
 */
import { ref } from "vue";
import { useProfile } from "@/composables/useBookkeeping";

// 用户资料持久化在 user store；记账笔数/天数/账本数由 bill、book store 实时联动
const { profile, joinDays, stats, editName, changeAvatar } = useProfile();

/**
 * 功能菜单配置（title 文案 + icon 样式类名，图标素材见本页 style 中的 .ic-* 类）
 */
const menuList = ref([
  { title: "邀请好友", icon: "ic-invite" },
  { title: "记账提醒", icon: "ic-alarm" },
  { title: "意见反馈", icon: "ic-feedback" },
  { title: "关于我们", icon: "ic-about" },
  { title: "设置", icon: "ic-settings" },
]);

/**
 * 菜单项点击（功能占位，后续按 item.title 路由到对应子页）
 * @param {{title: string, icon: string}} item 被点击的菜单项
 */
const onMenuTap = item => {
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
  min-height: 100vh;
  background-color: #fff;
}

// 顶部个人信息区
.header {
  position: relative;
  padding: calc(var(--status-bar-height) + 8rpx) 32rpx 56rpx;
  background: linear-gradient(135deg, #edeefc 0%, #f3f1fb 48%, #f7f0f6 100%);
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
  background: rgba(255, 255, 255, 0.55);
}

.decor-circle {
  width: 420rpx;
  height: 420rpx;
  right: -130rpx;
  top: -150rpx;
  background: rgba(255, 255, 255, 0.5);
}

.decor-dot-purple {
  width: 26rpx;
  height: 26rpx;
  right: 222rpx;
  top: 68rpx;
  background: rgba(187, 178, 232, 0.5);
}

.decor-dot-pink {
  width: 38rpx;
  height: 38rpx;
  right: 92rpx;
  top: 196rpx;
  background: rgba(247, 172, 196, 0.55);
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
    right: 2rpx;
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    background-color: #ff4d4f;
    border: 3rpx solid #f3f1fb;
    box-sizing: content-box;
  }
}

// 用户资料
.profile {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 20rpx;

  .avatar {
    width: 128rpx;
    height: 128rpx;
    border-radius: 30rpx;
    border: 4rpx solid #ffffff;
    box-shadow: 0 8rpx 24rpx rgba(80, 84, 130, 0.18);
    flex-shrink: 0;
  }

  .profile-info {
    margin-left: 26rpx;

    .name-row {
      display: flex;
      align-items: center;

      .name {
        font-size: 42rpx;
        font-weight: 700;
        color: #2b2c33;
        letter-spacing: 1rpx;
      }

      .edit-icon {
        margin-left: 16rpx;
      }
    }

    .welcome {
      display: block;
      margin-top: 14rpx;
      font-size: 26rpx;
      color: #9b9cac;
    }
  }
}

// 记账统计
.stats {
  position: relative;
  display: flex;
  margin-top: 66rpx;

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    .stat-num {
      font-size: 50rpx;
      font-weight: 700;
      color: #45465e;
      line-height: 1.1;
    }

    .stat-label {
      margin-top: 20rpx;
      font-size: 27rpx;
      color: #9b9cac;
    }
  }
}

// 功能菜单
.menu {
  padding: 26rpx 24rpx 0;

  .menu-item {
    display: flex;
    align-items: center;
    height: 128rpx;

    .menu-icon {
      width: 92rpx;
      height: 92rpx;
      border-radius: 24rpx;
      margin-right: 26rpx;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 58rpx 58rpx;
      flex-shrink: 0;
    }

    .menu-title {
      flex: 1;
      font-size: 35rpx;
      font-weight: 600;
      color: #30313c;
    }

    .menu-extra {
      font-size: 28rpx;
      color: #9b9faf;
      margin-right: 12rpx;
    }

    .menu-arrow {
      flex-shrink: 0;
    }
  }
}

// 菜单图标
.ic-team {
  background-color: #e9eefd;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path d='M20 13 L31 24 L20 35 L9 24 Z' fill='%234c6ef5' stroke='%234c6ef5' stroke-width='6' stroke-linejoin='round'/><path d='M30 18 L39 27 L30 36 L21 27 Z' fill='%2339bdf6' stroke='%2339bdf6' stroke-width='6' stroke-linejoin='round'/></svg>");
}

.ic-invite {
  background-color: #fff2dc;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect x='7' y='14' width='34' height='24' rx='5' fill='%23f7b733'/><path d='M9.5 17 L24 27.5 L38.5 17' fill='none' stroke='%23ed9a1e' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/><path d='M24 21.5c-1.8-2.6-6-1.4-6 1.6 0 2.4 2.6 3.9 6 6.4 3.4-2.5 6-4 6-6.4 0-3-4.2-4.2-6-1.6z' fill='%23ff6a3d'/></svg>");
}

.ic-alarm {
  background-color: #fbe4ee;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='15' cy='12.5' r='3.2' fill='%23f5588b'/><circle cx='33' cy='12.5' r='3.2' fill='%23f5588b'/><line x1='20.5' y1='9.5' x2='27.5' y2='9.5' stroke='%23f5588b' stroke-width='3' stroke-linecap='round'/><circle cx='24' cy='27' r='13.5' fill='%23f5588b'/><circle cx='24' cy='27' r='9.3' fill='%23fff2f7'/><path d='M24 22.5 V27.5 L28.5 30' fill='none' stroke='%23f5588b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/><line x1='16' y1='38' x2='13.5' y2='42' stroke='%23f5588b' stroke-width='3' stroke-linecap='round'/><line x1='32' y1='38' x2='34.5' y2='42' stroke='%23f5588b' stroke-width='3' stroke-linecap='round'/></svg>");
}

.ic-feedback {
  background-color: #dff7f2;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect x='17' y='7' width='25' height='18' rx='6' fill='%2382d8e6'/><rect x='5' y='15' width='28' height='21' rx='6' fill='%232bc7b6'/><path d='M12 35.5 L9.5 41.5 L18 36 Z' fill='%232bc7b6'/><circle cx='14.5' cy='25.5' r='2.1' fill='%23ffffff'/><circle cx='21' cy='25.5' r='2.1' fill='%23ffffff'/><circle cx='27.5' cy='25.5' r='2.1' fill='%23ffffff'/></svg>");
}

.ic-about {
  background-color: #fdece4;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><circle cx='19' cy='17' r='7' fill='%23f45d3b'/><path d='M5 40 A14 14 0 0 1 33 40 Z' fill='%23f45d3b'/><path d='M40 24 A9 9 0 1 1 31 18' fill='none' stroke='%23f9973d' stroke-width='3' stroke-linecap='round'/><path d='M31 11 L38 12.5 L33.5 18.5 Z' fill='%23f9973d'/></svg>");
}

.ic-settings {
  background-color: #f0e9fd;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='3.1' fill='%23f5b52e'/><path fill='%238b5cf6' d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'/></svg>");
}
</style>
