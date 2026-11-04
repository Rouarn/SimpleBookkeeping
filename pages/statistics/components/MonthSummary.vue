<!--
  @file 本期概览卡（pages/statistics/components/MonthSummary.vue）
  @description 统计页概览卡片（自 pages/statistics/index.vue 拆分，纯展示组件）：
               当期支出（或收入）总额、环比胶囊、对向金额、记账笔数、
               日均 / 月均与结余；加载失败时展示错误态，点击整块触发 retry。
               卡片配色随 billType 切换；环比胶囊由父组件按 mom.hasData 决定显隐。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：错误态卡底色收敛至主题 token（概览卡渐变与白字保持）
  @modify 2026-11-04 Liquid Glass 重构：品牌渐变卡改为玻璃面（.g-glass），
                右上角保留一层随收支类型切换的极淡色晕 + 同心圆环暗纹；
                文字改回主题 token（浅色深墨 / 深色调亮），环比胶囊改为压深玻璃片。
-->
<template>
  <!-- 概览加载失败错误态（点击整块重试，配色沿用空态文案体系） -->
  <view
    v-if="error"
    class="overview-error g-glass g-press"
    @click="emit('retry')"
  >
    <text class="oe-text">概览加载失败，点击重试</text>
  </view>
  <view v-else class="overview-card g-glass" :class="billType">
    <!-- 品牌色晕染：玻璃面上的一层极淡色相，随收支类型切换 -->
    <view class="card-glow"></view>
    <DecorRing class="card-decor" :size="270" :middle="186" :inner="102" />
    <view class="ov-top">
      <text class="ov-label">{{
        scopeText + (billType === 'expense' ? '支出（元）' : '收入（元）')
      }}</text>
      <!-- 无对比基期（服务端 mom.percent 为 null）时隐藏整个环比胶囊 -->
      <view v-if="mom.hasData" class="ov-chip">
        <uni-icons
          :type="mom.up ? 'up' : 'down'"
          size="12"
          color="#ffffff"
        ></uni-icons>
        <text class="chip-text"
          >较{{ isYear ? '去年' : '上月' }} {{ mom.text }}</text
        >
      </view>
    </view>
    <view class="ov-amount">{{ fmt(currentTotal) }}</view>

    <view class="ov-stats">
      <view class="ov-stat">
        <text class="stat-value">{{ fmt(oppositeTotal) }}</text>
        <text class="stat-label">{{
          scopeText + (billType === 'expense' ? '收入（元）' : '支出（元）')
        }}</text>
      </view>
      <view class="ov-divider"></view>
      <view class="ov-stat">
        <text class="stat-value">{{ count }} 笔</text>
        <text class="stat-label">记账笔数</text>
      </view>
      <view class="ov-divider"></view>
      <view class="ov-stat">
        <text class="stat-value">{{ fmt(avg) }}</text>
        <text class="stat-label">{{
          isYear ? '月均（元）' : '日均（元）'
        }}</text>
      </view>
    </view>

    <view class="ov-balance">
      <text class="balance-label">结余（元）：</text>
      <text class="balance-value">{{ fmt(balance) }}</text>
    </view>
  </view>
</template>

<script setup>
/**
 * 本期概览卡：props 下数据、emits 上交互；金额格式化统一走 utils/rmb。
 * 对向金额：billType=expense 时展示当期收入，billType=income 时展示当期支出。
 */
import { formatMoney } from '@/utils/rmb'

const fmt = formatMoney

defineProps({
  /** 概览接口是否失败（true 时展示错误态） */
  error: { type: Boolean, default: false },
  /** 收支类型：'expense' | 'income'（决定卡片配色与文案） */
  billType: { type: String, default: 'expense' },
  /** 是否年视图（决定环比基期文案与均值标签） */
  isYear: { type: Boolean, default: false },
  /** 范围前缀文案：'本月' | '本年' */
  scopeText: { type: String, default: '本月' },
  /** 环比信息 { up, text, hasData }，hasData=false 时隐藏胶囊 */
  mom: { type: Object, default: () => ({}) },
  /** 当前类型的总额（卡片主金额） */
  currentTotal: { type: Number, default: 0 },
  /** 对向金额（expense 视角下为收入，income 视角下为支出） */
  oppositeTotal: { type: Number, default: 0 },
  /** 记账笔数 */
  count: { type: Number, default: 0 },
  /** 日均（月视图）/ 月均（年视图） */
  avg: { type: Number, default: 0 },
  /** 结余 */
  balance: { type: Number, default: 0 },
})

