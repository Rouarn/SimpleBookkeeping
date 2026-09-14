<!--
  @file 统计页（pages/statistics/index.vue）
  @description 按月与收支类型展示账单分析：
               1. 顶部：标题、月份选择（picker 月份模式）与支出/收入切换；
               2. 概览卡片：当月支出（或收入）总额、较上月环比、对向金额、
                  记账笔数、日均（按当月已过天数）与结余，卡片配色随类型切换；
               3. 近 6 个月收支柱状趋势图（点击柱子查看数值，高度按 6 个月最大值归一化）；
               4. 分类排行：金额、笔数、占比与进度条；
               5. 支付方式分布（仅支出时展示）。
               月份与类型选择持久化在 app store，聚合数据全部由 bill store 实时计算。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
<template>
  <view class="statistics">
    <!-- 顶部标题 + 月份选择 -->
    <view class="top-bar">
      <text class="top-title">统计</text>
      <picker mode="date" fields="month" :value="month" @change="onMonthChange">
        <view class="month-pill">
          <text class="month-text">{{ monthText }}</text>
          <uni-icons type="bottom" size="14" color="#4a6ef7"></uni-icons>
        </view>
      </picker>
    </view>

    <!-- 收支切换 -->
    <view class="type-tabs">
      <view
        class="tab-item expense"
        :class="{ on: billType === 'expense' }"
        @click="switchType('expense')"
      >
        支出
      </view>
      <view
        class="tab-item income"
        :class="{ on: billType === 'income' }"
        @click="switchType('income')"
      >
        收入
      </view>
    </view>

    <!-- 本月概览卡片 -->
    <view class="overview-card" :class="billType">
      <view class="card-decor">
        <view class="decor-line"></view>
      </view>
      <view class="ov-top">
        <text class="ov-label">{{
          billType === "expense" ? "本月支出（元）" : "本月收入（元）"
        }}</text>
        <view class="ov-chip">
          <uni-icons
            :type="mom.up ? 'up' : 'down'"
            size="12"
            color="#ffffff"
          ></uni-icons>
          <text class="chip-text">较上月 {{ mom.text }}</text>
        </view>
      </view>
      <view class="ov-amount">{{ fmt(currentTotal) }}</view>

      <view class="ov-stats">
        <view class="ov-stat">
          <text class="stat-value">{{
            fmt(billType === "expense" ? totalIncome : totalExpense)
          }}</text>
          <text class="stat-label">{{
            billType === "expense" ? "本月收入（元）" : "本月支出（元）"
          }}</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-stat">
          <text class="stat-value">{{ currentCount }} 笔</text>
          <text class="stat-label">记账笔数</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-stat">
          <text class="stat-value">{{ fmt(dailyAverage) }}</text>
          <text class="stat-label">日均（元）</text>
        </view>
      </view>

      <view class="ov-balance">
        <text class="balance-label">结余（元）：</text>
        <text class="balance-value">{{ fmt(balance) }}</text>
      </view>
    </view>

    <!-- 近6个月收支趋势 -->
    <view class="panel">
      <view class="panel-header">
        <text class="panel-title">近6个月收支</text>
        <view class="legend">
          <view class="legend-dot expense-dot"></view>
          <text class="legend-text">支出</text>
          <view class="legend-dot income-dot"></view>
          <text class="legend-text">收入</text>
        </view>
      </view>

      <view class="chart">
        <view
          v-for="(item, index) in trend"
          :key="index"
          class="bar-group"
          @click="activeTrend = index"
        >
          <view class="bar-tip">
            <block v-if="activeTrend === index">
              <text class="tip-expense">支 {{ fmt(item.expense) }}</text>
              <text class="tip-income">收 {{ fmt(item.income) }}</text>
            </block>
          </view>
          <view class="bars">
            <view
              class="bar bar-expense"
              :class="{ active: activeTrend === index }"
              :style="{ height: barHeight(item.expense) + '%' }"
            ></view>
            <view
              class="bar bar-income"
              :class="{ active: activeTrend === index }"
              :style="{ height: barHeight(item.income) + '%' }"
            ></view>
          </view>
          <text class="bar-month" :class="{ on: activeTrend === index }">{{
            item.label
          }}</text>
        </view>
      </view>
    </view>

    <!-- 分类排行 -->
    <view class="panel">
      <view class="panel-header">
        <text class="panel-title">{{
          billType === "expense" ? "支出分类" : "收入分类"
        }}</text>
        <text class="panel-extra">共 {{ categoryStats.length }} 类</text>
      </view>

      <view class="rank-list">
        <view v-if="categoryStats.length === 0" class="empty-tip">
          <text class="empty-text"
            >暂无{{ billType === "expense" ? "支出" : "收入" }}数据</text
          >
        </view>
        <view
          v-else
          v-for="(cat, index) in categoryStats"
          :key="cat.name"
          class="rank-row"
        >
          <text class="rank-index" :class="{ top: index < 3 }">{{
            index + 1
          }}</text>
          <view class="cat-icon" :style="{ backgroundColor: cat.bg }">
            <text class="cat-emoji">{{ cat.icon }}</text>
          </view>
          <view class="rank-main">
            <view class="rank-line">
              <text class="rank-name">{{ cat.name }}</text>
              <text class="rank-amount">{{ fmt(cat.amount) }}</text>
            </view>
            <view class="rank-track">
              <view
                class="rank-fill"
                :style="{
                  width: cat.percent + '%',
                  backgroundColor: cat.color,
                }"
              ></view>
            </view>
            <view class="rank-line">
              <text class="rank-count">{{ cat.count }} 笔</text>
              <text class="rank-percent" :style="{ color: cat.color }"
                >{{ cat.percent.toFixed(1) }}%</text
              >
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 支付方式分布（仅支出） -->
    <view v-if="billType === 'expense'" class="panel">
      <view class="panel-header">
        <text class="panel-title">支付方式</text>
        <text class="panel-extra">共 {{ payStats.length }} 种</text>
      </view>

      <view class="rank-list">
        <view v-if="payStats.length === 0" class="empty-tip">
          <text class="empty-text">暂无支付方式数据</text>
        </view>
        <view
          v-else
          v-for="(pay, index) in payStats"
          :key="pay.name"
          class="rank-row"
        >
          <text class="rank-index" :class="{ top: index < 3 }">{{
            index + 1
          }}</text>
          <view
            class="pay-avatar"
            :style="{ backgroundColor: pay.bg, color: pay.color }"
          >
            {{ pay.short }}
          </view>
          <view class="rank-main">
            <view class="rank-line">
              <text class="rank-name">{{ pay.name }}</text>
              <text class="rank-amount">{{ fmt(pay.amount) }}</text>
            </view>
            <view class="rank-track">
              <view
                class="rank-fill pay-fill"
                :style="{
                  width: pay.percent + '%',
                  backgroundColor: pay.color,
                }"
              ></view>
            </view>
            <view class="rank-line">
              <text class="rank-count">{{ pay.count }} 笔</text>
              <text class="rank-percent" :style="{ color: pay.color }"
                >{{ pay.percent.toFixed(1) }}%</text
              >
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 统计页脚本模块
 * 模块说明：
 * - 选中月份 / 收支类型用可写 computed 双向绑定 app store（自动持久化）；
 * - 分类排行、支付方式排行、月汇总由 useStatisticsData 从 bill store 实时聚合；
 * - 近 6 个月趋势、柱状图归一化高度、环比百分比为本页基于月汇总二次派生。
 */
