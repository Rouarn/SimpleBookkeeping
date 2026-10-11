/**
 * @file 用户 API：资料 / 头像 / 统计
 * @see docs/server/04a-api-auth-user.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http, upload, normalizeFileUrl } from './http'

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

export default {
  getMe,
  updateMe,
  uploadAvatar,
  getStats,
}
