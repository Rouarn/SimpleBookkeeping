<!--
  @file 统计页（pages/statistics/index.vue）
  @description 支持单月与整年两种时间粒度的账单分析：
               1. 顶部：标题、月/年粒度切换、月份（或年份）picker 与支出/收入切换；
               2. 概览卡片：当期支出（或收入）总额、较上月/较去年环比、对向金额、
                  记账笔数、日均（月视图）或月均（年视图）与结余，卡片配色随类型切换；
               3. 收支趋势柱状图：月视图为近 6 个月，年视图为所选年份 12 个月，
                  年视图点击柱子显示金额，再次点击（或点「查看该月」）智能切换到该月单月视图；
               4. 分类排行：金额、笔数、占比与进度条；
               5. 支付方式分布（仅支出时展示）。
               粒度 / 月份 / 年份与类型选择持久化在 app store，聚合数据全部由接口实时计算。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-20
-->
<template>
  <view class="statistics">
    <!-- 顶部标题 + 粒度切换 + 月份/年份选择 -->
    <view class="top-bar">
      <text class="top-title">统计</text>
      <view class="top-actions">
        <view class="scope-toggle">
          <text
            class="scope-item"
            :class="{ on: !isYear }"
            @click="switchScope('month')"
            >月</text
          >
          <text
            class="scope-item"
            :class="{ on: isYear }"
            @click="switchScope('year')"
            >年</text
          >
        </view>
        <picker
          mode="date"
          :fields="isYear ? 'year' : 'month'"
          :value="pickerValue"
          @change="onPeriodChange"
        >
          <view class="month-pill">
            <text class="month-text">{{ periodText }}</text>
            <uni-icons type="bottom" size="14" color="#2f6b54"></uni-icons>
          </view>
        </picker>
      </view>
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

    <!-- 本期概览卡片 -->
    <view class="overview-card" :class="billType">
      <view class="card-decor">
        <view class="decor-ring r1"></view>
        <view class="decor-ring r2"></view>
        <view class="decor-ring r3"></view>
      </view>
      <view class="ov-top">
        <text class="ov-label">{{
          scopeText + (billType === "expense" ? "支出（元）" : "收入（元）")
        }}</text>
        <view class="ov-chip">
          <uni-icons
            :type="mom.up ? 'up' : 'down'"
            size="12"
            color="#ffffff"
          ></uni-icons>
          <text class="chip-text"
            >较{{ isYear ? "去年" : "上月" }} {{ mom.text }}</text
          >
        </view>
      </view>
      <view class="ov-amount">{{ fmt(currentTotal) }}</view>

      <view class="ov-stats">
        <view class="ov-stat">
          <text class="stat-value">{{
            fmt(billType === "expense" ? totalIncome : totalExpense)
          }}</text>
          <text class="stat-label">{{
            scopeText + (billType === "expense" ? "收入（元）" : "支出（元）")
          }}</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-stat">
          <text class="stat-value">{{ currentCount }} 笔</text>
          <text class="stat-label">记账笔数</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-stat">
          <text class="stat-value">{{ fmt(avgValue) }}</text>
          <text class="stat-label">{{
            isYear ? "月均（元）" : "日均（元）"
          }}</text>
        </view>
      </view>

      <view class="ov-balance">
        <text class="balance-label">结余（元）：</text>
        <text class="balance-value">{{ fmt(balance) }}</text>
      </view>
    </view>

    <!-- 收支趋势：月视图近6个月 / 年视图全年12个月 -->
    <view class="panel">
      <view class="panel-header">
        <text class="panel-title">{{ trendTitle }}</text>
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
          :class="{ cur: activeTrend === index }"
          @click="onTrendTap(index)"
        >
          <view class="bar-tip">
            <block v-if="activeTrend === index">
              <text class="tip-expense">支 {{ fmt(item.expense) }}</text>
              <text class="tip-income">收 {{ fmt(item.income) }}</text>
              <text
                v-if="isYear"
                class="tip-link"
                @click.stop="jumpToMonth(index)"
                >查看该月 →</text
              >
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
            isYear ? index + 1 : item.label
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
 * - 时间粒度（月/年）、月份、年份、收支类型均用可写 computed 双向绑定 app store（自动持久化）；
 * - 概览 / 分类排行 / 支付方式排行由 useStatisticsData 按 period（month 或 year 二选一）调接口；
 * - 趋势图月维度调 GET /statistics/trend?months=6，年维度调 ?year=YYYY 返回全年 12 个月；
 * - 年视图点击柱子显示金额，再次点击同柱（或点「查看该月」）智能切换到该月单月视图；
 * - 环比文案直接使用服务端 overview.mom.text / mom.up（月比上月、年比去年）。
 */
