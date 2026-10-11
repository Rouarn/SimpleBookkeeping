/**
 * @file 记账业务 composables 共享内部工具（下划线前缀表内部模块）
 * @description 各域 hook（useHome / useFlowing / useStatistics / useBillDetail /
 *              useBillEdit / useProfile）共用的底层能力：
 *              1. nextReqId / isLatestReq：模块级自增请求序号，快速切月 / 切类型时
 *                 旧响应按序号作废，从根本上消除请求竞态（全应用共用同一序号）；
 *              2. toBillVM：服务端 BillVM → 列表 / 详情视图模型映射；
 *              3. compressPhoto：选图二次压缩（quality 80），失败回退原图。
 *              本文件不面向页面直接使用，页面请从域文件或 useBookkeeping 门面引入。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11
 */
import { normalizeFileUrl } from '@/api'

/**
 * 模块内自增请求序号：每次发起加载时记下当前序号（reqId），回包后与最新序号
 * 比对，不一致说明期间已发起了更新的加载，本次旧响应整体作废丢弃（不清
 * loading 之外的任何状态），从根本上消除快速切月 / 切类型时的请求竞态。
 */
let reqSeq = 0

/**
 * 发起一次可作废的加载：领取并返回当前最新请求序号
 * @returns {number}
 */
export function nextReqId() {
  return ++reqSeq
}

/**
 * 判断本次回包是否仍属于最新请求（不一致即应丢弃旧响应）
 * @param {number} reqId 发请求时领取的序号
 * @returns {boolean}
 */
export function isLatestReq(reqId) {
  return reqId === reqSeq
}

/**
 * 对选中的图片做二次压缩（quality 80），用于减小上传体积；
 * 平台不支持或压缩失败时回退原图路径，不阻断上传流程。
 * @param {string} filePath 选图得到的临时文件路径
 * @returns {Promise<string>} 压缩后的临时文件路径（失败则为原路径）
 */
export function compressPhoto(filePath) {
  return new Promise((resolve) => {
    uni.compressImage({
      src: filePath,
      quality: 80,
      success: (res) => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath), // 压缩失败回退原图，不阻断上传
    })
  })
}

/**
 * 把服务端 BillVM 映射为列表视图模型（字段名对齐原 BillViewModel）
 * @param {object} b 服务端账单
 * @returns {object}
 */
export function toBillVM(b) {
  return {
    id: b.id,
    title: b.category,
    iconText: b.iconText,
    iconColor: b.iconColor,
    iconBg: b.iconBg,
    amount: Number(b.amount) || 0, // 已带符号
    date: b.date,
    time: b.time,
    payMethod: b.payMethod,
    payMethodId: b.payMethodId,
    type: b.type,
    category: b.category,
    categoryId: b.categoryId,
    remark: b.remark,
    // 兼容两种口径：列表接口 photos 为签名 URL 字符串数组；详情为 {key,url} 对象数组
    photos: (b.photos || []).map((p) =>
      typeof p === 'string'
        ? { key: '', url: normalizeFileUrl(p) }
        : { key: p?.key || '', url: normalizeFileUrl(p?.url) },
    ),
  }
}
