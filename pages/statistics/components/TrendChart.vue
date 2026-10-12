<!--
  @file 收支趋势柱状图（pages/statistics/components/TrendChart.vue）
  @description 统计页趋势面板（自 pages/statistics/index.vue 拆分，纯展示 + 交互上抛）：
               月视图近 6 个月、年视图所选年份 12 个月；年视图 12 柱错峰动画
               （每柱延后 30ms）；高亮柱下标 activeIndex 由父组件控制，
               点柱 / 点「查看该月」分别上抛 bar-tap / jump，由父组件决策。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：面板底色收敛至主题 token，收入红调亮一档
-->
<template>
  <view class="panel">
    <view class="panel-header">
      <text class="panel-title">{{ title }}</text>
      <view class="legend">
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
        class="bar-group"
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
          <view
            class="bar bar-expense"
            :class="{ active: activeIndex === index }"
            :style="{
              height: barHeight(item.expense) + '%',
              // 年视图 12 柱错峰动画（每柱延后 30ms）；月视图 6 柱不延迟
              transitionDelay: (isYear ? index * 30 : 0) + 'ms',
            }"
          ></view>
          <view
            class="bar bar-income"
            :class="{ active: activeIndex === index }"
            :style="{
              height: barHeight(item.income) + '%',
              transitionDelay: (isYear ? index * 30 : 0) + 'ms',
            }"
          ></view>
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
// 通用白色面板
.panel {
  margin: 0 24rpx 24rpx;
  padding: 30rpx 28rpx 26rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .panel-title {
      font-size: 31rpx;
      font-weight: 600;
      color: $text-title;
    }

    .legend {
      display: flex;
      align-items: center;

      .legend-dot {
        width: 14rpx;
        height: 14rpx;
        border-radius: 50%;
        margin: 0 7rpx 0 18rpx;

        &.expense-dot {
          background: $color-primary-mid;
        }
        &.income-dot {
          background: $color-income;
          margin-left: 0;
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
    display: flex;
    flex-direction: column;
    align-items: center;

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

    .bar {
      width: 22rpx;
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

    &.on {
      color: $color-primary-deep;
      font-weight: 700;
    }
  }
}
</style>
