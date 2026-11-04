<!--
  @file 首页（pages/index/index.vue）
  @description macOS 26 Liquid Glass 版首页：
               1. 悬浮玻璃标题栏：问候语 + 设置入口，内容从其下方滚过（折射可见）；
               2. 本月统计玻璃卡：支出大字 / 收入 / 预算 / 结余 / 预算进度条；
               3. 一言玻璃便签：点按换一句；
               4. 今日流水玻璃列表：BillRow 行内透明化，由外层玻璃卡统一折射；
               5. 底部悬浮玻璃导航（GlassTabBar）与记账按钮。
               数据与动作与改造前完全一致，仅重构视觉层。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 抽取 DecorRing / EmptyState / BillRow 公共组件
  @modify 2026-10-12 深色模式：根节点接 themeClass，硬编码颜色收敛至主题 token
  @modify 2026-11-04 Liquid Glass 重构：壁纸 + 玻璃卡 + 悬浮标题栏 + 自定义玻璃导航
-->
<template>
  <view class="home" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源 -->
    <GlassBackground />

    <!-- 悬浮玻璃标题栏 -->
    <view class="home-bar g-glass g-glass--bar g-pill">
      <view class="home-bar__greet">
        <text class="home-bar__hi">Hi,</text>
        <text class="home-bar__name">{{ userName }}</text>
      </view>
      <view class="home-bar__more g-press" @click="goSettings">
        <uni-icons type="more-filled" size="22" :color="inkColor"></uni-icons>
      </view>
    </view>

    <scroll-view class="home__scroll" scroll-y :show-scrollbar="false">
      <view class="home__content">
        <!-- 本月统计玻璃卡 -->
        <view class="stat-card g-glass">
          <view class="stat-card__head">
            <text class="stat-card__label">本月支出（元）</text>
            <view class="stat-card__badge">
              <text class="stat-card__badge-text">
                {{ budgetSet ? `预算 ${stats.progress}%` : '未设预算' }}
              </text>
            </view>
          </view>

          <view class="stat-card__amount">{{ stats.expense }}</view>

          <view class="stat-card__grid">
            <view class="stat-card__cell">
              <text class="stat-card__cell-label">本月收入</text>
              <text class="stat-card__cell-value">{{ stats.income }}</text>
            </view>
            <view class="stat-card__divider"></view>
            <view class="stat-card__cell" @click="editBudget">
              <text class="stat-card__cell-label">本月预算</text>
              <view class="stat-card__cell-row">
                <text class="stat-card__cell-value">{{ stats.budget }}</text>
                <text class="stat-card__edit">设置</text>
              </view>
            </view>
            <view class="stat-card__divider"></view>
            <view class="stat-card__cell">
              <text class="stat-card__cell-label">本月结余</text>
              <text class="stat-card__cell-value">{{ stats.balance }}</text>
            </view>
          </view>

          <!-- 预算进度：≤80% 绿 / 80~100% 橙 / 超支红 -->
          <view class="stat-progress" :class="progressTone" @click="editBudget">
            <view class="stat-progress__track">
              <view
                class="stat-progress__fill"
                :style="{ width: stats.progress + '%' }"
              ></view>
            </view>
            <text class="stat-progress__hint">
              {{
                budgetSet
                  ? `已用 ${stats.expense} / ${stats.budget}`
                  : '点击设置本月预算'
              }}
            </text>
          </view>
        </view>

        <!-- 一言玻璃便签 -->
        <view
          class="quote-card g-glass g-press"
          hover-class="quote-card--hover"
          :hover-stay-time="60"
          @click="refreshQuote"
        >
          <view class="quote-card__seal">言</view>
          <view class="quote-card__body">
            <text class="quote-card__text">{{
              quote ? quote.text : '轻触卡片，遇见一言'
            }}</text>
            <view class="quote-card__foot">
              <text class="quote-card__from">{{ quoteSource }}</text>
              <view class="quote-card__refresh">
                <view class="refresh-icon" :class="{ spinning: quoteLoading }">
                  <uni-icons type="refresh" size="13" :color="mutedColor" />
                </view>
                <text class="refresh-text">换一句</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 今日流水 -->
        <view class="today">
          <view class="today__head">
            <view class="today__title">
              <text class="today__title-text">今天</text>
              <text class="today__date">{{ todayDate }}</text>
            </view>
            <view class="today__chips">
              <text class="today-chip">支 {{ todayExpense }}</text>
              <text class="today-chip today-chip--income"
                >收 {{ todayIncome }}</text
              >
            </view>
          </view>

          <view class="today__list g-glass">
            <EmptyState
              v-if="flowList.length === 0"
              text="今天还没有记账"
              sub="点下方 + 记一笔"
            />
            <template v-else>
              <BillRow
                v-for="item in flowList"
                :key="item.id"
                :bill="item"
                @click="goDetail"
                @photo-error="onRowPhotoError"
              />
            </template>
          </view>
        </view>

        <!-- 给悬浮导航留出安全距离 -->
        <view class="home__bottom-space"></view>
      </view>
    </scroll-view>

    <!-- 底部悬浮玻璃导航 -->
    <GlassTabBar current="home" />

    <!-- APP 在线更新弹窗（全局唯一挂载点，仅 App 端编译，非 App 端不渲染） -->
    <!-- #ifdef APP-PLUS -->
    <update-popup />
    <!-- #endif -->
  </view>
