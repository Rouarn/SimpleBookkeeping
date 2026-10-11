/**
 * @file 更新模块请求封装（utils/app-update/http.js）
 * @description uni.request 的 Promise 化封装，独立于业务请求层：
 *              更新服务在登录态之外也必须可用，且服务端响应为统一外壳
 *              { code, message, data }，仅在 HTTP 200 且 code === 200
 *              时 resolve(data)，其余情况 reject。
 * @date 2026-09-15
 */

import { UPDATE_CONFIG } from './config'

/**
 * 通用请求
 * @param {{url: string, method?: string, data?: object, timeout?: number}} opts
 * @returns {Promise<any>} 响应外壳中的 data
 */
export function request({ url, method = 'GET', data = {}, timeout = 10000 }) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${UPDATE_CONFIG.baseUrl}${url}`,
      method,
      data,
      timeout,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode === 200 && body.code === 200) {
          resolve(body.data)
        } else {
          reject(new Error(body.message || `HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}
