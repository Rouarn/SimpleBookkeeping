<!--
  @file 同心圆环装饰（components/DecorRing/DecorRing.vue）
  @description 「铜钱纹」同心圆环装饰，从首页统计卡 / 流水收支卡 / 统计概览卡 /
               更新弹窗引导头四处重复结构原样抽取：
               - 根节点定位（top/right/宽高）仍由调用方 class 控制，保持各页几何数值不变；
               - size 为外环（容器）直径 rpx，middle/inner 为中内环直径，传 0 不渲染；
               - 各环透明度可按各页原值覆盖（outerOpacity/middleOpacity/innerOpacity）。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view class="decor-ring-box" :style="boxStyle">
    <view class="decor-ring" :style="ringStyle(size, outerOpacity)"></view>
    <view
      v-if="middle"
      class="decor-ring"
      :style="ringStyle(middle, middleOpacity)"
    ></view>
    <view
      v-if="inner"
      class="decor-ring"
      :style="ringStyle(inner, innerOpacity)"
    ></view>
  </view>
</template>

<script setup>
/**
 * 同心圆环装饰组件
 * 直径均为数字（单位 rpx），透明度为 0~1 的数字
 */
import { computed } from 'vue'

const props = defineProps({
  // 外环 / 容器直径（rpx）
  size: { type: [Number, String], required: true },
  // 中环直径（rpx），0 或不传则不渲染
  middle: { type: [Number, String], default: 0 },
  // 内环直径（rpx），0 或不传则不渲染
  inner: { type: [Number, String], default: 0 },
  // 各环描边透明度（保持各页原有细微差异）
  outerOpacity: { type: [Number, String], default: 0.08 },
  middleOpacity: { type: [Number, String], default: 0.11 },
  innerOpacity: { type: [Number, String], default: 0.15 },
})

// 容器尺寸与外环一致（定位由调用方 class 决定）
const boxStyle = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
}))

/**
 * 生成单环内联样式（直径 + 白色半透明描边）
 * @param {number|string} diameter 直径 rpx
 * @param {number|string} opacity 描边透明度
 * @returns {object}
 */
const ringStyle = (diameter, opacity) => ({
  width: `${diameter}rpx`,
  height: `${diameter}rpx`,
  borderColor: `rgba(255, 255, 255, ${opacity})`,
})
</script>

<style lang="scss" scoped>
/* 容器不拦截点击；定位规则由调用方 class 提供 */
.decor-ring-box {
  position: absolute;
  pointer-events: none;
}

/* 单环：相对容器绝对居中（与原各页 transform 居中写法一致） */
.decor-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  transform: translate(-50%, -50%);
}
</style>