</template>

<script setup>
/**
 * 首页脚本模块（与改造前一致，未改动数据流）
 * 模块说明：
 * - useHomeData()：调 GET /overview/home 聚合首页数据（统计卡 + 今日流水），
 *   onShow 调 load() 拉取；
 * - goBillDetail(id)：统一的详情跳转工具，仅传 id，详情页自行调接口。
 */
import { computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useHomeData, goBillDetail } from '@/composables/useBookkeeping'
import { useHitokoto } from '@/composables/useHitokoto'
import { useTheme } from '@/composables/useTheme'
// 更新弹窗仅 App 端挂载（状态来自 use-app-update 模块级单例）
// #ifdef APP-PLUS
import UpdatePopup from '@/components/update-popup.vue'
// #endif

// 深色模式：根节点主题类 + JS 取色（uni-icons color 走不了 CSS 变量）
const { themeClass, isDark } = useTheme()
// 「更多」按钮图标墨色（浅色深墨 / 深色调亮）
const inkColor = computed(() => (isDark.value ? '#e4ece6' : '#2b3730'))
// 次级文字与刷新图标色（随主题变化）
const mutedColor = computed(() => (isDark.value ? '#9aa39c' : '#8b938d'))

const {
  stats,
  flowList,
  todayExpense,
  todayIncome,
  userName,
  todayDate,
  editBudget,
  load,
} = useHomeData()

// 预算卡进度条档位：超支红 / 80~100% 橙 / ≤80% 绿（颜色用主题 token）
const progressTone = computed(() => {
  if (stats.value.overBudget) return 'over'
  if (stats.value.progress > 80) return 'warn'
  return 'ok'
})
// 是否已设置预算（未设置时进度区显示引导文案）
const budgetSet = computed(() => Number(stats.value.budget) > 0)

// 一言便签：冷启动自动拉取一次，点按卡片手动换一句
const { quote, loading: quoteLoading, refresh: refreshQuote } = useHitokoto()

// 出处拼接：作者《出处》，缺一则只展示存在的部分
const quoteSource = computed(() => {
  const q = quote.value
  if (!q) return ''
  if (q.who && q.from) return `—— ${q.who}《${q.from}》`
  if (q.from) return `—— 《${q.from}》`
  if (q.who) return `—— ${q.who}`
  return ''
})

// 每次进入首页 / 从后台恢复时重新拉取聚合数据（失败静默，保留上次数据）
onShow(() => {
  // App 端 tabBar.custom 不会隐藏原生条（H5 由 App.vue 的 CSS 兜底），
  // 这里每次显示都再隐藏一次，避免切换页面时原生条重新出现。
  try {
    uni.hideTabBar({ animation: false })
  } catch (e) {
    // ignore：无原生 tabBar 的环境（H5 已用 CSS 隐藏）
  }
  load().catch(() => {})
})

// 下拉刷新：重新拉取首页聚合数据，完成后关闭刷新动画
onPullDownRefresh(async () => {
  await load().catch(() => {})
  uni.stopPullDownRefresh()
})

/**
 * 点击今日流水单条 → 跳转详情页
 * @param {object} item 被点击的流水项
 */
const goDetail = (item) => {
  goBillDetail(item.id)
}

/**
 * 凭证缩略图签名过期换签：首页今日流水来自聚合 computed 无法原地替换，
 * 直接重拉首页聚合（onShow 本身也会重拉，语义安全），失败静默。
 */
const onRowPhotoError = () => {
  load().catch(() => {})
}

/** 右上角更多入口：跳转设置页（应用级配置统一在设置页承载） */
const goSettings = () => {
  uni.navigateTo({ url: '/pages/settings/index' })
}
</script>

