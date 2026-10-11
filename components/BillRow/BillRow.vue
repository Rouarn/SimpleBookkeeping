<!--
  @file 流水行（components/BillRow/BillRow.vue）
  @description 从首页「今日流水」与流水页分组列表两份近乎复制的行模板合并抽取
               （以流水页较新版本为基准）：分类 emoji 图标 / 名称 / 备注 /
               时间 · 支付方式 / 带符号金额 / 凭证缩略图角标 / 右箭头。
               金额由 utils/rmb 的 formatMoney 统一格式化；颜色仍由
               amount 正负驱动 income class（组件不关心收支枚举）。
               凭证缩略图为列表 photos 第一张签名 URL，签名过期加载失败时：
               组件内最多触发一次 photo-error 事件（防死循环），由页面调
               GET /bills/:id 重拉换新签名 URL；URL 变化后自动清失败标记重试。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view
    class="flow-item"
    hover-class="row-hover"
    :hover-stay-time="60"
    @click="$emit('click', bill)"
  >
    <view class="flow-icon-wrap" :style="{ backgroundColor: bill.iconBg }">
      <text class="flow-icon">{{ bill.iconText }}</text>
    </view>
    <view class="flow-info">
      <view class="flow-title-row">
        <view class="flow-title-wrap">
          <text class="flow-title">{{ bill.title }}</text>
          <text v-if="bill.remark" class="flow-remark">{{ bill.remark }}</text>
        </view>
        <text class="flow-amount" :class="{ income: bill.amount > 0 }">
          {{ bill.amount > 0 ? '+' : '' }}{{ formatMoney(bill.amount) }}
        </text>
      </view>
      <view class="flow-meta">
        <text class="flow-time">{{ bill.time }}</text>
        <text class="flow-dot">·</text>
        <text class="flow-pay">{{ bill.payMethod }}</text>
      </view>
    </view>

    <!-- 凭证缩略图角标：仅有凭证的账单展示首图；加载失败先占位，等页面换签 -->
    <view v-if="photoUrl && photoFailed" class="flow-photo flow-photo-fallback">
      <uni-icons type="image" size="20" color="#b6bfb6"></uni-icons>
    </view>
    <image
      v-else-if="photoUrl"
      class="flow-photo"
      :src="photoUrl"
      mode="aspectFill"
      lazy-load
      @error="onPhotoError"
    />

    <uni-icons
      class="flow-arrow"
      type="right"
      size="14"
      color="#c2c9c3"
    ></uni-icons>
  </view>
</template>

<script setup>
/**
 * 流水行组件
 * props.bill 为 composable toBillVM 后的视图模型（id/title/iconText/iconBg/
 * amount/time/payMethod/remark/photos）；组件只读不写。
 */
import { computed, ref, watch } from 'vue'
import { formatMoney } from '@/utils/rmb'

const props = defineProps({
  // 账单视图模型
  bill: { type: Object, required: true },
})

const emit = defineEmits([
  // 点击整行：payload 为 bill
  'click',
  // 凭证图加载失败（仅触发一次）：页面据此重拉账单详情换签
  'photo-error',
])

// 第一张凭证的签名 URL（列表 / 详情口径均已归一为 {key,url}）
const photoUrl = computed(() => props.bill?.photos?.[0]?.url || '')

// 当前签名 URL 是否加载失败（控制占位展示，URL 更新后重置）
const photoFailed = ref(false)
// 本行是否已触发过换签（每条账单最多一次，杜绝失败 → 重拉死循环）
const photoEmitted = ref(false)

/** 凭证图加载失败：置占位；首次失败通知页面换签，之后不再触发 */
function onPhotoError() {
  photoFailed.value = true
  if (!photoEmitted.value) {
    photoEmitted.value = true
    emit('photo-error', props.bill)
  }
}

// 签名 URL 被页面换新：清失败占位，给新 URL 一次加载机会（不重置已触发标记）
watch(photoUrl, () => {
  photoFailed.value = false
})

// 复用行组件展示另一条账单时（理论少见），全部标记按新账单重置
watch(
  () => props.bill?.id,
  () => {
    photoFailed.value = false
    photoEmitted.value = false
  },
)
</script>

<style lang="scss" scoped>
.flow-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 26rpx 26rpx;

  // 内缩发丝分割线
  &::after {
    content: '';
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

  // hover-class 会把 row-hover 加到本节点自身
  &.row-hover {
    background: $bg-hover;
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
        color: $text-primary;
        flex-shrink: 0;
      }

      .flow-remark {
        margin-left: 10rpx;
        font-size: 23rpx;
        color: $text-secondary;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .flow-amount {
        font-size: 31rpx;
        font-weight: 600;
        color: $text-strong;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;

        &.income {
          color: $color-danger-soft;
        }
      }
    }

    .flow-meta {
      margin-top: 7rpx;

      .flow-time,
      .flow-pay {
        font-size: 21rpx;
        color: $text-secondary;
      }
      .flow-dot {
        margin: 0 9rpx;
        font-size: 21rpx;
        color: #c6ccc6;
      }
    }
  }

  // 凭证缩略图角标
  .flow-photo {
    flex-shrink: 0;
    width: 56rpx;
    height: 56rpx;
    margin-left: 12rpx;
    border-radius: 10rpx;
  }

  .flow-photo-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eef1ec;
  }

  .flow-arrow {
    flex-shrink: 0;
    margin-left: 12rpx;
  }
}
</style>
