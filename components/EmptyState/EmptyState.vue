<!--
  @file 空态占位（components/EmptyState/EmptyState.vue）
  @description 从首页「今日流水」与流水页列表空态原样抽取的 ¥ 圆圈 + 文案占位：
               - text 为主文案（必填），sub 为副文案（可空，不传则不渲染）；
               - 样式数值与原两页 .empty-tip 完全一致。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view class="empty-tip">
    <view class="empty-coin">¥</view>
    <text class="empty-text">{{ text }}</text>
    <text v-if="sub" class="empty-sub">{{ sub }}</text>
  </view>
</template>

<script setup>
defineProps({
  // 主文案
  text: { type: String, default: '' },
  // 副文案（空串不渲染）
  sub: { type: String, default: '' },
})
</script>

<style lang="scss" scoped>
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72rpx 0 80rpx;

  .empty-coin {
    width: 104rpx;
    height: 104rpx;
    margin-bottom: 28rpx;
    border-radius: 50%;
    border: 2rpx solid #d6e2da;
    background: #f8faf8;
    box-shadow: 0 0 0 10rpx rgba(76, 175, 135, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    font-weight: 600;
    color: #7ba48f;
  }

  .empty-text {
    font-size: 28rpx;
    color: #8b938d;
  }

  .empty-sub {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: #abb3ac;
  }
}
</style>