import { ref, computed } from "vue";
import { useAppStore, useBillStore } from "@/store";
import { useStatisticsData } from "@/composables/useBookkeeping";

/**
 * 金额格式化：四舍五入到两位小数并固定两位展示，避免浮点累加误差
 * @param {number|string} n 原始数值
 * @returns {string} 如 '1234.50'
 */
const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

const appStore = useAppStore();
const billStore = useBillStore();

// 月份 / 收支类型：双向绑定 app store（切换后持久化记忆）
const month = computed({
  get: () => appStore.ui.statsMonth,
  set: value => appStore.setStatsMonth(value),
});
const billType = computed({
  get: () => appStore.ui.statsType,
  set: value => appStore.setStatsType(value),
});

// 当前高亮查看的趋势柱下标（0-5，5 为选中月；默认即选中当月）
const activeTrend = ref(5);

// 分类排行 / 支付方式排行 / 月汇总全部由 bill store 实时聚合，
// 分类与支付方式的图标配色统一来自 category / book store
const { categoryStats, payStats, summary } = useStatisticsData(month, billType);

/** 月份中文展示，如 '2026年9月' */
const monthText = computed(() => {
  const [y, m] = month.value.split("-");
  return `${y}年${Number(m)}月`;
});

/**
 * 月份 picker 选中回调：更新月份并把趋势高亮重置为当月柱
 * @param {object} e e.detail.value 形如 '2026-09'
 */
