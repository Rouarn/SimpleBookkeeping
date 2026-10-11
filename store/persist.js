/**
 * @file Pinia 持久化插件（uni-app 多端适配版）
 * @description 为 setup 风格的 Pinia store 提供声明式持久化能力：
 *              1. 基于 @/utils/storage 自动适配 uni 存储 / localStorage / 内存兜底，
 *                 iOS、Android、H5、小程序均可使用；
 *              2. 每个 store 独立存储键，统一 'bk:' 命名空间前缀，杜绝跨模块互相覆盖；
 *              3. 存储信封 { __v, value }，内置版本号 + migrations 迁移链，支持数据模型演进；
 *              4. paths 白名单（支持点路径），实现「统一走 Pinia、只持久化部分字段」；
 *              5. 恢复时以「默认结构 + 已存结构」合并，数组整体替换，既补齐新增字段，
 *                 又避免已删除数据被默认值复活（历史项目踩过的坑）；
 *              6. 同步写入 + 全链路 try/catch，任何单条脏数据都不会导致应用白屏。
 *              主要导出：createPersistPlugin / STORAGE_PREFIX。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { getStorageJSON, setStorageJSON, removeStorage } from '@/utils/storage'

/** 统一存储前缀，避免与其他应用/旧方案的 key 冲突 */
export const STORAGE_PREFIX = 'bk:'
/** 存储信封中的版本号字段名 */
const VERSION_KEY = '__v'
/** 存储信封中的数据载荷字段名 */
const VALUE_KEY = 'value'

/** 判断是否为普通对象（排除数组、null、Date 等），决定合并/迁移逻辑是否可深入 */
function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

/** 按点路径取值，如 getPath(obj, 'profile.name') */
function getPath(target, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined
    return acc[key]
  }, target)
}

/** 按点路径赋值，自动补中间对象 */
function setPath(target, path, value) {
  const keys = path.split('.')
  const last = keys.pop()
  let node = target
  for (const key of keys) {
    if (!isPlainObject(node[key])) node[key] = {}
    node = node[key]
  }
  node[last] = value
}

/** 按白名单从完整 state 中摘取可持久化片段 */
function pickPaths(state, paths) {
  const picked = {}
  paths.forEach((path) => {
    const value = getPath(state, path)
    if (value !== undefined) setPath(picked, path, value)
  })
  return picked
}

/**
 * 以默认状态为底，合并磁盘数据（原地修改默认状态）：
 * - 数组：整体替换（防止被删除的记录被默认种子"复活"）
 * - 对象：递归合并（补齐新版本新增的字段）
 * - 基本类型：磁盘值覆盖默认值
 */
function mergeState(base, saved) {
  if (!isPlainObject(saved)) return base
  Object.keys(saved).forEach((key) => {
    const savedValue = saved[key]
    if (Array.isArray(savedValue)) {
      base[key] = savedValue
    } else if (isPlainObject(savedValue)) {
      if (!isPlainObject(base[key])) base[key] = {}
      mergeState(base[key], savedValue)
    } else if (savedValue !== undefined) {
      base[key] = savedValue
    }
  })
  return base
}

/**
 * 归一化 persist 配置
 * @param {boolean | import('@/store/types').PersistOptions} [option]
 * @returns {Required<Pick<import('@/store/types').PersistOptions,'version'|'paths'|'migrations'>> & {key?: string} | null}
 */
function normalizeOption(option) {
  if (!option) return null
  const cfg =
    option === true
      ? {}
      : {
          key: option.key,
          version: option.version,
          paths: option.paths,
          migrations: option.migrations,
        }
  return {
    key: cfg.key,
    version: Number(cfg.version) || 0,
    paths: Array.isArray(cfg.paths) ? cfg.paths : [],
    migrations: isPlainObject(cfg.migrations) ? cfg.migrations : {},
  }
}

/**
 * 创建并返回持久化插件实例
 * @returns {import('pinia').PiniaPlugin}
 */
export function createPersistPlugin() {
  return function persistPlugin(context) {
    const { store, options } = context
    const config = normalizeOption(options.persist)
    if (!config) return

    const storageKey = STORAGE_PREFIX + (config.key || store.$id)

    // ---------- 启动恢复（hydration） ----------
    const snapshot = getStorageJSON(storageKey)
    if (snapshot !== null) {
      // 兼容两种历史格式：信封 {__v,value} 与直接的 state 对象
      const isEnvelope = isPlainObject(snapshot) && VALUE_KEY in snapshot
      let savedState = isEnvelope ? snapshot[VALUE_KEY] : snapshot
      let fromVersion = isEnvelope ? Number(snapshot[VERSION_KEY]) || 0 : 0

      try {
        // 顺序执行迁移链 v0 -> v1 -> ... -> 当前版本
        while (fromVersion < config.version) {
          const migrate = config.migrations[fromVersion]
          if (typeof migrate === 'function') {
            savedState = migrate(savedState) ?? savedState
          }
          fromVersion += 1
        }

        if (isPlainObject(savedState)) {
          if (config.paths.length > 0) {
            config.paths.forEach((path) => {
              const value = getPath(savedState, path)
              if (value !== undefined) setPath(store.$state, path, value)
            })
          } else {
            mergeState(store.$state, savedState)
          }
        }
      } catch (e) {
        // 恢复失败时保留默认状态，并清掉坏数据，避免反复报错
        console.warn(
          `[pinia-persist] 恢复 store "${store.$id}" 失败，已回退默认值`,
          e,
        )
        removeStorage(storageKey)
      }
    }

    // ---------- 变更订阅（同步落盘，保证杀进程不丢数据） ----------
    store.$subscribe(
      () => {
        try {
          const partial =
            config.paths.length > 0
              ? pickPaths(store.$state, config.paths)
              : store.$state
          setStorageJSON(storageKey, {
            [VERSION_KEY]: config.version,
            [VALUE_KEY]: partial,
          })
        } catch (e) {
          console.warn(`[pinia-persist] 持久化 store "${store.$id}" 失败`, e)
        }
      },
      { flush: 'sync', detached: true },
    )
  }
}
