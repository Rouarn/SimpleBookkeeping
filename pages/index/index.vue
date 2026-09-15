<!--
  @file 首页（pages/index/index.vue）
  @description 账本应用首页，展示三大区块：
               1. 顶部问候与用户昵称；
               2. 本月统计卡：本月支出（大字）、本月收入、本月预算（可点击设置）、
                  结余与预算执行进度条；
               3. 今日流水：按时间倒序展示当天账单（图标 / 标题 / 备注 / 带符号金额 /
                  时间 / 支付方式），点击单条跳转账单详情，空数据时显示引导提示。
               页面不直接操作 store，全部数据与动作来自 useHomeData / goBillDetail。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
<template>
  <view class="home">
    <view class="home-content">
      <!-- 顶部问候 -->
      <view class="greeting">
        <view class="greeting-text">Hi, {{ userName }}!</view>
        <view class="more-btn">
          <uni-icons type="more-filled" size="30" color="#1d1d1f"></uni-icons>
        </view>
      </view>

      <!-- 账本列表 -->
      <view class="section-title">账本</view>

      <!-- 本月统计卡片 -->
      <view class="stats-card">
        <view class="stats-decor">
          <view class="stats-line"></view>
        </view>
        <view class="stats-main">
          <view class="stats-label">本月支出（元）</view>
          <view class="stats-amount">{{ stats.expense }}</view>
        </view>
        <view class="stats-info">
          <view class="stats-info-item">
            <text class="info-label">本月收入（元）：</text>
            <text class="info-value">{{ stats.income }}</text>
          </view>
          <view class="stats-info-item" @click="editBudget">
            <text class="info-label">本月预算（元）：</text>
            <text class="info-value">{{ stats.budget }}</text>
            <text class="info-edit">设置</text>
          </view>
        </view>
        <view class="stats-balance">
          <text class="balance-label">结余（元）：</text>
          <text class="balance-value">{{ stats.balance }}</text>
        </view>
        <view class="stats-progress">
          <view class="progress-bar">
            <view
              class="progress-fill"
              :style="{ width: stats.progress + '%' }"
            ></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 今日流水 -->
    <view class="today-section">
      <view class="today-header">
        <view class="today-title">
          <text class="today-text">今天</text>
          <text class="today-date">{{ todayDate }}</text>
        </view>
        <view class="today-summary">
          <text class="summary-item">支：{{ todayExpense }}</text>
          <text class="summary-item income">收：{{ todayIncome }}</text>
        </view>
      </view>

      <view class="flow-list">
        <view v-if="flowList.length === 0" class="empty-tip">
          <text class="empty-text">今天还没有记账</text>
          <text class="empty-sub">点击下方 + 开始记一笔</text>
        </view>
        <view
          v-for="(item, index) in flowList"
          v-else
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

    <!-- APP 在线更新弹窗（单例状态，仅 App 端检查到更新时显示） -->
    <update-popup />
  </view>
</template>

<script setup>
/**
 * 首页脚本模块
 * 模块说明：
 * - useHomeData()：一次性取得本月统计（bill + book 联动）、今日流水、
 *   今日收支、用户昵称、今日日期与预算设置动作；
 * - goBillDetail(id)：统一的详情跳转工具，仅传 id，详情页自行从 store 取数。
 */
import { useHomeData, goBillDetail } from "@/composables/useBookkeeping";
import UpdatePopup from "@/components/update-popup.vue";

// 首页数据全部由 Pinia 派生，模板中直接消费，无需本地状态
const {
  stats,
  flowList,
  todayExpense,
  todayIncome,
  userName,
  todayDate,
  editBudget,
} = useHomeData();

/**
 * 点击今日流水单条 → 跳转详情页
 * @param {import('@/store/types').BillViewModel} item 被点击的流水项
 */
const goDetail = item => {
  goBillDetail(item.id);
};
</script>

