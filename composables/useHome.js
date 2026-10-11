/**
 * @file 首页组合式 API（composables 域文件）
 * @description 首页本月统计卡 + 今日流水（GET /overview/home 一次聚合）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { computed, ref } from 'vue'
import { useBookStore, useUserStore, fmtMoney, round2 } from '@/store'
import { statisticsApi } from '@/api'
import { todayStr, formatMD } from '@/utils/date'
import { nextReqId, isLatestReq, toBillVM } from './_shared'

/**
 * 首页数据：调 GET /overview/home 一次聚合，返回 ref；load() 供页面 onShow 调用。
 * @returns {object} stats / flowList / todayExpense / todayIncome / userName /
 *                   todayDate / editBudget / load / loading
 */
export function useHomeData() {
  const userStore = useUserStore()
  const bookStore = useBookStore()
  const home = ref(null)
  const loading = ref(false)

  async function load() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = nextReqId()
    loading.value = true
    try {
      const data = await statisticsApi.home()
      if (!isLatestReq(reqId)) return // 已有更新的请求，丢弃本次旧响应
      home.value = data
    } finally {
      // 仅当仍是最新请求时才收 loading，避免提前关闭新请求的加载态
      if (isLatestReq(reqId)) loading.value = false
    }
  }

  const stats = computed(() => {
    const h = home.value
    if (!h) {
      return {
        expense: '0.00',
        income: '0.00',
        budget: '0.00',
        balance: '0.00',
        progress: 0,
        overBudget: false,
      }
    }
    const m = h.month || {}
    const b = h.budget || {}
    const budget = Number(b.budget) || 0
    const expense = Number(m.expense) || 0
    const income = Number(m.income) || 0
    return {
      expense: fmtMoney(expense),
      income: fmtMoney(income),
      budget: fmtMoney(budget),
      balance: fmtMoney(income - expense),
      progress:
        budget > 0 ? Math.min(100, round2((expense / budget) * 100)) : 0,
      overBudget: !!b.overBudget,
    }
  })

  const flowList = computed(() => {
    const t = home.value?.today
    if (!t) return []
    return (t.list || []).map(toBillVM)
  })

  const todayExpense = computed(() =>
    fmtMoney(Number(home.value?.today?.expense) || 0),
  )
  const todayIncome = computed(() =>
    fmtMoney(Number(home.value?.today?.income) || 0),
  )

  const userName = computed(
    () => home.value?.user?.name || userStore.name || '',
  )
  const todayDate = computed(
    () => home.value?.todayDate || formatMD(todayStr()),
  )

  /** 弹窗设置当月预算（调 PUT /books/:id） */
  function editBudget() {
    const budget = Number(home.value?.budget?.budget) || 0
    uni.showModal({
      title: '设置本月预算',
      editable: true,
      placeholderText: '请输入预算金额',
      content: budget > 0 ? String(budget) : '',
      success: async (res) => {
        if (res.confirm) {
          const value = Number(res.content)
          if (value > 0) {
            await bookStore.setBudget(round2(value))
            uni.showToast({ title: '预算已更新', icon: 'success' })
            await load()
          } else if (res.content) {
            uni.showToast({ title: '金额需大于 0', icon: 'none' })
          }
        }
      },
    })
  }

  return {
    stats,
    flowList,
    todayExpense,
    todayIncome,
    userName,
    todayDate,
    editBudget,
    load,
    loading,
  }
}
