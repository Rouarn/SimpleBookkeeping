<!--
  @file 金额输入区（pages/add/components/AmountField.vue）
  @description 记账页大金额输入（自 pages/add/index.vue 拆分）：仅数字与一位小数点、
               最多 2 位小数、上限 99999999.99；失焦千分位展示、聚焦去格式便于编辑。
               v-model 绑定纯数字字符串（无千分位，保存时直接提交）；外部写入
               （编辑回填 / 再记一笔预填）经 watcher 统一规范化并同步展示格式。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-11-04 Liquid Glass 重构：金额改为「凹陷玻璃输入格」
                （--c-glass-inner 底 + 内高光 + 发丝描边），白色金额收敛至 $text-title，
                空态占位色由内联样式改由 CSS 类控制（判定条件与数据流不变）
-->
<template>
  <!-- 金额：仅数字与一位小数点、最多 2 位小数、上限 99999999.99；
       失焦千分位展示、聚焦去格式便于编辑。
       注意：App webview 的 digit 输入框映射为数字 input，无法承载含逗号的
       "4,727.64"（会被渲染为空并告警），因此失焦态用 text 覆盖层展示千分位，
       聚焦时才挂载真输入框（保留数字键盘）。 -->
  <view class="amount-row">
    <text
      v-if="!focused"
      class="amount-input amount-text"
      :class="{ 'is-empty': !amountDisplay }"
      @click="onDisplayClick"
      >{{ amountDisplay || '0.0' }}</text
    >
    <input
      v-else
      :value="amountDisplay"
      class="amount-input"
      type="digit"
      placeholder="0.0"
      placeholder-style="color: var(--c-text-placeholder, #8b938d)"
      :focus="focused"
      @input="onAmountInput"
      @blur="onAmountBlur"
    />
  </view>
</template>

<script setup>
/**
 * 金额输入：内部维护展示值 amountDisplay，对外只发纯数字字符串；
 * focused 期间外部同步回写不做千分位，避免编辑过程中被插入逗号。
 */
import { ref, watch } from 'vue'

const props = defineProps({
  /** 纯数字字符串（无千分位，保存口径） */
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

/**
 * 金额上限（与 BE 口径一致：最多 2 位小数 + 99,999,999.99 上限）
 */
const AMOUNT_MAX = '99999999.99'
const AMOUNT_MAX_NUM = Number(AMOUNT_MAX)

/**
 * 规范化金额输入：仅保留数字与一个分隔点、最多 2 位小数、去无效前导零；
 * 超出上限时截断到上限并提示。提交口径与 BE 一致（纯数字字符串）。
 * @param {string} raw 输入框原始值
 * @returns {string} 规范化后的纯数字字符串
 */
function sanitizeAmount(raw) {
  let s = String(raw ?? '').replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) {
    // 只保留第一个小数点
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    s = s.slice(0, dot + 3) // 最多 2 位小数
  }
  s = s.replace(/^0+(?=\d)/, '') // 去多余前导零（保留单个 0）
  if (Number(s) > AMOUNT_MAX_NUM) {
    uni.showToast({ title: '金额最大 99,999,999.99', icon: 'none' })
    return AMOUNT_MAX
  }
  return s
}

/**
 * 千分位格式化（仅展示用）：整数部分每 3 位插逗号，小数原样保留
 * @param {string} s 纯数字字符串
 * @returns {string}
 */
function formatAmountDisplay(s) {
  if (!s) return ''
  const [int, dec] = s.split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec === undefined ? intFmt : `${intFmt}.${dec}`
}

// 展示值（失焦后带千分位）；编辑回填 / 预填经 watcher 同步
const amountDisplay = ref(formatAmountDisplay(props.modelValue))
// 输入框是否处于聚焦态（聚焦时外部回写不做千分位）
const focused = ref(false)

// 外部写入（编辑回填 / 再记一笔预填 / 输入事件回写）：统一规范化，
// 超限时把截断后的规范值回吐父组件；失焦态同步千分位展示
watch(
  () => props.modelValue,
  (v) => {
    const s = sanitizeAmount(v)
    if (s !== v) emit('update:modelValue', s)
    amountDisplay.value = focused.value ? s : formatAmountDisplay(s)
  },
)

/** 金额输入：过滤非法字符 / 限制小数位与上限，同步纯数值与展示值 */
function onAmountInput(e) {
  const s = sanitizeAmount(e.detail.value)
  emit('update:modelValue', s)
  amountDisplay.value = s
}

/** 点击千分位展示文本：先切回原始纯数字值再挂载输入框聚焦（避免 digit 框收到逗号值） */
function onDisplayClick() {
  amountDisplay.value = props.modelValue
  focused.value = true
}

/** 金额失焦：千分位格式化展示 */
function onAmountBlur() {
  focused.value = false
  amountDisplay.value = formatAmountDisplay(props.modelValue)
}
</script>

<style lang="scss" scoped>
// 金额：凹陷玻璃输入格（内底 + 内高光 + 发丝描边），大字走 $text-title + 等宽数字
.amount-row {
  margin-top: 24rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  border-radius: 32rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));

  // 82rpx：上限金额 99,999,999.99 在 375pt 宽的凹陷格内仍单行完整展示
  // （原 92rpx 无内边距时可容纳，加玻璃格内边距后需按实测收敛字阶）
  .amount-input {
    display: block;
    width: 100%;
    height: 124rpx;
    box-sizing: border-box;
    font-size: 82rpx;
    font-weight: 700;
    line-height: 124rpx;
    color: $text-title;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  // 失焦态千分位展示覆盖层：与输入框同字号，空态占位色由下方类控制
  .amount-text {
    display: block;
  }

  .amount-text.is-empty {
    color: $text-placeholder;
  }
}
</style>
