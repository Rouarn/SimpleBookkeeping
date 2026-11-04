<!--
  @file APP 更新弹窗（components/update-popup.vue）
  @description 全局唯一的版本更新弹窗（状态来自 use-app-update 模块级单例），
               视觉对齐全站 Liquid Glass 设计语言（macOS 26 / iOS 26）：
               1. 玻璃引导头：品牌色晕 + 斜向高光 + 同心环暗纹（DecorRing）+
                  白色玻璃图标砖 + 「发现新版本」+ 版本号玻璃胶囊（强更时
                  同行展示朱砂标签），非强更且非下载中时右上角玻璃圆钮可关闭；
               2. 内容区：更新说明玻璃片、包大小、下载进度（百分比 + 已下载
                  字节）、失败提示条；
               3. 普通更新：提供「立即更新 / 稍后再说」；
               4. 下载中：进度条展示，不可关闭；
               5. 下载失败：错误提示 + 重试；强更失败额外提供「退出」；
               6. 强制更新：无「稍后」、无关闭途径，底部内联强更提示。
               弹窗可在多个 tab 页各挂载一次，共享同一份单例状态。
               注意：本组件为扁平路径（components/update-popup.vue），不满足
               easycom 默认规则，使用页面必须显式 import（首页 / 我的页均已引入）。
  @date 2026-09-20
  @modify 2026-10-12 深色模式：弹窗卡 / 日志卡 / 进度轨 / 文案色收敛至主题 token，
               主按钮改用实底主色 token 保证白字对比度（引导头渐变与白字保持）
  @modify 2026-10-12 安装失败引导：「安装未知应用」开关在 Android 系统按应用
               授权页（App 内无此开关），安装失败态主按钮改「去开启安装权限」
               直跳系统授权页，辅以「重试安装」复用已下载 APK 免重复下载
  @modify 2026-11-04 Liquid Glass 重构：遮罩改 var(--c-scrim) + 6px 背景模糊；
               弹窗主体换 .g-glass .g-glass--thick 厚玻璃（44px 折射 / 48rpx
               连续大圆角 / 1rpx 高光边）；深松绿实色引导头改「品牌色晕玻璃头」
               （引导头不再是深色块，标题 / 版本胶囊 / 强更提示改用主题 token）；
               日志卡改内嵌玻璃片，主按钮走纸面四色环（.g-btn-primary），次操作改玻璃片，
               关闭钮改玻璃圆钮；标题区与按钮区各加一条发丝线。
               逻辑（检查 / 下载 / 安装 / 强更 / 关闭）与改造前完全一致。
-->
<template>
  <view v-if="state.visible" class="upd-mask" @touchmove.stop.prevent>
    <view
      class="upd-box g-glass g-glass--thick"
      :class="{ 'upd-box--force': state.info?.forceUpdate }"
    >
      <!-- 玻璃引导头（品牌色晕 + 同心环暗纹 + 玻璃图标砖） -->
      <view class="upd-hero">
        <!-- 铜钱纹同心环（外环 340 .10 / 中环 230 .14，几何同原两环；
             根节点定位仍由 .upd-decor-arc 提供：right:-130rpx;top:-150rpx） -->
        <DecorRing
          class="upd-decor-arc"
          :size="340"
          :middle="230"
          :inner="0"
          :outer-opacity="0.1"
          :middle-opacity="0.14"
        />

        <view
          v-if="!state.info?.forceUpdate && !state.downloading"
          class="upd-close"
          @click="dismiss"
        >
          <uni-icons type="closeempty" size="17" color="#171512"></uni-icons>
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
              state.info?.updateLog || '性能优化与问题修复，建议立即更新。'
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
          <!-- 安装失败：主按钮直跳系统「安装未知应用」授权页 -->
          <button
            v-if="state.failedType === 'install'"
            class="upd-btn g-btn-primary"
            @click="openInstallPermissionSettings"
          >
            去开启安装权限
          </button>
          <button
            v-else-if="state.failedMsg"
            class="upd-btn g-btn-primary"
            @click="retry"
          >
            重新下载
          </button>
          <button
            v-else-if="!state.downloading"
            class="upd-btn g-btn-primary"
            @click="startDownload"
          >
            立即更新
          </button>

          <!-- 安装失败：授权后重试安装（复用已下载 APK，不重新下载） -->
          <view
            v-if="state.failedType === 'install'"
            class="upd-text-btn"
            @click="retryInstall"
          >
            已开启权限，重试安装
          </view>

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
import { useAppUpdate } from '@/composables/use-app-update'

