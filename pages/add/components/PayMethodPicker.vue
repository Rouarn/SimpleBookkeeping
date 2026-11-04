<!--
  @file 收 / 付款方式选择区（pages/add/components/PayMethodPicker.vue）
  @description 记账页白色内容区的支付方式胶囊（自 pages/add/index.vue 拆分）：
               字典来自 book store（接口缓存），选中方式 id 经 v-model 双向同步；
               区块标题随收支方向切换（支出→支付方式，收入→收款方式）。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：标题 / 胶囊边框底色文字收敛至主题 token
  @modify 2026-11-04 Liquid Glass 重构：支付方式胶囊改为薄玻璃胶囊
                （未选中 g-glass--thin，选中主色描边 + --c-glass-strong 底），
                标题字阶与记账页玻璃面板内的区块标题统一
-->
<template>
  <!-- 收/付款方式 -->
  <view class="section">
    <view class="section-title">{{ paySectionTitle }}</view>
    <view class="pay-list">
      <view
        v-for="pay in payMethods"
        :key="pay.id"
        class="pay-pill g-glass g-glass--thin g-pill"
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
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.5rpx;
    color: $text-title;
    margin: 24rpx 0 20rpx;
  }
}

// 支付方式：薄玻璃胶囊，选中为主色描边 + 强玻璃底
.pay-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;

  .pay-pill {
    padding: 14rpx 30rpx;
    font-size: 27rpx;
    line-height: 1.25;
    color: $text-regular;
    box-sizing: border-box;
    text-align: center;
    // 小面积玻璃：模糊半径收小，控制重绘成本
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      box-shadow 0.2s ease;

    // 选中：主色环（不占布局）+ 强玻璃底 + 主色文字
    &.on {
      background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.74));
      color: $color-primary-deep;
      font-weight: 600;
      box-shadow:
        0 0 0 2rpx var(--c-primary, #175142),
        0 10rpx 22rpx rgba(22, 48, 38, 0.16),
        inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95));
    }
  }
}
</style>
