/**
 * @file 账单详情组合式 API（composables 域文件）
 * @description 详情加载（query id 优先、eventChannel 兜底）/ 删除 / 变更自动刷新，
 *              以及账单变更订阅（onBillChange）、详情跳转（goBillDetail）与
 *              「再记一笔」预填中转常量（BILL_PREFILL_KEY）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { ref } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { useBillStore, BILL_CHANGE_EVENT, fmtMoney } from '@/store'
import { billsApi } from '@/api'
import { toBillVM } from './_shared'

/* -------------------------------------------------------------
 * 账单变更事件（跨页面 / 跨模块的命令式通信）
 * ----------------------------------------------------------- */

/**
 * 订阅账单增删改事件，页面卸载时自动解绑
 * @param {(payload: {action: string, id?: string, bill?: object}) => void} handler
 */
export function onBillChange(handler) {
  uni.$on(BILL_CHANGE_EVENT, handler)
  onUnload(() => {
    uni.$off(BILL_CHANGE_EVENT, handler)
  })
}

/**
 * 「再记一笔」预填数据的 storage 中转 key：详情页写入（金额/类型/分类/支付方式/备注），
 * 记账页 onLoad 读取后立即清除，用 storage 中转避免 eventChannel 的时序问题。
 */
export const BILL_PREFILL_KEY = 'bk:bill_prefill'

/**
 * 跳转账单详情：query 统一携带 id（支持分享落地 / H5 刷新 / 深链直达），
 * 同时保留 eventChannel 传参兜底（详情页有 query id 时不依赖 eventChannel）
 * @param {string} id
 */
export function goBillDetail(id) {
  uni.navigateTo({
    url: `/pages/detail/index?id=${id}`,
    success: (res) => {
      res.eventChannel.emit('billData', { id })
    },
  })
}

/**
 * 详情页数据：loadFromChannel 优先取页面 query 中的 id（分享落地 / H5 刷新 /
 * 深链直达场景），缺省再从上一页 eventChannel 兜底，之后异步拉详情；
 * 订阅账单变更事件实现编辑返回后自动刷新；removeCurrent 调 DELETE。
 * 状态三态：detail 有值 → 正常渲染；detailLoading → 加载中；
 * detailError → 加载失败或账单不存在（页面据此展示「重试 / 返回」）。
 * @returns {object} detail / currentId / detailLoading / detailError /
 *                   loadFromChannel / removeCurrent / reload
 */
export function useBillDetail() {
  const billStore = useBillStore()

  /**
   * @type {import('vue').Ref<object|null>}
   */
  const detail = ref(null)
  const currentId = ref('')
  /** 详情是否加载中（首屏与重拉共用） */
  const detailLoading = ref(true)
  /** 详情加载失败 / 账单不存在的终态（与「加载中」互斥） */
  const detailError = ref(false)

  /** 按 id 重新拉取详情（失败置 detailError，由页面展示重试 / 返回） */
  async function reload(id) {
    if (!id) return
    detailLoading.value = true
    try {
      const d = await billsApi.getOne(id)
      currentId.value = id
      if (d) {
        detail.value = {
          ...toBillVM(d),
          // 补充详情扩展字段
          bookId: d.bookId,
          bookName: d.bookName,
          recorder: d.recorder,
          recordTime: d.recordTime,
          monthExpense: fmtMoney(Number(d.monthExpense) || 0),
        }
        detailError.value = false
      } else {
        // 服务端返回空：视为账单不存在
        detail.value = null
        detailError.value = true
      }
    } catch {
      // 拉取失败（含账单已不存在）：进入错误态，不再与「加载中」混用文案
      detail.value = null
      detailError.value = true
    } finally {
      detailLoading.value = false
    }
  }

  /**
   * 在页面 onLoad 中调用：优先取 query 的 id，无 query id 时兜底从
   * 上一页 eventChannel 读取 { id }（eventChannel 保留作大对象传参优化）
   * @param {object} [options] onLoad 入参（query）
   */
  function loadFromChannel(options) {
    if (options?.id) {
      reload(options.id)
      return
    }
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    const eventChannel = page?.getOpenerEventChannel?.()
    if (eventChannel) {
      eventChannel.on('billData', (data) => {
        if (data?.id) reload(data.id)
      })
    } else {
      // 深链无 id 且无 eventChannel：直接进入错误态，避免永久 loading
      detailError.value = true
      detailLoading.value = false
    }
  }

  // 账单变更联动：编辑后返回自动刷新；当前账单被删除时仅清空本地态，
  // 不再请求 GET /bills/:id（账单已不存在，否则必然收到 404 并弹错）
  onBillChange(({ action, id }) => {
    if (action === 'remove') {
      if (id && id === currentId.value) {
        currentId.value = ''
        detail.value = null
      }
      return
    }
    if (id && id === currentId.value) reload(id)
  })

  /**
   * 删除当前账单（调 DELETE /bills/:id）
   * 失败时抛错且不清空本地态，由页面决定停留或跳转（http 层已统一 toast）
   */
  async function removeCurrent() {
    if (!currentId.value) return false
    await billStore.removeBill(currentId.value)
    return true
  }

  return {
    detail,
    currentId,
    detailLoading,
    detailError,
    loadFromChannel,
    removeCurrent,
    reload,
  }
}
