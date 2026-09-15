<!--
  @file APP 更新弹窗（components/update-popup.vue）
  @description 全局唯一的版本更新弹窗（状态来自 use-app-update 模块级单例）：
               1. 普通更新：展示版本号、更新说明、包大小，提供
                  「立即更新 / 稍后再说」；
               2. 下载中：进度条 + 百分比，不可关闭；
               3. 下载失败：错误提示 + 重试；强更失败额外提供「退出」；
               4. 强制更新：无「稍后」、无关闭途径，底部红色强更提示。
               弹窗可在多个 tab 页各挂载一次，共享同一份单例状态。
  @date 2026-09-15
-->
<template>
  <view v-if="state.visible" class="upd-mask">
    <view
      class="upd-box"
      :class="{ 'upd-box--force': state.info?.forceUpdate }"
    >
      <view class="upd-title">发现新版本 v{{ state.info?.versionName }}</view>

      <scroll-view scroll-y class="upd-log">
        <text class="upd-log-text">{{
          state.info?.updateLog || "性能优化与问题修复，建议立即更新。"
        }}</text>
      </scroll-view>

      <view v-if="!state.downloading && !state.failedMsg" class="upd-size">
        大小约 {{ formatSize(state.info?.packageSize) }}
      </view>

      <!-- 下载进度 -->
      <view v-if="state.downloading" class="upd-progress-wrap">
        <view class="upd-progress-bar">
          <view
            class="upd-progress-inner"
            :style="{ width: state.progress + '%' }"
          />
        </view>
        <text class="upd-progress-text">{{ state.progress }}%</text>
      </view>

      <!-- 失败提示 -->
      <view v-if="state.failedMsg" class="upd-error">{{
        state.failedMsg
      }}</view>

      <view class="upd-actions">
        <button
          v-if="state.failedMsg"
          class="upd-btn upd-btn--primary"
          @click="retry"
        >
          重试
        </button>
        <button
          v-else-if="!state.downloading"
          class="upd-btn upd-btn--primary"
          @click="startDownload"
        >
          立即更新
        </button>

        <button
          v-if="!state.info?.forceUpdate && !state.downloading"
          class="upd-btn"
          @click="dismiss"
        >
          稍后再说
        </button>

        <button
          v-if="state.info?.forceUpdate && state.failedMsg"
          class="upd-btn"
          @click="exitApp"
        >
          退出
        </button>
      </view>

      <view v-if="state.info?.forceUpdate" class="upd-force-tip">
        当前版本过低，需更新后才能继续使用
      </view>
    </view>
  </view>
</template>

<script setup>
import { useAppUpdate } from "@/composables/use-app-update";

const { state, startDownload, retry, dismiss, exitApp } = useAppUpdate();

/** 字节数格式化为 MB 展示 */
function formatSize(bytes) {
  if (!bytes) return "未知";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
</script>

<style scoped>
.upd-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upd-box {
  width: 580rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 36rpx 32rpx;
}
.upd-title {
  font-size: 34rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24rpx;
}
.upd-log {
  max-height: 280rpx;
  margin-bottom: 16rpx;
}
.upd-log-text {
  font-size: 26rpx;
  color: #555;
  line-height: 1.7;
  white-space: pre-wrap;
}
.upd-size {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
}
.upd-progress-wrap {
  margin: 10rpx 0 24rpx;
}
.upd-progress-bar {
  height: 14rpx;
  background: #eef0f3;
  border-radius: 7rpx;
  overflow: hidden;
}
.upd-progress-inner {
  height: 100%;
  background: #2bb673;
  border-radius: 7rpx;
  transition: width 0.2s;
}
.upd-progress-text {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #2bb673;
  margin-top: 10rpx;
}
.upd-error {
  font-size: 24rpx;
  color: #fa3534;
  margin-bottom: 16rpx;
  text-align: center;
}
.upd-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;
}
.upd-btn {
  flex: 1;
  font-size: 28rpx;
  border-radius: 44rpx;
}
.upd-btn--primary {
  background: #2bb673;
  color: #fff;
}
.upd-force-tip {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: #fa3534;
  text-align: center;
}
</style>