const {
  state,
  startDownload,
  retry,
  retryInstall,
  openInstallPermissionSettings,
  dismiss,
  exitApp,
} = useAppUpdate()

/** 字节数格式化为 MB 展示 */
function formatSize(bytes) {
  if (!bytes) return '未知'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style lang="scss" scoped>
/* ======================================================================
 * Liquid Glass 视觉层（macOS 26 / iOS 26）
 * 1. 遮罩：主题 scrim + 6px 背景模糊，把页面压成弹窗的「折射底」；
 * 2. 弹窗主体：.g-glass .g-glass--thick（44px 折射 + 1rpx 高光边），
 *    叠上 48rpx 连续大圆角与抬升投影；
 * 3. 引导头：透明玻璃面 + 品牌色晕 + 斜向高光 + 底部发丝线；
 * 4. 内容块（日志 / 进度 / 次按钮 / 关闭钮）：内嵌玻璃片或玻璃圆钮，
 *    按压统一走 var(--c-glass-hover)（常亮白玻璃片除外，见 .upd-close）。
 * 宽度 620rpx，在 375pt（750rpx）下左右各留 65rpx，不溢出。
 * ==================================================================== */

/* ---------- 遮罩 ---------- */
.upd-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-scrim, rgba(10, 20, 16, 0.32));
  animation: upd-fade 0.2s ease both;
}

/* ---------- 弹窗主体：厚玻璃 + 连续大圆角 + 高光边 ---------- */
.upd-box {
  position: relative;
  width: 620rpx;
  max-height: 88vh;
  border-radius: 48rpx; /* .g-glass 默认 36rpx，浮层用更大的连续圆角 */
  /* 纵向弹性布局：内容超高时由内容区滚动，避免小屏裁掉底部按钮 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 覆写 .g-glass 的默认投影：浮层需要更强的「浮起」与顶部镜面高光 */
  box-shadow:
    var(--shadow-glass-lift, 0 30rpx 80rpx rgba(22, 48, 38, 0.2)),
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
  animation: upd-in 0.28s ease-out both;
}

/* ---------- 玻璃引导头 ---------- */
.upd-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 44rpx 40rpx 34rpx;
  overflow: hidden;
  /* 只留一层斜向高光，主体让下方厚玻璃与壁纸透上来
     （原深松绿实色渐变块已移除，改由品牌色晕承担身份） */
  background-image: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.34) 0%,
    rgba(255, 255, 255, 0.06) 38%,
    rgba(255, 255, 255, 0) 68%
  );
}

/* 品牌色晕：给玻璃头一层「有颜色但透光」的身份（与统计概览玻璃卡同一手法） */
.upd-hero::before {
  content: '';
  position: absolute;
  top: -190rpx;
  right: -150rpx;
  width: 460rpx;
  height: 460rpx;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(79, 199, 148, 0.28) 0%,
    rgba(79, 199, 148, 0) 68%
  );
}

/* 标题区与内容区之间的玻璃棱线（上 1rpx 亮边 + 下 1rpx 暗边） */
.upd-hero::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2rpx;
  pointer-events: none;
  background-image:
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      var(--c-glass-hi, rgba(255, 255, 255, 0.9)) 18%,
      var(--c-glass-hi, rgba(255, 255, 255, 0.9)) 82%,
      rgba(255, 255, 255, 0) 100%
    ),
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      var(--c-divider-strong, #dbe1db) 18%,
      var(--c-divider-strong, #dbe1db) 82%,
      rgba(255, 255, 255, 0) 100%
    );
  background-size:
    100% 1rpx,
    100% 1rpx;
  background-position:
    0 0,
    0 100%;
  background-repeat: no-repeat;
}

