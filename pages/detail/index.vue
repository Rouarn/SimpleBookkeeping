<template>
  <view class="detail-page">
    <!-- 导航栏 -->
    <uni-nav-bar
      title="账单详情"
      left-icon="left"
      right-icon="redo"
      background-color="#3c64f6"
      color="#ffffff"
      :border="false"
      status-bar
      @clickLeft="goBack"
    />

    <!-- 账单卡片 -->
    <view class="bill-card">
      <!-- 顶部图标 -->
      <view class="bill-icon-wrap">
        <text class="bill-icon">{{ bill.iconText }}</text>
      </view>

      <view class="bill-category">{{ bill.title }}</view>
      <view class="bill-amount">
        {{ bill.amount > 0 ? "+" : "" }}{{ bill.amount.toFixed(2) }}
      </view>

      <!-- 票据分隔线 -->
      <view class="ticket-divider">
        <view class="notch notch-left"></view>
        <view class="notch notch-right"></view>
      </view>

      <!-- 详情信息 -->
      <view class="info-list">
        <view class="info-row">
          <text class="info-label">所属账本</text>
          <text class="info-value">{{ bill.bookName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">账户</text>
          <text class="info-value">{{ bill.payMethod }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">记录人</text>
          <text class="info-value">{{ bill.recorder }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">记录时间</text>
          <text class="info-value">{{ bill.recordTime }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">备注</text>
          <text class="info-value remark">{{ bill.remark }}</text>
        </view>
      </view>

      <view class="month-summary">
        截止本单该月目前支出{{ bill.monthExpense }}元
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="action-bar">
      <view class="action-item" @click="handleDelete">
        <view class="action-btn">
          <uni-icons type="trash" size="26" color="#e94e6b"></uni-icons>
        </view>
        <text class="action-text">删除</text>
      </view>
      <view class="action-item" @click="handleEdit">
        <view class="action-btn">
          <uni-icons type="compose" size="26" color="#3c64f6"></uni-icons>
        </view>
        <text class="action-text">编辑</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive } from "vue";
import { onLoad } from "@dcloudio/uni-app";

const bill = reactive({
  title: "公共交通",
  iconText: "🚌",
  amount: -500,
  payMethod: "微信支付",
  time: "13:05:36",
  bookName: "个人账本",
  recorder: "小绿",
  recordTime: "2026-12-18 13:05:36",
  remark: "公司周年庆团建汽车大巴费用支出",
  monthExpense: "6080.29",
});

onLoad(() => {
  const pages = getCurrentPages();
  const eventChannel = pages[pages.length - 1].getOpenerEventChannel?.();
  eventChannel?.on("billData", data => {
    Object.assign(bill, data);
    bill.recordTime = `2026-12-18 ${data.time || "13:05:36"}`;
  });
});

const goBack = () => {
  uni.navigateBack();
};

const handleDelete = () => {
  uni.showModal({
    title: "提示",
    content: "确定删除该账单吗？",
    success: res => {
      if (res.confirm) {
        uni.navigateBack();
      }
    },
  });
};

const handleEdit = () => {
  uni.showToast({ title: "编辑", icon: "none" });
};
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: #3c64f6;
}

// 账单卡片
.bill-card {
  position: relative;
  margin: 128rpx 40rpx 0;
  padding: 0 48rpx 48rpx;
  background-color: #fff;
  border-radius: 24rpx;

  // 顶部图标
  .bill-icon-wrap {
    position: absolute;
    top: -80rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 152rpx;
    height: 152rpx;
    border-radius: 50%;
    background-color: #fff;
    border: 6rpx solid #3c64f6;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);

    .bill-icon {
      font-size: 72rpx;
      line-height: 1;
    }
  }

  .bill-category {
    padding-top: 112rpx;
    text-align: center;
    font-size: 30rpx;
    color: #8a8f9c;
  }

  .bill-amount {
    margin-top: 24rpx;
    text-align: center;
    font-size: 64rpx;
    font-weight: 700;
    color: #1d1d1f;
    letter-spacing: 2rpx;
  }

  // 票据分隔线
  .ticket-divider {
    position: relative;
    margin: 56rpx 0;
    height: 0;
    border-top: 2rpx dashed #e2e6f0;

    .notch {
      position: absolute;
      top: -22rpx;
      width: 44rpx;
      height: 44rpx;
      border-radius: 50%;
      background-color: #3c64f6;

      &.notch-left {
        left: -70rpx;
      }

      &.notch-right {
        right: -70rpx;
      }
    }
  }

  // 详情信息
  .info-list {
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 44rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-size: 30rpx;
        color: #8a8f9c;
        flex-shrink: 0;
      }

      .info-value {
        font-size: 30rpx;
        font-weight: 500;
        color: #1d1d1f;
        text-align: right;
        margin-left: 40rpx;

        &.remark {
          line-height: 1.5;
        }
      }
    }
  }

  // 成员头像
  .member-list {
    display: flex;

    .member-avatar {
      width: 56rpx;
      height: 56rpx;
      border-radius: 50%;
      border: 4rpx solid #fff;
      margin-left: -12rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
      overflow: hidden;

      &:first-child {
        margin-left: 0;
      }
    }
  }

  .month-summary {
    margin-top: 100rpx;
    text-align: center;
    font-size: 26rpx;
    color: #b3b9c9;
  }
}

// 底部操作
.action-bar {
  display: flex;
  justify-content: space-around;
  padding: 96rpx 80rpx calc(80rpx + env(safe-area-inset-bottom));

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .action-btn {
      width: 116rpx;
      height: 116rpx;
      border-radius: 50%;
      background-color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);

      &:active {
        transform: scale(0.95);
      }
    }

    .action-text {
      margin-top: 20rpx;
      font-size: 28rpx;
      font-weight: 500;
      color: #fff;
    }
  }
}
</style>
