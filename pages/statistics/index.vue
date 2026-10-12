<!--
  @file 统计页（pages/statistics/index.vue）
  @description 支持单月与整年两种时间粒度的账单分析：
               1. 顶部：标题、月/年粒度切换、月份（或年份）picker 与支出/收入切换；
               2. 本期概览卡片、收支趋势柱状图、分类排行、支付方式分布均拆为
                  pages/statistics/components/ 下的子组件（MonthSummary /
                  TrendChart / CategoryRank），本页只保留数据获取、状态组合与交互编排；
               3. 年视图点击柱子显示金额，再次点击（或点「查看该月」）智能切换到
                  该月单月视图（近 6 月窗口内精确高亮）。
               粒度 / 月份 / 年份与类型选择持久化在 app store，聚合数据全部由接口实时计算。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 无环比隐藏胶囊；年→月跳转在近 6 月窗口内精确高亮；
               年视图 12 柱错峰动画；抽取 DecorRing，金额收敛至 utils/rmb；
               P2-15 概览卡 / 趋势图 / 排行拆为子组件，本页瘦身为编排层
  @modify 2026-10-12 深色模式：根节点接 themeClass，硬编码颜色收敛至主题 token
-->
<template>
  <view class="statistics" :class="themeClass">
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
            <uni-icons type="bottom" size="14" :color="primaryIcon"></uni-icons>
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

    <!-- 本期概览卡片（加载失败错误态内聚在组件中，点击重试上抛 retry） -->
    <MonthSummary
      :error="overviewError"
      :bill-type="billType"
      :is-year="isYear"
      :scope-text="scopeText"
      :mom="mom"
      :current-total="currentTotal"
      :opposite-total="oppositeTotal"
      :count="currentCount"
      :avg="avgValue"
      :balance="balance"
      @retry="retryOverview"
    />

    <!-- 收支趋势：月视图近6个月 / 年视图全年12个月；高亮与跳转由本页控制 -->
    <TrendChart
      :title="trendTitle"
      :trend="trend"
      :is-year="isYear"
      :active-index="activeTrend"
      @bar-tap="onTrendTap"
      @jump="jumpToMonth"
    />

    <!-- 分类排行 -->
    <CategoryRank
      :title="billType === 'expense' ? '支出分类' : '收入分类'"
      unit="类"
      :items="categoryStats"
      kind="category"
      :empty-text="categoryEmptyText"
    />

    <!-- 支付方式分布（仅支出） -->
    <CategoryRank
      v-if="billType === 'expense'"
      title="支付方式"
      unit="种"
      :items="payStats"
      kind="pay"
      empty-text="暂无支付方式数据"
    />
  </view>
</template>

<script setup>
/**
 * 统计页脚本模块（编排层）
 * 模块说明：
 * - 时间粒度（月/年）、月份、年份、收支类型均用可写 computed 双向绑定 app store（自动持久化）；
 * - 概览 / 分类排行 / 支付方式排行由 useStatisticsData 按 period（month 或 year 二选一）调接口；
 * - 趋势图月维度调 GET /statistics/trend?months=6，年维度调 ?year=YYYY 返回全年 12 个月；
 * - 年视图点击柱子显示金额，再次点击同柱（或点「查看该月」）智能切换到该月单月视图；
 * - 环比文案直接使用服务端 overview.mom.text / mom.up（月比上月、年比去年）。
 */
import { ref, computed, watch } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAppStore } from '@/store'
import { useStatisticsData, useTrendData } from '@/composables/useStatistics'
import { useTheme } from '@/composables/useTheme'
// 页面目录子组件不走 easycom，需显式 import
import MonthSummary from './components/MonthSummary.vue'
import TrendChart from './components/TrendChart.vue'
import CategoryRank from './components/CategoryRank.vue'

const appStore = useAppStore()

// 深色模式：根节点主题类 + JS 取色（uni-icons color 走不了 CSS 变量）
const { themeClass, isDark } = useTheme()
// 月份胶囊下拉图标（主题强调色）
const primaryIcon = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))

