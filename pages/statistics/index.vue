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
  @modify 2026-09-15
-->
<template>
  <view class="statistics">
    <!-- 顶部标题 + 月份选择 -->
    <view class="top-bar">
      <text class="top-title">统计</text>
      <picker mode="date" fields="month" :value="month" @change="onMonthChange">
        <view class="month-pill">
          <text class="month-text">{{ monthText }}</text>
          <uni-icons type="bottom" size="14" color="#2f6b54"></uni-icons>
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
        <view class="decor-ring r1"></view>
        <view class="decor-ring r2"></view>
        <view class="decor-ring r3"></view>
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
  background: #f3f5f2;
  padding-bottom: 180rpx;
  box-sizing: border-box;
}

// 顶部标题 + 月份选择
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 20rpx;

  .top-title {
    font-size: 42rpx;
    font-weight: 700;
    color: #1e2521;
    letter-spacing: 1rpx;
  }

  .month-pill {
    display: flex;
    align-items: center;
    padding: 11rpx 22rpx;
    background: #fff;
    border-radius: 999rpx;
    box-shadow: 0 4rpx 16rpx rgba(28, 54, 45, 0.07);

    .month-text {
      font-size: 25rpx;
      font-weight: 600;
      color: #2f6b54;
      margin-right: 8rpx;
    }
  }
}

// 收支切换
.type-tabs {
  display: flex;
  margin: 8rpx 24rpx 26rpx;
  padding: 6rpx;
  background: #e4eae4;
  border-radius: 999rpx;

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 15rpx 0;
    font-size: 28rpx;
    font-weight: 600;
    color: #767e78;
    border-radius: 999rpx;
    transition: all 0.25s ease;

    &.on {
      background: #ffffff;
      box-shadow: 0 5rpx 16rpx rgba(28, 54, 45, 0.1);

      &.expense {
        color: #175142;
      }
      &.income {
        color: #c04a36;
      }
    }
  }
}

// 概览卡片
.overview-card {
  position: relative;
  margin: 0 24rpx 24rpx;
  padding: 34rpx 30rpx 28rpx;
  border-radius: 28rpx;
  overflow: hidden;

  &.expense {
    background: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
    box-shadow: 0 16rpx 40rpx rgba(12, 58, 46, 0.28);
  }

  &.income {
    background: linear-gradient(150deg, #b5523e 0%, #913527 100%);
    box-shadow: 0 16rpx 40rpx rgba(145, 53, 39, 0.26);
  }

  // 同心圆环暗纹
  .card-decor {
    position: absolute;
    top: -100rpx;
    right: -80rpx;
    width: 270rpx;
    height: 270rpx;
    pointer-events: none;

    .decor-ring {
      position: absolute;
      top: 50%;
      left: 50%;
      border-radius: 50%;
      border: 2rpx solid rgba(255, 255, 255, 0.08);
      transform: translate(-50%, -50%);
    }
    .r1 {
      width: 270rpx;
      height: 270rpx;
    }
    .r2 {
      width: 186rpx;
      height: 186rpx;
      border-color: rgba(255, 255, 255, 0.11);
    }
    .r3 {
      width: 102rpx;
      height: 102rpx;
      border-color: rgba(255, 255, 255, 0.15);
    }
  }

  .ov-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .ov-label {
      font-size: 24rpx;
      color: rgba(237, 245, 240, 0.6);
    }

    .ov-chip {
      display: flex;
      align-items: center;
      padding: 7rpx 16rpx;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 999rpx;

      .chip-text {
        font-size: 21rpx;
        color: rgba(255, 255, 255, 0.92);
        margin-left: 4rpx;
      }
    }
  }

  .ov-amount {
    position: relative;
    z-index: 1;
    margin-top: 10rpx;
    font-size: 68rpx;
    font-weight: 700;
    color: #f1f7f3;
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
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-value {
        font-size: 30rpx;
        font-weight: 700;
        color: #f1f7f3;
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        margin-top: 9rpx;
        font-size: 21rpx;
        color: rgba(237, 245, 240, 0.55);
      }
    }

    .ov-divider {
      width: 1rpx;
      height: 52rpx;
      background: rgba(255, 255, 255, 0.16);
    }
  }

  .ov-balance {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24rpx;
    padding: 16rpx 22rpx;
    border-radius: 14rpx;
    background: rgba(255, 255, 255, 0.07);

    .balance-label {
      font-size: 23rpx;
      color: rgba(237, 245, 240, 0.55);
    }
    .balance-value {
      font-size: 28rpx;
      font-weight: 600;
      color: #f1f7f3;
      font-variant-numeric: tabular-nums;
    }
  }
}

// 通用白色面板
.panel {
  margin: 0 24rpx 24rpx;
  padding: 30rpx 28rpx 26rpx;
  background: #ffffff;
  border-radius: 26rpx;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .panel-title {
      font-size: 31rpx;
      font-weight: 600;
      color: #1e2521;
    }

    .panel-extra {
      font-size: 22rpx;
      color: #98a099;
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
          background: #2f6b54;
        }
        &.income-dot {
          background: #c04a36;
          margin-left: 0;
        }
      }

      .legend-text {
        font-size: 21rpx;
        color: #98a099;
      }
    }
  }
}

// 柱状趋势图
.chart {
  display: flex;
  align-items: flex-end;
  margin-top: 26rpx;

  .bar-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .bar-tip {
    height: 60rpx;
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
      color: #2f6b54;
    }
    .tip-income {
      color: #c04a36;
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
      background: linear-gradient(180deg, #4fc794 0%, #2f6b54 100%);
    }
    .bar-income {
      background: linear-gradient(180deg, #d97a66 0%, #b5523e 100%);
    }
  }

  .bar-month {
    margin-top: 12rpx;
    font-size: 21rpx;
    color: #98a099;

    &.on {
      color: #175142;
      font-weight: 700;
    }
  }
}

// 排行列表（分类 / 支付方式）
.rank-list {
  margin-top: 6rpx;

  .rank-row {
    display: flex;
    align-items: center;
    padding: 26rpx 0;
    border-bottom: 1rpx solid #edf0ec;

    &:last-child {
      border-bottom: none;
    }
  }

  .rank-index {
    width: 38rpx;
    text-align: center;
    font-size: 25rpx;
    font-weight: 700;
    color: #b9bfb9;
    flex-shrink: 0;

    &.top {
      color: #c08a3e;
    }
  }

  .cat-icon {
    width: 74rpx;
    height: 74rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 18rpx 0 12rpx;
    flex-shrink: 0;

    .cat-emoji {
      font-size: 36rpx;
    }
  }

  .pay-avatar {
    width: 74rpx;
    height: 74rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 18rpx 0 12rpx;
    font-size: 32rpx;
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
        font-size: 28rpx;
        font-weight: 500;
        color: #202622;
      }

      .rank-amount {
        font-size: 29rpx;
        font-weight: 700;
        color: #222924;
        font-variant-numeric: tabular-nums;
      }

      .rank-count {
        font-size: 21rpx;
        color: #98a099;
      }

      .rank-percent {
        font-size: 23rpx;
        font-weight: 700;
      }
    }

    .rank-track {
      height: 10rpx;
      margin: 13rpx 0 9rpx;
      background: #edf1ed;
      border-radius: 999rpx;
      overflow: hidden;

      .rank-fill {
        height: 100%;
        border-radius: 999rpx;
        transition: width 0.3s ease;
      }
    }
  }
}

// 空数据
.empty-tip {
  padding: 72rpx 0;
  text-align: center;

  .empty-text {
    font-size: 27rpx;
    color: #8b938d;
  }
}
</style>
