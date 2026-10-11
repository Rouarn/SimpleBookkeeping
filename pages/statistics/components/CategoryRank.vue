<!--
  @file 分类 / 支付方式排行（pages/statistics/components/CategoryRank.vue）
  @description 统计页排行面板（自 pages/statistics/index.vue 拆分，纯展示组件）：
               金额、笔数、占比与进度条；kind='category' 渲染圆形 emoji 分类图标，
               kind='pay' 渲染圆角方形简称头像。收入 / 支出仅标题与空态文案不同，
               由父组件通过 title / emptyText props 下发。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view class="panel">
    <view class="panel-header">
      <text class="panel-title">{{ title }}</text>
      <text class="panel-extra">共 {{ items.length }} {{ unit }}</text>
    </view>

    <view class="rank-list">
      <view v-if="items.length === 0" class="empty-tip">
        <text class="empty-text">{{ emptyText }}</text>
      </view>
      <template v-else>
        <view v-for="(row, index) in items" :key="row.name" class="rank-row">
          <text class="rank-index" :class="{ top: index < 3 }">{{
            index + 1
          }}</text>
          <!-- 分类：圆形 emoji 图标 -->
          <view
            v-if="kind === 'category'"
            class="cat-icon"
            :style="{ backgroundColor: row.bg }"
          >
            <text class="cat-emoji">{{ row.icon }}</text>
          </view>
          <!-- 支付方式：圆角方形简称头像 -->
          <view
            v-else
            class="pay-avatar"
            :style="{ backgroundColor: row.bg, color: row.color }"
          >
            {{ row.short }}
          </view>
          <view class="rank-main">
            <view class="rank-line">
              <text class="rank-name">{{ row.name }}</text>
              <text class="rank-amount">{{ fmt(row.amount) }}</text>
            </view>
            <view class="rank-track">
              <view
                class="rank-fill"
                :class="{ 'pay-fill': kind === 'pay' }"
                :style="{
                  width: row.percent + '%',
                  backgroundColor: row.color,
                }"
              ></view>
            </view>
            <view class="rank-line">
              <text class="rank-count">{{ row.count }} 笔</text>
              <text class="rank-percent" :style="{ color: row.color }"
                >{{ row.percent.toFixed(1) }}%</text
              >
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
/**
 * 排行面板：props 下数据，无交互上抛；金额格式化走 utils/rmb。
 */
import { formatMoney } from '@/utils/rmb'

const fmt = formatMoney

defineProps({
  /** 面板标题（如「支出分类」「支付方式」） */
  title: { type: String, default: '' },
  /** 数量单位文案（分类「类」/ 支付方式「种」） */
  unit: { type: String, default: '类' },
  /** 排行项 [{ name, icon?, short?, color, bg, amount, count, percent }] */
  items: { type: Array, default: () => [] },
  /** 图标形态：'category' 圆形 emoji | 'pay' 圆角方形简称 */
  kind: { type: String, default: 'category' },
  /** 空数据文案 */
  emptyText: { type: String, default: '暂无数据' },
})
</script>

<style lang="scss" scoped>
// 通用白色面板
.panel {
  margin: 0 24rpx 24rpx;
  padding: 30rpx 28rpx 26rpx;
  background: #ffffff;
  border-radius: $radius-lg;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .panel-title {
      font-size: 31rpx;
      font-weight: 600;
      color: $text-title;
    }

    .panel-extra {
      font-size: 22rpx;
      color: $text-secondary;
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
        color: $text-primary;
      }

      .rank-amount {
        font-size: 29rpx;
        font-weight: 700;
        color: $text-strong;
        font-variant-numeric: tabular-nums;
      }

      .rank-count {
        font-size: 21rpx;
        color: $text-secondary;
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
    color: $text-placeholder;
  }
}
</style>
