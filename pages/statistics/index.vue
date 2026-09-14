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
        <view
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
        <view v-for="(pay, index) in payStats" :key="pay.name" class="rank-row">
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
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";

// 金额格式化，避免浮点累加误差
const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// 分类元数据：图标 / 主题色 / 浅底色（与记账页分类保持一致）
const CATEGORY_META = {
  expense: {
    购物: { icon: "🛍️", color: "#ff8f1f", bg: "#fff3e6" },
    交通: { icon: "🚌", color: "#4a8cff", bg: "#eaf2ff" },
    娱乐: { icon: "🎬", color: "#a45dff", bg: "#f4ecff" },
    餐饮: { icon: "🍽️", color: "#ff6a3d", bg: "#ffefea" },
    住房: { icon: "🏠", color: "#22b573", bg: "#e8f8f1" },
    就医: { icon: "💊", color: "#f2484b", bg: "#ffecec" },
    教育: { icon: "📚", color: "#2ea8e6", bg: "#e8f6fd" },
    旅行: { icon: "✈️", color: "#14b8a6", bg: "#e6f7f5" },
  },
  income: {
    工资: { icon: "💵", color: "#f2484b", bg: "#ffecec" },
    退还款: { icon: "🔄", color: "#5b8ff9", bg: "#eaf2ff" },
    红包: { icon: "🧧", color: "#ff7a45", bg: "#fff0e8" },
    收益: { icon: "📈", color: "#34c759", bg: "#e9faf0" },
    礼金: { icon: "🎁", color: "#ffb020", bg: "#fff7e3" },
    佣金: { icon: "💰", color: "#b06be0", bg: "#f5edff" },
  },
};

const PAY_META = {
  微信支付: { short: "微", color: "#07c160", bg: "#e7f8ef" },
  支付宝: { short: "支", color: "#1677ff", bg: "#e8f2ff" },
  信用卡: { short: "信", color: "#ff7d00", bg: "#fff2e3" },
  储蓄卡: { short: "卡", color: "#5a6072", bg: "#eef0f5" },
  现金: { short: "现", color: "#f2994a", bg: "#fdf2e4" },
};

// 本月账单（mock 数据，与首页 / 流水页口径一致）
const bills = ref([
  {
    type: "expense",
    day: "09-01",
    category: "住房",
    amount: 2500,
    payMethod: "储蓄卡",
  },
  {
    type: "expense",
    day: "09-02",
    category: "餐饮",
    amount: 38.5,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-02",
    category: "交通",
    amount: 12,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-03",
    category: "购物",
    amount: 299,
    payMethod: "支付宝",
  },
  {
    type: "expense",
    day: "09-03",
    category: "餐饮",
    amount: 56,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-04",
    category: "娱乐",
    amount: 88,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-05",
    category: "交通",
    amount: 6,
    payMethod: "现金",
  },
  {
    type: "expense",
    day: "09-05",
    category: "餐饮",
    amount: 42.3,
    payMethod: "支付宝",
  },
  {
    type: "expense",
    day: "09-06",
    category: "购物",
    amount: 128.8,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-07",
    category: "旅行",
    amount: 1280,
    payMethod: "信用卡",
  },
  {
    type: "expense",
    day: "09-08",
    category: "餐饮",
    amount: 67,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-08",
    category: "教育",
    amount: 199,
    payMethod: "支付宝",
  },
  {
    type: "expense",
    day: "09-09",
    category: "交通",
    amount: 58,
    payMethod: "支付宝",
  },
  {
    type: "expense",
    day: "09-10",
    category: "购物",
    amount: 45.6,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-10",
    category: "餐饮",
    amount: 33.9,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-11",
    category: "娱乐",
    amount: 128,
    payMethod: "信用卡",
  },
  {
    type: "expense",
    day: "09-12",
    category: "就医",
    amount: 236.5,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-12",
    category: "餐饮",
    amount: 29.9,
    payMethod: "支付宝",
  },
  {
    type: "expense",
    day: "09-13",
    category: "交通",
    amount: 14,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-13",
    category: "购物",
    amount: 89.9,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-14",
    category: "餐饮",
    amount: 45.5,
    payMethod: "微信支付",
  },
  {
    type: "expense",
    day: "09-14",
    category: "交通",
    amount: 8,
    payMethod: "微信支付",
  },
  {
    type: "income",
    day: "09-01",
    category: "工资",
    amount: 8950,
    payMethod: "储蓄卡",
  },
  {
    type: "income",
    day: "09-03",
    category: "收益",
    amount: 8.66,
    payMethod: "支付宝",
  },
  {
    type: "income",
    day: "09-05",
    category: "红包",
    amount: 200,
    payMethod: "微信支付",
  },
  {
    type: "income",
    day: "09-08",
    category: "退还款",
    amount: 120,
    payMethod: "支付宝",
  },
  {
    type: "income",
    day: "09-10",
    category: "收益",
    amount: 12.88,
    payMethod: "支付宝",
  },
  {
    type: "income",
    day: "09-12",
    category: "佣金",
    amount: 500,
    payMethod: "支付宝",
  },
  {
    type: "income",
    day: "09-14",
    category: "收益",
    amount: 6.66,
    payMethod: "支付宝",
  },
]);

