/**
 * @file 账单 API：列表 / 今日 / 分组 / 汇总 / 详情 / 增删改
 * @see docs/server/04b-api-bills.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from './http'

/**
 * 账单凭证照片（详情口径）：key 为存储 key（编辑回填保存时原样传回），url 为签名访问 URL
 * @typedef {Object} BillPhoto
 * @property {string} key
 * @property {string} url
 */

/**
 * 账单列表项（字段与后端 BillVm 对齐）。
 * 注意：金额为服务端 DECIMAL 序列化的「字符串」，支出为负、收入为正，
 * 使用前需 Number() 转换；列表口径 photos 为签名 URL 字符串数组。
 * @typedef {Object} BillListItem
 * @property {string} id
 * @property {"expense"|"income"} type     收支方向
 * @property {string} amount               带符号金额字符串（支出负 / 收入正）
 * @property {string} amountAbs            绝对值金额字符串
 * @property {string} categoryId
 * @property {string} category             分类名称
 * @property {string} iconText             分类 emoji
 * @property {string} iconColor
 * @property {string} iconBg
 * @property {string} payMethodId
 * @property {string} payMethod            收/付款方式名称
 * @property {string} date                 记账日期 'YYYY-MM-DD'
 * @property {string} time                 记账时间 'HH:mm'
 * @property {string} remark               备注（可能为空串）
 * @property {string[]} photos             签名 URL 字符串数组（列表口径）
 * @property {string} bookId
 */

/**
 * 账单详情（GET /bills/:id，与后端 BillDetailVm 对齐）：
 * photos 为 {key,url} 对象数组，另附账本名 / 记录人 / 完整时间等扩展字段。
 * 其余字段同 BillListItem。
 * @typedef {Object} BillDetail
 * @property {string} id
 * @property {"expense"|"income"} type
 * @property {string} amount
 * @property {string} amountAbs
 * @property {string} categoryId
 * @property {string} category
 * @property {string} iconText
 * @property {string} iconColor
 * @property {string} iconBg
 * @property {string} payMethodId
 * @property {string} payMethod
 * @property {string} date
 * @property {string} time
 * @property {string} remark
 * @property {BillPhoto[]} photos          凭证照片（详情口径，含 key）
 * @property {string} bookId
 * @property {string} bookName             所属账本名称
 * @property {string} recorder             记录人
 * @property {string} recordTime           完整记录时间 'YYYY-MM-DD HH:mm'
 * @property {string} monthExpense         当月累计支出金额字符串
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 分页信封（各列表接口统一外壳）
 * @typedef {Object} PageData
 * @property {T[]} list
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @template T
 */

/**
 * 账单列表（分页 / 筛选）
 * @param {{page?:number,pageSize?:number,bookId?:string,month?:string,type?:string,startDate?:string,endDate?:string,keyword?:string}} params
 * @returns {Promise<PageData<BillListItem>>}
 */
export function list(params = {}) {
  return http.get('/bills', params)
}

/**
 * 今日账单（聚合首页今日流水；金额为字符串，使用前 Number() 转换）
 * @param {{bookId?:string}} [params]
 * @returns {Promise<{date:string,expense:string,income:string,list:BillListItem[]}>}
 */
export function today(params = {}) {
  return http.get('/bills/today', params)
}

/**
 * 流水页：按月 + 类型分组的账单
 * @param {{month:string,type?:string,bookId?:string}} params month=YYYY-MM；type=ALL|EXPENSE|INCOME
 * @returns {Promise<{groups:object[],summary:object}>}
 */
export function grouped(params) {
  return http.get('/bills/grouped', params)
}

/**
 * 月份汇总（收支笔数金额）
 * @param {{month:string,bookId?:string}} params
 * @returns {Promise<object>}
 */
export function summary(params) {
  return http.get('/bills/summary', params)
}

/**
 * 账单详情（含扩展字段）
 * photos 为 {key,url} 对象数组：key 供编辑回填保存时原样传回，url 为签名 URL 供展示
 * @param {string} id
 * @returns {Promise<BillDetail>}
 */
export function getOne(id) {
  return http.get(`/bills/${id}`)
}

/**
 * 新增账单
 * @param {object} payload {type,amount,categoryId,payMethodId,date,time,remark,photos,bookId}
 *   amount 为纯数字字符串（最多 2 位小数，上限 99999999.99）；time 为 'HH:mm'；
 *   photos 为已上传文件的 key 数组
 * @returns {Promise<BillDetail>}
 */
export function create(payload) {
  return http.post('/bills', payload)
}

/**
 * 更新账单（局部更新，photos 传参时全量替换）
 * @param {string} id
 * @param {object} payload 可选字段同 create（amount/time/photos 口径一致）
 * @returns {Promise<BillDetail>}
 */
export function update(id, payload) {
  return http.patch(`/bills/${id}`, payload)
}

/**
 * 删除账单
 * @param {string} id
 * @returns {Promise<object>}
 */
export function remove(id) {
  return http.del(`/bills/${id}`)
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
}
