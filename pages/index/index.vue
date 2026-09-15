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
  @modify 2026-09-15
-->
<template>
  <view class="home">
    <!-- 顶部问候 -->
    <view class="greeting">
      <text class="greeting-text">Hi, {{ userName }}</text>
      <view class="more-btn">
        <uni-icons type="more-filled" size="26" color="#3c4a42"></uni-icons>
      </view>
    </view>

    <!-- 本月统计卡片 -->
    <view class="stats-card">
      <!-- 铜钱纹：右上角同心圆环，点到为止 -->
      <view class="stats-decor">
        <view class="decor-ring r1"></view>
        <view class="decor-ring r2"></view>
        <view class="decor-ring r3"></view>
      </view>
      <view class="stats-main">
        <text class="stats-label">本月支出（元）</text>
        <view class="stats-amount">{{ stats.expense }}</view>
      </view>
      <view class="stats-info">
        <view class="stats-info-item">
          <text class="info-label">本月收入</text>
          <text class="info-value">{{ stats.income }}</text>
        </view>
        <view class="stats-info-item" @click="editBudget">
          <text class="info-label">本月预算</text>
          <text class="info-value">{{ stats.budget }}</text>
          <text class="info-edit">设置</text>
        </view>
      </view>
      <view class="stats-balance">
        <text class="balance-label">本月结余（元）</text>
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

    <!-- 今日流水 -->
    <view class="today-section">
      <view class="today-header">
        <view class="today-title">
          <text class="today-text">今天</text>
          <text class="today-date">{{ todayDate }}</text>
        </view>
        <view class="today-summary">
          <text class="summary-chip">支 {{ todayExpense }}</text>
          <text class="summary-chip income">收 {{ todayIncome }}</text>
        </view>
      </view>

      <view class="flow-list">
        <view v-if="flowList.length === 0" class="empty-tip">
          <view class="empty-coin">¥</view>
          <text class="empty-text">今天还没有记账</text>
          <text class="empty-sub">点下方 + 记一笔</text>
        </view>
        <template v-else>
          <view
            v-for="item in flowList"
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
        </template>
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
  background: #f3f5f2;
}

// 顶部问候
.greeting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 24rpx;

  .greeting-text {
    font-size: 44rpx;
    font-weight: 700;
    color: #1e2521;
    letter-spacing: 1rpx;
  }

  .more-btn {
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

// 统计卡片
.stats-card {
  position: relative;
  margin: 6rpx 24rpx 0;
  padding: 36rpx 32rpx 30rpx;
  border-radius: 28rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #175142 0%, #0c3a2e 100%);
  box-shadow: 0 18rpx 40rpx rgba(12, 58, 46, 0.26);

  // 铜钱纹：右上角同心圆环，点到为止
  .stats-decor {
    position: absolute;
    top: -110rpx;
    right: -90rpx;
    width: 300rpx;
    height: 300rpx;
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
      width: 300rpx;
      height: 300rpx;
    }
    .r2 {
      width: 208rpx;
      height: 208rpx;
      border-color: rgba(255, 255, 255, 0.1);
    }
    .r3 {
      width: 116rpx;
      height: 116rpx;
      border-color: rgba(255, 255, 255, 0.14);
    }
  }

  .stats-main {
    position: relative;
    z-index: 1;

    .stats-label {
      font-size: 24rpx;
      color: rgba(237, 245, 240, 0.6);
    }

    .stats-amount {
      margin-top: 10rpx;
      font-size: 72rpx;
      font-weight: 700;
      line-height: 1.1;
      color: #f1f7f3;
      letter-spacing: 1rpx;
      font-variant-numeric: tabular-nums;
    }
  }

  .stats-info {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 28rpx;

    .stats-info-item {
      display: flex;
      align-items: baseline;

      .info-label {
        margin-right: 10rpx;
        font-size: 24rpx;
        color: rgba(237, 245, 240, 0.58);
      }
      .info-value {
        font-size: 28rpx;
        font-weight: 600;
        color: #f1f7f3;
        font-variant-numeric: tabular-nums;
      }
      .info-edit {
        margin-left: 14rpx;
        padding: 4rpx 16rpx;
        font-size: 20rpx;
        line-height: 1.6;
        color: #8fe2bd;
        border: 1rpx solid rgba(143, 226, 189, 0.45);
        border-radius: 100rpx;
      }
    }
  }

  .stats-balance {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24rpx;
    padding: 18rpx 24rpx;
    border-radius: 16rpx;
    background: rgba(255, 255, 255, 0.06);

    .balance-label {
      font-size: 24rpx;
      color: rgba(237, 245, 240, 0.58);
    }
    .balance-value {
      font-size: 28rpx;
      font-weight: 600;
      color: #f1f7f3;
      font-variant-numeric: tabular-nums;
    }
  }

  .stats-progress {
    position: relative;
    z-index: 1;
    margin-top: 24rpx;

    .progress-bar {
      width: 100%;
      height: 12rpx;
      border-radius: 999rpx;
      background: rgba(255, 255, 255, 0.12);
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 999rpx;
        background: linear-gradient(90deg, #4fc794 0%, #93e7c4 100%);
        transition: width 0.3s ease;
      }
    }
  }
}

// 今日流水
.today-section {
  padding: 34rpx 24rpx 48rpx;

  .today-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4rpx 18rpx;

    .today-title {
      display: flex;
      align-items: baseline;

      .today-text {
        font-size: 34rpx;
        font-weight: 700;
        color: #1e2521;
      }
      .today-date {
        margin-left: 12rpx;
        font-size: 24rpx;
        color: #98a099;
      }
    }

    .today-summary {
      display: flex;
      align-items: center;

      .summary-chip {
        padding: 8rpx 18rpx;
        font-size: 22rpx;
        line-height: 1.4;
        border-radius: 999rpx;
        background: #e9f0eb;
        color: #56645c;
        font-variant-numeric: tabular-nums;

        & + & {
          margin-left: 12rpx;
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
      padding: 28rpx 28rpx;

      // 内缩发丝分割线
      &::after {
        content: "";
        position: absolute;
        left: 130rpx;
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
            font-size: 30rpx;
            font-weight: 500;
            color: #202622;
            flex-shrink: 0;
          }

          .flow-remark {
            margin-left: 10rpx;
            font-size: 24rpx;
            color: #98a099;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .flow-amount {
            font-size: 32rpx;
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
          margin-top: 8rpx;

          .flow-time,
          .flow-pay {
            font-size: 22rpx;
            color: #98a099;
          }
          .flow-dot {
            margin: 0 10rpx;
            font-size: 22rpx;
            color: #c6ccc6;
          }
        }
      }

      .flow-arrow {
        flex-shrink: 0;
        margin-left: 14rpx;
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
