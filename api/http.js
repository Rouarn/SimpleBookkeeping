/**
 * @file HTTP 请求封装（基于 uni.request）
 * @description 1) 注入 Authorization：除 register/login/refresh 外自动带 token；
 *              2) 冷启动引导（ensureAccessToken）：内存 access 仅进程级，重启后
 *                 首批请求不再「裸奔等 401」，而是先共享同一次单飞 refresh 拿到
 *                 新 access 再发出——全应用每次冷启动最多一次 /auth/refresh；
 *              3) 统一解包：响应只认 code===0，返回 data；非 0 抛错；
 *              4) 运行中 access 失效（40100/40101）自动 refresh 重试一次；
 *                 刷新结果三态：ok 成功；invalid（无 rt / 40100 / 40102）清登录态
 *                 reLaunch 登录页；unavailable（断网 / 5xx / 429）保留 30 天
 *                 refresh token，不误清登录态，由调用方按网络错误提示并重试；
 *              5) 错误码统一 toast：42900/42901「操作过于频繁」、5xx「服务繁忙」、网络异常；
 *              6) multipart 上传统一走 upload()：与 request 同一鉴权闸门与
 *                 401 单飞重试语义；
 *              7) 失败一律 reject ApiError（Error 子类，保留 code/raw 属性，
 *                 与历史裸对象 {code,message,raw} 形状兼容）。
 *              8) arraybuffer 下载统一走 download()：面向 CSV 流式响应，
 *                 同一鉴权闸门与 401 单飞重试语义，成功直接 resolve 二进制；
 *              注意：服务端 refresh token「轮换 + 重放即连坐吊销」，故同进程内
 *              必须严格单飞（refreshing 锁 + 启动引导 Promise），避免重复使用旧 rt。
 *              与 utils/app-update/* 内的 http 模块完全独立，互不耦合。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  ensureLoggedIn,
} from '@/utils/auth'
import { API_BASE } from '@/config/env'

/** 服务端基地址（统一来自 config/env.js，生产强制 HTTPS） */
export const BASE_URL = API_BASE

/**
 * 统一 API 错误类型（Error 子类）
 * 与历史 reject 裸对象 {code,message,raw} 形状完全兼容：
 * - code：业务错误码（信封 body.code）、HTTP 状态码，或 -1（网络异常）；
 * - raw：原始响应 / 底层错误对象，供调用方按需取细节；
 * - message：可直接 toast 的错误文案（Error 原生属性）；
 * - name 固定为 'ApiError'，catch 中可用 instanceof ApiError 精确判断。
 */
export class ApiError extends Error {
  /**
   * @param {string} message 错误文案
   * @param {{code?: number, raw?: any}} [options] code 错误码；raw 原始响应/错误
   */
  constructor(message, { code, raw } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.raw = raw
  }
}

/** 全局 API 前缀 */
const API_PREFIX = '/api/v1'

/** 文件访问路径前缀（与服务端 FilesController 一致） */
const FILES_PATH = '/api/v1/files/'

/**
 * 归一化服务端返回的文件 URL：若 URL 的 host/port 与客户端 BASE_URL 不一致
 * （如服务端 FILES_BASE_URL 配置为 localhost 或其他地址），则用 BASE_URL 重写前缀，
 * 保留签名查询参数。签名仅覆盖 key + exp，不含 host，故重写不影响验签。
 * @param {string} url 服务端签名 URL
 * @returns {string} 客户端可访问的 URL
 */
export function normalizeFileUrl(url) {
  if (!url || typeof url !== 'string') return url
  const idx = url.indexOf(FILES_PATH)
  if (idx === -1) return url
  const tail = url.slice(idx) // /api/v1/files/bills/...?e=...&sign=...
  return `${BASE_URL}${tail}`
}

/** 免鉴权路径前缀（白名单，命中即不注入 Authorization） */
const WHITELIST = ['/auth/register', '/auth/login', '/auth/refresh']

/** 是否在刷新中（避免并发多次 refresh） */
let refreshing = false

