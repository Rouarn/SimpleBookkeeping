<!--
  @file 我的页（pages/my/index.vue）
  @description 个人中心页面：
               1. 顶部个人信息区：PageHeader 公共渐变页头承载背景装饰，
                  头像与昵称（点击可修改昵称 / 更换头像）、加入产品天数提示；
               2. 记账统计：记账总笔数、记账总天数、账本数量（来自 GET /users/me/stats）；
               3. 功能菜单：MenuItem 公共菜单项（设置页承载检查更新 / 退出登录等
                  真实可用的应用级配置）。
               用户资料持久化在 user store，统计数字不落地存储。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 抽取 PageHeader / MenuItem 公共组件
-->
<template>
  <view class="my">
    <!-- 顶部个人信息区（渐变 / 圆角 / 双圆 + 双点由 PageHeader 内聚） -->
    <PageHeader variant="my">
      <!-- 用户资料 -->
      <view class="profile">
        <image
          class="avatar"
          :src="avatarSrc"
          mode="aspectFill"
          lazy-load
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
    </PageHeader>

    <!-- 功能菜单 -->
    <view class="menu">
      <MenuItem
        v-for="item in menuList"
        :key="item.title"
        :icon="item.icon"
        :label="item.title"
        @click="onMenuTap(item)"
      />
    </view>
  </view>
</template>

<script setup>
/**
 * 我的页脚本模块
 * 模块说明：
 * - useProfile()：取得用户资料、加入天数、跨模块统计（来自 GET /users/me/stats），
 *   以及修改昵称（PATCH /users/me）/ 更换头像（POST /users/me/avatar）动作；
 * - 功能菜单仅保留设置页跳转（应用级配置统一收敛至设置页）。
 */
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useProfile } from '@/composables/useBookkeeping'
import { DEFAULT_AVATAR, useUserStore } from '@/store'

// 用户资料 / 统计来自 user store（接口缓存）
const { profile, avatar, joinDays, stats, editName, changeAvatar } =
  useProfile()
const userStore = useUserStore()

// 进入页面时拉取用户资料与统计：加 60s TTL 缓存，避免每次 onShow 全量重拉
//（昵称 / 头像修改走 PATCH / POST 后直接写 store，UI 即时更新，不受缓存影响）
const PROFILE_TTL = 60 * 1000
let lastMePullAt = 0
let lastStatsPullAt = 0

onShow(() => {
  const now = Date.now()
  if (now - lastMePullAt >= PROFILE_TTL) {
    lastMePullAt = now
    userStore.fetchMe().catch(() => {
      // 拉取失败不计入 TTL，下次进入立即重试
      lastMePullAt = 0
    })
  }
  if (now - lastStatsPullAt >= PROFILE_TTL) {
    lastStatsPullAt = now
    userStore.fetchStats().catch(() => {
      lastStatsPullAt = 0
    })
  }
})

// 头像加载失败（如历史持久化的临时路径重启后失效）时回退默认头像，保证头像位不留白
const avatarLoadFailed = ref(false)
const avatarSrc = computed(() =>
  avatarLoadFailed.value ? DEFAULT_AVATAR : avatar.value,
)
// 更换头像后重置失败标记，给新地址一次加载机会
watch(avatar, () => {
  avatarLoadFailed.value = false
})
const onAvatarError = () => {
  avatarLoadFailed.value = true
}

/**
 * 功能菜单配置（title 文案 + icon 为 uni-icons 类型名，全应用图标语言统一）
 * 仅保留真实可用项，邀请好友等占位死入口已删除
 */
const menuList = ref([{ title: '设置', icon: 'gear' }])

/**
 * 菜单项点击：跳转设置页
 * @param {{title: string, icon: string}} item 被点击的菜单项
 */
const onMenuTap = (item) => {
  if (item.title === '设置') {
    uni.navigateTo({ url: '/pages/settings/index' })
  }
}

/** 头像 / 昵称编辑入口：弹出 ActionSheet 选择修改昵称或更换头像 */
const onEditProfile = () => {
  uni.showActionSheet({
    itemList: ['修改昵称', '更换头像'],
    success: (res) => {
      if (res.tapIndex === 0) editName()
      if (res.tapIndex === 1) changeAvatar()
    },
  })
}
</script>

<style lang="scss" scoped>
.my {
  min-height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - 80rpx
  );
  background: $bg-page;
  padding-bottom: 160rpx;
}

// 顶部个人信息区的渐变 / 圆角 / 背景装饰由 PageHeader 组件内聚，
// 本页只保留插槽内用户资料与统计的样式；
// 消息铃铛入口已移除（本期无消息能力，避免假按钮）；以下为用户资料样式
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
        color: $text-inverse;
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
      color: $text-inverse;
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

// 功能菜单（上浮白卡，压住头部圆角，层级更清晰；菜单项本体由 MenuItem 组件内聚）
.menu {
  position: relative;
  z-index: 2;
  margin: -52rpx 24rpx 0;
  background: #fff;
  border-radius: $radius-card;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);
  overflow: hidden;
}
</style>