<style lang="scss" scoped>
.home {
  width: 100%;
  height: 100%;
  margin-top: var(--status-bar-height);
  background-color: rgba(244, 245, 253, 1);
}

.home-content {
  background-color: #fff;
  padding: 0 12rpx 10rpx;
  margin-bottom: 24rpx;
}

// 顶部问候
.greeting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 20rpx;

  .greeting-text {
    font-size: 48rpx;
    font-weight: 700;
    color: #1d1d1f;
    letter-spacing: 2rpx;
    padding-left: 12rpx;
  }

  .more-btn {
    width: 64rpx;
    height: 64rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// 分区标题
.section-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1d1d1f;
  padding: 16rpx 12rpx 14rpx;
  letter-spacing: 2rpx;
}

// 统计卡片
.stats-card {
  margin: 16rpx 12rpx 40rpx;
  padding: 36rpx 36rpx 28rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #4a6ef7 0%, #3c64f6 50%, #2e54e0 100%);
  position: relative;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(60, 100, 246, 0.35);

  // 装饰折线图
  .stats-decor {
    position: absolute;
    top: 40rpx;
    right: 32rpx;
    width: 240rpx;
    height: 140rpx;
    opacity: 0.45;
    z-index: 0;

    .stats-line {
      width: 100%;
      height: 100%;
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 140' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='white' stop-opacity='0.5'/><stop offset='100%' stop-color='white' stop-opacity='0'/></linearGradient></defs><path d='M0,100 L30,80 L60,95 L90,60 L120,75 L150,45 L180,55 L210,30 L240,40 L240,140 L0,140 Z' fill='url(%23g)'/><path d='M0,100 L30,80 L60,95 L90,60 L120,75 L150,45 L180,55 L210,30 L240,40' fill='none' stroke='white' stroke-width='2' stroke-opacity='0.7' fill-opacity='0'/></svg>")
        no-repeat center / contain;
    }
  }

  .stats-main {
    position: relative;
    z-index: 1;

    .stats-label {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.75);
      letter-spacing: 1rpx;
    }

    .stats-amount {
      font-size: 72rpx;
      font-weight: 700;
      color: #fff;
      margin-top: 8rpx;
      letter-spacing: 2rpx;
    }
  }

  .stats-info {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    margin-top: 24rpx;

    .stats-info-item {
      .info-label {
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.7);
      }
      .info-value {
        font-size: 26rpx;
        font-weight: 600;
        color: #fff;
      }
      .info-edit {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.6);
        margin-left: 8rpx;
        text-decoration: underline;
      }
    }
  }

  .stats-balance {
    position: relative;
    z-index: 1;
    margin-top: 20rpx;

    .balance-label {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.7);
    }
    .balance-value {
      font-size: 30rpx;
      font-weight: 600;
      color: #fff;
    }
  }

  .stats-progress {
    position: relative;
    z-index: 1;
    margin-top: 24rpx;

    .progress-bar {
      width: 100%;
      height: 16rpx;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12rpx;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 12rpx;
        background: linear-gradient(90deg, #4cf0d4 0%, #6edfff 100%);
        transition: width 0.3s ease;
      }
    }
  }
}

// 今日流水
.today-section {
  padding: 0 12rpx;
  background-color: #fff;

  .today-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 8rpx 20rpx;

    .today-title {
      .today-text {
        font-size: 36rpx;
        font-weight: 700;
        color: #1d1d1f;
        letter-spacing: 2rpx;
      }
      .today-date {
        font-size: 28rpx;
        color: #8a8f9c;
        font-weight: 400;
      }
    }

    .today-summary {
      .summary-item {
        font-size: 26rpx;
        color: #6a7080;
        margin-left: 16rpx;

        &.income {
          color: #e94e6b;
        }
      }
    }
  }

  .flow-list {
    background: #fff;
    border-radius: 28rpx;
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
          margin-bottom: 8rpx;

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
            font-size: 34rpx;
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
  padding: 80rpx 0;
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
