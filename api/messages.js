/**
 * @file 消息中心 API：分页列表 / 未读数 / 标记已读
 * @see src/modules/messages/messages.controller.ts（服务端契约）
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-12
 */
import { http } from './http'

/**
 * 消息列表项（GET /users/me/messages）
 * @typedef {Object} MessageItem
 * @property {string} id 消息 id（数字串，标已读时转 number 传 ids）
 * @property {'budget_over'|'security'|'monthly_report'} type 消息类型：超预算 / 安全 / 月报
 * @property {string} title 标题
 * @property {string} content 正文
 * @property {unknown|null} payload 附加数据
 * @property {boolean} isRead 是否已读
 * @property {string|null} readAt 已读时间（ISO）
 * @property {string} createdAt 创建时间（ISO）
 */

/**
 * 消息分页列表（created_at 倒序）
 * @param {{page?: number, pageSize?: number}} [params] page/pageSize 缺省走服务端默认
 * @returns {Promise<{items: MessageItem[], pagination: {page:number,pageSize:number,total:number,totalPages:number}}>}
 */
export function list(params = {}) {
  return http.get('/users/me/messages', params)
}

/**
 * 未读消息数
 * @returns {Promise<{count: number}>}
 */
export function unreadCount() {
  return http.get('/users/me/messages/unread-count')
}

/**
 * 标记已读（ids 与 all 二选一，恰传其一）
 * @param {{ids?: number[], all?: boolean}} payload ids 单次最多 200 个
 * @returns {Promise<{updated: number}>}
 */
export function markRead(payload) {
  return http.put('/users/me/messages/read', payload)
}

export default { list, unreadCount, markRead }