// 粒度 / 月份 / 年份 / 收支类型：双向绑定 app store（切换后持久化记忆）
const scope = computed({
  get: () => appStore.ui.statsScope,
  set: (value) => appStore.setStatsScope(value),
})
const month = computed({
  get: () => appStore.ui.statsMonth,
  set: (value) => appStore.setStatsMonth(value),
})
const year = computed({
  get: () => appStore.ui.statsYear,
  set: (value) => appStore.setStatsYear(value),
})
const billType = computed({
  get: () => appStore.ui.statsType,
  set: (value) => appStore.setStatsType(value),
})

/** 是否年视图 */
const isYear = computed(() => scope.value === 'year')

// 概览 / 分类排行 / 支付方式排行（period 为 month/year 二选一）
const period = computed(() =>
  isYear.value ? { year: year.value } : { month: month.value },
)
const { overview, categoryStats, payStats, overviewError, load } =
  useStatisticsData(period, billType)
// 趋势：月维度近 6 个月；年维度整年 12 个月
const trendYear = computed(() => (isYear.value ? year.value : null))
const { trend, loadTrend, loading: trendLoading } = useTrendData(6, trendYear)

/**
 * 趋势柱默认高亮：年视图当前年高亮当前月、历史年高亮 12 月；月视图高亮最近月
 * @returns {number}
 */
function defaultTrend() {
  if (isYear.value) {
    const now = new Date()
    return year.value === String(now.getFullYear()) ? now.getMonth() : 11
  }
  return 5
}

// 当前高亮查看的趋势柱下标
const activeTrend = ref(defaultTrend())

/** 重置趋势高亮为默认值 */
function resetTrend() {
  activeTrend.value = defaultTrend()
}

// ---------- 展示文案 ----------
/** picker 值：月视图 'YYYY-MM'，年视图 'YYYY' */
const pickerValue = computed(() => (isYear.value ? year.value : month.value))

/** picker 展示文案：'2026年9月' / '2026年' */
const periodText = computed(() => {
  if (isYear.value) return `${year.value}年`
  const [y, m] = month.value.split('-')
  return `${y}年${Number(m)}月`
})

/** 概览卡「本月 / 本年」前缀 */
const scopeText = computed(() => (isYear.value ? '本年' : '本月'))

/** 趋势面板标题：月视图 '近6个月收支'，年视图 '2026年收支' */
const trendTitle = computed(() =>
  isYear.value ? `${year.value}年收支` : '近6个月收支',
)

/** 分类排行空态文案 */
const categoryEmptyText = computed(() =>
  billType.value === 'expense' ? '暂无支出数据' : '暂无收入数据',
)

// ---------- 交互 ----------
/** 切换单月 / 整年视图（同值幂等） */
function switchScope(value) {
  if (scope.value === value) return
  scope.value = value
  resetTrend()
}

/** picker 选择：年视图返回 'YYYY'，月视图返回 'YYYY-MM' */
function onPeriodChange(e) {
  if (isYear.value) year.value = e.detail.value
  else month.value = e.detail.value
  resetTrend()
}

function switchType(type) {
  billType.value = type
}

/**
 * 趋势柱点击：首次点击显示金额；年视图下再点同柱直接切换到该月单月视图
 * @param {number} index
 */
function onTrendTap(index) {
  if (isYear.value && activeTrend.value === index) {
    jumpToMonth(index)
    return
  }
  activeTrend.value = index
}

/**
 * 年视图 → 单月视图（智能切换）：选中对应月份并切回月视图。
 * 月视图趋势是服务端锚定「当前月」的近 6 个月窗口（months 只给数量、
 * 不支持任意锚点），切换粒度后 trend 会异步重拉，因此先记录待定位月份，
 * 数据回来后在窗口内精确高亮目标月（见 locatePendingMonth / watch(trend)）。
 */
// 待定位月份（'YYYY-MM'），空串表示无待定位
const pendingMonth = ref('')
function jumpToMonth(index) {
  const target = `${year.value}-${String(index + 1).padStart(2, '0')}`
  month.value = target
  scope.value = 'month'
  pendingMonth.value = target
  locatePendingMonth()
}

/**
 * 在已加载的近 6 月窗口中高亮待跳转月份：
 * - trend 仍在加载（年→月切换后的数据重拉未完成）时跳过，等 watch(trend) 再定位；
 * - 目标月不在近 6 月窗口内（接口不支持更早窗口）时回退默认高亮，避免错柱。
 */
