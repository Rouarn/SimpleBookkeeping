/**
 * @file 用户 API：资料 / 头像 / 统计 / 数据导出 / 账号注销
 * @see docs/server/04a-api-auth-user.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 * @modify 2026-10-12 新增账单 CSV 导出（download 封装）与账号注销
 */
import { http, upload, download, normalizeFileUrl } from './http'

/**
 * 获取当前用户资料
 * @returns {Promise<object>} {id,username,name,avatar,joinDate,...}
 */
export function getMe() {
  return http.get('/users/me')
}

/**
 * 更新资料（仅 name 等可改字段）
 * @param {{name?:string}} payload
 * @returns {Promise<object>} 更新后的用户
 */
export function updateMe(payload) {
  return http.patch('/users/me', payload)
}

/**
 * 上传头像（multipart，服务端直传并返回 url）
 * 统一走 http.upload()：鉴权闸门 + 401 单飞重试
 * @param {string} filePath 临时文件路径
 * @returns {Promise<{avatar:string}>}
 */
export function uploadAvatar(filePath) {
  return upload({
    url: '/users/me/avatar',
    filePath,
    name: 'file',
  }).then((data) => {
    // 归一化签名 URL，确保使用客户端可达的 BASE_URL
    if (data && data.avatar) data.avatar = normalizeFileUrl(data.avatar)
    if (data && data.url) data.url = normalizeFileUrl(data.url)
    return data
  })
}

/**
 * 获取记账统计（累计笔数、金额、天数等）
 * @returns {Promise<object>}
 */
export function getStats() {
  return http.get('/users/me/stats')
}

/**
 * 导出账单 CSV（GET /users/me/export，服务端流式响应）
 * 走 http.download()：arraybuffer + Authorization + 401 单飞重试一次。
 * 注意服务端限流 6 次/小时，超限返回错误码 42900（调用方映射文案）。
 * @param {{month?: string}} [params] month 为 'YYYY-MM'，缺省导出全部账单
 * @returns {Promise<ArrayBuffer>} CSV 二进制（UTF-8 含 BOM，Excel 兼容）
 */
export function exportCsv(params = {}) {
  return download({ url: '/users/me/export', data: params })
}

/**
 * 注销账号（POST /users/me/deactivate）
 * 校验密码，成功后服务端立即吊销全部登录态；业务数据保留期后清除。
 * @param {{password: string}} payload 登录密码（8~32 位）
 * @returns {Promise<void>}
 */
export function deactivate(payload) {
  return http.post('/users/me/deactivate', payload)
}

export default {
  getMe,
  updateMe,
  uploadAvatar,
  getStats,
  exportCsv,
  deactivate,
}