import { ref, computed, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useAppStore } from "@/store";
import { useStatisticsData, useTrendData } from "@/composables/useBookkeeping";

/**
 * 金额格式化：四舍五入到两位小数并固定两位展示
 * @param {number|string} n
 * @returns {string}
 */
const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

const appStore = useAppStore();

// 粒度 / 月份 / 年份 / 收支类型：双向绑定 app store（切换后持久化记忆）
const scope = computed({
  get: () => appStore.ui.statsScope,
  set: value => appStore.setStatsScope(value),
});
const month = computed({
  get: () => appStore.ui.statsMonth,
  set: value => appStore.setStatsMonth(value),
});
const year = computed({
  get: () => appStore.ui.statsYear,
  set: value => appStore.setStatsYear(value),
});
const billType = computed({
  get: () => appStore.ui.statsType,
  set: value => appStore.setStatsType(value),
});

/** 是否年视图 */
const isYear = computed(() => scope.value === "year");

// 概览 / 分类排行 / 支付方式排行（period 为 month/year 二选一）
const period = computed(() =>
  isYear.value ? { year: year.value } : { month: month.value },
);
const { overview, categoryStats, payStats, load } = useStatisticsData(
  period,
  billType,
);
// 趋势：月维度近 6 个月；年维度整年 12 个月
const trendYear = computed(() => (isYear.value ? year.value : null));
const { trend, loadTrend } = useTrendData(6, trendYear);

/**
 * 趋势柱默认高亮：年视图当前年高亮当前月、历史年高亮 12 月；月视图高亮最近月
 * @returns {number}
 */
function defaultTrend() {
  if (isYear.value) {
    const now = new Date();
    return year.value === String(now.getFullYear()) ? now.getMonth() : 11;
  }
  return 5;
}

// 当前高亮查看的趋势柱下标
const activeTrend = ref(defaultTrend());

/** 重置趋势高亮为默认值 */
function resetTrend() {
  activeTrend.value = defaultTrend();
}

// ---------- 展示文案 ----------
/** picker 值：月视图 'YYYY-MM'，年视图 'YYYY' */
const pickerValue = computed(() => (isYear.value ? year.value : month.value));

/** picker 展示文案：'2026年9月' / '2026年' */
const periodText = computed(() => {
  if (isYear.value) return `${year.value}年`;
  const [y, m] = month.value.split("-");
  return `${y}年${Number(m)}月`;
});

/** 概览卡「本月 / 本年」前缀 */
const scopeText = computed(() => (isYear.value ? "本年" : "本月"));

/** 趋势面板标题：月视图 '近6个月收支'，年视图 '2026年收支' */
const trendTitle = computed(() =>
  isYear.value ? `${year.value}年收支` : "近6个月收支",
);

// ---------- 交互 ----------
/** 切换单月 / 整年视图（同值幂等） */
function switchScope(value) {
  if (scope.value === value) return;
  scope.value = value;
  resetTrend();
}

/** picker 选择：年视图返回 'YYYY'，月视图返回 'YYYY-MM' */
function onPeriodChange(e) {
  if (isYear.value) year.value = e.detail.value;
  else month.value = e.detail.value;
  resetTrend();
}