/** 等待 refresh 完成的请求队列（刷新成功后依次重试） */
let pendingQueue = []

/**
 * 路径是否在免鉴权白名单（按 path 片段匹配，避免 query 干扰）
 * @param {string} path 形如 "/auth/login"
 */
function isWhitelisted(path) {
  return WHITELIST.some((prefix) => path.startsWith(prefix))
}

/**
 * 拼接最终 URL：BASE_URL + API_PREFIX + path
 * @param {string} path 形如 "/bills" 或 "/bills/abc"
 */
function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return `${BASE_URL}${API_PREFIX}${p}`
}

/**
 * 统一 toast（去重）
 * @param {string} title
 * @param {"none"|"success"|"error"} [icon]
 */
function toast(title, icon = 'none') {
  if (!title) return
  uni.showToast({ title, icon, duration: 2000 })
}

/**
 * 调用 POST /auth/refresh 换取新 access；并发时只发一次，其余挂起等待。
 * 这里直接用 uni.request 调 refresh，避免与 api/auth.js 产生循环依赖。
 * @returns {Promise<'ok'|'invalid'|'unavailable'>}
 *   - ok：刷新成功，新 token 对已写入（access 内存 / refresh 本地）；
 *   - invalid：本地无 rt，或服务端明确判定凭证失效（HTTP 401，40100/40102），
 *     调用方应清登录态并跳登录页；
 *   - unavailable：断网 / 5xx / 429 等临时性失败，rt 仍然有效，调用方应
 *     保留登录态，按网络错误提示并允许后续重试（不得清 token）。
 */
function doRefresh() {
  if (refreshing) {
    return new Promise((resolve) => pendingQueue.push(resolve))
  }
  refreshing = true
  const rt = getRefreshToken()
  if (!rt) {
    refreshing = false
    pendingQueue.forEach((r) => r('invalid'))
    pendingQueue = []
    return Promise.resolve('invalid')
  }
  /** 统一结算等待队列与本次 Promise */
  const settle = (resolve) => (status) => {
    pendingQueue.forEach((r) => r(status))
    pendingQueue = []
    resolve(status)
  }
  return new Promise((resolve) => {
    const done = settle(resolve)
    uni.request({
      url: `${BASE_URL}${API_PREFIX}/auth/refresh`,
      method: 'POST',
      data: { refreshToken: rt },
      timeout: 15000,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          const tokens = body.data || {}
          setTokens({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          })
          done('ok')
          return
        }
        // 服务端明确表示凭证失效（refresh 缺失/非法/过期/已吊销）
        if (
          res.statusCode === 401 ||
          body.code === 40100 ||
          body.code === 40102
        ) {
          done('invalid')
        } else {
          // 429 / 5xx 等：不认定登录态失效，保留 rt 以便下次重试
          done('unavailable')
        }
      },
      fail: () => done('unavailable'),
      complete: () => {
        refreshing = false
      },
    })
  })
}

/**
 * 冷启动引导 Promise：全应用单飞。
 * - 内存已有 access → 直接 ok；
 * - 无 rt → invalid（调用方跳登录页）；
 * - 仅有 rt（重启后常态）→ 共享同一次 doRefresh；
 * 结算后释放引用：成功后 getAccessToken 短路；invalid 随即跳登录；
 * unavailable 后下次调用可用保留的 rt 重新尝试。
 * @returns {Promise<'ok'|'invalid'|'unavailable'>}
 */
let bootPromise = null
export function ensureAccessToken() {
  if (getAccessToken()) return Promise.resolve('ok')
  if (!getRefreshToken()) return Promise.resolve('invalid')
  if (!bootPromise) {
    bootPromise = doRefresh().finally(() => {
      bootPromise = null
    })
  }
  return bootPromise
}

/**
 * 从入参 url 中剥离 host 与 API 前缀，得到鉴权白名单匹配用路径
 * @param {string} url 接口路径或完整 URL
 * @returns {string} 形如 "/auth/login"
 */
