/**
 * @file 人民币金额工具（全站唯一金额格式化实现）
 * @description 收敛原三套实现（store/modules/bill.js 的 fmtMoney、
 *              statistics 页内 fmt、模板内联 toFixed）：
 *              - 入参兼容 number 与服务端 DECIMAL 序列化字符串，非法值按 0 处理；
 *              - 先乘 100 四舍五入取整再除回，规避浮点累加误差；
 *              - 固定两位小数输出，负数保留负号（颜色由调用方 class 控制，
 *                本函数只返回字符串，不做红显）；
 *              - 不做千分位（与原三套实现的展示行为一致）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11
 */

/**
 * 金额保留两位小数（先乘 100 取整再除回，避免浮点误差）
 * @param {number|string} n 原始数值（元，支持带符号字符串）
 * @returns {number} 两位小数数值
 */
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * 金额格式化为两位小数字符串（模板直接渲染用）
 * @param {number|string} n 原始数值（元，number 或字符串均可）
 * @returns {string} 如 '12.30'、'-8.00'
 */
export const formatMoney = (n) => roundMoney(n).toFixed(2)

export default {
  roundMoney,
  formatMoney,
}
