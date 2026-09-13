<template>
  <view class="container">
    <view class="header">
      <text class="page-title">支出记录</text>
      <view class="setting" @click="navigateToSetting">
        <uni-icons type="gear-filled" size="24" color="#4CAF87"></uni-icons>
      </view>
    </view>

    <view class="card card--green">
      <text class="card-title">总金额</text>
      <view class="amount-display">
        <uni-icons type="wallet" size="24" color="#4CAF87"></uni-icons>
        <text class="amount-value">¥{{ formatAmount(totalAmount) }}</text>
      </view>
      <view class="amount-details">
        <view class="detail-row">
          <text class="detail-label">总支出</text>
          <text class="detail-value">
            ¥{{ formatAmount(getTotalExpense()) }}
          </text>
        </view>
        <view class="detail-row">
          <text class="detail-label">剩余金额</text>
          <text class="detail-value">
            ¥{{ formatAmount(getRemainingAmount()) }}
          </text>
        </view>
      </view>
    </view>

    <view class="card card--paper">
      <text class="card-title">支出记录</text>

      <view class="table-head">
        <text class="th th-date">日期</text>
        <text class="th th-item">项目</text>
        <text class="th th-amt">金额</text>
      </view>

      <view v-if="records.length === 0" class="empty">
        <view class="plant">
          <view class="plant-leaves">
            <view class="leaf l1"></view>
            <view class="leaf l2"></view>
            <view class="leaf l3"></view>
          </view>
          <view class="pot"></view>
        </view>
        <text class="empty-text">还没有支出记录哦～</text>
      </view>

      <view v-else class="table">
        <view v-for="item in records" :key="item.id" class="tr">
          <text class="td td-date">{{ item.date }}</text>
          <text class="td td-item">{{ item.item }}</text>
          <text class="td td-amt">¥{{ formatAmount(item.amount) }}</text>
        </view>
      </view>
    </view>

    <uni-fab
      @fabClick="openAdd"
      horizontal="right"
      :pattern="{ buttonColor: '#4CAF87' }"
    />
  </view>

  <view
    v-if="leafAnimating"
    class="leaf-fall"
    @animationend="leafAnimating = false"
  >
    <view class="mini-leaf"></view>
  </view>

  <view v-if="showAdd" class="mask" @click="closeAdd">
    <view class="modal" @click.stop>
      <text class="modal-title">添加支出</text>

      <view class="form-row">
        <text class="form-label">日期</text>
        <picker mode="date" :value="addForm.dateRaw" @change="onPickDate">
          <view class="form-value">{{ addForm.dateText }}</view>
        </picker>
      </view>

      <view class="form-row">
        <text class="form-label">项目</text>
        <input
          class="form-input"
          placeholder="例如：早餐"
          placeholder-class="placeholder-soft"
          v-model="addForm.item"
        />
      </view>

      <view class="form-row">
        <text class="form-label">金额</text>
        <input
          class="form-input form-input--right"
          type="digit"
          placeholder="请输入金额"
          placeholder-class="placeholder-soft"
          v-model="addForm.amount"
        />
      </view>

      <view class="modal-actions">
        <button
          class="btn btn--ghost"
          hover-class="btn--ghost-active"
          @click="closeAdd"
        >
          取消
        </button>
        <button
          class="btn btn--primary"
          hover-class="btn--primary-active"
          @click="saveAdd"
        >
          保存
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";

// 页面：支出记录 + 初始金额设置
// 数据持久化：
// - sbk_total_amount：初始金额（字符串/数字都可能出现，这里统一转成字符串展示）
// - sbk_records：支出记录数组（历史版本数据结构可能不同，normalizeRecord 负责兼容）

// 初始金额输入框（使用 v-model 绑定，保持为字符串，避免输入中间态丢失）
const totalAmount = ref("");

// 支出记录列表
// record 结构：
// { id: string, date: string, item: string, amount: number }
const records = ref([]);

// 添加支出后的小叶子动画开关（通过先 false 再 nextTick->true 触发重播）
const leafAnimating = ref(false);

// 添加支出弹窗显示开关
const showAdd = ref(false);

