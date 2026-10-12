<!--
  @file 消息中心（pages/messages/index.vue）
  @description 站内消息列表：
               1. 分页列表（每页 20 条，触底加载下一页，id 去重合并）+ 下拉刷新；
               2. 未读条目左侧小圆点 + 主文字加重，点击条目即标已读
                  （PUT /users/me/messages/read，乐观更新 + 失败回滚）；
               3. 顶部「全部已读」（all:true，乐观置灰未读点）；
               4. type 徽标：budget_over=预算 / security=安全 / monthly_report=报告；
               5. 相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / 日期。
               未读总数缓存于 user store（我的页角标共用），本页标已读后即时回写。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-12
-->
<template>
  <view class="messages" :class="themeClass">
    <!-- 顶部工具条：未读数 + 全部已读 -->
    <view class="toolbar">
      <text class="toolbar-hint">
        {{ unreadTotal > 0 ? `${unreadTotal} 条未读` : '消息已全部读完' }}
      </text>
      <view
        class="read-all"
        :class="{ disabled: unreadTotal === 0 || markingAll }"
        hover-class="read-all-hover"
        :hover-stay-time="60"
        @click="onMarkAll"
      >
        <uni-icons
          type="checkmarkempty"
          size="14"
          :color="accentIcon"
        ></uni-icons>
        <text class="read-all-text">全部已读</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <view class="msg-list">
      <EmptyState
        v-if="!loading && items.length === 0"
        text="暂无消息"
        sub="预算提醒与安全通知会出现在这里"
      />
      <template v-else>
        <view
          v-for="item in items"
          :key="item.id"
          class="msg-item"
          hover-class="row-hover"
          :hover-stay-time="60"
          @click="onTapItem(item)"
        >
          <!-- 未读圆点占位列（已读时空置，保持正文对齐） -->
          <view class="dot-col">
            <view v-if="!item.isRead" class="unread-dot"></view>
          </view>
          <view class="msg-icon">
            <uni-icons
              :type="typeMeta(item.type).icon"
              size="20"
              :color="typeMeta(item.type).color"
            ></uni-icons>
          </view>
          <view class="msg-body">
            <view class="msg-row">
              <text class="msg-title" :class="{ strong: !item.isRead }">
                {{ item.title }}
              </text>
              <text class="msg-type" :class="`type-${item.type}`">
                {{ typeMeta(item.type).label }}
              </text>
            </view>
            <text class="msg-content">{{ item.content }}</text>
            <text class="msg-time">{{ relativeTime(item.createdAt) }}</text>
          </view>
        </view>

        <!-- 分页底态：触底加载中 / 已加载全部 -->
        <view
          v-if="items.length > 0 && (loadingMore || finished)"
          class="list-footer"
        >
          <text class="footer-text">
            {{ loadingMore ? '加载中…' : '没有更多了' }}
          </text>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
/**
 * 消息中心脚本模块
 * 模块说明：
 * - messagesApi.list({page,pageSize}) 分页拉取（created_at 倒序），
 *   触底加载下一页并按 id 去重合并，pagination.total 判定加载完毕；
 * - 点击未读条目 → 乐观置已读 + user store 未读数递减 → PUT read ids:[Number(id)]
 *   （VO id 为数字串，后端 ids 要求 number），失败回滚并交由 http 层统一 toast；
 * - 全部已读 → PUT read all:true，乐观清零未读。
 */
import { computed, ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { messagesApi } from '@/api'
import { useUserStore } from '@/store'
import { useTheme } from '@/composables/useTheme'

const PAGE_SIZE = 20

// 深色模式：根节点主题类 + JS 取色（uni-icons color 走不了 CSS 变量）
const { themeClass, isDark } = useTheme()
const accentIcon = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))

const userStore = useUserStore()
const unreadTotal = computed(() => userStore.unreadCount)

