<template>
  <view class="add-page">
    <!-- 导航栏 -->
    <uni-nav-bar
      title="个人账本"
      left-icon="closeempty"
      background-color="#4060f8"
      color="#ffffff"
      :border="false"
      status-bar
      fixed
      @clickLeft="handleClose"
    />

    <!-- 顶部蓝色区域 -->
    <view class="header">
      <!-- 收支切换 + 日期 -->
      <view class="toolbar">
        <view class="tabs">
          <text
            class="tab"
            :class="{ on: billType === 'expense' }"
            @click="switchType('expense')"
            >支出</text
          >
          <text
            class="tab"
            :class="{ on: billType === 'income' }"
            @click="switchType('income')"
            >收入</text
          >
        </view>
        <picker mode="date" :value="date" @change="onDateChange">
          <view class="date-pill">
            <text>{{ dateText }}</text>
            <uni-icons type="arrow-down" size="13" color="#ffffff"></uni-icons>
          </view>
        </picker>
      </view>

      <!-- 金额 -->
      <view class="amount-row">
        <input
          v-model="amount"
          class="amount-input"
          type="digit"
          placeholder="0.0"
          placeholder-style="color: rgba(255,255,255,0.55)"
        />
      </view>

      <!-- 分类图标 -->
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-list">
          <view
            v-for="item in categoryList"
            :key="item.name"
            class="category-item"
            @click="activeCategory = item.name"
          >
            <view
              class="category-icon"
              :class="{ on: activeCategory === item.name }"
            >
              <image
                class="category-img"
                :src="
                  activeCategory === item.name ? item.activeIcon : item.icon
                "
                mode="aspectFit"
              />
            </view>
            <text
              class="category-name"
              :class="{ on: activeCategory === item.name }"
              >{{ item.name }}</text
            >
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 白色内容区 -->
    <scroll-view class="body" scroll-y :show-scrollbar="false">
      <!-- 收/付款方式 -->
      <view class="section">
        <view class="section-title">{{ paySectionTitle }}</view>
        <view class="pay-list">
          <view
            v-for="pay in payMethods"
            :key="pay"
            class="pay-pill"
            :class="{ on: payMethod === pay }"
            @click="payMethod = pay"
          >
            {{ pay }}
          </view>
        </view>
      </view>

      <!-- 凭证照片 -->
      <view class="section">
        <view class="section-title">上传照片或拍摄凭证（最多3张）</view>
        <view class="photo-list">
          <view
            v-for="(photo, index) in photos"
            :key="photo"
            class="photo-item"
          >
            <image class="photo-img" :src="photo" mode="aspectFill" />
            <view class="photo-del" @click="removePhoto(index)">
              <uni-icons
                type="closeempty"
                size="11"
                color="#ffffff"
              ></uni-icons>
            </view>
          </view>
          <view v-if="photos.length < 3" class="photo-add" @click="choosePhoto">
            <uni-icons type="plus" size="42" color="#4060F8"></uni-icons>
          </view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="section">
        <view class="section-title">备注</view>
        <input
          v-model="remark"
          class="remark-input"
          maxlength="50"
          placeholder="请填写备注信息（限50字）"
          placeholder-style="color: #b3b9c7"
        />
      </view>
    </scroll-view>

    <!-- 底部保存 -->
    <view class="footer">
      <view class="save-btn" @click="handleSave">保存</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";

// 生成线性 SVG 图标（默认白色，选中态使用分类主题色）
const icon = (inner, color = "#ffffff") =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  );

// 其他（2x2 方格，寓意「更多/其他分类」）
const otherCategory =
  '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>';
// 双向箭头（退还款）
const swapArrows =
  '<path d="M7.5 9h11M7.5 9L10 6.5M7.5 9L10 11.5"/><path d="M16.5 15h-11M16.5 15L14 12.5M16.5 15L14 17.5"/>';
// 红包
const redPacket =
  '<rect x="4.5" y="5.5" width="15" height="13" rx="2.5"/><path d="M12 9.2c1.7 0 3 1 3 2.3 0 2.3-3 2.7-3 4.5 0-1.8-3-2.2-3-4.5 0-1.3 1.3-2.3 3-2.3z"/><path d="M12 5.5v3.7"/>';