function resolveApiPath(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  return path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path
}

/**
 * 发起一次请求（最底层封装，不处理 401 重试）
 * @param {object} opts
 * @param {string} opts.url 接口路径（如 "/bills"）或完整 URL
 * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [opts.method="GET"]
 * @param {object} [opts.data] 请求体（GET 时会拼到 query）
 * @param {object} [opts.header]
 * @param {number} [opts.timeout]
 * @param {boolean} [opts.rawResponse=false] 是否返回原始响应（用于下载/特殊场景）
 * @returns {Promise<any>} 解包后的 data
 */
function requestOnce(opts) {
  const url = buildUrl(opts.url)
  const method = (opts.method || 'GET').toUpperCase()
  const header = { ...(opts.header || {}) }

  // 注入 Authorization（白名单跳过；正常情况下闸门已保证此处持有 access）
  if (!isWhitelisted(resolveApiPath(opts.url))) {
    const token = getAccessToken()
    if (token) header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: opts.data,
      header,
      timeout: opts.timeout || 15000,
      success: (res) => {
        // 非 2xx：优先解析信封 body.code（401 判定依赖 40100/40101，
        // 仅凭 statusCode 会把 40101 过期误判成普通失败，静默刷新失效）
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let body = res.data
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body || '{}')
            } catch {
              body = {}
            }
          }
          body = body && typeof body === 'object' ? body : {}
          reject(
            new ApiError(body.message || `请求失败(${res.statusCode})`, {
              code: typeof body.code === 'number' ? body.code : res.statusCode,
              raw: res,
            }),
          )
          return
        }
        if (opts.rawResponse) {
          resolve(res)
          return
        }
        const body = res.data || {}
        // 成功：code === 0
        if (body.code === 0) {
          resolve(body.data === undefined ? null : body.data)
          return
        }
        // 业务错误
        reject(
          new ApiError(body.message || '请求失败', {
            code: body.code,
            raw: body,
          }),
        )
      },
      fail: (err) => {
        reject(new ApiError('网络异常', { code: -1, raw: err }))
      },
    })
  })
}

/**
 * 处理错误：按 code 决定 toast 文案
 * @param {{code:number,message:string}} err
 */
function handleBusinessError(err) {
  const code = err.code
  if (code === 42900 || code === 42901) {
    toast('操作过于频繁，请稍后再试')
  } else if (code === 40100 || code === 40102) {
    // 40100 未登录/登录失效（无法静默刷新时）、40102 refresh 失效：
    // 清登录态并跳转登录页（ensureLoggedIn 内部去重，不弹 toast）
    ensureLoggedIn(true)
  } else if (code >= 500 && code < 600) {
    toast('服务繁忙，请稍后重试')
  } else if (code === -1) {
    toast('网络异常，请检查网络')
  } else if (err.message) {
    toast(err.message)
  }
}

/**
 * 主请求入口
 * 1) 冷启动闸门：非白名单请求发出前必须持有 access token；内存没有时共享
 *    同一次静默 refresh（全应用单飞），从源头杜绝无 token 请求批量 401；
 * 2) invalid（无 rt / rt 失效）：清登录态 reLaunch 登录页，不弹多余 toast；
 * 3) unavailable（断网 / 5xx / 429 导致刷新没完成）：保留登录态，按网络错误
 *    toast 并抛错，网络恢复后页面重进 / onShow 会再次经闸门自动恢复；
 * 4) 运行中 access 失效（40100/40101）：强制刷新一次并重试原请求。
 * @param {object} opts 同 requestOnce
 * @returns {Promise<any>}
 */