/** @type {import('vue').Ref<import('@/api/messages').MessageItem[]>} */
const items = ref([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const markingAll = ref(false)
const finished = computed(
  () => page.value > 0 && items.value.length >= total.value,
)

/** 拉取第一页（下拉刷新 / onShow 重入共用） */
async function loadFirst() {
  const res = await messagesApi.list({ page: 1, pageSize: PAGE_SIZE })
  items.value = res?.items || []
  total.value = Number(res?.pagination?.total) || items.value.length
  page.value = 1
}

/** 触底加载下一页（按 id 去重合并，防重复插入） */
async function loadMore() {
  if (loading.value || loadingMore.value || finished.value) return
  loadingMore.value = true
  try {
    const res = await messagesApi.list({
      page: page.value + 1,
      pageSize: PAGE_SIZE,
    })
    const more = res?.items || []
    const seen = new Set(items.value.map((it) => it.id))
    items.value = items.value.concat(more.filter((m) => !seen.has(m.id)))
    total.value = Number(res?.pagination?.total) || items.value.length
    page.value += 1
  } finally {
    loadingMore.value = false
  }
}

// 进入页面拉取第一页；onShow 兜底（从详情等返回时保持新鲜）
onShow(() => {
  loading.value = true
  loadFirst()
    .catch(() => {})
    .finally(() => {
      loading.value = false
    })
})

// 下拉刷新：回到第一页
onPullDownRefresh(async () => {
  try {
    await loadFirst()
  } catch (e) {
    // 静默：http 层已 toast
  } finally {
    uni.stopPullDownRefresh()
  }
})

// 触底加载下一页
onReachBottom(() => {
  loadMore().catch(() => {})
})

/** 消息类型元数据：uni-icons 图标名 + 徽标文案 */
const TYPE_META = {
  budget_over: { label: '预算', icon: 'wallet-filled' },
  security: { label: '安全', icon: 'locked-filled' },
  monthly_report: { label: '报告', icon: 'calendar' },
}

/** 徽标 / 图标配色（浅深两盘同 token 色值：金=预算 红=安全 绿=报告） */
const TYPE_COLORS = {
  budget_over: '#c08a3e',
  security: '#d54e3c',
  monthly_report: '#2f6b54',
}

/**
 * 取消息类型元数据（未知类型兜底为「通知」中性样式）
 * @param {string} type 消息类型
 * @returns {{label: string, icon: string, color: string}}
 */
function typeMeta(type) {
  const meta = TYPE_META[type] || { label: '通知', icon: 'notification' }
  return {
    ...meta,
    // 深色下安全红 / 报告绿调亮（与 token 深浅两盘同色值）；uni-icons color 走不了 CSS 变量
    color:
      type === 'security'
        ? isDark.value
          ? '#e06651'
          : TYPE_COLORS.security
        : type === 'monthly_report'
          ? isDark.value
            ? '#58b992'
            : TYPE_COLORS.monthly_report
          : TYPE_COLORS[type] || '#98a099',
  }
}

/**
 * 消息相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / （今年）M月D日 / 跨年带年份
 * @param {string} str 服务端 ISO 时间戳
 * @returns {string}
 */
function relativeTime(str) {
  if (!str) return ''
  // 'YYYY-MM-DDTHH:mm:ss.sss+08:00'：直接 new Date；容错空格分隔的旧格式
  const t = new Date(String(str).replace(' ', 'T'))
  if (Number.isNaN(t.getTime())) return String(str)
  const diff = Date.now() - t.getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
  const now = new Date()
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  if (t.getTime() >= startToday - 24 * 60 * 60 * 1000) return '昨天'
  const md = `${t.getMonth() + 1}月${t.getDate()}日`
  return t.getFullYear() === now.getFullYear()
    ? md
    : `${t.getFullYear()}年${md}`
}

/**
 * 点击条目：未读则乐观置已读并调接口（失败回滚）
 * @param {import('@/api/messages').MessageItem} item 消息项
 */
async function onTapItem(item) {
  if (item.isRead) return
  item.isRead = true
  item.readAt = new Date().toISOString()
  userStore.setUnreadCount(unreadTotal.value - 1)
  try {
    // 后端 ids 要求 number[]（VO 的 id 是数字串）
    await messagesApi.markRead({ ids: [Number(item.id)] })
  } catch (e) {
    // 回滚乐观更新（错误 toast 由 http 层统一处理）
    item.isRead = false
    item.readAt = null
    userStore.setUnreadCount(unreadTotal.value + 1)
  }
}

/** 全部已读：乐观清零 → PUT read all:true，失败回查服务端未读数 */
async function onMarkAll() {
  if (unreadTotal.value === 0 || markingAll.value) return
  markingAll.value = true
  const prev = unreadTotal.value
  userStore.setUnreadCount(0)
  items.value.forEach((it) => {
    it.isRead = true
  })
  try {
    await messagesApi.markRead({ all: true })
  } catch (e) {
    // 回滚：重新拉取服务端未读数（比本地回退更准）
    userStore.setUnreadCount(prev)
    items.value.forEach((it) => {
      it.isRead = false
    })
    userStore.fetchUnread().catch(() => {})
  } finally {
    markingAll.value = false
  }
}
</script>

<style lang="scss" scoped>
.messages {
  min-height: 100vh;
  background: $bg-page;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

// 顶部工具条
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx 8rpx;

  .toolbar-hint {
    font-size: 24rpx;
    color: $text-secondary;
  }

  .read-all {
    display: flex;
    align-items: center;
    padding: 8rpx 20rpx;
    border-radius: 999rpx;
    background: $bg-tint-icon;

    .read-all-text {
      margin-left: 6rpx;
      font-size: 24rpx;
      color: $color-primary-mid;
      font-weight: 500;
    }

    &.read-all-hover {
      background: $bg-hover;
    }

    // 无未读 / 处理中：弱化（仍可点击，服务端幂等）
    &.disabled {
      opacity: 0.45;
    }
  }
}

// 消息列表
.msg-list {
  margin: 16rpx 24rpx 0;
  background: $bg-card;
  border-radius: $radius-card;
  box-shadow: $shadow-card-lg;
  overflow: hidden;
}

.msg-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 26rpx 28rpx 26rpx 16rpx;

  &::after {
    content: '';
    position: absolute;
    left: 104rpx;
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: $divider;
  }
  &:last-child::after {
    display: none;
  }
  &.row-hover {
    background: $bg-hover;
  }

  // 未读圆点占位列
  .dot-col {
    width: 44rpx;
    display: flex;
    justify-content: center;
    padding-top: 14rpx;
    flex-shrink: 0;

    .unread-dot {
      width: 14rpx;
      height: 14rpx;
      border-radius: 50%;
      background: $color-danger;
    }
  }

  .msg-icon {
    width: 64rpx;
    height: 64rpx;
    margin-right: 20rpx;
    border-radius: $radius-md;
    background: $bg-tint-icon;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .msg-body {
    flex: 1;
    min-width: 0;

    .msg-row {
      display: flex;
      align-items: center;

      .msg-title {
        flex: 1;
        min-width: 0;
        font-size: 28rpx;
        color: $text-primary;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        // 未读主文字加重
        &.strong {
          font-weight: 700;
          color: $text-strong;
        }
      }

      .msg-type {
        margin-left: 12rpx;
        padding: 2rpx 14rpx;
        border-radius: 999rpx;
        font-size: 20rpx;
        line-height: 30rpx;
        flex-shrink: 0;

        // 徽标配色：预算=金 / 安全=红 / 报告=主题绿（底色取对应浅底 token）
        &.type-budget_over {
          color: $color-gold;
          background: $bg-tint;
        }
        &.type-security {
          color: $color-danger;
          background: $color-danger-bg;
        }
        &.type-monthly_report {
          color: $color-primary-mid;
          background: $bg-tint-icon;
        }
      }
    }

    .msg-content {
      display: block;
      margin-top: 10rpx;
      font-size: 24rpx;
      line-height: 1.6;
      color: $text-regular;
    }

    .msg-time {
      display: block;
      margin-top: 8rpx;
      font-size: 22rpx;
      color: $text-secondary;
      font-variant-numeric: tabular-nums;
    }
  }
}

// 分页底态
.list-footer {
  padding: 24rpx 0 12rpx;
  display: flex;
  justify-content: center;

  .footer-text {
    font-size: 24rpx;
    color: $text-secondary;
  }
}
</style>