/* 铜钱纹同心环：DecorRing 根节点定位（环体样式内聚在组件内，与原两圆基本同心） */
.upd-decor-arc {
  right: -130rpx;
  top: -150rpx;
}

/* ---------- 关闭钮：玻璃圆钮 ---------- */
.upd-close {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  z-index: 3;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  /* 常亮白玻璃：深浅两套主题下都保证深松绿 × 可读（uni-icons 走内联色） */
  background-color: rgba(255, 255, 255, 0.7);
  background-image: linear-gradient(
    150deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0) 60%
  );
  border: 1rpx solid rgba(255, 255, 255, 0.6);
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    0 8rpx 20rpx rgba(12, 58, 46, 0.14);
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;

  /* 白玻璃片按压取「更亮」而非 var(--c-glass-hover)：后者在深色主题下近乎透明，
     会让内联深色图标失去可读性 */
  &:active {
    transform: scale(0.94);
    background-color: rgba(255, 255, 255, 0.92);
  }
}

/* ---------- 更新图标：白色玻璃砖 + 深松绿云下载描边 ---------- */
.upd-icon {
  position: relative;
  width: 116rpx;
  height: 116rpx;
  border-radius: 34rpx;
  background-color: rgba(255, 255, 255, 0.82);
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path d='M16.5 34H32a8.5 8.5 0 0 0 1.4-16.9A12.4 12.4 0 0 0 9.8 20.8 7.1 7.1 0 0 0 16.5 34z' fill='none' stroke='%23175142' stroke-width='3.2' stroke-linejoin='round'/><path d='M24 24v11.6M19.2 30.8 24 35.6l4.8-4.8' fill='none' stroke='%23175142' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/></svg>"),
    linear-gradient(
      150deg,
      rgba(255, 255, 255, 0.6) 0%,
      rgba(255, 255, 255, 0) 62%
    );
  background-repeat: no-repeat;
  background-position: center, center;
  background-size:
    62rpx 62rpx,
    100% 100%;
  border: 1rpx solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 12rpx 28rpx rgba(6, 32, 25, 0.22),
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
}

/* 引导头文字：玻璃头上改用主题墨色（原深底白字不再适用） */
.upd-title {
  position: relative;
  margin-top: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: $text-title;
  letter-spacing: 1rpx;
}

.upd-tags {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 14rpx;
}

/* 版本胶囊：内嵌玻璃片 + 主色字（深浅主题自动换色） */
.upd-version {
  padding: 6rpx 22rpx;
  border-radius: 999rpx;
  background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  color: $color-primary;
  font-size: 24rpx;
  font-weight: 600;
}

/* 强更标签：米纸底 + 朱砂字（保持原配色，只把实底换成带高光的米纸玻璃片） */
.upd-force-tag {
  margin-left: 12rpx;
  padding: 6rpx 22rpx;
  border-radius: 999rpx;
  background-color: rgba(246, 232, 218, 0.9);
  border: 1rpx solid rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.7);
  color: #a8543f;
  font-size: 24rpx;
  font-weight: 600;
}

/* ---------- 内容区 ---------- */
.upd-body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  /* 底部留出主按钮外投影的余量，避免 overflow 容器把投影裁平 */
  padding: 30rpx 36rpx 52rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 更新日志：厚玻璃内的内嵌玻璃片 */
.upd-log {
  padding: 22rpx 24rpx 18rpx;
  border-radius: 28rpx;
  background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
}

.upd-log-head {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $text-body;
}

.upd-log-bar {
  width: 8rpx;
  height: 26rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  background: $color-primary;
}

.upd-log-scroll {
  max-height: 220rpx;
}

