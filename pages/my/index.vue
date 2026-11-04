<!--
  @file 我的页（pages/my/index.vue）
  @description 个人中心页面（macOS 26 / iOS 26 Liquid Glass 版）：
               1. 桌面壁纸 + 玻璃页头：PageHeader（my 变体，已玻璃化）承载
                  头像 / 昵称 / 加入产品天数与记账统计；页头内的文字与头像区
                  改用可在玻璃上阅读的主题 token（浅色深字 / 深色浅字）；
               2. 记账统计：玻璃页头内的凹陷玻璃分区（var(--c-glass-inner) +
                  顶部内高光），记账总笔数 / 总天数 / 账本数量来自
                  GET /users/me/stats；
               3. 功能菜单：.g-glass 玻璃卡分组包裹 MenuItem（消息中心带未读数
                  角标，未读数来自 GET /users/me/messages/unread-count），
                  分组标题用 $text-secondary 小字；
               4. 底部悬浮玻璃导航（GlassTabBar）与 calc(200rpx + safe-area)
                  安全区留白。
               数据与动作与改造前完全一致，仅重构视觉层。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 抽取 PageHeader / MenuItem 公共组件
  @modify 2026-10-12 深色模式：根节点接 themeClass，硬编码颜色收敛至主题 token
  @modify 2026-10-12 恢复消息中心活入口（未读数角标，>99 显示 99+）
  @modify 2026-11-04 Liquid Glass 重构：壁纸 + 玻璃页头 + 玻璃菜单卡 + 悬浮玻璃导航
-->
<template>
  <view class="my" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源 -->
    <GlassBackground />

    <!-- 内容层（z-index 1） -->
    <view class="my__body">
      <!-- 顶部个人信息区（玻璃页头，圆角 / 双圆 + 双点由 PageHeader 内聚） -->
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
              <!-- 图标色走 CSS 变量：uni-icons 的 color 为内联样式，无法继承主题类，
                   这里直接写 var()，浅色 / 深色两盘自动取值 -->
              <uni-icons
                class="edit-icon"
                type="compose"
                size="23"
                color="var(--c-primary-mid)"
                @click="onEditProfile"
              ></uni-icons>
            </view>
            <text class="welcome">小绿记账陪伴你的第 {{ joinDays }} 天</text>
          </view>
        </view>

        <!-- 记账统计（凹陷玻璃分区） -->
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

      <!-- 功能菜单：玻璃卡分组（菜单项本体由 MenuItem 组件内聚） -->
      <view class="menu-group">
        <text class="menu-group__label">功能</text>
        <view class="menu-group__card g-glass">
          <MenuItem
            v-for="item in menuList"
            :key="item.key"
            :icon="item.icon"
            :label="item.title"
            :badge="item.key === 'messages' ? unreadCount : 0"
            @click="onMenuTap(item)"
          />
        </view>
      </view>
    </view>

    <!-- 底部悬浮玻璃导航 -->
    <GlassTabBar current="my" />
  </view>
</template>

<script setup>
/**
 * 我的页脚本模块
 * 模块说明：
 * - useProfile()：取得用户资料、加入天数、跨模块统计（来自 GET /users/me/stats），
 *   以及修改昵称（PATCH /users/me）/ 更换头像（POST /users/me/avatar）动作；
 * - 功能菜单：消息中心（未读数角标）+ 设置；未读数来自 user store（onShow 拉取，
 *   首页聚合 / 消息页标已读会同步写回，返回本页时角标即时刷新）。
 */
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useProfile } from '@/composables/useBookkeeping'
import { useTheme } from '@/composables/useTheme'
import { DEFAULT_AVATAR, useUserStore } from '@/store'

// 深色模式：根节点主题类（页面内颜色均已走 token，无需 JS 取色）
const { themeClass } = useTheme()

// 用户资料 / 统计来自 user store（接口缓存）
const { profile, avatar, joinDays, stats, editName, changeAvatar, userStore } =
  useProfile()

// 未读消息数角标（进入页面即拉最新，从消息页返回时 onShow 再次拉取）
const unreadCount = computed(() => userStore.unreadCount)

