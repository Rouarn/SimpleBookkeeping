/**
 * @file 账本 API
 * @see docs/server/04c-api-books-dictionaries.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from './http'

/**
 * 账本列表
 * @returns {Promise<object[]>}
 */
export function list() {
  return http.get('/books')
}

/**
 * 新建账本
 * @param {{name:string,budget?:number,currency?:string,members?:string[]}} payload
 * @returns {Promise<object>}
 */
export function create(payload) {
  return http.post('/books', payload)
}

/**
 * 获取当前激活账本
 * @returns {Promise<object>}
 */
export function getActive() {
  return http.get('/books/active')
}

/**
 * 设置激活账本
 * @param {{bookId:string}} payload
 * @returns {Promise<object>}
 */
export function setActive(payload) {
  return http.put('/books/active', payload)
}

/**
 * 更新账本
 * @param {string} id
 * @param {object} payload
 * @returns {Promise<object>}
 */
export function update(id, payload) {
  return http.patch(`/books/${id}`, payload)
}

export default {
  list,
  create,
  getActive,
  setActive,
  update,
}
