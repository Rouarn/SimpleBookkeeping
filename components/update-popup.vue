<!--
  @file APP 更新弹窗（components/update-popup.vue）
  @description 全局唯一的版本更新弹窗（状态来自 use-app-update 模块级单例），
               视觉对齐全站设计语言（深松绿 #175142 + 米纸暖调 + 朱砂点缀）：
               1. 顶部深松绿引导头：铜钱纹同心环 + 白色图标砖 + 「发现新版本」+
                  版本号胶囊（强更时同行展示朱砂标签），非强更且非下载中
                  时右上角可关闭；
               2. 内容区：更新说明卡片、包大小、下载进度（百分比 + 已下载
                  字节）、失败提示条；
               3. 普通更新：提供「立即更新 / 稍后再说」；
               4. 下载中：进度条展示，不可关闭；
               5. 下载失败：错误提示 + 重试；强更失败额外提供「退出」；
               6. 强制更新：无「稍后」、无关闭途径，底部内联强更提示。
               弹窗可在多个 tab 页各挂载一次，共享同一份单例状态。
               注意：本组件为扁平路径（components/update-popup.vue），不满足
               easycom 默认规则，使用页面必须显式 import（首页 / 我的页均已引入）。
  @date 2026-09-20
-->
<template>
  <view v-if="state.visible" class="upd-mask" @touchmove.stop.prevent>
    <view
      class="upd-box"
      :class="{ 'upd-box--force': state.info?.forceUpdate }"
    >
      <!-- 深松绿引导头 -->
      <view class="upd-hero">
        <view class="upd-decor upd-decor-arc"></view>
        <view class="upd-decor upd-decor-circle"></view>

        <view
          v-if="!state.info?.forceUpdate && !state.downloading"
          class="upd-close"
          @click="dismiss"
        >
          <uni-icons type="closeempty" size="17" color="#dfeee6"></uni-icons>
        </view>

        <view class="upd-icon"></view>
        <view class="upd-title">发现新版本</view>
        <view class="upd-tags">
          <view class="upd-version">v{{ state.info?.versionName }}</view>
          <view v-if="state.info?.forceUpdate" class="upd-force-tag"
            >强制更新</view
          >
        </view>
      </view>

      <!-- 内容区 -->
      <view class="upd-body">
        <!-- 更新日志 -->
        <view class="upd-log">
          <view class="upd-log-head">
            <view class="upd-log-bar"></view>
            <text>更新内容</text>
          </view>
          <scroll-view scroll-y class="upd-log-scroll">
            <text class="upd-log-text">{{
              state.info?.updateLog || "性能优化与问题修复，建议立即更新。"
            }}</text>
          </scroll-view>
        </view>

        <!-- 包大小 -->
        <view v-if="!state.downloading && !state.failedMsg" class="upd-size">
          <text class="upd-size-dot"></text>
          <text>安装包约 {{ formatSize(state.info?.packageSize) }}</text>
        </view>

        <!-- 下载进度 -->
        <view v-if="state.downloading" class="upd-progress">
          <view class="upd-progress-head">
            <text class="upd-progress-label">正在下载更新</text>
            <text class="upd-progress-pct">{{ state.progress }}%</text>
          </view>
          <view class="upd-progress-track">
            <view
              class="upd-progress-fill"
              :style="{ width: state.progress + '%' }"
            ></view>
          </view>
          <text v-if="state.totalBytes" class="upd-progress-bytes">
            {{ formatSize(state.downloadedBytes) }} /
            {{ formatSize(state.totalBytes) }}
          </text>
          <text class="upd-progress-tip">下载完成后将自动调起安装，请稍候</text>
        </view>

        <!-- 失败提示 -->
        <view v-if="state.failedMsg" class="upd-error">
          <view class="upd-error-badge">!</view>
          <text class="upd-error-text">{{ state.failedMsg }}</text>
        </view>

        <!-- 强更提示 -->
        <view v-if="state.info?.forceUpdate" class="upd-force-hint">
          <view class="upd-force-dot">!</view>
          <text>当前版本过低，需更新后才能继续使用</text>
        </view>

        <!-- 按钮区 -->
        <view class="upd-actions">
          <button v-if="state.failedMsg" class="upd-btn" @click="retry">
            重新下载
          </button>
          <button
            v-else-if="!state.downloading"
            class="upd-btn"
            @click="startDownload"
          >
            立即更新
          </button>

          <view
            v-if="!state.info?.forceUpdate && !state.downloading"
            class="upd-text-btn"
            @click="dismiss"
          >
            稍后再说
          </view>

          <view
            v-if="state.info?.forceUpdate && state.failedMsg"
            class="upd-text-btn upd-text-btn--danger"
            @click="exitApp"
          >
            退出应用
          </view>
        </view>
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

<style lang="scss" scoped>
// 遮罩
.upd-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(20, 28, 24, 0.52);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: upd-fade 0.2s ease both;
}

// 弹窗卡片
.upd-box {
  width: 620rpx;
  max-height: 88vh;
  background: #ffffff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 24rpx 64rpx rgba(14, 40, 31, 0.24);
  animation: upd-in 0.28s ease-out both;
}

// 深松绿引导头
.upd-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 44rpx 40rpx 34rpx;
  background: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
  overflow: hidden;
}

.upd-decor {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background: transparent;
}

