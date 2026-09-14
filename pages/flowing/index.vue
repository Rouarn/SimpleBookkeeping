<!--
  @file 流水页（pages/flowing/index.vue）
  @description 按「月份 + 收支类型」筛选账单并按天分组展示：
               1. 顶部导航：类型选择（全部类型 / 支出 / 收入，ActionSheet）与搜索入口；
               2. 日期选择：uni-app 标准 picker（mode=date, fields=month）；
               3. 本月总支出 / 总收入双卡；
               4. 按天分组的流水列表，每组显示日标签（今天/昨天/周X）、日期与
                  当日收支合计，组内账单点击进入详情；无数据时显示空态提示。
               月份与类型选择态持久化在 app store，分组数据由 bill store 实时派生。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
<template>
  <view class="flowing-water">
    <!-- 顶部导航 -->
    <view class="top-bar">
      <view class="type-selector" @click="handleTypeClick">
        <text class="type-text">{{ currentType }}</text>
        <uni-icons type="bottom" size="22" color="#1d1d1f"></uni-icons>
      </view>
      <view class="search-btn" @click="handleSearch">
        <uni-icons type="search" size="34" color="#1d1d1f"></uni-icons>
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
        <text class="date-text">{{ currentMonth }}</text>
        <uni-icons type="bottom" size="22" color="#4a6ef7"></uni-icons>
      </view>
    </picker>

    <!-- 本月收支卡片 -->
    <view class="summary-cards">
      <view class="summary-card expense-card">
        <view class="card-decor">
          <view class="card-line"></view>
        </view>
        <view class="card-icon-wrap">
          <uni-icons type="bars" size="34" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.expense }}</view>
        <view class="card-label">本月总支出（元）</view>
      </view>
      <view class="summary-card income-card">
        <view class="card-decor">
          <view class="card-line income-line"></view>
        </view>
        <view class="card-icon-wrap">
          <uni-icons type="redo" size="34" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.income }}</view>
        <view class="card-label">本月总收入（元）</view>
      </view>
    </view>

    <!-- 流水列表 -->
    <view class="flow-list-wrap">
      <view v-if="groups.length === 0" class="empty-tip">
        <text class="empty-text">本月暂无流水</text>
        <text class="empty-sub">记一笔，开始追踪你的收支</text>
      </view>
      <view
        v-for="(group, gIndex) in groups"
        v-else
        :key="gIndex"
        class="flow-group"
      >
        <view class="group-header">
          <view class="group-title">
            <text class="group-day">{{ group.day }}</text>
            <text class="group-date">{{ group.date }}</text>
          </view>
          <view class="group-summary">
            <text class="summary-item">支：{{ group.expense }}</text>
            <text class="summary-item income">收：{{ group.income }}</text>
          </view>
        </view>

        <view class="flow-list">
          <view
            v-for="(item, index) in group.items"
            :key="index"
            class="flow-item"
            @click="goDetail(item)"
          >
            <view
              class="flow-icon-wrap"
              :style="{ backgroundColor: item.iconBg }"
            >
              <text class="flow-icon">{{ item.iconText }}</text>
            </view>
            <view class="flow-info">
              <view class="flow-title-row">
                <view class="flow-title-wrap">
                  <text class="flow-title">{{ item.title }}</text>
                  <text v-if="item.remark" class="flow-remark"
                    >- {{ item.remark }}</text
                  >
                </view>
                <text class="flow-amount" :class="{ income: item.amount > 0 }">
                  {{ item.amount > 0 ? "+" : "" }}{{ item.amount.toFixed(2) }}
                </text>
              </view>
              <view class="flow-meta">
                <text class="flow-time">{{ item.time }}</text>
                <text class="flow-divider">|</text>
                <text class="flow-pay">{{ item.payMethod }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 流水页脚本模块
 * 模块说明：
 * - useFlowingData()：取得可读写的 currentMonth / currentType（自动持久化）、
 *   按天分组 groups 与当月汇总 monthCard；
 * - 本页仅负责三个交互入口：类型 ActionSheet、月份 picker、搜索占位按钮。
 */
import { useFlowingData, goBillDetail } from "@/composables/useBookkeeping";

// 类型选项（顺序即 ActionSheet 中的展示顺序，tapIndex 直接映射）
const typeOptions = ["全部类型", "支出", "收入"];

// 月份 / 类型选择态持久化在 app store；分组与月汇总由 bill store 实时派生
const { currentMonth, currentType, groups, monthCard } = useFlowingData();

/** 点击顶部类型文字 → 弹出 ActionSheet 切换筛选类型（写入后列表自动重算） */
const handleTypeClick = () => {
  uni.showActionSheet({
    itemList: typeOptions,
    success: res => {
      currentType.value = typeOptions[res.tapIndex];
    },
  });
};

/** 搜索按钮（功能占位，后续接入账单检索） */
const handleSearch = () => {
  uni.showToast({ title: "搜索", icon: "none" });
};

/**
 * 月份 picker 选中回调
 * @param {object} e uni-app picker change 事件，e.detail.value 形如 '2026-09'
 */
const handleDateChange = e => {
  currentMonth.value = e.detail.value;
};

/**
 * 点击流水单条 → 跳转详情页
 * @param {import('@/store/types').BillViewModel} item 被点击的流水项
 */
const goDetail = item => {
  goBillDetail(item.id);
};
</script>

<style lang="scss" scoped>
.flowing-water {
  width: 100%;
  min-height: 100vh;
  margin-top: var(--status-bar-height);
  background-color: #f4f5fd;
  padding-bottom: 40rpx;
}

// 顶部导航
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;

  .type-selector {
    display: flex;
    align-items: center;

    .type-text {
      font-size: 44rpx;
      font-weight: 700;
      color: #1d1d1f;
      letter-spacing: 2rpx;
      margin-right: 8rpx;
    }
  }

  .search-btn {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// 日期选择
.date-filter {
  display: inline-flex;
  align-items: center;
  margin: 12rpx 0 24rpx 32rpx;
  padding: 12rpx 28rpx;
  background-color: #eaf0ff;
  border-radius: 12rpx;

  .date-text {
    font-size: 32rpx;
    font-weight: 600;
    color: #4a6ef7;
    margin-right: 12rpx;
  }
}

// 收支卡片
.summary-cards {
  display: flex;
  padding: 0 24rpx;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.summary-card {
  flex: 1;
  position: relative;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  overflow: hidden;

  .card-decor {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    width: 180rpx;
    height: 100rpx;
    opacity: 0.4;
    z-index: 0;

    .card-line {
      width: 100%;
      height: 100%;
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 100' preserveAspectRatio='none'><path d='M0,70 L25,55 L50,65 L75,40 L100,55 L125,30 L150,42 L180,20 L180,100 L0,100 Z' fill='none' stroke='white' stroke-width='2' stroke-opacity='0.5'/><path d='M0,70 L25,55 L50,65 L75,40 L100,55 L125,30 L150,42 L180,20' fill='none' stroke='white' stroke-width='2.5' stroke-opacity='0.8'/></svg>")
        no-repeat center / contain;
    }

    .income-line {
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 100' preserveAspectRatio='none'><path d='M0,80 L25,70 L50,75 L75,55 L100,65 L125,40 L150,50 L180,25 L180,100 L0,100 Z' fill='white' fill-opacity='0.15'/><path d='M0,80 L25,70 L50,75 L75,55 L100,65 L125,40 L150,50 L180,25' fill='none' stroke='white' stroke-width='2.5' stroke-opacity='0.8'/></svg>")
        no-repeat center / contain;
    }
  }

  .card-icon-wrap {
    position: relative;
    z-index: 1;
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    background: rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
  }

  .card-amount {
    position: relative;
    z-index: 1;
    font-size: 56rpx;
    font-weight: 700;
    color: #fff;
    letter-spacing: 1rpx;
    line-height: 1.1;
  }

  .card-label {
    position: relative;
    z-index: 1;
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.85);
    margin-top: 12rpx;
  }
}

.expense-card {
  background: linear-gradient(135deg, #4a6ef7 0%, #3c64f6 50%, #2e54e0 100%);
  box-shadow: 0 12rpx 32rpx rgba(60, 100, 246, 0.3);
}

.income-card {
  background: linear-gradient(135deg, #ff7a93 0%, #ff5c7a 50%, #f0486a 100%);
  box-shadow: 0 12rpx 32rpx rgba(240, 72, 106, 0.3);
}

// 流水列表
.flow-list-wrap {
  padding: 0 24rpx;
}

.flow-group {
  margin-bottom: 28rpx;

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 12rpx 16rpx;

    .group-title {
      display: flex;
      align-items: baseline;

      .group-day {
        font-size: 38rpx;
        font-weight: 700;
        color: #1d1d1f;
        margin-right: 16rpx;
      }

      .group-date {
        font-size: 26rpx;
        color: #8a8f9c;
      }
    }

    .group-summary {
      .summary-item {
        font-size: 26rpx;
        color: #6a7080;
        margin-left: 20rpx;

        &.income {
          color: #e94e6b;
        }
      }
    }
  }

  .flow-list {
    background: #fff;
    border-radius: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);

    .flow-item {
      display: flex;
      align-items: center;
      padding: 28rpx 28rpx;
      border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);

      &:last-child {
        border-bottom: none;
      }

      .flow-icon-wrap {
        width: 88rpx;
        height: 88rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 24rpx;
        flex-shrink: 0;

        .flow-icon {
          font-size: 44rpx;
        }
      }

      .flow-info {
        flex: 1;
        min-width: 0;

        .flow-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10rpx;

          .flow-title-wrap {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: baseline;
            margin-right: 16rpx;
            overflow: hidden;
          }

          .flow-title {
            font-size: 32rpx;
            font-weight: 600;
            color: #1d1d1f;
            flex-shrink: 0;
          }

          .flow-remark {
            font-size: 26rpx;
            color: #b3b9c7;
            margin-left: 10rpx;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .flow-amount {
            font-size: 38rpx;
            font-weight: 700;
            color: #1d1d1f;
            flex-shrink: 0;

            &.income {
              color: #e94e6b;
            }
          }
        }

        .flow-meta {
          .flow-time,
          .flow-pay {
            font-size: 24rpx;
            color: #8a8f9c;
          }

          .flow-divider {
            font-size: 24rpx;
            color: #d0d4de;
            margin: 0 12rpx;
          }
        }
      }
    }
  }
}

.empty-tip {
  padding: 100rpx 0;
  text-align: center;

  .empty-text {
    display: block;
    font-size: 30rpx;
    color: #8a8f9c;
  }

  .empty-sub {
    display: block;
    font-size: 24rpx;
    color: #b3b9c7;
    margin-top: 12rpx;
  }
}
</style>
