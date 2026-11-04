<!--
  @file 流水页（pages/flowing/index.vue）
  @description 按「月份 + 收支类型」筛选账单并按天分组展示：
               1. 顶部导航：类型选择（全部类型 / 支出 / 收入，ActionSheet）与搜索入口
                  （点击展开搜索框，输入关键字 300ms 防抖后从第一页重查，清空恢复全量）；
               2. 日期选择：uni-app 标准 picker（mode=date, fields=month）；
               3. 本月总支出 / 总收入双卡（/bills/summary 完整口径）；
               4. 按天分组的流水列表，每组显示日标签（今天/昨天/周X）、日期与
                  当日收支合计（已加载页口径），组内账单点击进入详情；
               5. 列表按月分页加载（每页 50 条），onReachBottom 触底加载下一页
                  并按日合并进现有分组，下拉刷新重置到第一页，末尾展示「没有更多了」。
               月份与类型选择态持久化在 app store，分组数据由接口分页拉取。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 抽取 DecorRing / EmptyState / BillRow 公共组件，
               凭证缩略图签名过期支持页面侧换签
  @modify 2026-10-12 深色模式：根节点接 themeClass，硬编码颜色收敛至主题 token
  @modify 2026-11-04 Liquid Glass 重构：壁纸 + 玻璃卡 + 玻璃浮层
-->
<template>
  <view class="flowing-water" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源 -->
    <GlassBackground />

    <!-- 悬浮玻璃条：类型筛选 / 搜索 / 月份切换，内容从其下方滚过 -->
    <view class="flow-head">
      <view class="flow-head__bar g-glass g-glass--bar g-float">
        <view class="flow-head__row">
          <view class="type-selector g-pill g-press" @click="handleTypeClick">
            <text class="type-text">{{ currentType }}</text>
            <uni-icons type="bottom" size="20" :color="titleInk"></uni-icons>
          </view>
          <view class="search-btn g-press" @click="handleSearch">
            <uni-icons type="search" size="28" :color="inkColor"></uni-icons>
          </view>
        </view>

        <!-- 搜索框：点右上角搜索图标展开，输入关键字防抖触发检索 -->
        <view v-if="searchVisible" class="search-bar g-pill">
          <uni-icons type="search" size="22" :color="secondaryIcon"></uni-icons>
          <input
            class="search-input"
            :value="searchText"
            placeholder="搜索备注 / 分类"
            placeholder-style="color: #b3b9c7"
            confirm-type="search"
            focus
            @input="onSearchInput"
            @confirm="flushSearch"
          />
          <view
            v-if="searchText"
            class="search-clear"
            hover-class="clear-hover"
            :hover-stay-time="60"
            @click="clearSearch"
          >
            <uni-icons type="clear" size="18" color="#c2c9c3"></uni-icons>
          </view>
        </view>

        <!-- 日期选择 -->
        <picker
          class="month-picker"
          mode="date"
          :value="currentMonth"
          fields="month"
          @change="handleDateChange"
        >
          <view class="date-filter g-pill g-press">
            <uni-icons
              type="calendar"
              size="26"
              :color="primaryIcon"
            ></uni-icons>
            <text class="date-text">{{ currentMonth }}</text>
            <uni-icons type="bottom" size="16" :color="primaryIcon"></uni-icons>
          </view>
        </picker>
      </view>
    </view>

    <!-- 内容层：抬到壁纸之上 -->
    <view class="flowing-water__content">
      <!-- 本月收支玻璃汇总卡 -->
      <view class="summary-cards">
        <view class="summary-card expense-card g-glass">
          <DecorRing
            class="card-decor"
            :size="240"
            :middle="166"
            :inner="92"
            :middle-opacity="0.11"
            :inner-opacity="0.15"
          />
          <view class="card-icon-wrap">
            <uni-icons type="arrow-up" size="26" color="#fff"></uni-icons>
          </view>
          <view class="card-amount">{{ monthCard.expense }}</view>
          <view class="card-label">本月总支出（元）</view>
        </view>
        <view class="summary-card income-card g-glass">
          <DecorRing
            class="card-decor"
            :size="240"
            :middle="166"
            :inner="92"
            :middle-opacity="0.11"
            :inner-opacity="0.15"
          />
          <view class="card-icon-wrap">
            <uni-icons type="arrow-down" size="26" color="#fff"></uni-icons>
          </view>
          <view class="card-amount">{{ monthCard.income }}</view>
          <view class="card-label">本月总收入（元）</view>
        </view>
      </view>

      <!-- 流水列表 -->
      <view class="flow-list-wrap">
        <EmptyState
          v-if="groups.length === 0"
          class="flow-empty g-glass"
          :text="keyword ? '未找到相关账单' : '本月暂无流水'"
          :sub="keyword ? '换个关键词试试' : '记一笔，开始追踪你的收支'"
        />
        <template v-else>
          <view
            v-for="group in groups"
            :key="group.recordDate"
            class="flow-group g-glass"
          >
            <view class="group-header">
              <view class="group-title">
                <text class="group-day">{{ group.day }}</text>
                <text class="group-date">{{ group.date }}</text>
              </view>
              <view class="group-summary">
                <text class="summary-chip">支 {{ group.expense }}</text>
                <text class="summary-chip income">收 {{ group.income }}</text>
              </view>
            </view>

            <view class="flow-list">
              <BillRow
                v-for="item in group.items"
                :key="item.id"
                :bill="item"
                @click="goDetail"
                @photo-error="resignBillPhoto"
              />
            </view>
          </view>
        </template>

        <!-- 分页底态：触底加载中 / 已加载全部（仅在有数据时展示） -->
        <view
          v-if="groups.length > 0 && (loadingMore || finished)"
          class="list-footer"
        >
          <text class="footer-text">{{
            loadingMore ? '加载中…' : '没有更多了'
          }}</text>
        </view>
      </view>
    </view>

    <!-- 底部悬浮玻璃导航（pages.json tabBar.custom = true，需 tab 页自行挂载） -->
    <GlassTabBar current="flowing" />
  </view>
