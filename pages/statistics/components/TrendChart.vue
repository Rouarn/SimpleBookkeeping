<!--
  @file 收支趋势柱状图（pages/statistics/components/TrendChart.vue）
  @description 统计页趋势面板（自 pages/statistics/index.vue 拆分，纯展示 + 交互上抛）：
               月视图近 6 个月、年视图所选年份 12 个月；年视图 12 柱错峰动画
               （每柱延后 30ms）；高亮柱下标 activeIndex 由父组件控制，
               点柱 / 点「查看该月」分别上抛 bar-tap / jump，由父组件决策。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：面板底色收敛至主题 token，收入红调亮一档
  @modify 2026-11-04 Liquid Glass 重构：面板改玻璃卡（.g-glass），图例改玻璃胶囊；
                每根柱子加玻璃凹陷轨道（--c-glass-inner + 顶部内高光），
                柱体渐变（$gradient-bar-expense/income）原样保留。
-->
<template>
  <view class="panel g-glass">
    <view class="panel-header">
      <text class="panel-title">{{ title }}</text>
      <view class="legend g-pill">
        <view class="legend-dot expense-dot"></view>
        <text class="legend-text">支出</text>
        <view class="legend-dot income-dot"></view>
        <text class="legend-text">收入</text>
      </view>
    </view>
    <text v-if="isYear" class="chart-hint"
      >点击柱子查看金额，再次点击可切换到该月单月统计</text
    >

    <view class="chart">
      <view
        v-for="(item, index) in trend"
        :key="item.month"
        class="bar-group g-press"
        :class="{ cur: activeIndex === index }"
        @click="emit('bar-tap', index)"
      >
        <view class="bar-tip">
          <block v-if="activeIndex === index">
            <text class="tip-expense">支 {{ fmt(item.expense) }}</text>
            <text class="tip-income">收 {{ fmt(item.income) }}</text>
            <text
              v-if="isYear"
              class="tip-link"
              @click.stop="emit('jump', index)"
              >查看该月 →</text
            >
          </block>
        </view>
        <view class="bars">
          <view class="bar-track">
            <view
              class="bar bar-expense"
              :class="{ active: activeIndex === index }"
              :style="{
                height: barHeight(item.expense) + '%',
                // 年视图 12 柱错峰动画（每柱延后 30ms）；月视图 6 柱不延迟
                transitionDelay: (isYear ? index * 30 : 0) + 'ms',
              }"
            ></view>
          </view>
          <view class="bar-track">
            <view
              class="bar bar-income"
              :class="{ active: activeIndex === index }"
              :style="{
                height: barHeight(item.income) + '%',
                transitionDelay: (isYear ? index * 30 : 0) + 'ms',
              }"
            ></view>
          </view>
        </view>
        <text class="bar-month" :class="{ on: activeIndex === index }">{{
          isYear ? index + 1 : item.label
        }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 趋势柱状图：柱高按当期支出 / 收入全局最大值归一化；金额格式化走 utils/rmb。
 */
import { computed } from 'vue'
import { formatMoney } from '@/utils/rmb'

const fmt = formatMoney

const props = defineProps({
  /** 面板标题（月视图「近6个月收支」/ 年视图「YYYY年收支」） */
  title: { type: String, default: '' },
  /** 趋势数据 [{ month, label, expense, income }] */
  trend: { type: Array, default: () => [] },
  /** 是否年视图（12 柱 + 错峰动画 + 月份纯数字下标） */
  isYear: { type: Boolean, default: false },
  /** 当前高亮柱下标（由父组件控制） */
  activeIndex: { type: Number, default: -1 },
})

const emit = defineEmits([
  /** 点击柱子（首次显示金额 / 再点同月切换，由父组件决策） */
  'bar-tap',
  /** 年视图点「查看该月」跳转单月 */
  'jump',
])

/** 趋势周期内支出 / 收入的全局最大值，作为柱状图高度归一化的分母 */
const trendMax = computed(() =>
  props.trend.reduce((max, i) => Math.max(max, i.expense, i.income), 0),
)
/** 单根柱子高度百分比 */
const barHeight = (v) =>
  trendMax.value > 0 ? Math.max(Math.round((v / trendMax.value) * 100), 2) : 2
</script>

<style lang="scss" scoped>
// 通用玻璃面板
.panel {
  margin: 0 24rpx 24rpx;
  padding: 30rpx 28rpx 26rpx;
  border-radius: 40rpx;

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .panel-title {
      font-size: 31rpx;
      font-weight: 600;
      color: $text-title;
    }

    // 图例：玻璃胶囊（内凹底 + 顶部内高光）
    .legend {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding: 4rpx 14rpx 4rpx 10rpx;
      background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
      box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

      .legend-dot {
        width: 14rpx;
        height: 14rpx;
        border-radius: 50%;
        flex-shrink: 0;

        &.expense-dot {
          background: $color-primary-mid;
          margin-right: 7rpx;
        }
        &.income-dot {
          background: $color-income;
          margin: 0 7rpx 0 16rpx;
        }
      }

      .legend-text {
        font-size: 21rpx;
        color: $text-secondary;
      }
    }
  }

  .chart-hint {
    display: block;
    margin-top: 10rpx;
    font-size: 21rpx;
    color: $text-secondary;
  }
}

// 柱状趋势图
.chart {
  display: flex;
  align-items: flex-end;
  margin-top: 26rpx;

  .bar-group {
    position: relative;
    flex: 1;
    /* 年视图 12 列时，浮层金额文字不得撑开列宽（min-content 会顶破面板） */
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 20rpx;

    // 高亮柱的浮层不被相邻柱遮挡（年视图 12 组更拥挤）
    &.cur {
      z-index: 2;
    }
  }

  .bar-tip {
    height: 96rpx;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;

    .tip-expense,
    .tip-income,
    .tip-link {
      // 年视图 12 组柱子每列仅约 53rpx，禁止 text 内部折行（金额/箭头被挤到下一行）
      white-space: nowrap;
      font-size: 16rpx;
      line-height: 1.5;
    }
    .tip-expense {
      color: $color-primary-mid;
    }
    .tip-income {
      color: $color-income;
    }
    .tip-link {
      font-size: 18rpx;
      font-weight: 700;
      color: $color-primary-deep;
    }
  }

  .bars {
    height: 280rpx;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 8rpx;

    // 柱子的玻璃凹陷轨道：内凹底 + 顶部内高光（柱体仍用品牌渐变）
    .bar-track {
      width: 22rpx;
      height: 100%;
      display: flex;
      align-items: flex-end;
      border-radius: 999rpx 999rpx 6rpx 6rpx;
      /* 轨道只做极淡的“量尺”底，不能盖过柱体 */
      background: rgba(255, 255, 255, 0.14);
      box-shadow:
        inset 0 0 0 1rpx rgba(255, 255, 255, 0.28),
        inset 0 -2rpx 6rpx rgba(12, 58, 46, 0.05);
      overflow: hidden;
    }

    .bar {
      width: 100%;
      border-radius: 999rpx 999rpx 6rpx 6rpx;
      opacity: 0.38;
      transition:
        height 0.3s ease,
        opacity 0.2s ease;

      &.active {
        opacity: 1;
      }
    }

    .bar-expense {
      background: $gradient-bar-expense;
    }
    .bar-income {
      background: $gradient-bar-income;
    }
  }

  .bar-month {
    margin-top: 12rpx;
    font-size: 21rpx;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;

    &.on {
      color: $color-primary-deep;
      font-weight: 700;
    }
  }
}
</style>
