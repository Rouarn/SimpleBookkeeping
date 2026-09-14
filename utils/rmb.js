/**
 * @file 人民币金额转中文大写工具
 * @description 将阿拉伯数字金额转换为财务场景使用的中文大写金额，
 *              支持角分、负数（负）与「万 / 亿 / 兆」节进位，
 *              最大支持到兆级；非法入参返回空串，零元返回「零元整」。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */

/**
 * 将金额转换为人民币大写金额
 * @param {number|string} raw 原始金额，允许带 ¥、逗号等非数字字符（会被清洗）
 * @returns {string} 大写金额字符串，如 1234.56 -> '壹仟贰佰叁拾肆元伍角陆分'；入参非法时返回 ''
 */
export function toRmbUppercase(raw) {
  // 仅保留数字、小数点、负号，兼容 '¥1,234.50' 这类带格式的输入
  const amount = Number(String(raw ?? '').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(amount)) return ''

  const negative = amount < 0
  const abs = Math.abs(amount)
  // 先四舍五入到分，避免 0.1 + 0.2 之类的浮点尾数影响角分拆分
  const rounded = Math.round(abs * 100) / 100
  if (rounded === 0) return '零元整'

  // digit：0-9 的大写；unit1：节内个/拾/佰/仟；unit2：节间万/亿/兆
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit1 = ['', '拾', '佰', '仟']
  const unit2 = ['', '万', '亿', '兆']

  // 拆出整数部分与角、分（金额只精算到两位小数）
  const integerPart = Math.floor(rounded)
  const fractionPart = Math.round((rounded - integerPart) * 100)
  const jiao = Math.floor(fractionPart / 10)
  const fen = fractionPart % 10

  /**
   * 单个「四位节」转中文（0-9999）
   * 核心规则：连续的 0 只保留一个「零」，节末尾的 0 不读零
   * @param {number} section 0-9999 的整数
   * @returns {string} 如 1005 -> '壹仟零伍'
   */
  function sectionToChinese(section) {
    let out = ''
    let unitPos = 0
    let zero = true
    while (section > 0) {
      const d = section % 10
      if (d === 0) {
        if (!zero) {
          zero = true
          out = digit[0] + out
        }
      } else {
        zero = false
        out = digit[d] + unit1[unitPos] + out
      }
      unitPos++
      section = Math.floor(section / 10)
    }
    return out.replace(/零+/g, '零').replace(/零$/g, '')
  }

  // 整数部分按每 4 位切一节（个/万/亿/兆），从低位向高位依次转换后前置拼接；
  // needZero 记录跨节时是否需要补「零」（如 10000123 -> 壹仟万零壹佰贰拾叁）
  let int = integerPart
  let intText = ''
  let sectionIndex = 0
  let needZero = false
  while (int > 0) {
    const section = int % 10000
    if (section === 0) {
      // 整节为 0：若更高位还有文字，标记下一个非零节前需要补零
      if (intText) needZero = true
    } else {
      let sectionText = sectionToChinese(section)
      if (needZero) intText = '零' + intText
      sectionText += unit2[sectionIndex]
      intText = sectionText + intText
      needZero = section < 1000
    }
    int = Math.floor(int / 10000)
    sectionIndex++
  }

  // 小数部分：无角分写「整」；有角写角、有分写分，零角零分不输出
  let fracText = ''
  if (jiao === 0 && fen === 0) {
    fracText = '整'
  } else {
    if (jiao !== 0) fracText += digit[jiao] + '角'
    if (fen !== 0) fracText += digit[fen] + '分'
  }

  // 纯小数（如 0.56）不带「元」；其余在整数后补「元」，负数统一加「负」前缀
  if (integerPart === 0) {
    const result = fracText
    return negative ? `负${result}` : result
  }

  intText = (intText || '零') + '元'
  const result = intText + fracText
  return negative ? `负${result}` : result
}