function locatePendingMonth() {
  if (!pendingMonth.value || isYear.value || trendLoading.value) return
  const idx = trend.value.findIndex((t) => t.month === pendingMonth.value)
  activeTrend.value = idx >= 0 ? idx : defaultTrend()
  pendingMonth.value = ''
}

// ---------- 概览卡片派生（数据源为 overview 接口，props 下发子组件） ----------
/** 当前类型的总额（卡片主金额） */
const currentTotal = computed(() => Number(overview.value?.total) || 0)
/** 对向金额：type=expense 时为当期收入，type=income 时为当期支出 */
const oppositeTotal = computed(() => Number(overview.value?.oppositeTotal) || 0)
const currentCount = computed(() => Number(overview.value?.count) || 0)
const balance = computed(() => Number(overview.value?.balance) || 0)
/** 日均（服务端已按已过天数计算） */
const dailyAverage = computed(() => Number(overview.value?.dailyAverage) || 0)
/** 月均（仅年视图接口返回） */
const monthlyAverage = computed(
  () => Number(overview.value?.monthlyAverage) || 0,
)
/** 卡片第三个均值：月视图日均 / 年视图月均 */
const avgValue = computed(() =>
  isYear.value ? monthlyAverage.value : dailyAverage.value,
)
/**
 * 环比（服务端计算，直接消费）：
 * percent 为 null 表示不可比（基期为 0 且当期 >0），hasData=false，
 * 子组件据此隐藏环比胶囊（不展示无意义的上下箭头与 '--'）。
 */
const mom = computed(() => {
  const raw = overview.value?.mom
  return {
    up: !!raw?.up,
    text: raw?.text || '—',
    percent: raw?.percent ?? null,
    hasData: raw?.percent != null,
  }
})

// 进入页面拉取（失败静默，保留上次数据）；粒度 / 月份 / 年份 / 类型变化重拉概览与排行
onShow(() => {
  load().catch(() => {})
  loadTrend()
})
watch([period, billType], () => {
  load().catch(() => {})
})
// 趋势仅在 粒度/年份 变化时重拉（月视图近6个月与选中月份无关）
watch(trendYear, () => {
  loadTrend()
})
// 年→月跳转后 trend 重拉完成：在近 6 月窗口内补定位目标月高亮
watch(trend, locatePendingMonth)

// 下拉刷新：重拉概览 / 排行与趋势，全部完成后关闭刷新动画
onPullDownRefresh(async () => {
  await Promise.all([load().catch(() => {}), loadTrend()])
  uni.stopPullDownRefresh()
})

/** 概览加载失败 → 点击重试（复用 load，重拉概览与排行） */
const retryOverview = () => {
  load().catch(() => {})
}
</script>

<style lang="scss" scoped>
.statistics {
  width: 100%;
  min-height: 100vh;
  margin-top: var(--status-bar-height);
  background: $bg-page;
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
    color: $text-title;
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
    background: $bg-toggle;
    border-radius: 999rpx;

    .scope-item {
      padding: 8rpx 22rpx;
      font-size: 23rpx;
      font-weight: 600;
      color: $text-regular;
      border-radius: 999rpx;
      transition: all 0.25s ease;

      &.on {
        background: $bg-card;
        color: $color-primary-mid;
        box-shadow: $shadow-float;
      }
    }
  }

  .month-pill {
    display: flex;
    align-items: center;
    padding: 11rpx 22rpx;
    background: $bg-card;
    border-radius: 999rpx;
    box-shadow: $shadow-float;

    .month-text {
      font-size: 25rpx;
      font-weight: 600;
      color: $color-primary-mid;
      margin-right: 8rpx;
    }
  }
}

// 收支切换
.type-tabs {
  display: flex;
  margin: 8rpx 24rpx 26rpx;
  padding: 6rpx;
  background: $bg-toggle;
  border-radius: 999rpx;

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 15rpx 0;
    font-size: 28rpx;
    font-weight: 600;
    color: $text-regular;
    border-radius: 999rpx;
    transition: all 0.25s ease;

    &.on {
      background: $bg-card;
      box-shadow: $shadow-float;

      &.expense {
        color: $color-primary-deep;
      }
      &.income {
        color: $color-income;
      }
    }
  }
}
</style>