// 上升收益
const trendUp = '<path d="M4.5 16l4.8-4.8 3 3L19.5 7"/><path d="M14.5 7h5v5"/>';
// 礼金（钞票 + ¥）
const giftMoney =
  '<rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="M12 9.2v3.6M10.3 10.2l1.7 1.8 1.7-1.8M10.6 13.4h2.8M10.6 14.9h2.8"/>';
// 钱袋（佣金）
const moneyBag =
  '<path d="M9.6 7.2c-1.8 1.9-2.9 4.1-2.9 7a5.3 5.3 0 0 0 10.6 0c0-2.9-1.1-5.1-2.9-7z"/><path d="M9.6 7.2h4.8"/><path d="M12 10.4v3.2M10.4 11.3l1.6 1.5 1.6-1.5M10.9 14.2h2.2"/>';

// 组装分类：白色图标 + 选中后的彩色图标
const makeCategory = (name, inner, color) => ({
  name,
  color,
  icon: icon(inner),
  activeIcon: icon(inner, color),
});

const expenseCategories = [
  makeCategory("其他", otherCategory, "#ff6a3d"),
  makeCategory(
    "购物",
    '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    "#ff8f1f",
  ),
  makeCategory(
    "交通",
    '<rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 11h16"/><circle cx="8.5" cy="17.6" r="1.3"/><circle cx="15.5" cy="17.6" r="1.3"/><path d="M7 20l-1.2 1.6M17 20l1.2 1.6"/>',
    "#4a8cff",
  ),
  makeCategory(
    "娱乐",
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M9 21h6"/>',
    "#a45dff",
  ),
  makeCategory(
    "餐饮",
    '<path d="M12 4v2.5"/><circle cx="12" cy="3" r=".9" fill="#ff6a3d" stroke="none"/><path d="M5 16c.8-4.2 3.6-6.5 7-6.5s6.2 2.3 7 6.5"/><path d="M3.5 16h17"/><path d="M7 19h10"/>',
    "#ff6a3d",
  ),
  makeCategory(
    "住房",
    '<path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M9.5 12l2.5 2.5L14.5 12M12 14.5V18M10.2 16.6h3.6"/>',
    "#22b573",
  ),
  makeCategory(
    "就医",
    '<path d="M5 3.5v3M19 3.5v3"/><path d="M5 6.5V9a4 4 0 0 0 8 0V6.5"/><path d="M12 13v1.5a4 4 0 0 0 8 0V12.4"/><circle cx="20" cy="10" r="2.1"/>',
    "#f2484b",
  ),
  makeCategory(
    "教育",
    '<path d="M4 5c3-1 6 0 8 2 2-2 5-3 8-2v13c-3-1-6 0-8 2-2-2-5-3-8-2z"/><path d="M12 7v13"/>',
    "#2ea8e6",
  ),
  makeCategory(
    "旅行",
    '<path d="M21 3L10 12.5M21 3l-4.5 17L10 12.5 4 10.5 21 3z"/>',
    "#14b8a6",
  ),
];

const incomeCategories = [
  makeCategory("其他", otherCategory, "#ff6a3d"),
  makeCategory("退还款", swapArrows, "#5b8ff9"),
  makeCategory("红包", redPacket, "#ff7a45"),
  makeCategory("收益", trendUp, "#34c759"),
  makeCategory("礼金", giftMoney, "#ffb020"),
  makeCategory("佣金", moneyBag, "#b06be0"),
];

const billType = ref("expense");
const activeCategory = ref("其他");
const amount = ref("");
const remark = ref("");
const payMethod = ref("现金");
const photos = ref([]);

const payMethods = ["现金", "微信支付", "支付宝", "信用卡", "储蓄卡"];

const categoryList = computed(() =>
  billType.value === "expense" ? expenseCategories : incomeCategories,
);

const paySectionTitle = computed(() =>
  billType.value === "expense" ? "支付方式" : "收款方式",
);

