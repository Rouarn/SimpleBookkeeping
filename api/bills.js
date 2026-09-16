/**
 * @file 账单 API：列表 / 今日 / 分组 / 汇总 / 详情 / 增删改 / 清空
 * @see docs/server/04b-api-bills.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from "./http";

/**
 * 账单列表（分页 / 筛选）
 * @param {{page?:number,pageSize?:number,bookId?:string,type?:string,startDate?:string,endDate?:string,keyword?:string}} params
 * @returns {Promise<{list:object[],total:number,page:number,pageSize:number}>}
 */
export function list(params = {}) {
  return http.get("/bills", params);
}

/**
 * 今日账单（聚合首页今日流水）
 * @param {{bookId?:string}} [params]
 * @returns {Promise<{date:string,expense:number,income:number,list:object[]}>}
 */
export function today(params = {}) {
  return http.get("/bills/today", params);
}

/**
 * 流水页：按月 + 类型分组的账单
 * @param {{month:string,type?:string,bookId?:string}} params month=YYYY-MM；type=ALL|EXPENSE|INCOME
 * @returns {Promise<{groups:object[],summary:object}>}
 */
export function grouped(params) {
  return http.get("/bills/grouped", params);
}

/**
 * 月份汇总（收支笔数金额）
 * @param {{month:string,bookId?:string}} params
 * @returns {Promise<object>}
 */
export function summary(params) {
  return http.get("/bills/summary", params);
}

/**
 * 账单详情（含扩展字段）
 * @param {string} id
 * @returns {Promise<object>}
 */
export function getOne(id) {
  return http.get(`/bills/${id}`);
}

/**
 * 新增账单
 * @param {object} payload {type,amount,categoryId,payMethodId,date,time,remark,photos,bookId}
 * @returns {Promise<object>}
 */
export function create(payload) {
  return http.post("/bills", payload);
}

/**
 * 更新账单
 * @param {string} id
 * @param {object} payload 局部字段
 * @returns {Promise<object>}
 */
export function update(id, payload) {
  return http.patch(`/bills/${id}`, payload);
}

/**
 * 删除账单
 * @param {string} id
 * @returns {Promise<object>}
 */
export function remove(id) {
  return http.del(`/bills/${id}`);
}

/**
 * 清空账单（body: {confirm:true,bookId?}）
 * @param {{confirm:boolean,bookId?:string}} payload
 * @returns {Promise<object>}
 */
export function clearAll(payload) {
  return http.del("/bills", payload);
}

export default {
  list,
  today,
  grouped,
  summary,
  getOne,
  create,
  update,
  remove,
  clearAll,
};
