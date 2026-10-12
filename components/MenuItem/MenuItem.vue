<!--
  @file 菜单行（components/MenuItem/MenuItem.vue）
  @description 从我的页与设置页两份重复菜单行原样抽取：左侧图标砖 + 标题
               （+ 可选描述）+ 右侧可选值与箭头，自带内缩发丝分割线与按压底色。
               props: icon（uni-icons 类型名）/ label / desc（可选）/ value（可选）/
               badge（可选，红色未读数角标，>99 显示 99+）；emits: click。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：分割线收敛至主题 token，左侧图标色随主题取值
  @modify 2026-10-12 新增 badge 未读数角标（我的页「消息中心」入口）
-->
<template>
  <view
    class="menu-item"
    hover-class="row-hover"
    :hover-stay-time="60"
    @click="$emit('click')"
  >
    <view class="menu-icon">
      <uni-icons :type="icon" size="23" :color="iconColor"></uni-icons>
    </view>
    <text class="menu-title">{{ label }}</text>
    <text v-if="desc" class="menu-desc">{{ desc }}</text>
    <view v-if="badge > 0" class="menu-badge">
      {{ badge > 99 ? '99+' : badge }}
    </view>
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
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

defineProps({
  // uni-icons 图标类型名
  icon: { type: String, required: true },
  // 菜单标题
  label: { type: String, required: true },
  // 标题右侧描述（可选，当前两页暂无使用）
  desc: { type: String, default: '' },
  // 右侧值（如版本号，可选）
  value: { type: [String, Number], default: '' },
  // 红色未读数角标（0 不显示，>99 显示 99+）
  badge: { type: Number, default: 0 },
})

defineEmits(['click'])

// uni-icons 的 color 为内联样式走不了 CSS 变量，按 isDark 在 JS 侧取值
// （浅 #2f6b54 / 深 #58b992，与 token 深浅两盘同色值）
const { isDark } = useTheme()
const iconColor = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))
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
    background: $divider;
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

  // 红色未读数角标（消息中心入口）
  .menu-badge {
    margin-left: 12rpx;
    padding: 2rpx 12rpx;
    min-width: 34rpx;
    box-sizing: border-box;
    border-radius: 999rpx;
    background: $color-danger;
    color: #ffffff;
    font-size: 20rpx;
    line-height: 30rpx;
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
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