const emit = defineEmits([
  /** 错误态点击重试 */
  'retry',
])
</script>

<style lang="scss" scoped>
// 概览加载失败错误态（点击整块重试，玻璃薄卡）
.overview-error {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 24rpx 24rpx;
  padding: 72rpx 0;
  border-radius: 40rpx;

  .oe-text {
    font-size: 27rpx;
    color: $text-placeholder;
  }
}

// 概览卡片：玻璃面（折射壁纸）+ 品牌色晕染 + 同心圆环暗纹
.overview-card {
  margin: 0 24rpx 24rpx;
  padding: 34rpx 30rpx 28rpx;
  border-radius: $glass-radius-lg;
  overflow: hidden;
  box-shadow:
    $glass-shadow,
    inset 0 1rpx 0 $glass-highlight,
    inset 0 -1rpx 0 $glass-shade;

  // 右上角色晕：给玻璃加一层「有颜色但透光」的品牌感（不遮挡壁纸）
  .card-glow {
    position: absolute;
    top: -150rpx;
    right: -120rpx;
    width: 440rpx;
    height: 440rpx;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(
      circle at 50% 50%,
      rgba(79, 199, 148, 0.3) 0%,
      rgba(79, 199, 148, 0) 68%
    );
  }

  &.income .card-glow {
    background: radial-gradient(
      circle at 50% 50%,
      rgba(217, 122, 102, 0.28) 0%,
      rgba(217, 122, 102, 0) 68%
    );
  }

  // 同心圆环暗纹（DecorRing 组件根节点，环体样式内聚在组件内）
  .card-decor {
    position: absolute;
    top: -100rpx;
    right: -80rpx;
    width: 270rpx;
    height: 270rpx;
    pointer-events: none;
  }

  .ov-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .ov-label {
      font-size: 24rpx;
      color: $text-regular;
    }

    // 环比胶囊：压深玻璃片（白字 + 白色箭头在深浅两套主题下都成立）
    .ov-chip {
      display: flex;
      align-items: center;
      padding: 7rpx 16rpx;
      border-radius: 999rpx;
      background: rgba(12, 58, 46, 0.58);
      box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.28);

      .chip-text {
        font-size: 21rpx;
        color: rgba(255, 255, 255, 0.92);
        margin-left: 4rpx;
      }
    }
  }

  // 收入视角下胶囊换陶土色压深玻璃（白字依旧可读）
  &.income .ov-chip {
    background: rgba(145, 53, 39, 0.58);
  }

  .ov-amount {
    position: relative;
    z-index: 1;
    margin-top: 10rpx;
    font-size: 68rpx;
    font-weight: 700;
    color: $text-title;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }

  .ov-stats {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    margin-top: 28rpx;

    .ov-stat {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-value {
        font-size: 30rpx;
        font-weight: 700;
        color: $text-strong;
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        margin-top: 9rpx;
        font-size: 21rpx;
        color: $text-secondary;
      }
    }

    .ov-divider {
      width: 1rpx;
      height: 52rpx;
      background: $divider;
    }
  }

  // 结余行：玻璃卡内的一块凹陷分区
  .ov-balance {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24rpx;
    padding: 16rpx 22rpx;
    border-radius: 18rpx;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

    .balance-label {
      font-size: 23rpx;
      color: $text-secondary;
    }
    .balance-value {
      font-size: 28rpx;
      font-weight: 600;
      color: $text-strong;
      font-variant-numeric: tabular-nums;
    }
  }
}
</style>