const onMonthChange = e => {
  month.value = e.detail.value;
  activeTrend.value = 5;
};

/**
 * 切换支出 / 收入视图
 * @param {import('@/store/types').BillType} type
 */
const switchType = type => {
  billType.value = type;
};

// ---------- 概览卡片派生（数据源为 bill store 的月汇总） ----------
const totalExpense = computed(() => summary.value.expense);
const totalIncome = computed(() => summary.value.income);
/** 卡片主金额：跟随当前收支类型取支出或收入 */
const currentTotal = computed(() =>
  billType.value === "expense" ? totalExpense.value : totalIncome.value,
);
/** 当前类型的记账笔数 */
const currentCount = computed(() =>
  billType.value === "expense"
    ? summary.value.expenseCount
    : summary.value.incomeCount,
);
const balance = computed(() => summary.value.balance);
/** 日均支出/收入 = 当前总额 ÷ 当月已过天数（今天至少按 1 天，避免月初除零） */
const dailyAverage = computed(() => {
  const elapsed = new Date().getDate() || 1;
  return currentTotal.value / elapsed;
});

/**
 * 近 6 个月趋势：以选中月为第 6 项（下标 5），前 5 项逐月回退，
 * 每月从 bill store 取支出 / 收入汇总（无数据自然为 0）
 * @returns {Array<{label: string, expense: number, income: number}>}
 */
const trend = computed(() => {
  const [y, m] = month.value.split("-").map(Number);
  const list = [];
  for (let i = 5; i >= 1; i--) {
    // 借助 Date 自动处理跨年：月份传 0 基且允许负数偏移
    const d = new Date(y, m - 1 - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const s = billStore.monthSummary(monthStr);
    list.push({
      label: `${d.getMonth() + 1}月`,
      expense: s.expense,
      income: s.income,
    });
  }
  // 选中月直接用当前汇总，保证与卡片数字完全一致
  list.push({
    label: `${m}月`,
    expense: Math.round(totalExpense.value * 100) / 100,
    income: Math.round(totalIncome.value * 100) / 100,
  });
  return list;
});

/** 6 个月内支出 / 收入的全局最大值，作为柱状图高度归一化的分母 */
const trendMax = computed(() =>
  trend.value.reduce((max, i) => Math.max(max, i.expense, i.income), 0),
);

/**
 * 计算单根柱子的高度百分比
 * @param {number} v 该柱金额
 * @returns {number} 0-100 的高度百分比；无数据时给 2% 保底可见，最大值为 100
 */
const barHeight = v =>
  trendMax.value > 0 ? Math.max(Math.round((v / trendMax.value) * 100), 2) : 2;

/**
 * 选中月相对上月的环比（跟随当前收支类型）
 * 上月为 0 时不计算百分比：当月有值显示「新增」，均为 0 显示「—」
 * @returns {{up: boolean, text: string}} up 控制箭头方向，text 为展示文案
 */
const mom = computed(() => {
  const key = billType.value;
  const cur = trend.value[5][key]; // 选中月
  const prev = trend.value[4][key]; // 上月
  if (prev === 0) {
    return { up: cur > 0, text: cur > 0 ? "新增" : "—" };
  }
  const pct = ((cur - prev) / prev) * 100;
  return {
    up: pct >= 0,
    text: `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)}%`,
  };
});
</script>

<style lang="scss" scoped>
.statistics {
  width: 100%;
  min-height: 100vh;
  margin-top: var(--status-bar-height);
  background-color: #f4f5fd;
  padding-bottom: 180rpx;
  box-sizing: border-box;
}

// 顶部标题 + 月份选择
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;

  .top-title {
    font-size: 44rpx;
    font-weight: 700;
    color: #1d1d1f;
    letter-spacing: 2rpx;
  }

  .month-pill {
    display: flex;
    align-items: center;
    padding: 12rpx 24rpx;
    background-color: #eaf0ff;
    border-radius: 12rpx;

    .month-text {
      font-size: 28rpx;
      font-weight: 600;
      color: #4a6ef7;
      margin-right: 10rpx;
    }
  }
}

