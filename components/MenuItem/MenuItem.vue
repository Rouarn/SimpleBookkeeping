<!--
  @file 菜单行（components/MenuItem/MenuItem.vue）
  @description 从我的页与设置页两份重复菜单行原样抽取：左侧图标砖 + 标题
               （+ 可选描述）+ 右侧可选值与箭头，自带内缩发丝分割线与按压底色。
               props: icon（uni-icons 类型名）/ label / desc（可选）/ value（可选）；
               emits: click。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view
    class="menu-item"
    hover-class="row-hover"
    :hover-stay-time="60"
    @click="$emit('click')"
  >
    <view class="menu-icon">
      <uni-icons :type="icon" size="23" color="#2f6b54"></uni-icons>
    </view>
    <text class="menu-title">{{ label }}</text>
    <text v-if="desc" class="menu-desc">{{ desc }}</text>
    <text v-if="value" class="menu-extra">{{ value }}</text>
    <uni-icons
      class="menu-arrow"
      type="right"
      size="14"
      color="#c2c9c3"
    ></uni-icons>
  </view>
</template>

<script setup>
defineProps({
  // uni-icons 图标类型名
  icon: { type: String, required: true },
  // 菜单标题
  label: { type: String, required: true },
  // 标题右侧描述（可选，当前两页暂无使用）
  desc: { type: String, default: '' },
  // 右侧值（如版本号，可选）
  value: { type: [String, Number], default: '' },
})

defineEmits(['click'])
</script>

<style lang="scss" scoped>
.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;

  &::after {
    content: '';
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

  // hover-class 会把 row-hover 加到本节点自身
  &.row-hover {
    background: $bg-hover;
  }

  .menu-icon {
    width: 64rpx;
    height: 64rpx;
    margin-right: 22rpx;
    border-radius: $radius-md;
    background: $bg-tint-icon;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .menu-title {
    flex: 1;
    font-size: 29rpx;
    font-weight: 500;
    color: $text-primary;
  }

  // 标题后的补充描述（弱化灰字）
  .menu-desc {
    margin-left: 12rpx;
    font-size: 23rpx;
    color: $text-secondary;
  }

  .menu-extra {
    font-size: 23rpx;
    color: $text-secondary;
    margin-right: 10rpx;
    font-variant-numeric: tabular-nums;
  }

  .menu-arrow {
    flex-shrink: 0;
  }
}
</style>
