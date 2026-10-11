<!--
  @file 深松绿渐变页头（components/PageHeader/PageHeader.vue）
  @description 从登录 / 我的 / 设置三页重复的「深松绿渐变 + 底部圆角 + 双圆装饰
               （+ 两枚色点）」页头原样抽取：
               - variant=login：登录页（固定 420rpx 高、底边 44rpx 圆角、含色点）；
               - variant=my：我的页（自适应高、底边 36rpx 圆角、含色点）；
               - variant=settings：设置页（自适应高、底边 36rpx 圆角、无色点）；
               各变体的尺寸 / 内边距 / 装饰圆位置均为重构前原数值，视觉零变化。
               - 页头正文（品牌区 / 资料区 / 导航区）全部通过默认插槽传入。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view class="page-header" :style="rootStyle">
    <!-- 背景装饰：大圆弧 -->
    <view class="decor decor-arc" :style="arcStyle"></view>
    <!-- 背景装饰：小圆弧 -->
    <view class="decor decor-circle" :style="circleStyle"></view>
    <!-- 两枚色点（登录 / 我的页头有，设置页头无） -->
    <template v-if="preset.dots">
      <view class="decor decor-dot dot-jade" :style="jadeDotStyle"></view>
      <view class="decor decor-dot dot-clay" :style="clayDotStyle"></view>
    </template>

    <!-- 页头正文 -->
    <slot></slot>
  </view>
</template>

<script setup>
/**
 * 页头组件：variant 选择与三页原 CSS 一一对应的几何预设
 */
import { computed } from 'vue'

const props = defineProps({
  // 页头变体：login 登录页 / my 我的页 / settings 设置页
  variant: {
    type: String,
    default: 'my',
    validator: (v) => ['login', 'my', 'settings'].includes(v),
  },
})

/**
 * 各变体几何预设（数值逐一搬迁自原各页 .header / .decor-* 规则）
 * padding/height 为根节点内联样式；其余为装饰圆 / 色点的位置与尺寸
 */
const PRESETS = {
  login: {
    height: '420rpx',
    padding: 'calc(var(--status-bar-height) + 60rpx) 48rpx 0',
    radius: '0 0 44rpx 44rpx',
    arc: { width: 520, height: 520, left: -220, top: -240, opacity: 0.06 },
    circle: { width: 460, height: 460, right: -160, top: -160, opacity: 0.05 },
    dots: true,
    jade: { width: 22, height: 22, right: 220, top: 120, opacity: 0.45 },
    clay: { width: 32, height: 32, right: 96, top: 230, opacity: 0.4 },
  },
  my: {
    height: 'auto',
    padding: 'calc(var(--status-bar-height) + 44rpx) 32rpx 96rpx',
    radius: '0 0 36rpx 36rpx',
    arc: { width: 460, height: 460, left: -200, top: -210, opacity: 0.06 },
    circle: { width: 400, height: 400, right: -130, top: -140, opacity: 0.05 },
    dots: true,
    jade: { width: 22, height: 22, right: 208, top: 86, opacity: 0.45 },
    clay: { width: 32, height: 32, right: 86, top: 210, opacity: 0.4 },
  },
  settings: {
    height: 'auto',
    padding: 'calc(var(--status-bar-height) + 20rpx) 32rpx 148rpx',
    radius: '0 0 36rpx 36rpx',
    arc: { width: 480, height: 480, left: -210, top: -220, opacity: 0.06 },
    circle: { width: 420, height: 420, right: -150, top: -150, opacity: 0.05 },
    dots: false,
    jade: {},
    clay: {},
  },
}

const preset = computed(() => PRESETS[props.variant] || PRESETS.my)

// 根节点样式（高度 / 内边距 / 底部圆角）
const rootStyle = computed(() => ({
  height: preset.value.height,
  padding: preset.value.padding,
  borderRadius: preset.value.radius,
}))

/**
 * 把预设中的定位项转为 rpx/px 内联样式
 * @param {{width?:number,height?:number,left?:number,right?:number,top?:number,opacity?:number}} g
 * @param {string} bg 背景色（含透明度）
 * @returns {object}
 */
const geometryStyle = (g, bg) => ({
  width: `${g.width}rpx`,
  height: `${g.height}rpx`,
  left: g.left !== undefined ? `${g.left}rpx` : 'auto',
  right: g.right !== undefined ? `${g.right}rpx` : 'auto',
  top: `${g.top}rpx`,
  background: bg,
})

const arcStyle = computed(() =>
  geometryStyle(
    preset.value.arc,
    `rgba(255, 255, 255, ${preset.value.arc.opacity})`,
  ),
)
const circleStyle = computed(() =>
  geometryStyle(
    preset.value.circle,
    `rgba(255, 255, 255, ${preset.value.circle.opacity})`,
  ),
)
// 色点色值沿用原页：薄荷绿 / 陶土
const jadeDotStyle = computed(() =>
  geometryStyle(
    preset.value.jade,
    `rgba(143, 226, 189, ${preset.value.jade.opacity})`,
  ),
)
const clayDotStyle = computed(() =>
  geometryStyle(
    preset.value.clay,
    `rgba(216, 122, 99, ${preset.value.clay.opacity})`,
  ),
)
</script>

<style lang="scss" scoped>
/* 深松绿渐变圆角页头（各页几何尺寸由 variant 内联样式决定） */
.page-header {
  position: relative;
  background: $gradient-header;
  overflow: hidden;
}

/* 背景装饰圆（位置 / 尺寸由内联样式决定） */
.decor {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
</style>
