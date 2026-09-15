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
  @modify 2026-09-15
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
        <view class="card-decor">
          <view class="decor-ring r1"></view>
          <view class="decor-ring r2"></view>
          <view class="decor-ring r3"></view>
        </view>
        <view class="card-icon-wrap">
          <uni-icons type="bars" size="26" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.expense }}</view>
        <view class="card-label">本月总支出（元）</view>
      </view>
      <view class="summary-card income-card">
        <view class="card-decor">
          <view class="decor-ring r1"></view>
          <view class="decor-ring r2"></view>
          <view class="decor-ring r3"></view>
        </view>
        <view class="card-icon-wrap">
          <uni-icons type="redo" size="26" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthCard.income }}</view>
        <view class="card-label">本月总收入（元）</view>
      </view>
    </view>

    <!-- 流水列表 -->
    <view class="flow-list-wrap">
      <view v-if="groups.length === 0" class="empty-tip">
        <view class="empty-coin">¥</view>
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
            <text class="summary-chip">支 {{ group.expense }}</text>
            <text class="summary-chip income">收 {{ group.income }}</text>
          </view>
        </view>

        <view class="flow-list">
          <view
            v-for="item in group.items"
            :key="item.id"
            class="flow-item"
            hover-class="row-hover"
            :hover-stay-time="60"
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
                  <text v-if="item.remark" class="flow-remark">{{
                    item.remark
                  }}</text>
                </view>
                <text class="flow-amount" :class="{ income: item.amount > 0 }">
                  {{ item.amount > 0 ? "+" : "" }}{{ item.amount.toFixed(2) }}
                </text>
              </view>
              <view class="flow-meta">
                <text class="flow-time">{{ item.time }}</text>
                <text class="flow-dot">·</text>
                <text class="flow-pay">{{ item.payMethod }}</text>
              </view>
            </view>
            <uni-icons
              class="flow-arrow"
              type="right"
              size="14"
              color="#c2c9c3"
            ></uni-icons>
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
  background: #f3f5f2;
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
      color: #1e2521;
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
    color: #2f6b54;
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
  border-radius: 24rpx;
  padding: 30rpx 26rpx;
  overflow: hidden;

  // 同心圆环暗纹（与首页主卡同源）
  .card-decor {
    position: absolute;
    top: -90rpx;
    right: -70rpx;
    width: 240rpx;
    height: 240rpx;
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
      width: 240rpx;
      height: 240rpx;
    }
    .r2 {
      width: 166rpx;
      height: 166rpx;
      border-color: rgba(255, 255, 255, 0.11);
    }
    .r3 {
      width: 92rpx;
      height: 92rpx;
      border-color: rgba(255, 255, 255, 0.15);
    }
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
  background: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
  box-shadow: 0 14rpx 32rpx rgba(12, 58, 46, 0.24);
}

.income-card {
  background: linear-gradient(150deg, #b5523e 0%, #913527 100%);
  box-shadow: 0 14rpx 32rpx rgba(145, 53, 39, 0.24);
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
    padding: 14rpx 8rpx 14rpx;

    .group-title {
      display: flex;
      align-items: baseline;

      .group-day {
        font-size: 32rpx;
        font-weight: 700;
        color: #1e2521;
      }

      .group-date {
        margin-left: 12rpx;
        font-size: 22rpx;
        color: #98a099;
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
        background: #e9f0eb;
        color: #56645c;
        font-variant-numeric: tabular-nums;

        & + & {
          margin-left: 10rpx;
        }

        &.income {
          background: #fcebe8;
          color: #d54e3c;
        }
      }
    }
  }

  .flow-list {
    background: #fff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);
    overflow: hidden;

    .row-hover {
      background: #f6f9f6;
    }

    .flow-item {
      position: relative;
      display: flex;
      align-items: center;
      padding: 26rpx 26rpx;

      &::after {
        content: "";
        position: absolute;
        left: 128rpx;
        right: 0;
        bottom: 0;
        height: 1rpx;
        background: #edf0ec;
      }
      &:last-child::after {
        display: none;
      }

      .flow-icon-wrap {
        width: 80rpx;
        height: 80rpx;
        margin-right: 22rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .flow-icon {
          font-size: 38rpx;
        }
      }

      .flow-info {
        flex: 1;
        min-width: 0;

        .flow-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .flow-title-wrap {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: baseline;
            margin-right: 16rpx;
            overflow: hidden;
          }

          .flow-title {
            font-size: 29rpx;
            font-weight: 500;
            color: #202622;
            flex-shrink: 0;
          }

          .flow-remark {
            margin-left: 10rpx;
            font-size: 23rpx;
            color: #98a099;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .flow-amount {
            font-size: 31rpx;
            font-weight: 600;
            color: #222924;
            flex-shrink: 0;
            font-variant-numeric: tabular-nums;

            &.income {
              color: #df543f;
            }
          }
        }

        .flow-meta {
          margin-top: 7rpx;

          .flow-time,
          .flow-pay {
            font-size: 21rpx;
            color: #98a099;
          }
          .flow-dot {
            margin: 0 9rpx;
            font-size: 21rpx;
            color: #c6ccc6;
          }
        }
      }

      .flow-arrow {
        flex-shrink: 0;
        margin-left: 12rpx;
      }
    }
  }
}

// 空状态
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72rpx 0 80rpx;

  .empty-coin {
    width: 104rpx;
    height: 104rpx;
    margin-bottom: 28rpx;
    border-radius: 50%;
    border: 2rpx solid #d6e2da;
    background: #f8faf8;
    box-shadow: 0 0 0 10rpx rgba(76, 175, 135, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    font-weight: 600;
    color: #7ba48f;
  }

  .empty-text {
    font-size: 28rpx;
    color: #8b938d;
  }

  .empty-sub {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: #abb3ac;
  }
}
</style>