// 收支切换
.type-tabs {
  display: flex;
  margin: 8rpx 24rpx 24rpx;
  padding: 6rpx;
  background: #e7ebfa;
  border-radius: 999rpx;

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    font-size: 30rpx;
    font-weight: 600;
    color: #7b8198;
    border-radius: 999rpx;
    transition: all 0.25s ease;

    &.on {
      background: #ffffff;
      box-shadow: 0 6rpx 18rpx rgba(60, 100, 246, 0.16);

      &.expense {
        color: #4a6ef7;
      }
      &.income {
        color: #f0486a;
      }
    }
  }
}

// 概览卡片
.overview-card {
  position: relative;
  margin: 0 24rpx 24rpx;
  padding: 36rpx 32rpx 30rpx;
  border-radius: 28rpx;
  overflow: hidden;

  &.expense {
    background: linear-gradient(135deg, #4a6ef7 0%, #3c64f6 50%, #2e54e0 100%);
    box-shadow: 0 16rpx 48rpx rgba(60, 100, 246, 0.35);
  }

  &.income {
    background: linear-gradient(135deg, #ff7a93 0%, #ff5c7a 50%, #f0486a 100%);
    box-shadow: 0 16rpx 48rpx rgba(240, 72, 106, 0.32);
  }

  .card-decor {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    width: 220rpx;
    height: 120rpx;
    opacity: 0.4;
    z-index: 0;

    .decor-line {
      width: 100%;
      height: 100%;
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 100' preserveAspectRatio='none'><path d='M0,70 L25,55 L50,65 L75,40 L100,55 L125,30 L150,42 L180,20 L180,100 L0,100 Z' fill='none' stroke='white' stroke-width='2' stroke-opacity='0.5'/><path d='M0,70 L25,55 L50,65 L75,40 L100,55 L125,30 L150,42 L180,20' fill='none' stroke='white' stroke-width='2.5' stroke-opacity='0.8'/></svg>")
        no-repeat center / contain;
    }
  }

  .ov-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .ov-label {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.75);
      letter-spacing: 1rpx;
    }

    .ov-chip {
      display: flex;
      align-items: center;
      padding: 8rpx 18rpx;
      background: rgba(255, 255, 255, 0.18);
      border-radius: 999rpx;

      .chip-text {
        font-size: 22rpx;
        color: #ffffff;
        margin-left: 4rpx;
      }
    }
  }

  .ov-amount {
    position: relative;
    z-index: 1;
    font-size: 72rpx;
    font-weight: 700;
    color: #ffffff;
    margin-top: 10rpx;
    letter-spacing: 2rpx;
    line-height: 1.15;
  }

  .ov-stats {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    margin-top: 28rpx;

    .ov-stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-value {
        font-size: 32rpx;
        font-weight: 700;
        color: #ffffff;
      }

      .stat-label {
        margin-top: 10rpx;
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .ov-divider {
      width: 1rpx;
      height: 56rpx;
      background: rgba(255, 255, 255, 0.22);
    }
  }

  .ov-balance {
    position: relative;
    z-index: 1;
    margin-top: 26rpx;
    padding-top: 22rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.18);

    .balance-label {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.7);
    }
    .balance-value {
      font-size: 30rpx;
      font-weight: 600;
      color: #ffffff;
    }
  }
}

