/**
 * @file 日期工具函数集合
 * @description 记账业务的日期/月份处理工具，全部为纯函数，全平台可用，
 *              不依赖任何 uni-app 平台 API。主要模块：
 *              1. 当前时间取值：currentMonth / todayStr / nowTime；
 *              2. 格式化：formatDate / formatMD / formatMonthCN；
 *              3. 日期比较与分组：diffFromToday / dayLabel / isSameMonth；
 *              4. 月份运算：shiftMonth。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */

/**
 * 数字补零至两位（月、日、时、分拼接前的统一处理）
 * @param {number} n 0-99 的整数
 * @returns {string} 两位字符串，如 9 -> '09'
 */
export const pad = n => String(n).padStart(2, "0");

/**
 * 当前年月
 * @returns {string} 形如 '2026-09'
 */
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/**
 * 当前年份
 * @returns {string} 形如 '2026'
 */
export function currentYear() {
  return String(new Date().getFullYear());
}

/**
 * 当前日期
 * @returns {string} 形如 '2026-09-14'
 */
export function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 当前时分
 * @returns {string} 形如 '18:39'
 */
export function nowTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * 从 Date 对象得到 'YYYY-MM-DD'
 * @param {Date} date 任意日期对象
 * @returns {string} 形如 '2026-09-14'
 */
export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 'YYYY-MM-DD' → 'M月D日'（月、日去除前导零，符合中文阅读习惯）
 * @param {string} dateStr 日期字符串
 * @returns {string} 形如 '9月14日'；入参非法时返回空串
 */
export function formatMD(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "";
  const [, m, d] = dateStr.split("-");
  if (!m || !d) return "";
  return `${Number(m)}月${Number(d)}日`;
}

/**
 * 'YYYY-MM' → 'YYYY年M月'
 * @param {string} month 月份字符串
 * @returns {string} 形如 '2026年9月'；入参非法时返回空串
 */
export function formatMonthCN(month) {
  if (!month || typeof month !== "string") return "";
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}

/**
 * 'YYYY-MM-DD' 与今天相差的整天数（今天=0，昨天=1，明天=-1）
 * @param {string} dateStr 日期字符串
 * @returns {number} 相差天数；入参为空或非法日期时返回 NaN
 */
export function diffFromToday(dateStr) {
  if (!dateStr) return NaN;
  // 统一补 T00:00:00 截断到当天零点，消除时分秒与夏令时对整天差值的干扰
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return NaN;
  const today = new Date(`${formatDate(new Date())}T00:00:00`);
  // 一天的毫秒数 86400000；round 兜底时区/夏令时造成的不足整天偏差
  return Math.round((today.getTime() - target.getTime()) / 86400000);
}

/** 星期中文名，下标与 Date.prototype.getDay() 返回值（0=周日）一一对应 */
const WEEK_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 流水分组用的中文日标签：今天 / 昨天 / 周X
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {string} 今天 / 昨天 / 周X；入参非法时返回空串
 */
export function dayLabel(dateStr) {
  const diff = diffFromToday(dateStr);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEK_NAMES[d.getDay()];
}

/**
 * 判断 'YYYY-MM-DD' 是否属于指定月份
 * @param {string} dateStr 日期字符串
 * @param {string} month 'YYYY-MM'
 * @returns {boolean} 前缀匹配即同月，避免 new Date 解析的跨端差异
 */
export function isSameMonth(dateStr, month) {
  return typeof dateStr === "string" && dateStr.startsWith(`${month}-`);
}

/**
 * 月份加减（借助 Date 自动处理跨年、闰年）
 * @param {string} month 'YYYY-MM'
 * @param {number} offset 偏移月数，可为负（如 -1 表示上一月）
 * @returns {string} 'YYYY-MM'
 */
export function shiftMonth(month, offset) {
  const [y, m] = String(month).split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