.upd-log-text {
  display: block;
  font-size: 26rpx;
  color: $text-regular;
  line-height: 1.75;
  white-space: pre-wrap;
}

/* 包大小 */
.upd-size {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 22rpx;
  font-size: 24rpx;
  color: $text-secondary;
}

.upd-size-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  background: $text-secondary;
}

/* ---------- 下载进度 ---------- */
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
  color: $text-body;
}

.upd-progress-pct {
  font-size: 30rpx;
  font-weight: 700;
  color: $color-primary;
  font-variant-numeric: tabular-nums;
}

.upd-progress-track {
  height: 14rpx;
  border-radius: 8rpx;
  background: $bg-toggle;
  overflow: hidden;
  box-shadow: inset 0 1rpx 2rpx var(--c-glass-shade, rgba(12, 58, 46, 0.06));
}

.upd-progress-fill {
  height: 100%;
  border-radius: 8rpx;
  background: $gradient-progress;
  box-shadow:
    0 2rpx 8rpx rgba(79, 199, 148, 0.35),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.55);
  transition: width 0.2s;
}

.upd-progress-bytes {
  display: block;
  margin-top: 10rpx;
  text-align: center;
  font-size: 22rpx;
  color: $text-secondary;
  font-variant-numeric: tabular-nums;
}

.upd-progress-tip {
  display: block;
  margin-top: 8rpx;
  text-align: center;
  font-size: 22rpx;
  color: $text-secondary;
}

/* ---------- 失败提示：半透明警示玻璃片 ---------- */
.upd-error {
  display: flex;
  align-items: flex-start;
  margin-top: 24rpx;
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background-color: var(--c-danger-soft-glass, rgba(223, 84, 63, 0.12));
  border: 1rpx solid rgba(223, 84, 63, 0.22);
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
  background: $color-danger;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.upd-error-text {
  flex: 1;
  font-size: 24rpx;
  color: $color-error-text;
  line-height: 1.5;
}

/* ---------- 强更内联提示 ---------- */
.upd-force-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: $color-error-text;
}

.upd-force-dot {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  margin-right: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--c-danger-soft-glass, rgba(223, 84, 63, 0.12));
  color: $color-error-text;
  font-size: 20rpx;
  font-weight: 700;
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
}

/* ---------- 按钮区：上方一条发丝线，主按钮玻璃渐变 + 次按钮玻璃片 ---------- */
.upd-actions {
  position: relative;
  margin-top: 30rpx;
  padding-top: 28rpx;
}

.upd-actions::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2rpx;
  pointer-events: none;
  /* 与引导头底部同一条玻璃棱线：上亮边 + 下暗边，浅深主题各取其一 */
  background-image:
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      var(--c-glass-hi, rgba(255, 255, 255, 0.9)) 18%,
      var(--c-glass-hi, rgba(255, 255, 255, 0.9)) 82%,
      rgba(255, 255, 255, 0) 100%
    ),
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      var(--c-divider-strong, #dbe1db) 18%,
      var(--c-divider-strong, #dbe1db) 82%,
      rgba(255, 255, 255, 0) 100%
    );
  background-size:
    100% 1rpx,
    100% 1rpx;
  background-position:
    0 0,
    0 100%;
  background-repeat: no-repeat;
}

.upd-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  margin: 0;
  padding: 0;
  border-radius: 26rpx;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  overflow: hidden;
  transition: transform 0.15s ease;

  &::after {
    border: none;
  }

  &:active {
    transform: scale(0.98);
  }
}

/* 次操作：内嵌玻璃片（浅色深字 / 深色浅字），按压走 --c-glass-hover */
.upd-text-btn {
  margin-top: 16rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 28rpx;
  color: $text-regular;
  border-radius: 24rpx;
  background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;

  &:active {
    background-color: var(--c-glass-hover, rgba(255, 255, 255, 0.44));
    transform: scale(0.985);
  }
}

.upd-text-btn--danger {
  color: $color-error-text;
}

/* 动画 */
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
