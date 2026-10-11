/**
 * @file 鉴权 token 管理
 * @description accessToken 放内存（2h 有效，重启重新登录）；refreshToken 用
 *              uni.setStorageSync('bk:rt', ...) 持久化（30d）。供 api/http.js 与
 *              App.vue / 登录页共同使用。不与 utils/app-update/* 的独立 http 模块耦合。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */

/** refresh token 的本地存储 key */
const RT_KEY = 'bk:rt'

/** 登录页路由（pages.json 中非 tabBar 页，统一用 reLaunch 清空页面栈） */
const LOGIN_PATH = '/pages/login/index'

/** 内存中的 access token（进程级，重启即失，符合 2h 短时效策略） */
let accessToken = ''

/** 是否正在跳转登录页（避免并发 401 重复触发） */
let redirectLock = false

/**
 * 读取当前内存中的 access token
 * @returns {string}
 */
export function getAccessToken() {
  return accessToken
}

/**
 * 读取本地持久化的 refresh token
 * @returns {string}
 */
export function getRefreshToken() {
  return uni.getStorageSync(RT_KEY) || ''
}

/**
 * 写入 token：access 放内存，refresh 持久化（为空则清除本地）
 * @param {{accessToken?: string, refreshToken?: string}} tokens
 */
export function setTokens(tokens = {}) {
  if (tokens.accessToken) accessToken = tokens.accessToken
  if (tokens.refreshToken) {
    uni.setStorageSync(RT_KEY, tokens.refreshToken)
  } else if (tokens.refreshToken === null) {
    uni.removeStorageSync(RT_KEY)
  }
}

/**
 * 清空全部 token：内存 + 本地 refresh
 */
export function clearTokens() {
  accessToken = ''
  uni.removeStorageSync(RT_KEY)
}

/**
 * 当前是否已登录（仅判断是否持有 access / refresh 任一）
 * @returns {boolean}
 */
export function isLoggedIn() {
  return !!accessToken || !!uni.getStorageSync(RT_KEY)
}

/**
 * 确保登录态有效：失效时清空 token 并跳转登录页（加锁，避免并发 401 重复跳转）
 * @param {boolean} [redirectLogin=true] 是否执行 reLaunch 到登录页
 * @returns {boolean} 本次是否实际触发了跳转
 */
export function ensureLoggedIn(redirectLogin = true) {
  if (!redirectLogin) return false
  // 登录态既已失效，无论是否重复触发都先清掉内存/本地 token
  clearTokens()
  if (redirectLock) return false
  // 已在登录页时只清 token：避免并发 401 反复 reLaunch 刷新页面、打断用户输入
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (
    currentPage &&
    currentPage.route &&
    `/${currentPage.route}` === LOGIN_PATH
  ) {
    return false
  }
  redirectLock = true
  uni.reLaunch({
    url: LOGIN_PATH,
    complete: () => {
      // 锁延迟释放，避免当前调用栈内再次触发
      setTimeout(() => {
        redirectLock = false
      }, 500)
    },
  })
  return true
}
