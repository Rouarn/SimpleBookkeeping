/**
 * @file 统计页组合式 API（composables 域文件）
 * @description 概览 / 分类排行 / 支付方式排行（statistics 系列接口）与收支趋势
 *              （GET /statistics/trend，月维度近 N 月 / 年维度全年 12 月）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { ref } from 'vue'
import { statisticsApi } from '@/api'
import { nextReqId, isLatestReq } from './_shared'

/**
 * 统计页数据：调 statistics 系列接口；period/type 改变时由页面 watch 调 load()。
 * @param {import('vue').Ref<{month?: string, year?: string}>} periodRef
 *        时间范围：{ month: 'YYYY-MM' } 单月 或 { year: 'YYYY' } 整年（二选一）
 * @param {import('vue').Ref<import('@/store/types').BillType>} typeRef
 * @returns {object} overview / categoryStats / payStats / overviewError /
 *                   load / loading
 */
export function useStatisticsData(periodRef, typeRef) {
  const overview = ref(null)
  const categoryStats = ref([])
  const payStats = ref([])
  const loading = ref(false)
  /** 概览接口是否失败（页面据此展示「加载失败，点击重试」，不再静默显示 ¥0） */
  const overviewError = ref(false)

  async function load() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = nextReqId()
    loading.value = true
    overviewError.value = false
    try {
      const period = periodRef.value || {}
      const base = period.year ? { year: period.year } : { month: period.month }
      const type = typeRef.value
      const [ov, cats, pays] = await Promise.all([
        // 概览失败置错误态交由页面展示重试入口；旧请求失败不污染新请求状态
        statisticsApi.overview({ ...base, type }).catch(() => {
          if (isLatestReq(reqId)) overviewError.value = true
          return null
        }),
        statisticsApi.categories({ ...base, type }).catch(() => ({ list: [] })),
        type === 'expense'
          ? statisticsApi.payMethods({ ...base }).catch(() => ({ list: [] }))
          : Promise.resolve({ list: [] }),
      ])
      if (!isLatestReq(reqId)) return // 已有更新的请求，丢弃本次旧响应
      overview.value = ov
      categoryStats.value = (cats?.list || []).map((i) => ({
        name: i.name,
        icon: i.icon,
        color: i.color,
        bg: i.bg,
        amount: Number(i.amount) || 0,
        count: Number(i.count) || 0,
        percent: Number(i.percent) || 0,
      }))
      payStats.value = (pays?.list || []).map((i) => ({
        name: i.name,
        short: i.shortName,
        color: i.color,
        bg: i.bg,
        amount: Number(i.amount) || 0,
        count: Number(i.count) || 0,
        percent: Number(i.percent) || 0,
      }))
    } finally {
      loading.value = false
    }
  }

  return { overview, categoryStats, payStats, overviewError, load, loading }
}

/**
 * 收支趋势（GET /statistics/trend）
 * @param {number} [months=6] 月维度：近 N 个月
 * @param {import('vue').Ref<string|null>} [yearRef] 年维度：传 'YYYY' 时拉取该年 12 个月
 * @returns {{trend: import('vue').Ref<object[]>, loadTrend: Function, loading: import('vue').Ref<boolean>}}
 */
export function useTrendData(months = 6, yearRef = null) {
  const trend = ref([])
  const loading = ref(false)

  async function loadTrend() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = nextReqId()
    loading.value = true
    try {
      const year = yearRef?.value
      const res = await statisticsApi.trend(year ? { year } : { months })
      if (!isLatestReq(reqId)) return // 已有更新的请求，丢弃本次旧响应
      trend.value = (res?.list || []).map((i) => ({
        month: i.month,
        label: i.label,
        expense: Number(i.expense) || 0,
        income: Number(i.income) || 0,
      }))
    } catch {
      // 仅最新请求失败时才清空，避免旧请求失败污染新请求的数据
      if (isLatestReq(reqId)) trend.value = []
    } finally {
      if (isLatestReq(reqId)) loading.value = false
    }
  }

  return { trend, loadTrend, loading }
}
