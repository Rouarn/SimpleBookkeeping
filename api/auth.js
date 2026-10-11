/**
 * @file 鉴权 API：注册 / 登录 / 登出
 * @description token 刷新不经过本模块：冷启动单飞与 401 静默刷新全部内聚在
 *              api/http.js（doRefresh / ensureAccessToken），避免多处持锁
 *              导致 refresh token 重放连坐吊销。
 * @see docs/server/04a-api-auth-user.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from './http'
import { setTokens, clearTokens } from '@/utils/auth'

/**
 * 注册（返回 user 与 token）
 * @param {{username:string,password:string,name?:string}} payload
 * @returns {Promise<{user:object,accessToken:string,refreshToken:string}>}
 */
export function register(payload) {
  return http.post('/auth/register', payload).then((data) => {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    })
    return data
  })
}

/**
 * 登录
 * @param {{username:string,password:string}} payload
 * @returns {Promise<{user:object,accessToken:string,refreshToken:string}>}
 */
export function login(payload) {
  return http.post('/auth/login', payload).then((data) => {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    })
    return data
  })
}

/**
 * 登出：清本地 token（服务端可选吊销）
 */
export function logout() {
  return http
    .post('/auth/logout')
    .catch(() => {})
    .finally(() => {
      clearTokens()
    })
}

export default { register, login, logout }