</template>

<script setup>
/**
 * 流水页脚本模块
 * 模块说明：
 * - useFlowingData()：currentMonth / currentType 双向绑定 app store（持久化），
 *   groups / monthCard 为接口拉取的 ref；列表按月分页加载（每页 50 条），
 *   load() 拉取第一页并重置分页，loadMore() 触底加载下一页并按日合并进现有分组，
 *   finished 标记已加载全部；keyword 为搜索关键字（透传 billsApi.list）；
 * - 本页负责：类型 ActionSheet、月份 picker、搜索（展开输入框 + 300ms 防抖触发
 *   load() 从第一页重查，清空恢复全量）、触底分页与下拉刷新入口。
 */
import { ref, computed, watch } from 'vue'
import {
  onShow,
  onUnload,
  onReachBottom,
  onPullDownRefresh,
} from '@dcloudio/uni-app'
import { useFlowingData, goBillDetail } from '@/composables/useBookkeeping'
import { useTheme } from '@/composables/useTheme'
import { billsApi, normalizeFileUrl } from '@/api'

// 深色模式：根节点主题类 + JS 取色（uni-icons color 走不了 CSS 变量）
const { themeClass, isDark } = useTheme()
// 标题旁下拉箭头（随主标题墨色）
const titleInk = computed(() => (isDark.value ? '#e8efe9' : '#1e2521'))
// 圆形按钮底上的搜索图标（浅色 #3c4a42 / 深色调亮）
const inkColor = computed(() => (isDark.value ? '#c9d3cb' : '#3c4a42'))
// 搜索框占位图标（辅助文字色）
const secondaryIcon = computed(() => (isDark.value ? '#79837c' : '#98a099'))
// 日期胶囊图标（主题强调色）
const primaryIcon = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))

// 类型选项（顺序即 ActionSheet 中的展示顺序，tapIndex 直接映射）
const typeOptions = ['全部类型', '支出', '收入']

// 月份 / 类型选择态持久化在 app store；分组与月汇总由 load() 异步拉取
const {
  currentMonth,
  currentType,
  keyword,
  groups,
  monthCard,
  load,
  loadMore,
  loadingMore,
  finished,
} = useFlowingData()

// ---------- 搜索 ----------
// 搜索框展开态；searchText 为输入框内容，防抖 300ms 后同步到 keyword 触发重查
const SEARCH_DEBOUNCE = 300
const searchVisible = ref(false)
const searchText = ref('')
let searchTimer = null

/** 同步关键字到 composable 并从第一页重查（keyword 相同则跳过） */
function search(kw) {
  if (kw === keyword.value) return
  keyword.value = kw
  load().catch(() => {})
}

/** 输入防抖：300ms 内连续输入只取最后一次 */
function onSearchInput(e) {
  searchText.value = e.detail.value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search(searchText.value.trim())
  }, SEARCH_DEBOUNCE)
}

