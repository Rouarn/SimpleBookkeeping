/**
 * @file 统计 API + 首页聚合
 * @see docs/server/04d-api-statistics.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from './http'

/**
 * 概览卡（总额/环比/笔数/日均/结余）
 * @param {{month?:string,year?:string,type?:string,bookId?:string}} params
 *        month（YYYY-MM）与 year（YYYY）二选一，均缺省为当前月；
 *        year 为年维度时响应附 monthlyAverage / elapsedMonths
 * @returns {Promise<object>}
 */
export function overview(params) {
  return http.get('/statistics/overview', params)
}

/**
 * 分类排行
 * @param {{month?:string,year?:string,type:string,bookId?:string}} params
 *        type=expense|income；month/year 二选一
 * @returns {Promise<object[]>}
 */
export function categories(params) {
  return http.get('/statistics/categories', params)
}

/**
 * 支付方式排行
 * @param {{month?:string,year?:string,bookId?:string}} params month/year 二选一
 * @returns {Promise<object[]>}
 */
export function payMethods(params) {
  return http.get('/statistics/pay-methods', params)
}

/**
 * 收支趋势
 * @param {{months?:number,year?:string,bookId?:string}} params
 *        months=近 N 个月（默认 6）；year=YYYY 时返回该年 12 个月
 * @returns {Promise<object[]>}
 */
export function trend(params) {
  return http.get('/statistics/trend', params)
}

/**
 * 首页聚合数据（今日 + 当月 + 预算 + 用户名）
 * @returns {Promise<object>}
 */
export function home() {
  return http.get('/overview/home')
}

export default {
  overview,
  categories,
  payMethods,
  trend,
  home,
}