export async function request(opts) {
  // —— 冷启动 / 鉴权引导闸门 ——
  if (!isWhitelisted(resolveApiPath(opts.url))) {
    const status = await ensureAccessToken()
    if (status === 'invalid') {
      ensureLoggedIn(true)
      throw new ApiError('未登录或登录已失效', { code: 40100 })
    }
    if (status === 'unavailable') {
      // 刷新都没完成（断网/服务暂不可用），不发必然 401 的请求，保留 rt 待恢复
      const err = new ApiError('网络异常', { code: -1 })
      handleBusinessError(err)
      throw err
    }
  }

  try {
    return await requestOnce(opts)
  } catch (err) {
    // 运行中 access 缺失/非法（40100）或过期（40101）：有 rt 才尝试刷新重试
    if (
      err &&
      (err.code === 40100 || err.code === 40101) &&
      getRefreshToken()
    ) {
      const status = await doRefresh()
      if (status === 'ok') {
        try {
          return await requestOnce(opts)
        } catch (err2) {
          // 新 access 仍被拒（如账号已不存在/冻结边缘情况）：按错误码兜底
          handleBusinessError(err2)
          throw err2
        }
      }
      if (status === 'invalid') {
        // 凭证被服务端明确否决：清登录态跳登录页
        ensureLoggedIn(true)
        throw err
      }
      // unavailable：保留登录态，按普通错误提示，稍后可重试
      handleBusinessError(err)
      throw err
    }
    handleBusinessError(err)
    throw err
  }
}

/**
 * 统一 multipart 上传封装（uni.uploadFile）
 * 与 request() 同一套鉴权语义：
 * 1) 冷启动闸门：上传前必须持有 access token（ensureAccessToken 单飞）；
 * 2) 运行中 access 失效（40100）或过期（40101）：有 rt 则刷新后重试一次；
 * 3) invalid：清登录态跳登录页；unavailable：按网络错误提示；
 * 4) 统一解析 {code,message,data} 信封（uploadFile 的 res.data 是字符串）。
 * @param {object} opts
 * @param {string} opts.url 接口路径（如 "/uploads/image"）
 * @param {string} opts.filePath 本地文件路径（uni.chooseImage 返回值）
 * @param {string} [opts.name="file"] 表单文件字段名
 * @param {object} [opts.formData] 附加表单字段
 * @param {number} [opts.timeout=60000]
 * @returns {Promise<any>} 解包后的 data
 */
export async function upload(opts) {
  // —— 冷启动 / 鉴权引导闸门（与 request 一致）——
  const status = await ensureAccessToken()
  if (status === 'invalid') {
    ensureLoggedIn(true)
    throw new ApiError('未登录或登录已失效', { code: 40100 })
  }
  if (status === 'unavailable') {
    const err = new ApiError('网络异常', { code: -1 })
    handleBusinessError(err)
    throw err
  }

  const doUpload = () =>
    new Promise((resolve, reject) => {
      uni.uploadFile({
        url: buildUrl(opts.url),
        filePath: opts.filePath,
        name: opts.name || 'file',
        formData: opts.formData,
        header: { Authorization: `Bearer ${getAccessToken()}` },
        timeout: opts.timeout || 60000,
        success: (res) => {
          let body = res.data
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body || '{}')
            } catch {
              body = {}
            }
          }
          body = body && typeof body === 'object' ? body : {}
          if (
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            body.code === 0
          ) {
            resolve(body.data === undefined ? null : body.data)
            return
          }
          reject(
            new ApiError(body.message || `上传失败(${res.statusCode})`, {
              code: typeof body.code === 'number' ? body.code : res.statusCode,
              raw: res,
            }),
          )
        },
        fail: (err) => reject(new ApiError('网络异常', { code: -1, raw: err })),
      })
    })

  try {
    return await doUpload()
  } catch (err) {
    // access 运行中失效/过期：有 rt 才刷新重试一次（与 request 语义一致）
    if (
      err &&
      (err.code === 40100 || err.code === 40101) &&
      getRefreshToken()
    ) {
      const st = await doRefresh()
      if (st === 'ok') return doUpload()
      if (st === 'invalid') {
        ensureLoggedIn(true)
        throw err
      }
    }
    handleBusinessError(err)
    throw err
  }
}

