<!--
  @file 液态玻璃底部导航（components/GlassTabBar/GlassTabBar.vue）
  @description 自定义 tabBar（pages.json 中 tabBar.custom = true）：
               - 悬浮胶囊玻璃条：四枚入口，选中项有胶囊状玻璃高光与主色图标；
               - 中间「+」为脱离胶囊的液态玻璃圆钮，点击以 slide-in-bottom 打开记账页；
               - 底部按 env(safe-area-inset-bottom) 抬升，避开 iPhone 手势条。
               原生 tabBar 无法做玻璃材质与悬浮形态，故整体替换为组件实现；
               切换仍走 uni.switchTab，页面栈行为与原生一致。
  @author 夏季 <2937375029@qq.com>
  @date 2026-11-04
-->
<template>
  <view class="glass-tabbar">
    <view class="glass-tabbar__pill g-glass g-glass--bar g-float">
      <view
        v-for="item in leftTabs"
        :key="item.key"
        class="glass-tabbar__item"
        :class="{ 'is-active': item.key === current }"
        @click="switchTo(item)"
      >
        <view class="glass-tabbar__icon">
          <uni-icons
            :type="item.key === current ? item.iconActive : item.icon"
            size="23"
            :color="item.key === current ? activeColor : inactiveColor"
          ></uni-icons>
        </view>
        <text class="glass-tabbar__label">{{ item.text }}</text>
      </view>

      <!-- 中间留位：给悬浮的 + 按钮让出视觉空间 -->
      <view class="glass-tabbar__gap"></view>

      <view
        v-for="item in rightTabs"
        :key="item.key"
        class="glass-tabbar__item"
        :class="{ 'is-active': item.key === current }"
        @click="switchTo(item)"
      >
        <view class="glass-tabbar__icon">
          <uni-icons
            :type="item.key === current ? item.iconActive : item.icon"
            size="23"
            :color="item.key === current ? activeColor : inactiveColor"
          ></uni-icons>
        </view>
        <text class="glass-tabbar__label">{{ item.text }}</text>
      </view>
    </view>

    <!-- 中间悬浮的记账按钮：液态玻璃 + 品牌渐变，悬浮于胶囊之上 -->
    <view class="glass-tabbar__fab g-press" @click="openAdd">
      <!-- 纸面圆钮固定为浅色，+ 号固定用墨色（两套主题下都清晰） -->
      <uni-icons type="plusempty" size="28" color="#171512"></uni-icons>
    </view>
  </view>
</template>

<script setup>
/**
 * 底部玻璃导航
 * - current：由页面传入的当前选中项 key（home / flowing / statistics / my）
 * - 切换：uni.switchTab（tabBar 配置为 custom，原生条被隐藏，仅保留切换语义）
 * - 记账：uni.navigateTo + slide-in-bottom，模拟从底部升起的录入面板
 */
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const props = defineProps({
  // 当前选中项
  current: {
    type: String,
    default: 'home',
    validator: (v) => ['home', 'flowing', 'statistics', 'my'].includes(v),
  },
})

const { isDark } = useTheme()

/** 选中 / 未选中图标色（uni-icons 走内联 color，无法读取 CSS 变量） */
const activeColor = computed(() => (isDark.value ? '#5fc29a' : '#175142'))
const inactiveColor = computed(() => (isDark.value ? '#79837c' : '#98a099'))

/** 左侧两枚入口 */
const leftTabs = [
  {
    key: 'home',
    text: '首页',
    icon: 'home',
    iconActive: 'home-filled',
    url: '/pages/index/index',
  },
  {
    key: 'flowing',
    text: '流水',
    icon: 'list',
    iconActive: 'list',
    url: '/pages/flowing/index',
  },
]

/** 右侧两枚入口 */
const rightTabs = [
  {
    key: 'statistics',
    text: '统计',
    icon: 'bars',
    iconActive: 'bars',
    url: '/pages/statistics/index',
  },
  {
    key: 'my',
    text: '我的',
    icon: 'person',
    iconActive: 'person-filled',
    url: '/pages/my/index',
  },
]

/**
 * 切换 tab 页面
 * @param {{key:string,url:string}} item 目标入口
 */
const switchTo = (item) => {
  if (item.key === props.current) return
  uni.switchTab({ url: item.url })
}

/** 打开记账页（与原生中间按钮一致的「由下弹出」动效） */
const openAdd = () => {
  uni.navigateTo({
    url: '/pages/add/index',
    animationType: 'slide-in-bottom',
    animationDuration: 150,
  })
}
</script>

<style lang="scss" scoped>
.glass-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  padding: 0 24rpx calc(env(safe-area-inset-bottom) + 18rpx);
  pointer-events: none;

  &__pill {
    position: relative;
    display: flex;
    align-items: center;
    height: 118rpx;
    padding: 0 10rpx;
    border-radius: 999rpx;
    pointer-events: auto;
    /* 胶囊玻璃比页面卡片更透，露出壁纸颜色 */
    background-color: var(--c-glass-subtle, rgba(255, 255, 255, 0.3));
  }

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4rpx;
    height: 100%;
    border-radius: 999rpx;
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);

    &:active {
      transform: scale(0.94);
    }

    &.is-active {
      .glass-tabbar__label {
        color: $color-primary;
        font-weight: 600;
      }
    }
  }

  /* 图标容器只负责居中，不加任何底板（选中态只换图标颜色） */
  &__icon {
    position: relative;
    width: 48rpx;
    height: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__label {
    font-size: 20rpx;
    line-height: 1.2;
    color: $text-secondary;
    letter-spacing: 0.5rpx;
  }

  &__gap {
    width: 132rpx;
    height: 1rpx;
    flex-shrink: 0;
  }

  /* 中间悬浮圆钮 */
  &__fab {
    position: absolute;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 54rpx);
    width: 104rpx;
    height: 104rpx;
    margin-left: -52rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    /* VaKao 风格：纸面圆钮 + 一圈四色细环（四芒星的四色），+ 号为墨色。
       用双层 background-clip 做 3rpx 渐变描边，避免额外伪元素。 */
    background-image:
      linear-gradient(160deg, #ffffff 0%, #faf9f5 52%, #ebe8e1 100%),
      conic-gradient(from 210deg, #f0995f, #5fbedc, #a27fc2, #eddf55, #f0995f);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    border: 3rpx solid transparent;
    box-shadow:
      0 16rpx 36rpx rgba(23, 21, 18, 0.24),
      inset 0 2rpx 0 rgba(255, 255, 255, 0.9),
      inset 0 -2rpx 6rpx rgba(23, 21, 18, 0.08);
  }
}
</style>
