/**
 * @file 统计 API + 首页聚合
 * @see docs/server/04d-api-statistics.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from "./http";

/**
 * 月度概览（收支笔数 + 预算进度）
 * @param {{month:string,type?:string,bookId?:string}} params
 * @returns {Promise<object>}
 */
export function overview(params) {
  return http.get("/statistics/overview", params);
}

/**
 * 分类排行
 * @param {{month:string,type:string,bookId?:string}} params type=expense|income
 * @returns {Promise<object[]>}
 */
export function categories(params) {
  return http.get("/statistics/categories", params);
}

/**
 * 支付方式排行
 * @param {{month:string,bookId?:string}} params
 * @returns {Promise<object[]>}
 */
export function payMethods(params) {
  return http.get("/statistics/pay-methods", params);
}

/**
 * 月度趋势
 * @param {{months:number,bookId?:string}} params
 * @returns {Promise<object[]>}
 */
export function trend(params) {
  return http.get("/statistics/trend", params);
}

/**
 * 首页聚合数据（今日 + 当月 + 预算 + 用户名）
 * @returns {Promise<object>}
 */
export function home() {
  return http.get("/overview/home");
}

export default {
  overview,
  categories,
  payMethods,
  trend,
  home,
};