// 通用白色面板
.panel {
  margin: 0 24rpx 24rpx;
  padding: 32rpx 28rpx 28rpx;
  background: #ffffff;
  border-radius: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .panel-title {
      font-size: 32rpx;
      font-weight: 700;
      color: #1d1d1f;
      letter-spacing: 1rpx;
    }

    .panel-extra {
      font-size: 24rpx;
      color: #9aa0ad;
    }

    .legend {
      display: flex;
      align-items: center;

      .legend-dot {
        width: 16rpx;
        height: 16rpx;
        border-radius: 50%;
        margin: 0 8rpx 0 20rpx;

        &.expense-dot {
          background: #4a6ef7;
        }
        &.income-dot {
          background: #ff5c7a;
          margin-left: 0;
        }
      }

      .legend-text {
        font-size: 22rpx;
        color: #8a8f9c;
      }
    }
  }
}

// 柱状趋势图
.chart {
  display: flex;
  align-items: flex-end;
  margin-top: 24rpx;

  .bar-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .bar-tip {
    height: 64rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;

    .tip-expense,
    .tip-income {
      font-size: 16rpx;
      line-height: 1.5;
    }
    .tip-expense {
      color: #4a6ef7;
    }
    .tip-income {
      color: #f0486a;
    }
  }

  .bars {
    height: 300rpx;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 8rpx;

    .bar {
      width: 20rpx;
      border-radius: 10rpx 10rpx 4rpx 4rpx;
      opacity: 0.45;
      transition:
        height 0.3s ease,
        opacity 0.2s ease;

      &.active {
        opacity: 1;
      }
    }

    .bar-expense {
      background: linear-gradient(180deg, #6d8bff 0%, #4a6ef7 100%);
    }
    .bar-income {
      background: linear-gradient(180deg, #ff94a8 0%, #f0486a 100%);
    }
  }

  .bar-month {
    margin-top: 14rpx;
    font-size: 22rpx;
    color: #8a8f9c;

    &.on {
      color: #4a6ef7;
      font-weight: 700;
    }
  }
}

// 排行列表（分类 / 支付方式）
.rank-list {
  margin-top: 8rpx;

  .rank-row {
    display: flex;
    align-items: center;
    padding: 28rpx 0;
    border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);

    &:last-child {
      border-bottom: none;
    }
  }

  .rank-index {
    width: 40rpx;
    text-align: center;
    font-size: 26rpx;
    font-weight: 700;
    color: #b4bac6;
    flex-shrink: 0;

    &.top {
      color: #ff8f1f;
    }
  }

  .cat-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 20rpx 0 12rpx;
    flex-shrink: 0;

    .cat-emoji {
      font-size: 38rpx;
    }
  }

  .pay-avatar {
    width: 76rpx;
    height: 76rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 20rpx 0 12rpx;
    font-size: 34rpx;
    font-weight: 700;
    flex-shrink: 0;
  }

  .rank-main {
    flex: 1;
    min-width: 0;

    .rank-line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .rank-name {
        font-size: 30rpx;
        font-weight: 600;
        color: #1d1d1f;
      }

      .rank-amount {
        font-size: 30rpx;
        font-weight: 700;
        color: #1d1d1f;
      }

      .rank-count {
        font-size: 22rpx;
        color: #9aa0ad;
      }

      .rank-percent {
        font-size: 24rpx;
        font-weight: 700;
      }
    }

    .rank-track {
      height: 12rpx;
      margin: 14rpx 0 10rpx;
      background: #f1f2f7;
      border-radius: 8rpx;
      overflow: hidden;

      .rank-fill {
        height: 100%;
        border-radius: 8rpx;
        transition: width 0.3s ease;
      }
    }
  }
}

.empty-tip {
  padding: 80rpx 0;
  text-align: center;

  .empty-text {
    font-size: 28rpx;
    color: #8a8f9c;
  }
}
</style>