<style lang="scss" scoped>
.home {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

/* ---------- 悬浮玻璃标题栏 ---------- */
.home-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  top: calc(var(--status-bar-height) + 12rpx);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 96rpx;
  padding: 0 16rpx 0 32rpx;

  &__greet {
    display: flex;
    align-items: baseline;
    min-width: 0;
  }

  &__hi {
    font-size: 26rpx;
    color: $text-regular;
    letter-spacing: 0.5rpx;
  }

  &__name {
    margin-left: 10rpx;
    font-size: 34rpx;
    font-weight: 700;
    color: $text-title;
    letter-spacing: 0.5rpx;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__more {
    width: 68rpx;
    height: 68rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  }
}

/* ---------- 滚动区 ---------- */
.home__scroll {
  position: relative;
  z-index: 1;
  height: 100%;
}

.home__content {
  padding: calc(var(--status-bar-height) + 128rpx) 24rpx 0;
}

.home__bottom-space {
  height: calc(200rpx + env(safe-area-inset-bottom));
}

/* ---------- 本月统计玻璃卡 ---------- */
.stat-card {
  padding: 34rpx 32rpx 28rpx;
  border-radius: 48rpx;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label {
    font-size: 24rpx;
    color: $text-regular;
    letter-spacing: 0.5rpx;
  }

  &__badge {
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  }

  &__badge-text {
    font-size: 21rpx;
    color: $text-regular;
    font-variant-numeric: tabular-nums;
  }

  &__amount {
    margin-top: 16rpx;
    font-size: 84rpx;
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: 0.5rpx;
    color: $text-title;
    font-variant-numeric: tabular-nums;
  }

  &__grid {
    display: flex;
    align-items: stretch;
    margin-top: 30rpx;
    padding: 22rpx 8rpx;
    border-radius: 28rpx;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  }

  &__cell {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  &__cell-label {
    font-size: 22rpx;
    color: $text-secondary;
  }

  &__cell-row {
    display: flex;
    align-items: baseline;
  }

  &__cell-value {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-strong;
    font-variant-numeric: tabular-nums;
  }

  &__edit {
    margin-left: 10rpx;
    padding: 2rpx 12rpx;
    font-size: 19rpx;
    line-height: 1.6;
    color: $color-primary;
    border-radius: 999rpx;
    border: 1rpx solid rgba(76, 175, 135, 0.35);
  }

  &__divider {
    width: 1rpx;
    margin: 6rpx 0;
    background: $divider;
  }
}

/* 预算进度条 */
.stat-progress {
  margin-top: 26rpx;

  &__track {
    width: 100%;
    height: 14rpx;
    border-radius: 999rpx;
    background: $bg-toggle;
    overflow: hidden;
    box-shadow: inset 0 1rpx 2rpx rgba(12, 58, 46, 0.08);
  }

  &__fill {
    height: 100%;
    border-radius: 999rpx;
    background: $gradient-progress;
    box-shadow: 0 2rpx 8rpx rgba(79, 199, 148, 0.45);
    transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  &__hint {
    display: block;
    margin-top: 12rpx;
    font-size: 21rpx;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;
  }

  &.warn {
    .stat-progress__fill {
      background: $color-gold;
      box-shadow: 0 2rpx 8rpx rgba(192, 138, 62, 0.4);
    }
    .stat-progress__hint {
      color: $color-gold;
    }
  }

  &.over {
    .stat-progress__fill {
      background: $color-danger-soft;
      box-shadow: 0 2rpx 8rpx rgba(223, 84, 63, 0.4);
    }
    .stat-progress__hint {
      color: $color-danger-soft;
    }
  }
}

/* ---------- 一言玻璃便签 ---------- */
.quote-card {
  display: flex;
  align-items: flex-start;
  margin-top: 22rpx;
  padding: 26rpx 28rpx 22rpx;
  border-radius: 36rpx;

  &--hover {
    background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.72));
  }

  &__seal {
    width: 48rpx;
    height: 48rpx;
    margin: 4rpx 20rpx 0 0;
    border-radius: 12rpx;
    flex-shrink: 0;
    background: $color-terracotta;
    color: #f7f0e4;
    font-size: 27rpx;
    line-height: 48rpx;
    text-align: center;
    box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.35);
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__text {
    font-size: 27rpx;
    line-height: 1.7;
    color: $text-body;
    letter-spacing: 0.5rpx;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12rpx;
  }

  &__from {
    flex: 1;
    min-width: 0;
    font-size: 21rpx;
    color: $text-secondary;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__refresh {
    display: flex;
    align-items: center;
    margin-left: 20rpx;
    flex-shrink: 0;
  }

  .refresh-text {
    margin-left: 6rpx;
    font-size: 21rpx;
    color: $text-secondary;
  }

  .refresh-icon.spinning {
    animation: quote-spin 0.8s linear infinite;
  }
}

@keyframes quote-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 今日流水 ---------- */
.today {
  margin-top: 36rpx;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8rpx 18rpx;
  }

  &__title {
    display: flex;
    align-items: baseline;
  }

  &__title-text {
    font-size: 36rpx;
    font-weight: 700;
    color: $text-title;
    letter-spacing: 0.5rpx;
  }

  &__date {
    margin-left: 12rpx;
    font-size: 23rpx;
    color: $text-secondary;
  }

  &__chips {
    display: flex;
    align-items: center;
  }
}

.today-chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1.4;
  color: $text-regular;
  background: var(--c-glass-subtle, rgba(255, 255, 255, 0.3));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  font-variant-numeric: tabular-nums;

  & + & {
    margin-left: 12rpx;
  }

  &--income {
    color: $color-income;
    background: var(--c-danger-soft-glass, rgba(223, 84, 63, 0.12));
  }
}

.today__list {
  border-radius: 40rpx;
  overflow: hidden;
  padding: 8rpx 0;
}
</style>
