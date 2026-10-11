/**
 * @file 流水页组合式 API（composables 域文件）
 * @description 月份 / 类型筛选 + 关键字搜索 + 按天分组流水
 *              （GET /bills 分页 + /bills/summary），触底加载下一页。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { computed, ref } from 'vue'
import { useAppStore, fmtMoney, round2 } from '@/store'
import { billsApi } from '@/api'
import { formatMD, dayLabel } from '@/utils/date'
import { nextReqId, isLatestReq, toBillVM } from './_shared'

/** 流水页每页条数（触底分页加载） */
const FLOW_PAGE_SIZE = 50

/** 流水筛选 code → 页面展示文案（页面模板直接渲染 currentType） */
const FLOW_TYPE_LABELS = {
  all: '全部类型',
  expense: '支出',
  income: '收入',
}

/** 流水筛选 code → 服务端 /bills type 参数 */
const FLOW_TYPE_PARAMS = {
  all: 'ALL',
  expense: 'expense',
  income: 'income',
}

/** 页面 ActionSheet 文案 → code（兼容页面写入中文文案的赋值方式） */
const FLOW_LABEL_TO_CODE = {
  全部类型: 'all',
  支出: 'expense',
  收入: 'income',
}

/**
 * 流水页数据：currentMonth/currentType 双向绑定 app store（持久化）；
 * groups 为按天分组流水（分页加载、新页按日合并），monthCard 为当月收支汇总
 * （来自 /bills/summary，不随分页截断，始终是该月完整口径）。
 * load() 拉取第一页并重置分页；loadMore() 触底加载下一页；均带序号防竞态。
 * keyword 为搜索关键字（非空时透传 billsApi.list 的 keyword 参数），变化后由页面防抖调 load()。
 * @returns {object} currentMonth / currentType（可写 Ref）/ keyword / groups /
 *                   monthCard / load / loadMore / loading / loadingMore / finished
 */
export function useFlowingData() {
  const appStore = useAppStore()

  const currentMonth = computed({
    get: () => appStore.ui.flowMonth,
    set: (value) => appStore.setFlowMonth(value),
  })
  // app store 只持久化 code（'all'/'expense'/'income'）；此处做展示层适配：
  // getter 出中文文案供模板直接渲染，setter 兼容页面 ActionSheet 写入的中文文案，
  // 真正发请求时再用 FLOW_TYPE_PARAMS 把 code 映射为服务端 type 参数
  const currentType = computed({
    get: () => FLOW_TYPE_LABELS[appStore.ui.flowType] || FLOW_TYPE_LABELS.all,
    set: (value) => appStore.setFlowType(FLOW_LABEL_TO_CODE[value] || value),
  })

  const groups = ref([])
  const monthCard = ref({ expense: '0.00', income: '0.00' })
  const loading = ref(false)
  /** 分页状态：当前已加载页码 / 触底加载中 / 是否已加载全部 */
  const page = ref(1)
  const loadingMore = ref(false)
  const finished = ref(false)
  /** 搜索关键字（空串表示未搜索）；写入后由页面防抖调用 load() 从第一页重查 */
  const keyword = ref('')

  /**
   * 新建一个按日分组结构（格式对齐原 GET /bills/grouped 的 groups 项）
   * @param {string} recordDate 'YYYY-MM-DD'
   * @returns {object}
   */
  function createGroup(recordDate) {
    return {
      day: dayLabel(recordDate),
      date: formatMD(recordDate),
      recordDate,
      // 原始数值用于跨页累加，expense/income 为格式化后的展示文案
      expenseRaw: 0,
      incomeRaw: 0,
      expense: '0.00',
      income: '0.00',
      items: [],
    }
  }

  /**
   * 把账单（toBillVM 后、按日期倒序）按日合并进分组数组：
   * 已存在的日期追加条目并累加日合计；全新日期在尾部新建分组。
   * 注意：分页后日合计只对已加载页累加，若某天的记录被页边界截断，
   * 该组合计为「已加载部分」口径（月卡汇总仍用 /bills/summary 完整数据）。
   * @param {object[]} list 分组数组（原地修改）
   * @param {object[]} items 账单视图模型数组
   */
  function mergeIntoGroups(list, items) {
    for (const item of items) {
      let grp = list.find((g) => g.recordDate === item.date)
      if (!grp) {
        grp = createGroup(item.date)
        list.push(grp)
      }
      grp.items.push(item)
      if (item.amount > 0) grp.incomeRaw += item.amount
      else grp.expenseRaw += -item.amount
      grp.expense = fmtMoney(round2(grp.expenseRaw))
      grp.income = fmtMoney(round2(grp.incomeRaw))
    }
  }

  /** 拉取第一页并重置分页（切月 / 切类型 / 关键词变化 / 下拉刷新 / onShow 走这里） */
  async function load() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = nextReqId()
    loading.value = true
    page.value = 1
    finished.value = false
    loadingMore.value = false
    try {
      const type = FLOW_TYPE_PARAMS[appStore.ui.flowType] || 'ALL'
      const month = appStore.ui.flowMonth
      const kw = keyword.value.trim()
      const [res, s] = await Promise.all([
        // 关键字非空才透传 keyword，避免无意义的空参
        billsApi.list({
          month,
          type,
          page: 1,
          pageSize: FLOW_PAGE_SIZE,
          ...(kw ? { keyword: kw } : {}),
        }),
        billsApi.summary({ month }),
      ])
      if (!isLatestReq(reqId)) return // 已有更新的请求，丢弃本次旧响应
      const items = (res?.list || []).map(toBillVM)
      groups.value = []
      mergeIntoGroups(groups.value, items)
      monthCard.value = {
        expense: fmtMoney(Number(s?.expense) || 0),
        income: fmtMoney(Number(s?.income) || 0),
      }
      if (items.length < FLOW_PAGE_SIZE) finished.value = true
    } finally {
      if (isLatestReq(reqId)) loading.value = false
    }
  }

  /** 触底加载下一页：按日合并进现有分组；失败保持未完成态，下次触底自动重试 */
  async function loadMore() {
    if (loading.value || loadingMore.value || finished.value) return
    loadingMore.value = true
    const reqId = nextReqId()
    try {
      const type = FLOW_TYPE_PARAMS[appStore.ui.flowType] || 'ALL'
      const month = appStore.ui.flowMonth
      const kw = keyword.value.trim()
      const next = page.value + 1
      const res = await billsApi
        .list({
          month,
          type,
          page: next,
          pageSize: FLOW_PAGE_SIZE,
          ...(kw ? { keyword: kw } : {}),
        })
        .catch(() => null)
      if (!isLatestReq(reqId)) return // 已被更新的请求作废
      if (!res) return // 拉取失败：不推进页码，等待下次触底重试
      const items = (res?.list || []).map(toBillVM)
      mergeIntoGroups(groups.value, items)
      page.value = next
      if (items.length < FLOW_PAGE_SIZE) finished.value = true
    } finally {
      loadingMore.value = false
    }
  }

  return {
    currentMonth,
    currentType,
    keyword,
    groups,
    monthCard,
    load,
    loadMore,
    loading,
    loadingMore,
    finished,
  }
}