/**
 * ArrayBuffer → UTF-8 字符串（下载错误信封解析 / App 端写文本文件用）
 * 优先 TextDecoder；缺失时走 fromCharCode + escape 解码兜底（App v8 无 TextDecoder）。
 * @param {ArrayBuffer} buffer 二进制内容
 * @returns {string}
 */
export function bufferToText(buffer) {
  if (!buffer) return ''
  if (typeof TextDecoder === 'function') {
    try {
      return new TextDecoder('utf-8').decode(buffer)
    } catch {
      // ignore：降级到手工解码
    }
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  try {
    return decodeURIComponent(escape(binary))
  } catch {
    return binary
  }
}

/**
 * 统一 arraybuffer 下载封装（uni.request responseType=arraybuffer）
 * 面向 CSV 等流式响应：成功响应无 {code,data} 信封，直接 resolve 原始
 * ArrayBuffer；错误响应仍是 JSON 信封，按 request 同规则解析为 ApiError。
 * 与 request/upload 同一套鉴权语义：
 * 1) 冷启动闸门：下载前必须持有 access token（ensureAccessToken 单飞）；
 * 2) 运行中 access 失效（40100）或过期（40101）：有 rt 则刷新后重试一次；
 * 3) invalid：清登录态跳登录页；unavailable / 其余错误：抛 ApiError 交调用方
 *    处理（下载场景的限流文案与端侧动作各异，不在此统一 toast）。
 * @param {object} opts
 * @param {string} opts.url 接口路径（如 "/users/me/export"）
 * @param {object} [opts.data] query 参数（GET 时拼到 query）
 * @param {"GET"|"POST"} [opts.method="GET"]
 * @param {number} [opts.timeout=60000]
 * @returns {Promise<ArrayBuffer>} 响应二进制
 */
export async function download(opts) {
  // —— 冷启动 / 鉴权引导闸门（与 request/upload 一致）——
  const status = await ensureAccessToken()
  if (status === 'invalid') {
    ensureLoggedIn(true)
    throw new ApiError('未登录或登录已失效', { code: 40100 })
  }
  if (status === 'unavailable') {
    throw new ApiError('网络异常', { code: -1 })
  }

  const doDownload = () =>
    new Promise((resolve, reject) => {
      uni.request({
        url: buildUrl(opts.url),
        method: (opts.method || 'GET').toUpperCase(),
        data: opts.data,
        responseType: 'arraybuffer',
        header: { Authorization: `Bearer ${getAccessToken()}` },
        timeout: opts.timeout || 60000,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
            return
          }
          // 错误体按 {code,message} 信封解析（arraybuffer → string → JSON）
          let body = {}
          try {
            body = JSON.parse(bufferToText(res.data) || '{}')
          } catch {
            body = {}
          }
          body = body && typeof body === 'object' ? body : {}
          reject(
            new ApiError(body.message || `下载失败(${res.statusCode})`, {
              code: typeof body.code === 'number' ? body.code : res.statusCode,
              raw: res,
            }),
          )
        },
        fail: (err) => reject(new ApiError('网络异常', { code: -1, raw: err })),
      })
    })

  try {
    return await doDownload()
  } catch (err) {
    // access 运行中失效/过期：有 rt 才刷新重试一次（与 request/upload 语义一致）
    if (
      err &&
      (err.code === 40100 || err.code === 40101) &&
      getRefreshToken()
    ) {
      const st = await doRefresh()
      if (st === 'ok') return doDownload()
      if (st === 'invalid') {
        ensureLoggedIn(true)
        throw err
      }
    }
    throw err
  }
}

/**
 * 便捷方法
 */
export const http = {
  get: (url, data, opts) => request({ ...opts, url, method: 'GET', data }),
  post: (url, data, opts) => request({ ...opts, url, method: 'POST', data }),
  put: (url, data, opts) => request({ ...opts, url, method: 'PUT', data }),
  patch: (url, data, opts) => request({ ...opts, url, method: 'PATCH', data }),
  del: (url, data, opts) => request({ ...opts, url, method: 'DELETE', data }),
}

export default http