// 铜钱纹同心环：与首页统计卡同一装饰语言
.upd-decor-arc {
  width: 340rpx;
  height: 340rpx;
  right: -130rpx;
  top: -150rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.1);
}

.upd-decor-circle {
  width: 230rpx;
  height: 230rpx;
  right: -75rpx;
  top: -96rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.14);
}

// 关闭按钮
.upd-close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);

  &:active {
    background: rgba(255, 255, 255, 0.26);
  }
}

// 更新图标：白色图标砖 + 深松绿云下载描边
.upd-icon {
  position: relative;
  width: 116rpx;
  height: 116rpx;
  border-radius: 30rpx;
  background-color: #ffffff;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path d='M16.5 34H32a8.5 8.5 0 0 0 1.4-16.9A12.4 12.4 0 0 0 9.8 20.8 7.1 7.1 0 0 0 16.5 34z' fill='none' stroke='%23175142' stroke-width='3.2' stroke-linejoin='round'/><path d='M24 24v11.6M19.2 30.8 24 35.6l4.8-4.8' fill='none' stroke='%23175142' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 62rpx 62rpx;
  box-shadow: 0 12rpx 28rpx rgba(6, 32, 25, 0.28);
}

.upd-title {
  position: relative;
  margin-top: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #f1f7f3;
  letter-spacing: 1rpx;
}

.upd-tags {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 14rpx;
}

// 版本胶囊：薄荷叶描边，呼应首页统计卡的「设置」胶囊
.upd-version {
  padding: 6rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(143, 226, 189, 0.14);
  border: 1rpx solid rgba(143, 226, 189, 0.4);
  color: #9fe8cb;
  font-size: 24rpx;
  font-weight: 600;
}

// 强更标签：米纸底 + 朱砂字，与深松绿成沉稳的红绿对色
.upd-force-tag {
  margin-left: 12rpx;
  padding: 6rpx 22rpx;
  border-radius: 999rpx;
  background: #f6e8da;
  color: #a8543f;
  font-size: 24rpx;
  font-weight: 600;
}

// 内容区
.upd-body {
  padding: 30rpx 36rpx 34rpx;
}

// 更新日志
.upd-log {
  background: #f6f8f4;
  border: 1rpx solid #eef1ec;
  border-radius: 20rpx;
  padding: 22rpx 24rpx 18rpx;
}

.upd-log-head {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #3a423d;
}

.upd-log-bar {
  width: 8rpx;
  height: 26rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  background: #175142;
}

.upd-log-scroll {
  max-height: 220rpx;
}

.upd-log-text {
  display: block;
  font-size: 26rpx;
  color: #6b736c;
  line-height: 1.75;
  white-space: pre-wrap;
}

// 包大小
.upd-size {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 22rpx;
  font-size: 24rpx;
  color: #98a099;
}

.upd-size-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  background: #b6bfb6;
}

// 下载进度
.upd-progress {
  margin-top: 28rpx;
}

.upd-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14rpx;
}

.upd-progress-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #3a423d;
}

.upd-progress-pct {
  font-size: 30rpx;
  font-weight: 700;
  color: #175142;
  font-variant-numeric: tabular-nums;
}

.upd-progress-track {
  height: 14rpx;
  border-radius: 8rpx;
  background: #edf0ec;
  overflow: hidden;
}

.upd-progress-fill {
  height: 100%;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #4fc794 0%, #93e7c4 100%);
  transition: width 0.2s;
}

.upd-progress-bytes {
  display: block;
  margin-top: 10rpx;
  text-align: center;
  font-size: 22rpx;
  color: #98a099;
  font-variant-numeric: tabular-nums;
}

.upd-progress-tip {
  display: block;
  margin-top: 8rpx;
  text-align: center;
  font-size: 22rpx;
  color: #abb3ac;
}

// 失败提示
.upd-error {
  display: flex;
  align-items: flex-start;
  margin-top: 24rpx;
  padding: 18rpx 22rpx;
  border-radius: 16rpx;
  background: #fcebe8;
}

.upd-error-badge {
  flex-shrink: 0;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  margin-right: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d54e3c;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.upd-error-text {
  flex: 1;
  font-size: 24rpx;
  color: #c24a39;
  line-height: 1.5;
}

// 强更内联提示
.upd-force-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #a8543f;
}

.upd-force-dot {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  margin-right: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6e8da;
  color: #a8543f;
  font-size: 20rpx;
  font-weight: 700;
}

// 按钮区：深松绿主按钮独占一行，次操作为文字按钮
.upd-actions {
  margin-top: 30rpx;
}

.upd-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  margin: 0;
  padding: 0;
  border-radius: 20rpx;
  background: #175142;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  box-shadow: 0 12rpx 28rpx rgba(23, 81, 66, 0.28);
  transition: transform 0.15s ease;

  &::after {
    border: none;
  }

  &:active {
    transform: scale(0.98);
  }
}

.upd-text-btn {
  margin-top: 18rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  font-size: 28rpx;
  color: #98a099;
  transition: opacity 0.15s ease;

  &:active {
    opacity: 0.6;
  }
}

.upd-text-btn--danger {
  color: #c24a39;
}

// 动画
@keyframes upd-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes upd-in {
  from {
    opacity: 0;
    transform: translateY(28rpx) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