function switchType(type) {
  billType.value = type;
}

/**
 * 趋势柱点击：首次点击显示金额；年视图下再点同柱直接切换到该月单月视图
 * @param {number} index
 */
function onTrendTap(index) {
  if (isYear.value && activeTrend.value === index) {
    jumpToMonth(index);
    return;
  }
  activeTrend.value = index;
}

/** 年视图 → 单月视图（智能切换）：选中对应月份并切回月视图 */
function jumpToMonth(index) {
  month.value = `${year.value}-${String(index + 1).padStart(2, "0")}`;
  scope.value = "month";
  activeTrend.value = 5;
}

// ---------- 概览卡片派生（数据源为 overview 接口） ----------
/** 当前类型的总额（卡片主金额） */
const currentTotal = computed(() => Number(overview.value?.total) || 0);
/** 对向金额：type=expense 时为当期收入，type=income 时为当期支出 */
const oppositeTotal = computed(
  () => Number(overview.value?.oppositeTotal) || 0,
);
const totalExpense = computed(() =>
  billType.value === "expense" ? currentTotal.value : oppositeTotal.value,
);
const totalIncome = computed(() =>
  billType.value === "expense" ? oppositeTotal.value : currentTotal.value,
);
const currentCount = computed(() => Number(overview.value?.count) || 0);
const balance = computed(() => Number(overview.value?.balance) || 0);
/** 日均（服务端已按已过天数计算） */
const dailyAverage = computed(() => Number(overview.value?.dailyAverage) || 0);
/** 月均（仅年视图接口返回） */
const monthlyAverage = computed(
  () => Number(overview.value?.monthlyAverage) || 0,
);
/** 卡片第三个均值：月视图日均 / 年视图月均 */
const avgValue = computed(() =>
  isYear.value ? monthlyAverage.value : dailyAverage.value,
);
/** 环比（服务端计算，直接消费） */
const mom = computed(() => ({
  up: !!overview.value?.mom?.up,
  text: overview.value?.mom?.text || "—",
}));

/** 趋势周期内支出 / 收入的全局最大值，作为柱状图高度归一化的分母 */
const trendMax = computed(() =>
  trend.value.reduce((max, i) => Math.max(max, i.expense, i.income), 0),
);
/** 单根柱子高度百分比 */
const barHeight = v =>
  trendMax.value > 0 ? Math.max(Math.round((v / trendMax.value) * 100), 2) : 2;

// 进入页面拉取；粒度 / 月份 / 年份 / 类型变化重拉概览与排行
onShow(() => {
  load();
  loadTrend();
});
watch([period, billType], () => {
  load();
});
// 趋势仅在 粒度/年份 变化时重拉（月视图近6个月与选中月份无关）
watch(trendYear, () => {
  loadTrend();
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

// 顶部标题 + 粒度切换 + 月份/年份选择
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

  .top-actions {
    display: flex;
    align-items: center;
  }

  .scope-toggle {
    display: flex;
    margin-right: 14rpx;
    padding: 4rpx;
    background: #e4eae4;
    border-radius: 999rpx;

    .scope-item {
      padding: 8rpx 22rpx;
      font-size: 23rpx;
      font-weight: 600;
      color: #767e78;
      border-radius: 999rpx;
      transition: all 0.25s ease;

      &.on {
        background: #ffffff;
        color: #2f6b54;
        box-shadow: 0 4rpx 12rpx rgba(28, 54, 45, 0.1);
      }
    }
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

  .chart-hint {
    display: block;
    margin-top: 10rpx;
    font-size: 21rpx;
    color: #98a099;
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
      color: #2f6b54;
    }
    .tip-income {
      color: #c04a36;
    }
    .tip-link {
      font-size: 18rpx;
      font-weight: 700;
      color: #175142;
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
