/**
 * @file 一言组合式 API（Composables 层）
 * @description 从自建 Hitokoto 兼容接口拉取随机短句，供首页便签卡展示。
 *              设计要点：
 *              1. 外部静态接口（非业务后端），直接 uni.request，不走 api/http.js
 *                 （无 code===0 信封、无需 Authorization、无 401 刷新逻辑）；
 *              2. 模块级单例：多个页面/组件 useHitokoto() 共享同一句与同一次请求；
 *              3. 本地缓存最近一句：冷启动 / 断网时先展示缓存，不留白、不报错；
 *              4. 冷启动自动拉取一次（仅一次），之后由用户点按「换一句」手动刷新；
 *              5. 刷新并发防抖：进行中的请求复用同一 Promise。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-20
 */
import { ref } from 'vue'
import { getStorageJSON, setStorageJSON } from '@/utils/storage'
import { STATIC_BASE } from '@/config/env'

/** 一言接口地址（Hitokoto 兼容协议，JSON 直出） */
const HITOKOTO_URL = `${STATIC_BASE}/hitokoto?encode=json&min_length=4&max_length=30`

/** 最近一句的本地缓存键 */
const CACHE_KEY = 'hitokoto_last'

/** 当前句子（模块级单例）：{ text, from, who } */
const quote = ref(getStorageJSON(CACHE_KEY) || null)

/** 是否正在拉取 */
const loading = ref(false)

/** 进行中的请求 Promise（并发单飞） */
let pending = null

/** 冷启动是否已自动拉取过 */
let autoFetched = false

/**
 * 拉取一句新的一言；失败时保留当前句子（或缓存句）。
 * @param {object} [options]
 * @param {boolean} [options.silent=true] 失败是否静默：自动拉取静默，
 *   用户手动点「换一句」时传 false 以 toast 反馈（否则表现为"点了没反应"）
 * @returns {Promise<void>}
 */
export function refreshHitokoto({ silent = true } = {}) {
  if (pending) return pending
  loading.value = true
  let ok = false
  pending = new Promise((resolve) => {
    uni.request({
      url: HITOKOTO_URL,
      method: 'GET',
      timeout: 8000,
      success: (res) => {
        const d = res.data
        if (res.statusCode === 200 && d && typeof d.hitokoto === 'string') {
          ok = true
          quote.value = {
            text: d.hitokoto,
            from: d.from || '',
            who: d.from_who || '',
          }
          setStorageJSON(CACHE_KEY, quote.value)
        }
        // 接口异常时不打扰用户，保留上一句
      },
      fail: () => {
        // 断网 / 超时：缓存句兜底
      },
      complete: () => {
        loading.value = false
        pending = null
        if (!silent && !ok) {
          uni.showToast({ title: '一言获取失败，请检查网络', icon: 'none' })
        }
        resolve()
      },
    })
  })
  return pending
}

/**
 * 一言便签数据
 * @param {boolean} [autoLoad=true] 是否在首次调用时自动拉取一句
 * @returns {{quote: import('vue').Ref<{text:string,from:string,who:string}|null>,
 *            loading: import('vue').Ref<boolean>,
 *            refresh: () => Promise<void>}}
 */
export function useHitokoto(autoLoad = true) {
  if (autoLoad && !autoFetched) {
    autoFetched = true
    refreshHitokoto()
  }
  // 手动刷新（卡片点击）：失败时 toast 反馈
  return { quote, loading, refresh: () => refreshHitokoto({ silent: false }) }
}
