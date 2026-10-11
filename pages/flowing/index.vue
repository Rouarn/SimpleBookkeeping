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
-->
<template>
  <view class="flowing-water">
    <!-- 顶部导航 -->
    <view class="top-bar">
      <view class="type-selector" @click="handleTypeClick">
        <text class="type-text">{{ currentType }}</text>
        <uni-icons type="bottom" size="20" color="#1e2521"></uni-icons>
      </view>
      <view class="search-btn" @click="handleSearch">
        <uni-icons type="search" size="28" color="#3c4a42"></uni-icons>
      </view>
    </view>

    <!-- 搜索框：点右上角搜索图标展开，输入关键字防抖触发检索 -->
    <view v-if="searchVisible" class="search-bar">
      <uni-icons type="search" size="22" color="#98a099"></uni-icons>
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
      mode="date"
      :value="currentMonth"
      fields="month"
      @change="handleDateChange"
    >
      <view class="date-filter">
        <uni-icons type="calendar" size="26" color="#2f6b54"></uni-icons>
        <text class="date-text">{{ currentMonth }}</text>
        <uni-icons type="bottom" size="16" color="#2f6b54"></uni-icons>
      </view>
    </picker>

    <!-- 本月收支卡片 -->
    <view class="summary-cards">
      <view class="summary-card expense-card">
        <DecorRing
          class="card-decor"
          :size="240"
          :middle="166"
          :inner="92"
          :middle-opacity="0.11"
          :inner-opacity="0.15"
        />
        <view class="card-icon-wrap">
          <uni-icons type="bars" size="26" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.expense }}</view>
        <view class="card-label">本月总支出（元）</view>
      </view>
      <view class="summary-card income-card">
        <DecorRing
          class="card-decor"
          :size="240"
          :middle="166"
          :inner="92"
          :middle-opacity="0.11"
          :inner-opacity="0.15"
        />
        <view class="card-icon-wrap">
          <uni-icons type="redo" size="26" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.income }}</view>
        <view class="card-label">本月总收入（元）</view>
      </view>
    </view>

    <!-- 流水列表 -->
    <view class="flow-list-wrap">
      <EmptyState
        v-if="groups.length === 0"
        :text="keyword ? '未找到相关账单' : '本月暂无流水'"
        :sub="keyword ? '换个关键词试试' : '记一笔，开始追踪你的收支'"
      />
      <template v-else>
        <view
          v-for="group in groups"
          :key="group.recordDate"
          class="flow-group"
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
import { ref, watch } from 'vue'
import {
  onShow,
  onUnload,
  onReachBottom,
  onPullDownRefresh,
} from '@dcloudio/uni-app'
import { useFlowingData, goBillDetail } from '@/composables/useBookkeeping'
import { billsApi, normalizeFileUrl } from '@/api'

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
  width: 100%;
  min-height: 100vh;
  margin-top: var(--status-bar-height);
  background: $bg-page;
  padding-bottom: 160rpx;
}

// 顶部导航
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 20rpx;

  .type-selector {
    display: flex;
    align-items: center;

    .type-text {
      font-size: 42rpx;
      font-weight: 700;
      color: $text-title;
      letter-spacing: 1rpx;
      margin-right: 8rpx;
    }
  }

  .search-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 16rpx rgba(28, 54, 45, 0.08);
  }
}

// 搜索框（与日期 pill 同视觉语言：白底胶囊 + 轻阴影）
.search-bar {
  display: flex;
  align-items: center;
  margin: 0 28rpx 20rpx;
  padding: 0 26rpx;
  height: 76rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(28, 54, 45, 0.07);

  .search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    margin-left: 16rpx;
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

// 日期选择
.date-filter {
  display: inline-flex;
  align-items: center;
  margin: 10rpx 0 28rpx 28rpx;
  padding: 12rpx 24rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(28, 54, 45, 0.07);

  .date-text {
    margin: 0 10rpx 0 12rpx;
    font-size: 26rpx;
    font-weight: 600;
    color: $color-primary-mid;
    font-variant-numeric: tabular-nums;
  }
}

// 收支卡片
.summary-cards {
  display: flex;
  padding: 0 24rpx;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.summary-card {
  flex: 1;
  position: relative;
  border-radius: $radius-card;
  padding: 30rpx 26rpx;
  overflow: hidden;

  // 同心圆环暗纹（DecorRing 组件根节点，环体样式内聚在组件内）
  .card-decor {
    position: absolute;
    top: -90rpx;
    right: -70rpx;
    width: 240rpx;
    height: 240rpx;
    pointer-events: none;
  }

  .card-icon-wrap {
    position: relative;
    z-index: 1;
    width: 58rpx;
    height: 58rpx;
    border-radius: 16rpx;
    background: rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18rpx;
  }

  .card-amount {
    position: relative;
    z-index: 1;
    font-size: 48rpx;
    font-weight: 700;
    color: #fff;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .card-label {
    position: relative;
    z-index: 1;
    font-size: 23rpx;
    color: rgba(255, 255, 255, 0.72);
    margin-top: 10rpx;
  }
}

.expense-card {
  background: $gradient-header;
  box-shadow: 0 14rpx 32rpx rgba(12, 58, 46, 0.24);
}

.income-card {
  background: $gradient-income;
  box-shadow: 0 14rpx 32rpx rgba(145, 53, 39, 0.24);
}

// 流水列表
.flow-list-wrap {
  padding: 0 24rpx;
}

// 分页底态（触底加载中 / 没有更多了）
.list-footer {
  display: flex;
  justify-content: center;
  padding: 8rpx 0 26rpx;

  .footer-text {
    font-size: 23rpx;
    color: $text-secondary;
  }
}

.flow-group {
  margin-bottom: 28rpx;

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14rpx 8rpx 14rpx;

    .group-title {
      display: flex;
      align-items: baseline;

      .group-day {
        font-size: 32rpx;
        font-weight: 700;
        color: $text-title;
      }

      .group-date {
        margin-left: 12rpx;
        font-size: 22rpx;
        color: $text-secondary;
        font-variant-numeric: tabular-nums;
      }
    }

    .group-summary {
      display: flex;
      align-items: center;

      .summary-chip {
        padding: 7rpx 16rpx;
        font-size: 21rpx;
        line-height: 1.4;
        border-radius: 999rpx;
        background: $bg-tint;
        color: #56645c;
        font-variant-numeric: tabular-nums;

        & + & {
          margin-left: 10rpx;
        }

        &.income {
          background: $color-danger-bg;
          color: $color-danger;
        }
      }
    }
  }

  .flow-list {
    background: #fff;
    border-radius: $radius-card;
    box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);
    overflow: hidden;
  }
}
</style>
