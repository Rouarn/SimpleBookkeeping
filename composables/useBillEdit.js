/**
 * @file 记账页组合式 API（composables 域文件）
 * @description 默认表单（上次记账记忆）+ 编辑回填 + 凭证上传 + 保存
 *              （GET/POST/PATCH /bills，POST /uploads/image）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { computed } from 'vue'
import { useAppStore, useBillStore } from '@/store'
import { billsApi, uploadsApi } from '@/api'

/**
 * 记账页表单逻辑：remembered 为上次记账记忆（分类 / 支付方式存 id，失效时由
 * 记账页回退默认项）；loadBillForEdit(id) 调 GET /bills/:id 回填；saveBill 调
 * POST/PATCH /bills，photos 为已上传的 key 数组。
 * @returns {object} remembered / saveBill / loadBillForEdit / uploadPhoto
 */
export function useBillForm() {
  const appStore = useAppStore()
  const billStore = useBillStore()

  // 上次记账记忆：按 id 存储（分类 id 随收支方向分开记忆）
  const remembered = computed(() => ({
    type: appStore.ui.lastBillType,
    categoryId: appStore.ui.lastCategory[appStore.ui.lastBillType] || '',
    payMethodId: appStore.ui.lastPayMethod || '',
  }))

  /**
   * 编辑模式：调 GET /bills/:id 拉取详情用于表单回填
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async function loadBillForEdit(id) {
    try {
      const bill = await billsApi.getOne(id)
      return bill
    } catch {
      return null
    }
  }

  /**
   * 上传凭证图片，返回 {key,url}
   * @param {string} filePath 临时文件路径
   */
  async function uploadPhoto(filePath) {
    return uploadsApi.uploadImage(filePath, 'bill')
  }

  /**
   * 保存账单（新增或更新）。
   * 输入字段以服务端口径为准：categoryId / payMethodId / photos(key 数组)。
   * @param {object} input
   * @param {string} [editId]
   * @returns {Promise<{ok:boolean,error?:string,bill?:object}>}
   */
  async function saveBill(input, editId) {
    try {
      const payload = {
        type: input.type,
        amount: input.amount,
        categoryId: input.categoryId,
        payMethodId: input.payMethodId,
        date: input.date,
        time: input.time,
        remark: input.remark,
        photos: input.photos || [],
      }
      const bill = editId
        ? await billStore.updateBill(editId, payload)
        : await billStore.addBill(payload)
      // 记忆上次选择（存 id，按 id 匹配字典，分类 / 支付方式被改名后仍可命中）
      appStore.rememberBillForm({
        type: input.type,
        categoryId: input.categoryId,
        payMethodId: input.payMethodId,
      })
      return { ok: true, bill }
    } catch (e) {
      return {
        ok: false,
        error: e?.message || '保存失败',
      }
    }
  }

  return {
    remembered,
    saveBill,
    loadBillForEdit,
    uploadPhoto,
  }
}