/** 键盘确认：跳过防抖立即检索 */
function flushSearch() {
  clearTimeout(searchTimer)
  search(searchText.value.trim())
}

/** 清空关键词并恢复全量列表 */
function clearSearch() {
  clearTimeout(searchTimer)
  searchText.value = ''
  search('')
}

/** 点击顶部搜索图标：展开 / 收起搜索框；收起时若有关键词则恢复全量 */
const handleSearch = () => {
  searchVisible.value = !searchVisible.value
  if (!searchVisible.value) {
    clearSearch()
  }
}

// 页面卸载清理防抖定时器
onUnload(() => {
  clearTimeout(searchTimer)
})

// 进入页面 / 从后台恢复时拉取；月份或类型变化时重置到第一页重新拉取
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
watch([currentMonth, currentType], () => {
  load().catch(() => {})
})

// 触底加载下一页（内部自带 loading / finished 防抖与失败重试语义）
onReachBottom(() => {
  loadMore()
})

// 下拉刷新：重置到第一页重新拉取，完成后关闭刷新动画
onPullDownRefresh(async () => {
  await load().catch(() => {})
  uni.stopPullDownRefresh()
})

/** 点击顶部类型文字 → 弹出 ActionSheet 切换筛选类型（写入后列表自动重算） */
const handleTypeClick = () => {
  uni.showActionSheet({
    itemList: typeOptions,
    success: (res) => {
      currentType.value = typeOptions[res.tapIndex]
    },
  })
}

/**
 * 月份 picker 选中回调
 * @param {object} e uni-app picker change 事件，e.detail.value 形如 '2026-09'
 */
const handleDateChange = (e) => {
  currentMonth.value = e.detail.value
}

/**
 * 点击流水单条 → 跳转详情页
 * @param {object} item 被点击的流水项
 */
const goDetail = (item) => {
  goBillDetail(item.id)
}

/**
 * 凭证缩略图签名过期换签：重拉该账单详情，用新签名 URL 原地替换分组中的
 * photos（与详情页同一套思路）。组件内保证每条账单最多触发一次，失败静默，
 * 行内缩略图保持灰底占位。
 * @param {object} item 加载失败的流水项
 */
const resignBillPhoto = async (item) => {
  try {
    const detail = await billsApi.getOne(item.id)
    const photos = (detail?.photos || []).map((p) =>
      typeof p === 'string'
        ? { key: '', url: normalizeFileUrl(p) }
        : { key: p?.key || '', url: normalizeFileUrl(p?.url) },
    )
    if (!photos.length) return
    for (const group of groups.value) {
      const found = group.items.find((b) => b.id === item.id)
      if (found) {
        found.photos = photos
        break
      }
    }
  } catch (e) {
    // 换签失败不阻断浏览，缩略图保持占位，下次进页会重新拉列表
  }
}
</script>

<style lang="scss" scoped>
.flowing-water {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  /* 页面底色交给壁纸，页面自身透明 */
  background: transparent;
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

/* ==================================================================
 * 悬浮玻璃条（类型筛选 / 搜索 / 月份切换）
 * 固定定位：列表滚动时从玻璃下方穿过，形成折射
 * 折叠高度 = 上下内边距 32 + 类型行 64 + 间距 14 + 月份行 68 = 178rpx
 * 内容层 padding-top 按此预留（见 .flowing-water__content）
 * ================================================================== */
.flow-head {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  top: calc(var(--status-bar-height) + 12rpx);
  z-index: 20;
}

.flow-head__bar {
  display: flex;
  flex-direction: column;
  padding: 16rpx 18rpx;
  border-radius: 44rpx;
}

.flow-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 类型筛选：玻璃条内的凹陷胶囊 */
.type-selector {
  display: flex;
  align-items: center;
  height: 64rpx;
  padding: 0 20rpx 0 24rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

  .type-text {
    margin-right: 8rpx;
    font-size: 36rpx;
    font-weight: 700;
    color: $text-title;
    letter-spacing: 0.5rpx;
  }
}

/* 搜索入口：圆形玻璃钮 */
.search-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
}

/* 搜索框：玻璃条内的凹陷胶囊（展开时玻璃条随之下延，内容从其下穿过） */
.search-bar {
  display: flex;
  align-items: center;
  height: 72rpx;
  margin-top: 14rpx;
  padding: 0 22rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

  .search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    margin-left: 14rpx;
    font-size: 27rpx;
    color: $text-title;
  }

  .search-clear {
    display: flex;
    padding: 12rpx;
    margin-right: -12rpx;

    &.clear-hover {
      opacity: 0.6;
    }
  }
}

