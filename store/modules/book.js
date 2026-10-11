/**
 * @file 账本 store（book 模块，接口数据缓存）
 * @description 管理账本（多账本能力预留）、当前激活账本、月预算与收付款方式字典。
 *              数据来源由服务端接口提供：GET /books、GET|PUT /books/active、GET /pay-methods。
 *              本 store 作为缓存层：登录后由 App.vue / 页面 onShow 触发 fetch。
 *              persist: false —— 数据来源为服务端，本地不再持久化账本业务数据。
 *              主要导出：useBookStore，提供账本增改、当前账本切换、
 *              预算设置与支付方式元数据查询。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { booksApi, dictionariesApi } from '@/api'

/** 支付方式静态兜底元数据（接口未拉取或名称不匹配时） */
const PAY_FALLBACK = { short: '其', color: '#8a8f9c', bg: '#f1f2f7' }

/**
 * 把服务端支付方式字段映射为展示元数据
 * @param {object} item {id,name,shortName,color,bg}
 */
function toPayMeta(item) {
  return {
    id: item.id,
    name: item.name,
    short: item.shortName || item.name?.slice(0, 1) || '其',
    color: item.color || PAY_FALLBACK.color,
    bg: item.bg || PAY_FALLBACK.bg,
  }
}

export const useBookStore = defineStore(
  'book',
  () => {
    /** @type {import('vue').Ref<import('@/store/types').Book[]>} */
    const books = ref([])
    const activeBookId = ref('')
    /** 收付款方式选项（接口缓存） */
    const payMethods = ref([])
    /** 是否已拉取过账本列表（响应式加载标记，随 reset 复位） */
    const booksLoaded = ref(false)
    /** 是否已拉取过支付方式 */
    const payLoaded = ref(false)

    const activeBook = computed(
      () =>
        books.value.find((b) => b.id === activeBookId.value) ||
        books.value[0] || { id: '', name: '默认账本', budget: 0 },
    )

    /**
     * 拉取账本列表 + 当前激活账本
     * @param {boolean} [force=false]
     */
    async function fetchBooks(force = false) {
      if (booksLoaded.value && !force) return
      const [list, active] = await Promise.all([
        booksApi.list(),
        booksApi.getActive().catch(() => null),
      ])
      // GET /books 返回 {list:[...]}；兼容直接数组形态
      const arr = Array.isArray(list) ? list : list?.list || []
      books.value = arr.map((b) => ({
        id: b.id,
        name: b.name,
        budget: Number(b.budget) || 0,
      }))
      if (active && active.id) activeBookId.value = active.id
      else if (books.value[0]) activeBookId.value = books.value[0].id
      booksLoaded.value = true
    }

    /**
     * 拉取支付方式字典
     * @param {boolean} [force=false]
     */
    async function fetchPayMethods(force = false) {
      if (payLoaded.value && !force) return
      const list = await dictionariesApi.getPayMethods()
      payMethods.value = (list || []).map(toPayMeta)
      payLoaded.value = true
    }

    /**
     * @param {string} id
     * @returns {import('@/store/types').Book | undefined}
     */
    function getBook(id) {
      return books.value.find((b) => b.id === id)
    }

    /**
     * 支付方式元数据，找不到时返回安全兜底
     * @param {string} name
     */
    function getPayMeta(name) {
      const found = payMethods.value.find((p) => p.name === name)
      return found
        ? { short: found.short, color: found.color, bg: found.bg }
        : { ...PAY_FALLBACK }
    }

    /**
     * 切换当前账本（调服务端 PUT /books/active）
     * @param {string} id
     */
    async function setActiveBook(id) {
      if (!books.value.some((b) => b.id === id)) return
      await booksApi.setActive({ bookId: id })
      activeBookId.value = id
    }

    /**
     * 新增账本（调服务端 POST /books，成功后刷新本地列表）
     * @param {{name: string, budget?: number}} input
     * @returns {Promise<object>}
     */
    async function addBook({ name, budget = 0 }) {
      const created = await booksApi.create({
        name: String(name || '新账本').slice(0, 12),
        budget: Math.max(0, Number(budget) || 0),
      })
      // 主动刷新本地缓存
      booksLoaded.value = false
      await fetchBooks(true)
      return created
    }

    /**
     * 更新账本（名称 / 预算）
     * @param {string} id
     * @param {Partial<Pick<import('@/store/types').Book,'name'|'budget'>>} patch
     */
    async function updateBook(id, patch) {
      const payload = {}
      if (typeof patch.name === 'string' && patch.name.trim()) {
        payload.name = patch.name.trim().slice(0, 12)
      }
      if (patch.budget !== undefined) {
        payload.budget = Math.max(0, Number(patch.budget) || 0)
      }
      await booksApi.update(id, payload)
      const book = getBook(id)
      if (book) {
        if (payload.name) book.name = payload.name
        if (payload.budget !== undefined) book.budget = payload.budget
      }
    }

    /**
     * 直接设置当前账本月预算
     * @param {number} budget
     */
    async function setBudget(budget) {
      await updateBook(activeBook.value.id, { budget })
    }

    /** 重置本地缓存与加载标记（退出登录时调用） */
    function reset() {
      books.value = []
      activeBookId.value = ''
      payMethods.value = []
      booksLoaded.value = false
      payLoaded.value = false
    }

    return {
      books,
      activeBookId,
      payMethods,
      booksLoaded,
      payLoaded,
      activeBook,
      fetchBooks,
      fetchPayMethods,
      getBook,
      getPayMeta,
      setActiveBook,
      addBook,
      updateBook,
      setBudget,
      reset,
    }
  },
  // 数据来源为服务端，不启用本地持久化
  { persist: false },
)
