/**
 * @file 文件上传 API：multipart 图片上传
 * @description 统一走 api/http.js 的 upload()：鉴权闸门 + 401 单飞重试。
 * @see docs/server/04b-api-bills.md（uploads/image）
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { upload, normalizeFileUrl } from './http'

/**
 * 上传图片（multipart，scene 仅支持 bill 账单凭证；头像请走 POST /users/me/avatar）
 * @param {string} filePath uni.chooseImage 返回的临时路径
 * @param {"bill"} [scene="bill"] 业务场景，后端目前仅接受 bill
 * @returns {Promise<{key:string,url:string,expiresAt:string,width?:number,height?:number,size?:number}>}
 */
export function uploadImage(filePath, scene = 'bill') {
  return upload({
    url: '/uploads/image',
    filePath,
    name: 'file',
    formData: { scene },
  }).then((data) => {
    // 归一化签名 URL，确保使用客户端可达的 BASE_URL
    if (data && data.url) data.url = normalizeFileUrl(data.url)
    return data
  })
}

export default { uploadImage }
