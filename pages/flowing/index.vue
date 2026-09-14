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
        <view class="card-amount">{{ monthExpense }}</view>
        <view class="card-label">本月总支出（元）</view>
      </view>
      <view class="summary-card income-card">
        <view class="card-decor">
          <view class="card-line income-line"></view>
        </view>
        <view class="card-icon-wrap">
          <uni-icons type="redo" size="34" color="#fff"></uni-icons>
        </view>
        <view class="card-amount">{{ monthIncome }}</view>
        <view class="card-label">本月总收入（元）</view>
      </view>
    </view>

    <!-- 流水列表 -->
    <view class="flow-list-wrap">
      <view
        v-for="(group, gIndex) in filteredGroups"
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
                <text class="flow-title">{{ item.title }}</text>
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
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";

// 类型选项
const typeOptions = ["全部类型", "支出", "收入"];
const currentType = ref(typeOptions[0]);

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const currentMonth = ref(getCurrentMonth());
const monthExpense = ref("130295.85");
const monthIncome = ref("4865.46");

const flowGroups = ref([
  {
    day: "今天",
    date: "12月19日",
    expense: "390.29",
    income: "8.66",
    items: [
      {
        title: "公共交通",
        iconText: "🚌",
        iconBg: "#eef2ff",
        amount: -12.0,
        time: "18:39",
        payMethod: "微信支付",
      },
      {
        title: "收益",
        iconText: "💰",
        iconBg: "#fff0f0",
        amount: 8.66,
        time: "09:45",
        payMethod: "支付宝",
      },
      {
        title: "餐饮",
        iconText: "🍽️",
        iconBg: "#eef2ff",
        amount: -29.5,
        time: "10:02",
        payMethod: "微信支付",
      },
    ],
  },
  {
    day: "昨天",
    date: "12月18日",
    expense: "1696.23",
    income: "8.66",
    items: [
      {
        title: "购物",
        iconText: "🛍️",
        iconBg: "#eef2ff",
        amount: -520.0,
        time: "18:39",
        payMethod: "微信支付",
      },
      {
        title: "收益",
        iconText: "💰",
        iconBg: "#fff0f0",
        amount: 8.66,
        time: "09:45",
        payMethod: "支付宝",
      },
    ],
  },
]);

// 根据当前类型筛选流水分组
const filteredGroups = computed(() => {
  const type = currentType.value;
  if (type === "全部类型") return flowGroups.value;

  return flowGroups.value
    .map(group => {
      const items = group.items.filter(item =>
        type === "支出" ? item.amount < 0 : item.amount > 0,
      );
      if (items.length === 0) return null;
      return { ...group, items };
    })
    .filter(Boolean);
});

const handleTypeClick = () => {
  uni.showActionSheet({
    itemList: typeOptions,
    success: res => {
      currentType.value = typeOptions[res.tapIndex];
    },
  });
};

const handleSearch = () => {
  uni.showToast({ title: "搜索", icon: "none" });
};

const handleDateChange = e => {
  currentMonth.value = e.detail.value;
};

const goDetail = item => {
  uni.navigateTo({
    url: "/pages/detail/index",
    success: res => {
      res.eventChannel.emit("billData", item);
    },
  });
};

onLoad(() => {
  // 可以在这里添加初始化逻辑
});
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

          .flow-title {
            font-size: 32rpx;
            font-weight: 600;
            color: #1d1d1f;
          }

          .flow-amount {
            font-size: 38rpx;
            font-weight: 700;
            color: #1d1d1f;

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
</style>
