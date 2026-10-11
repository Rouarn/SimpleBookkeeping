/**
 * @file 跨端本地存储适配器
 * @description 按优先级自动选择底层实现，对上层屏蔽平台差异：
 *                1. uni.getStorageSync / uni.setStorageSync  —— App(iOS/Android)、各家小程序
 *                2. window.localStorage                     —— H5（uni API 缺失时的兜底）
 *                3. 内存 Map                                —— SSR / 异常环境的最终兜底
 *
 *              约定：
 *              - 所有写入一律由调用方 JSON.stringify 后传入字符串，保证各平台序列化协议一致，
 *                避免 boolean/object 直存、读取时又按字符串解析导致的数据损坏（历史教训）。
 *              - 任何单条数据的读写失败都不应让应用崩溃，统一吞掉异常并打印告警。
 *
 *              主要导出：getStorage / setStorage / removeStorage（字符串层）、
 *              getStorageJSON / setStorageJSON（JSON 层）及默认导出的聚合对象。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 *
 * @typedef {Object} StorageBackend
 * @property {(key: string) => string | null} get
 * @property {(key: string, value: string) => void} set
 * @property {(key: string) => void} remove
 */

/** 内存兜底存储（进程级，刷新后失效） */
const memoryStore = new Map()

/** 检测当前运行环境是否提供 uni 同步存储 API */
function canUseUniStorage() {
  return (
    typeof uni !== 'undefined' &&
    typeof uni.getStorageSync === 'function' &&
    typeof uni.setStorageSync === 'function'
  )
}

/** 检测当前运行环境是否可用 window.localStorage（部分沙箱访问 window 会抛异常） */
function canUseLocalStorage() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    )
  } catch {
    return false
  }
}

/** @type {StorageBackend} */
const uniBackend = {
  get(key) {
    // uni.getStorageSync 在 key 不存在时返回 ''（App/小程序）或 null（部分平台）
    const value = uni.getStorageSync(key)
    return value === '' || value === null || value === undefined
      ? null
      : String(value)
  },
  set(key, value) {
    // uni.setStorageSync 是同步 API，签名是 (key, data)，位置参数；
    // 不要与异步的 uni.setStorage({key,data}) 混用，否则数据写不进去。
    uni.setStorageSync(key, value)
  },
  remove(key) {
    uni.removeStorageSync(key)
  },
}

/** @type {StorageBackend} */
const webBackend = {
  get(key) {
    return window.localStorage.getItem(key)
  },
  set(key, value) {
    window.localStorage.setItem(key, value)
  },
  remove(key) {
    window.localStorage.removeItem(key)
  },
}

/** @type {StorageBackend} */
const memoryBackend = {
  get(key) {
    return memoryStore.has(key) ? memoryStore.get(key) : null
  },
  set(key, value) {
    memoryStore.set(key, value)
  },
  remove(key) {
    memoryStore.delete(key)
  },
}

/** 按 uni 存储 -> localStorage -> 内存 的优先级解析唯一后端（模块加载时确定一次） */
function resolveBackend() {
  if (canUseUniStorage()) return uniBackend
  if (canUseLocalStorage()) return webBackend
  return memoryBackend
}

const backend = resolveBackend()

/**
 * 读取一条原始字符串
 * @param {string} key 存储键
 * @returns {string | null} 读取失败或不存在时返回 null
 */
export function getStorage(key) {
  try {
    return backend.get(key)
  } catch (e) {
    console.warn(`[storage] 读取失败: ${key}`, e)
    return null
  }
}

/**
 * 写入一条字符串
 * @param {string} key 存储键
 * @param {string} value 字符串值（一般为 JSON.stringify 的结果）
 * @returns {boolean} 是否写入成功
 */
export function setStorage(key, value) {
  try {
    backend.set(key, String(value))
    return true
  } catch (e) {
    console.warn(`[storage] 写入失败: ${key}`, e)
    return false
  }
}

/**
 * 删除一条数据
 * @param {string} key 存储键
 */
export function removeStorage(key) {
  try {
    backend.remove(key)
  } catch (e) {
    console.warn(`[storage] 删除失败: ${key}`, e)
  }
}

/**
 * 读取并反序列化 JSON：
 * - getStorage 约定只返回字符串或 null（写入侧统一 String(value)），故直接 parse；
 * - 解析失败 / 不存在 → 返回 null。
 * @param {string} key
 * @returns {unknown | null}
 */
export function getStorageJSON(key) {
  const raw = getStorage(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    console.warn(`[storage] JSON 解析失败，已忽略: ${key}`, e)
    return null
  }
}

/**
 * 序列化并写入
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean}
 */
export function setStorageJSON(key, value) {
  try {
    return setStorage(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`[storage] JSON 序列化失败: ${key}`, e)
    return false
  }
}

/** 当前实际生效的后端名称，便于调试/文档示例 */
export const storageBackendName = canUseUniStorage()
  ? 'uni'
  : canUseLocalStorage()
    ? 'localStorage'
    : 'memory'

export default {
  get: getStorage,
  set: setStorage,
  remove: removeStorage,
  getJSON: getStorageJSON,
  setJSON: setStorageJSON,
  backendName: storageBackendName,
}
