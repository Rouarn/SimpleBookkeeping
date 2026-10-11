/**
 * @file 记账业务组合式 API —— 兼容门面（Facade）
 * @description 本文件为兼容门面：原 useBookkeeping.js 已按页面域拆分为
 *              composables/useHome.js / useFlowing.js / useStatistics.js /
 *              useBillEdit.js / useBillDetail.js / useProfile.js（共享工具在 _shared.js）。
 *              此处 re-export 全部域 hook 与具名导出，保证既有
 *              `import { useXxx } from '@/composables/useBookkeeping'` 零破坏。
 *
 *              ⚠️ 本文件为兼容门面，新代码请直接从域文件 import：
 *                 - useHomeData                → @/composables/useHome
 *                 - useFlowingData             → @/composables/useFlowing
 *                 - useStatisticsData/useTrendData → @/composables/useStatistics
 *                 - useBillForm                → @/composables/useBillEdit
 *                 - useBillDetail / onBillChange / goBillDetail / BILL_PREFILL_KEY
 *                                              → @/composables/useBillDetail
 *                 - useProfile                 → @/composables/useProfile
 *                 - compressPhoto（共享工具）  → @/composables/_shared
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-10-11 P2-15 超长文件拆分：本文件瘦身为兼容门面，实现按域迁出
 */

// 共享内部工具（compressPhoto 同时是页面在用的具名导出）
export { compressPhoto } from './_shared'

// 首页：本月统计卡 + 今日流水
export { useHomeData } from './useHome'

// 流水页：分页 list、按日分组、搜索、筛选、触底加载
export { useFlowingData } from './useFlowing'

// 统计页：概览 / 分类排行 / 支付方式 / 收支趋势
export { useStatisticsData, useTrendData } from './useStatistics'

// 记账页：表单记忆 / 编辑回填 / 凭证上传 / 保存
export { useBillForm } from './useBillEdit'

// 详情页：详情加载 / 删除 / 变更订阅 / 详情跳转 / 再记一笔预填 key
export {
  useBillDetail,
  onBillChange,
  goBillDetail,
  BILL_PREFILL_KEY,
} from './useBillDetail'

// 我的页：资料 / 统计 / 昵称 / 头像
export { useProfile } from './useProfile'