const billType = ref("expense");
const month = ref("2026-09");
const activeTrend = ref(5);

const monthText = computed(() => {
  const [y, m] = month.value.split("-");
  return `${y}年${Number(m)}月`;
});

const onMonthChange = e => {
  month.value = e.detail.value;
  activeTrend.value = 5;
};

const switchType = type => {
  billType.value = type;
};

// 收支汇总
const expenseBills = computed(() =>
  bills.value.filter(i => i.type === "expense"),
);
const totalExpense = computed(() =>
  expenseBills.value.reduce((s, i) => s + i.amount, 0),
);
const totalIncome = computed(() =>
  bills.value
    .filter(i => i.type === "income")
    .reduce((s, i) => s + i.amount, 0),
);
const currentTotal = computed(() =>
  billType.value === "expense" ? totalExpense.value : totalIncome.value,
);
const currentCount = computed(
  () => bills.value.filter(i => i.type === billType.value).length,
);
const balance = computed(() => totalIncome.value - totalExpense.value);
// 日均按当月已过天数计算
const dailyAverage = computed(() => {
  const elapsed = new Date().getDate() || 1;
  return currentTotal.value / elapsed;
});

// 分类聚合：金额 / 笔数 / 占比，按金额倒序
const categoryStats = computed(() => {
  const meta = CATEGORY_META[billType.value];
  const map = {};
  bills.value.forEach(i => {
    if (i.type !== billType.value) return;
    if (!map[i.category]) map[i.category] = { amount: 0, count: 0 };
    map[i.category].amount += i.amount;
    map[i.category].count += 1;
  });
  const total = Object.values(map).reduce((s, v) => s + v.amount, 0) || 1;
  return Object.keys(map)
    .map(name => ({
      name,
      amount: Math.round(map[name].amount * 100) / 100,
      count: map[name].count,
      percent: Math.round((map[name].amount / total) * 1000) / 10,
      ...meta[name],
    }))
    .sort((a, b) => b.amount - a.amount);
});

// 支付方式聚合（仅支出口径）
const payStats = computed(() => {
  const map = {};
  expenseBills.value.forEach(i => {
    if (!map[i.payMethod]) map[i.payMethod] = { amount: 0, count: 0 };
    map[i.payMethod].amount += i.amount;
    map[i.payMethod].count += 1;
  });
  const total = totalExpense.value || 1;
  return Object.keys(map)
    .map(name => ({
      name,
      amount: Math.round(map[name].amount * 100) / 100,
      count: map[name].count,
      percent: Math.round((map[name].amount / total) * 1000) / 10,
      ...PAY_META[name],
    }))
    .sort((a, b) => b.amount - a.amount);
});

// 近6个月趋势（最近5个月为 mock，当前月取实际汇总）
const PREV_EXPENSE = [5280, 6120, 4890, 7350, 5980];
const PREV_INCOME = [8700, 8950, 9200, 8950, 10300];

const trend = computed(() => {
  const [y, m] = month.value.split("-").map(Number);
  const list = [];
  for (let i = 5; i >= 1; i--) {
    const d = new Date(y, m - 1 - i, 1);
    list.push({
      label: `${d.getMonth() + 1}月`,
      expense: PREV_EXPENSE[5 - i],
      income: PREV_INCOME[5 - i],
    });
  }
  list.push({
    label: `${m}月`,
    expense: Math.round(totalExpense.value * 100) / 100,
    income: Math.round(totalIncome.value * 100) / 100,
  });
  return list;
});

const trendMax = computed(() =>
  trend.value.reduce((max, i) => Math.max(max, i.expense, i.income), 0),
);

const barHeight = v => Math.max(Math.round((v / trendMax.value) * 100), 2);

// 环比
const mom = computed(() => {
  const key = billType.value;
  const cur = trend.value[5][key];
  const prev = trend.value[4][key];
  const pct = ((cur - prev) / prev) * 100;
  return {
    up: pct >= 0,
    text: `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)}%`,
  };
});

onLoad(() => {});
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
</style>