/* 月份切换：picker 内的玻璃胶囊（flex 避免行盒基线多余高度，保证条高可算） */
.month-picker {
  display: flex;
  margin-top: 14rpx;
}

.date-filter {
  display: inline-flex;
  align-items: center;
  height: 68rpx;
  padding: 0 22rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

  .date-text {
    margin: 0 8rpx 0 10rpx;
    font-size: 25rpx;
    font-weight: 600;
    color: $color-primary-mid;
    font-variant-numeric: tabular-nums;
  }
}

/* 内容层：抬到壁纸 / 悬浮玻璃条之上 */
.flowing-water__content {
  position: relative;
  z-index: 1;
  padding: calc(var(--status-bar-height) + 214rpx) 24rpx 0;
}

/* ---------- 收支玻璃汇总卡 ---------- */
.summary-cards {
  display: flex;
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.summary-card {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  padding: 26rpx 24rpx 24rpx;
  border-radius: 40rpx;

  // 同心圆环暗纹（DecorRing 组件根节点，环体样式内聚在组件内）
  .card-decor {
    position: absolute;
    top: -90rpx;
    right: -70rpx;
    width: 240rpx;
    height: 240rpx;
    pointer-events: none;
  }

  // 小面积品牌色玻璃图标砖（保证内嵌白色图标可读）
  .card-icon-wrap {
    position: relative;
    z-index: 1;
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16rpx;
    box-shadow:
      inset 0 1rpx 0 rgba(255, 255, 255, 0.45),
      0 6rpx 14rpx rgba(22, 48, 38, 0.16);
  }

  .card-amount {
    position: relative;
    z-index: 1;
    font-size: 44rpx;
    font-weight: 700;
    line-height: 1.12;
    color: $text-title;
    font-variant-numeric: tabular-nums;
  }

  .card-label {
    position: relative;
    z-index: 1;
    margin-top: 8rpx;
    font-size: 22rpx;
    color: $text-regular;
  }
}

.expense-card .card-icon-wrap {
  background: linear-gradient(
    150deg,
    rgba(23, 81, 66, 0.92) 0%,
    rgba(12, 58, 46, 0.96) 100%
  );
}

.income-card {
  .card-icon-wrap {
    background: linear-gradient(
      150deg,
      rgba(181, 82, 62, 0.92) 0%,
      rgba(145, 53, 39, 0.96) 100%
    );
  }

  // 本应用收入为红：金额沿用语义色，支出用标题墨色
  .card-amount {
    color: $color-income;
  }
}

/* ---------- 玻璃分组卡 ---------- */
.flow-list-wrap {
  padding: 0;
}

/* 空态：整块玻璃面，避免文字直接浮在壁纸上 */
.flow-empty {
  border-radius: 40rpx;
  overflow: hidden;
}

.flow-group {
  margin-bottom: 24rpx;
  border-radius: 40rpx;
  overflow: hidden;

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22rpx 26rpx 18rpx;
    border-bottom: 1rpx solid $divider;

    .group-title {
      display: flex;
      align-items: baseline;

      .group-day {
        font-size: 30rpx;
        font-weight: 700;
        color: $text-title;
      }

      .group-date {
        margin-left: 12rpx;
        font-size: 21rpx;
        color: $text-secondary;
        font-variant-numeric: tabular-nums;
      }
    }

    .group-summary {
      display: flex;
      align-items: center;

      .summary-chip {
        padding: 6rpx 16rpx;
        font-size: 20rpx;
        line-height: 1.4;
        border-radius: 999rpx;
        color: $color-tint-text;
        background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
        box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
        font-variant-numeric: tabular-nums;

        & + & {
          margin-left: 10rpx;
        }

        &.income {
          color: $color-income;
          background: var(--c-danger-soft-glass, rgba(223, 84, 63, 0.12));
        }
      }
    }
  }

  // 行内透明：折射由外层玻璃分组卡统一提供
  .flow-list {
    background: transparent;
  }
}

/* 分页底态（触底加载中 / 没有更多了） */
.list-footer {
  display: flex;
  justify-content: center;
  padding: 6rpx 0 26rpx;

  .footer-text {
    padding: 8rpx 24rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: $text-secondary;
    background: var(--c-glass-subtle, rgba(255, 255, 255, 0.3));
    border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  }
}
</style>