// 添加支出表单
// dateRaw：picker 返回的 YYYY-MM-DD
// dateText：展示用 YYYY.MM.DD
// item：项目名称
// amount：金额输入（字符串，保存时再转 number）
const addForm = ref({
  dateRaw: "",
  dateText: "",
  item: "",
  amount: "",
});

// 将 YYYY-MM-DD 转成 YYYY.MM.DD（仅用于展示）
function formatDateText(raw) {
  if (!raw) return "";
  return String(raw).replace(/-/g, ".");
}

// 兼容旧数据中的 timeText（例如 "04-21 12:00"），拼出 YYYY.MM.DD
function guessDateFromTimeText(timeText, year) {
  const m = String(timeText).match(/^(\d{2})-(\d{2})\s+/);
  if (!m) return `${year}.01.01`;
  return `${year}.${m[1]}.${m[2]}`;
}

// 兼容/清洗本地存储中的记录对象，尽量转成当前页面需要的结构
function normalizeRecord(r) {
  if (!r || typeof r !== "object") return null;
  const amount = Number(r.amount);
  const id = r.id
    ? String(r.id)
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  if (r.date && r.item) {
    return {
      id,
      date: String(r.date),
      item: String(r.item),
      amount: Number.isFinite(amount) ? amount : 0,
    };
  }

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const date = r.timeText
    ? guessDateFromTimeText(String(r.timeText), yyyy)
    : `${yyyy}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const item = r.category ? String(r.category) : "支出";

  return {
    id,
    date,
    item,
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

// 金额展示格式：最多两位小数，去掉末尾无意义的 0
function formatAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const fixed = Math.round(num * 100) / 100;
  return String(fixed).includes(".")
    ? fixed.toFixed(2).replace(/\.?0+$/, "")
    : String(fixed);
}

// 计算总支出数
function getTotalExpense() {
  return records.value.reduce((sum, record) => sum + Number(record.amount), 0);
}

// 计算剩余金额
function getRemainingAmount() {
  const totalNum = Number(totalAmount.value);
  const expenseNum = getTotalExpense();
  return totalNum - expenseNum;
}

// 重置“添加支出”表单（默认日期为今天）
function resetAddForm() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  addForm.value = {
    dateRaw: `${yyyy}-${mm}-${dd}`,
    dateText: `${yyyy}.${mm}.${dd}`,
    item: "",
    amount: "",
  };
}

// 打开“添加支出”弹窗
function openAdd() {
  resetAddForm();
  showAdd.value = true;
}

// 关闭“添加支出”弹窗
function closeAdd() {
  showAdd.value = false;
}

// 选择日期回调：同步 dateRaw/dateText
function onPickDate(e) {
  const value = (e && e.detail && e.detail.value) || "";
  addForm.value.dateRaw = value;
  addForm.value.dateText = formatDateText(value);
}

// 保存新增支出：
// 1) 校验项目与金额
// 2) 生成记录并写入 records
// 3) 持久化到本地存储
// 4) 关闭弹窗并触发动画
function saveAdd() {
  const itemText = String(addForm.value.item || "").trim();
  const amountNumber = parseFloat(
    String(addForm.value.amount).replace(/[^\d.]/g, ""),
  );
  if (!itemText) {
    uni.showToast({ title: "请输入项目", icon: "none" });
    return;
  }
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    uni.showToast({ title: "请输入正确金额", icon: "none" });
    return;
  }

  const now = new Date();
  const record = {
    id: `${now.getTime()}_${Math.random().toString(16).slice(2)}`,
    date: addForm.value.dateText || formatDateText(addForm.value.dateRaw),
    item: itemText,
    amount: amountNumber,
  };
  records.value = [record, ...records.value];
  uni.setStorageSync("sbk_records", records.value);
  showAdd.value = false;

  leafAnimating.value = false;
  nextTick(() => {
    leafAnimating.value = true;
  });
}

// 页面加载时：
// - 读取初始金额与记录列表
// - 兼容历史结构（normalizeRecord）
// - 初始化添加表单
onShow(() => {
  const storedTotal = uni.getStorageSync("sbk_total_amount");
  const storedRecords = uni.getStorageSync("sbk_records");
  if (storedTotal !== undefined && storedTotal !== null && storedTotal !== "") {
    totalAmount.value = String(storedTotal);
  } else {
    uni.reLaunch({
      url: "/pages/initialAmount/index",
    });
    return;
  }
  if (Array.isArray(storedRecords)) {
    records.value = storedRecords.map(r => normalizeRecord(r)).filter(Boolean);
  }
  resetAddForm();
});

// 导航到设置页面
function navigateToSetting() {
  uni.navigateTo({
    url: "/pages/setting/index",
  });
}
</script>

<style lang="scss" scoped>
.container {
  padding: 96rpx 44rpx 96rpx;
  /* #ifdef H5 */
  padding-top: 52rpx;
  /* #endif */

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* #ifdef MP-WEIXIN */
    margin-top: calc(var(--window-top) + var(--status-bar-height));
    /* #endif */

    .page-title {
      font-size: 52rpx;
      font-weight: 700;
      color: #1d1d1f;
      letter-spacing: 1rpx;
      display: block;
    }

    .setting {
      font-size: 32rpx;
      font-weight: 700;
      color: #1d1d1f;
      letter-spacing: 1rpx;
    }
  }

  .card {
    margin-top: 28rpx;
    border-radius: 44rpx;
    padding: 30rpx 28rpx 28rpx;

    &--green {
      position: relative;
      overflow: hidden;
      background: linear-gradient(
        180deg,
        rgba(76, 175, 135, 0.28) 0%,
        rgba(102, 194, 165, 0.18) 56%,
        rgba(255, 255, 255, 0.78) 100%
      );
      box-shadow: 0 24rpx 64rpx rgba(56, 142, 107, 0.14);

      &::before {
        content: "";
        position: absolute;
        inset: -60rpx -60rpx auto -60rpx;
        height: 360rpx;
        background:
          radial-gradient(
            circle at 20% 10%,
            rgba(255, 255, 255, 0.76) 0%,
            rgba(255, 255, 255, 0) 56%
          ),
          radial-gradient(
            circle at 86% 0%,
            rgba(255, 255, 255, 0.46) 0%,
            rgba(255, 255, 255, 0) 60%
          );
        pointer-events: none;
      }
    }

    &--paper {
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 24rpx 64rpx rgba(56, 142, 107, 0.1);
    }

    .card-title {
      position: relative;
      font-size: 30rpx;
      font-weight: 700;
      color: #1d1d1f;
    }

    .amount-display {
      margin-top: 36rpx;
      display: flex;
      align-items: center;
      gap: 16rpx;

      .amount-value {
        flex: 1;
        font-size: 56rpx;
        font-weight: 700;
        color: #1d1d1f;
        text-align: right;
        letter-spacing: 1rpx;
      }
    }

    .amount-details {
      margin-top: 24rpx;
      padding-top: 24rpx;
      border-top: 2rpx solid rgba(76, 175, 135, 0.16);

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12rpx;

        &:first-child {
          margin-top: 0;
        }

        .detail-label {
          font-size: 26rpx;
          color: rgba(56, 142, 107, 0.88);
        }

        .detail-value {
          font-size: 28rpx;
          font-weight: 600;
          color: #1d1d1f;
        }
      }
    }
  }

  .table-head {
    margin-top: 22rpx;
    display: flex;
    align-items: center;
    padding: 16rpx 18rpx;
    border-radius: 22rpx;
    background: rgba(102, 194, 165, 0.16);

    .th {
      font-size: 26rpx;
      font-weight: 600;
      color: #388e6b;

      &-date {
        width: 34%;
      }

      &-item {
        width: 33%;
        text-align: center;
      }

      &-amt {
        width: 33%;
        text-align: right;
      }
    }
  }

  .table {
    margin-top: 8rpx;
    border-radius: 28rpx;
    overflow: hidden;
    position: relative;

    .tr {
      background: rgba(255, 255, 255, 0.72);
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 22rpx 18rpx;
      border-bottom: 2rpx solid rgba(56, 142, 107, 0.08);

      &:last-child {
        border-bottom: none;
      }

      .td {
        font-size: 28rpx;
        color: #333333;

        &-date {
          width: 34%;
        }

        &-item {
          width: 33%;
          text-align: center;
          color: rgba(51, 51, 51, 0.92);
        }

        &-amt {
          width: 33%;
          font-weight: 700;
          text-align: right;
        }
      }
    }
  }

  .add-btn {
    margin-top: 22rpx;
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #66c2a5 0%, #4caf87 100%);
    color: #ffffff;
    font-size: 32rpx;

    &::after {
      border: none;
    }

    &--active {
      opacity: 0.88;
    }
  }

  .empty {
    margin-top: 12rpx;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 28rpx;
    padding: 54rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18rpx;

    .plant {
      width: 140rpx;
      height: 120rpx;
      position: relative;

      .plant-leaves {
        position: absolute;
        top: 4rpx;
        left: 50%;
        transform: translateX(-50%);
        width: 140rpx;
        height: 80rpx;

        .leaf {
          position: absolute;
          width: 46rpx;
          height: 60rpx;
          border-radius: 999rpx 999rpx 999rpx 0;
          background: linear-gradient(
            180deg,
            rgba(102, 194, 165, 0.95) 0%,
            rgba(76, 175, 135, 0.9) 100%
          );
          opacity: 0.92;

          &.l1 {
            left: 22rpx;
            top: 18rpx;
            transform: rotate(-24deg);
          }

          &.l2 {
            left: 56rpx;
            top: 6rpx;
            transform: rotate(4deg);
          }

          &.l3 {
            left: 88rpx;
            top: 20rpx;
            transform: rotate(26deg);
          }
        }
      }

      .pot {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 110rpx;
        height: 54rpx;
        border-radius: 0 0 26rpx 26rpx;
        background: rgba(56, 142, 107, 0.16);
      }
    }

    .empty-text {
      font-size: 26rpx;
      color: #888888;
    }
  }

  .mini-leaf {
    width: 26rpx;
    height: 26rpx;
    border-radius: 999rpx 999rpx 999rpx 0;
    background: linear-gradient(
      180deg,
      rgba(102, 194, 165, 0.95) 0%,
      rgba(76, 175, 135, 0.9) 100%
    );
    transform: rotate(14deg);
    box-shadow: 0 10rpx 18rpx rgba(76, 175, 135, 0.12);
  }

  .leaf-fall {
    position: absolute;
    top: 140rpx;
    right: 54rpx;
    animation: leafFall 820ms ease-out forwards;
    pointer-events: none;
  }
}

@keyframes leafFall {
  0% {
    transform: translateY(-16rpx) rotate(0deg);
    opacity: 0;
  }

  20% {
    opacity: 1;
  }

  100% {
    transform: translateY(180rpx) rotate(38deg);
    opacity: 0;
  }
}

.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(29, 29, 31, 0.28);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 28rpx 36rpx;
  box-sizing: border-box;
  z-index: 12;

  .modal {
    width: 100%;
    background: rgba(255, 255, 255, 0.96);
    border-radius: 40rpx;
    padding: 26rpx 22rpx 22rpx;
    box-shadow: 0 28rpx 70rpx rgba(56, 142, 107, 0.18);
    position: relative;

    .modal-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1d1d1f;
    }

    .form-row {
      margin-top: 18rpx;
      display: flex;
      align-items: center;
      gap: 16rpx;
      padding: 18rpx 18rpx;
      border-radius: 24rpx;
      background: rgba(102, 194, 165, 0.1);

      .form-label {
        width: 84rpx;
        font-size: 26rpx;
        color: rgba(56, 142, 107, 0.88);
        flex: none;
      }

      .form-value {
        flex: 1;
        font-size: 28rpx;
        color: #333333;
        text-align: right;
      }

      .form-input {
        flex: 1;
        height: 72rpx;
        font-size: 28rpx;
        color: #333333;
        text-align: left;

        &--right {
          text-align: right;
        }
      }
    }

    .modal-actions {
      margin-top: 22rpx;
      display: flex;
      gap: 16rpx;

      .btn {
        flex: 1;
        height: 84rpx;
        line-height: 84rpx;
        border-radius: 999rpx;
        font-size: 30rpx;

        &::after {
          border: none;
        }

        &--ghost {
          background: rgba(56, 142, 107, 0.1);
          color: #388e6b;

          &-active {
            background: rgba(56, 142, 107, 0.14);
          }
        }

        &--primary {
          background: #4caf87;
          color: #ffffff;

          &-active {
            background: #3f9d78;
          }
        }
      }
    }
  }
}
</style>
