<!--
  @file 账单详情页（pages/detail/index.vue）
  @description 以票据卡片样式展示单笔账单的完整信息：
               1. 顶部分类 emoji 图标、分类名与带符号金额；
               2. 票据分隔线及信息列表：所属账本、账户（支付方式）、记录人、
                  记录时间、备注、凭证照片缩略图（点击全屏预览）；
               3. 卡片底部展示「截止本单该月目前支出」累计金额；
               4. 底部操作：删除（二次确认）与编辑（携 id 跳转记账页）。
               页面自身不持有数据，onLoad 时通过 eventChannel 的 id 从 bill store
               装载，账单被编辑后会依据变更事件自动刷新。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-14
-->
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
    <view v-if="detail" class="bill-card">
      <!-- 顶部图标 -->
      <view class="bill-icon-wrap">
        <text class="bill-icon">{{ detail.iconText }}</text>
      </view>

      <view class="bill-category">{{ detail.title }}</view>
      <view class="bill-amount">
        {{ detail.amount > 0 ? "+" : "" }}{{ detail.amount.toFixed(2) }}
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
          <text class="info-value">{{ detail.bookName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">账户</text>
          <text class="info-value">{{ detail.payMethod }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">记录人</text>
          <text class="info-value">{{ detail.recorder }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">记录时间</text>
          <text class="info-value">{{ detail.recordTime }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">备注</text>
          <text class="info-value remark">{{ detail.remark }}</text>
        </view>
        <view v-if="detail.photos?.length" class="info-row photo-row">
          <text class="info-label">凭证照片</text>
          <view class="photo-thumbs">
            <image
              v-for="(photo, index) in detail.photos"
              :key="index"
              class="photo-thumb"
              :src="photo"
              mode="aspectFill"
              @click="previewPhotos(index)"
            />
          </view>
        </view>
      </view>

      <view class="month-summary">
        截止本单该月目前支出{{ detail.monthExpense }}元
      </view>
    </view>

    <!-- 数据加载占位 -->
    <view v-else class="loading-tip">账单加载中...</view>

    <!-- 底部操作 -->
    <view v-if="detail" class="action-bar">
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
/**
 * 详情页脚本模块
 * 模块说明：
 * - useBillDetail()：按 eventChannel 中的 id 装载详情视图模型（含账本名 /
 *   记录人 / 记录时间 / 当月截止支出），并提供删除动作与变更自动刷新；
 * - 本页仅负责导航返回、删除二次确认、跳转编辑与图片预览四个交互。
 */
import { onLoad } from "@dcloudio/uni-app";
import { useBillDetail } from "@/composables/useBookkeeping";

// 详情数据按 id 从 bill store 读取，删除后通过 store 广播变更，各页面自动联动
const { detail, loadFromChannel, removeCurrent } = useBillDetail();

/** 页面加载：注册 eventChannel 监听，等待上一页 emit('billData', { id }) */
onLoad(() => {
  loadFromChannel();
});

/** 返回上一页 */
const goBack = () => {
  uni.navigateBack();
};

/** 删除账单：先弹确认框，确认后调用 store 删除并提示、延迟返回（列表会收到变更广播） */
const handleDelete = () => {
  uni.showModal({
    title: "提示",
    content: "确定删除该账单吗？",
    success: res => {
      if (!res.confirm) return;
      if (detail.value?.id) {
        removeCurrent();
        uni.showToast({ title: "已删除", icon: "success" });
      }
      setTimeout(() => uni.navigateBack(), 300);
    },
  });
};

/** 编辑账单：携带账单 id 跳转记账页，由其 onLoad 进入编辑回填模式 */
const handleEdit = () => {
  if (!detail.value?.id) return;
  uni.navigateTo({ url: `/pages/add/index?id=${detail.value.id}` });
};

/**
 * 点击缩略图全屏预览凭证（支持左右滑动查看多张）
 * @param {number} index 当前点击图片的下标，作为预览起始位置
 */
const previewPhotos = index => {
  uni.previewImage({ urls: detail.value.photos, current: index });
};
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: #3c64f6;
}

.loading-tip {
  margin-top: 200rpx;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  font-size: 28rpx;
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

      // 凭证照片缩略图（.photo-row 与 .info-row 同节点，用复合选择器）
      &.photo-row {
        align-items: flex-start;

        .photo-thumbs {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12rpx;
          margin-left: 40rpx;

          .photo-thumb {
            width: 128rpx;
            height: 128rpx;
            border-radius: 12rpx;
          }
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