// 进入页面时拉取用户资料与统计：加 60s TTL 缓存，避免每次 onShow 全量重拉
//（昵称 / 头像修改走 PATCH / POST 后直接写 store，UI 即时更新，不受缓存影响；
// 未读数轻量且要求即时，不设 TTL 每次必拉）
const PROFILE_TTL = 60 * 1000
let lastMePullAt = 0
let lastStatsPullAt = 0

onShow(() => {
  // App 端 tabBar.custom 不会隐藏原生条（H5 由 App.vue 的 CSS 兜底），
  // 这里每次显示都再隐藏一次，避免切换页面时原生条重新出现。
  try {
    uni.hideTabBar({ animation: false })
  } catch (e) {
    // ignore：无原生 tabBar 的环境（H5 已用 CSS 隐藏）
  }
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
  userStore.fetchUnread().catch(() => {
    // 未读数拉取失败静默，保留上次角标
  })
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
 * 仅保留真实可用项
 */
const menuList = [
  { key: 'messages', title: '消息中心', icon: 'notification-filled' },
  { key: 'settings', title: '设置', icon: 'gear' },
]

/**
 * 菜单项点击：跳转对应页面
 * @param {{key: string, title: string, icon: string}} item 被点击的菜单项
 */
const onMenuTap = (item) => {
  if (item.key === 'messages') {
    uni.navigateTo({ url: '/pages/messages/index' })
  } else if (item.key === 'settings') {
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
/* 页面根：底色交给壁纸层，页面本身 transparent；
   底部预留悬浮玻璃导航（GlassTabBar）与 iPhone 手势条的空间 */
.my {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  min-height: calc(
    100vh - var(--status-bar-height) - var(--window-top) - 80rpx
  );
  background: transparent;
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

/* 内容层：抬到壁纸（z-index 0）之上，玻璃才有可折射的壁纸 */
.my__body {
  position: relative;
  z-index: 1;
}

/* ---------- 页头内用户资料 ----------
   PageHeader 已玻璃化：文字与头像描边改走浅色深字 / 深色浅字的主题 token，
   头像用玻璃高光边（1rpx 亮边 + 内高光）替代原来的半透明白描边 */
.profile {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 28rpx;

  .avatar {
    width: 124rpx;
    height: 124rpx;
    border-radius: 32rpx;
    flex-shrink: 0;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
    border: 3rpx solid var(--c-glass-border, rgba(255, 255, 255, 0.72));
    box-shadow:
      0 10rpx 24rpx rgba(22, 48, 38, 0.18),
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  }

  .profile-info {
    flex: 1;
    min-width: 0;
    margin-left: 26rpx;

    .name-row {
      display: flex;
      align-items: center;

      .name {
        max-width: 100%;
        font-size: 40rpx;
        font-weight: 700;
        color: $text-title;
        letter-spacing: 1rpx;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .edit-icon {
        margin-left: 14rpx;
        flex-shrink: 0;
      }
    }

    .welcome {
      display: block;
      margin-top: 12rpx;
      font-size: 24rpx;
      color: $text-secondary;
    }
  }
}

/* ---------- 记账统计：凹陷玻璃分区 ----------
   var(--c-glass-inner) 半透明内衬 + 顶部内高光 / 底部内暗边，
   与凸起的玻璃卡形成「玻璃里再嵌一层玻璃」的层级 */
.stats {
  position: relative;
  display: flex;
  margin-top: 48rpx;
  padding: 26rpx 0;
  border-radius: 28rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    & + & {
      border-left: 1rpx solid $divider;
    }

    .stat-num {
      font-size: 42rpx;
      font-weight: 700;
      color: $text-title;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      margin-top: 12rpx;
      font-size: 22rpx;
      color: $text-secondary;
    }
  }
}

/* ---------- 功能菜单：玻璃卡分组 ----------
   PageHeader 底部自带 96rpx 内边距，分组从玻璃页头下方的留白里开始；
   不再负向压边，避免标题骑在页头圆角上被“切掉”。 */
.menu-group {
  position: relative;
  z-index: 1;
  margin: 8rpx 24rpx 0;

  &__label {
    display: block;
    margin: 0 8rpx 14rpx;
    font-size: 23rpx;
    color: $text-secondary;
    letter-spacing: 0.5rpx;
  }

  &__card {
    border-radius: 36rpx;
    overflow: hidden;
  }
}
</style>