// 日期
const pad = n => String(n).padStart(2, "0");
const today = new Date();
const date = ref(
  `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
);
const dateText = computed(() => {
  const [, m, d] = date.value.split("-");
  return `${Number(m)}月${Number(d)}日`;
});

function switchType(type) {
  billType.value = type;
  activeCategory.value = "其他";
}

function onDateChange(e) {
  date.value = e.detail.value;
}

function choosePhoto() {
  uni.chooseImage({
    count: 3 - photos.value.length,
    success: res => {
      photos.value = photos.value.concat(res.tempFilePaths).slice(0, 3);
    },
  });
}

function removePhoto(index) {
  photos.value.splice(index, 1);
}

function handleClose() {
  uni.navigateBack();
}

function handleSave() {
  uni.showToast({ title: "保存成功", icon: "success" });
}
</script>

<style lang="scss" scoped>
.add-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

// ===== 顶部蓝色区域 =====
.header {
  background: #4060f8;
  padding: 0 32rpx 48rpx;
}

// 收支切换 + 日期
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;

  .tabs {
    display: flex;
    align-items: center;

    .tab {
      font-size: 40rpx;
      color: rgba(255, 255, 255, 0.65);
      margin-right: 56rpx;
      transition: color 0.2s;

      &.on {
        color: #ffffff;
        font-weight: 700;
      }
    }
  }

  .date-pill {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.17);
    border-radius: 14rpx;
    padding: 12rpx 24rpx;

    text {
      font-size: 28rpx;
      color: #ffffff;
      margin-right: 8rpx;
    }
  }
}

// 金额
.amount-row {
  margin-top: 36rpx;
  border-bottom: 2rpx solid rgba(255, 255, 255, 0.35);

  .amount-input {
    width: 100%;
    height: 120rpx;
    font-size: 96rpx;
    font-weight: 700;
    color: #ffffff;
    line-height: 120rpx;
  }
}

// 分类图标
.category-scroll {
  margin-top: 40rpx;
  white-space: nowrap;

  .category-list {
    display: flex;
    padding: 4rpx 4rpx 0;
  }

  .category-item {
    flex-shrink: 0;
    width: 132rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .category-icon {
      width: 112rpx;
      height: 112rpx;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.16);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;

      .category-img {
        width: 54rpx;
        height: 54rpx;
      }

      &.on {
        background: #ffffff;
        box-shadow: 0 6rpx 16rpx rgba(20, 40, 120, 0.18);
      }
    }

    .category-name {
      margin-top: 16rpx;
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.65);

      &.on {
        color: #ffffff;
        font-weight: 700;
      }
    }
  }
}

// ===== 白色内容区 =====
.body {
  flex: 1;
  min-height: 0;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  margin-top: -28rpx;
  position: relative;
  padding-top: 16rpx;
  box-sizing: border-box;
}

.section {
  padding: 0 40rpx;

  .section-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #23262d;
    margin: 40rpx 0 28rpx;
  }
}

// 支付方式
.pay-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;

  .pay-pill {
    padding: 12rpx 30rpx;
    border: 2rpx solid #dfe3ee;
    border-radius: 16rpx;
    font-size: 28rpx;
    color: #7b8198;
    background: #ffffff;
    box-sizing: border-box;
    text-align: center;

    &.on {
      border-color: transparent;
      background: #e9eeff;
      color: #4060f8;
      font-weight: 600;
    }
  }
}

// 凭证照片
.photo-list {
  display: flex;
  flex-wrap: wrap;

  .photo-item,
  .photo-add {
    width: 156rpx;
    height: 156rpx;
    border-radius: 18rpx;
    margin: 0 20rpx 20rpx 0;
  }

  .photo-add {
    background: #f4f6fc;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .photo-item {
    position: relative;

    .photo-img {
      width: 100%;
      height: 100%;
      border-radius: 18rpx;
    }

    .photo-del {
      position: absolute;
      top: -14rpx;
      right: -14rpx;
      width: 40rpx;
      height: 40rpx;
      border-radius: 50%;
      background: #3a3f4a;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}

// 备注
.remark-input {
  width: 100%;
  height: 100rpx;
  border-bottom: 2rpx solid #ededf2;
  font-size: 30rpx;
  color: #23262d;
}

// ===== 底部保存 =====
.footer {
  background: #ffffff;
  padding: 16rpx 32rpx;
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));

  .save-btn {
    height: 96rpx;
    border-radius: 20rpx;
    background: #4060f8;
    color: #ffffff;
    font-size: 34rpx;
    font-weight: 700;
    letter-spacing: 4rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
