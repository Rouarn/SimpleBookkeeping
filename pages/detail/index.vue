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
  @modify 2026-09-15
-->
<template>
  <view class="detail-page">
    <!-- 导航栏 -->
    <uni-nav-bar
      title="账单详情"
      left-icon="left"
      right-icon="redo"
      background-color="transparent"
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
              lazy-load
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
          <uni-icons type="trash" size="26" color="#d54e3c"></uni-icons>
        </view>
        <text class="action-text">删除</text>
      </view>
      <view class="action-item" @click="handleEdit">
        <view class="action-btn">
          <uni-icons type="compose" size="26" color="#2f6b54"></uni-icons>
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

/** 删除账单：先弹确认框，确认后调 DELETE /bills/:id 并提示、延迟返回 */
const handleDelete = () => {
  uni.showModal({
    title: "提示",
    content: "确定删除该账单吗？",
    success: async res => {
      if (!res.confirm) return;
      if (detail.value?.id) {
        const ok = await removeCurrent();
        if (ok) uni.showToast({ title: "已删除", icon: "success" });
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
  uni.previewImage({
    urls: detail.value.photos,
    current: detail.value.photos[index],
  });
};
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #175142 0%, #0c3a2e 100%);
}

.loading-tip {
  margin-top: 200rpx;
  text-align: center;
  color: rgba(237, 245, 240, 0.7);
  font-size: 28rpx;
}

// 账单卡片
.bill-card {
  position: relative;
  margin: 120rpx 32rpx 0;
  padding: 0 40rpx 44rpx;
  background-color: #fff;
  border-radius: 28rpx;
  box-shadow: 0 18rpx 44rpx rgba(4, 24, 18, 0.28);

  // 顶部图标
  .bill-icon-wrap {
    position: absolute;
    top: -72rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 144rpx;
    height: 144rpx;
    border-radius: 50%;
    background-color: #fff;
    border: 5rpx solid #175142;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10rpx 24rpx rgba(4, 24, 18, 0.18);

    .bill-icon {
      font-size: 66rpx;
      line-height: 1;
    }
  }

  .bill-category {
    padding-top: 104rpx;
    text-align: center;
    font-size: 28rpx;
    color: #98a099;
  }

  .bill-amount {
    margin-top: 18rpx;
    text-align: center;
    font-size: 60rpx;
    font-weight: 700;
    color: #1e2521;
    font-variant-numeric: tabular-nums;
  }

  // 票据分隔线
  .ticket-divider {
    position: relative;
    margin: 48rpx 0;
    height: 0;
    border-top: 2rpx dashed #dbe1db;

    .notch {
      position: absolute;
      top: -21rpx;
      width: 42rpx;
      height: 42rpx;
      border-radius: 50%;
      background: linear-gradient(160deg, #175142 0%, #0c3a2e 100%);

      &.notch-left {
        left: -61rpx;
      }

      &.notch-right {
        right: -61rpx;
      }
    }
  }

  // 详情信息
  .info-list {
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 36rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-size: 27rpx;
        color: #98a099;
        flex-shrink: 0;
      }

      .info-value {
        font-size: 27rpx;
        font-weight: 500;
        color: #202622;
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
            border-radius: 14rpx;
          }
        }
      }
    }
  }

  .month-summary {
    margin-top: 56rpx;
    padding-top: 30rpx;
    border-top: 2rpx dashed #dbe1db;
    text-align: center;
    font-size: 24rpx;
    color: #98a099;
  }
}

// 底部操作
.action-bar {
  display: flex;
  justify-content: space-around;
  padding: 72rpx 80rpx calc(72rpx + env(safe-area-inset-bottom));

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .action-btn {
      width: 108rpx;
      height: 108rpx;
      border-radius: 50%;
      background-color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10rpx 28rpx rgba(4, 24, 18, 0.24);

      &:active {
        transform: scale(0.94);
      }
    }

    .action-text {
      margin-top: 16rpx;
      font-size: 25rpx;
      font-weight: 500;
      color: rgba(237, 245, 240, 0.82);
    }
  }
}
</style>
