<!--
  @file 收 / 付款方式选择区（pages/add/components/PayMethodPicker.vue）
  @description 记账页白色内容区的支付方式胶囊（自 pages/add/index.vue 拆分）：
               字典来自 book store（接口缓存），选中方式 id 经 v-model 双向同步；
               区块标题随收支方向切换（支出→支付方式，收入→收款方式）。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <!-- 收/付款方式 -->
  <view class="section">
    <view class="section-title">{{ paySectionTitle }}</view>
    <view class="pay-list">
      <view
        v-for="pay in payMethods"
        :key="pay.id"
        class="pay-pill"
        :class="{ on: modelValue === pay.id }"
        @click="emit('update:modelValue', pay.id)"
      >
        {{ pay.name }}
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 支付方式选择：v-model 为选中方式 id，直接以 id 匹配选中态。
 */
import { computed } from 'vue'
import { useBookStore } from '@/store'

const props = defineProps({
  /** 当前选中支付方式 id（提交口径） */
  modelValue: { type: String, default: '' },
  /** 收支方向 'expense' | 'income'（决定区块标题） */
  billType: { type: String, default: 'expense' },
})

const emit = defineEmits(['update:modelValue'])

const bookStore = useBookStore()

// 收付款方式选项（book store 字典项 {id,name,...}，直接以 id 匹配选中态）
const payMethods = computed(() => bookStore.payMethods)

// 区块标题随收支方向变化（支出→支付方式，收入→收款方式）
const paySectionTitle = computed(() =>
  props.billType === 'expense' ? '支付方式' : '收款方式',
)
</script>

<style lang="scss" scoped>
.section {
  .section-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #1e2521;
    margin: 36rpx 0 24rpx;
  }
}

// 支付方式
.pay-list {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;

  .pay-pill {
    padding: 13rpx 30rpx;
    border: 2rpx solid #e3e8e3;
    border-radius: 999rpx;
    font-size: 27rpx;
    color: #767e78;
    background: #ffffff;
    box-sizing: border-box;
    text-align: center;

    &.on {
      border-color: transparent;
      background: #e6f3ec;
      color: $color-primary-deep;
      font-weight: 600;
    }
  }
}
</style>
