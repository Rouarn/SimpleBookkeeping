/**
 * @file 文件上传 API：multipart 图片上传
 * @see docs/server/04b-api-bills.md（uploads/image）
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { BASE_URL, normalizeFileUrl } from "./http";
import { getAccessToken } from "@/utils/auth";

const API_PREFIX = "/api/v1";

/**
 * 上传图片（multipart，scene=bill|avatar）
 * @param {string} filePath uni.chooseImage 返回的临时路径
 * @param {"bill"|"avatar"} [scene="bill"]
 * @returns {Promise<{key:string,url:string,expiresAt:string,width?:number,height?:number,size?:number}>}
 */
export function uploadImage(filePath, scene = "bill") {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}${API_PREFIX}/uploads/image`,
      filePath,
      name: "file",
      formData: { scene },
      header: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
      success: res => {
        try {
          const body =
            typeof res.data === "string"
              ? JSON.parse(res.data || "{}")
              : res.data || {};
          if (body.code === 0 && body.data) {
            const data = body.data;
            // 归一化签名 URL，确保使用客户端可达的 BASE_URL
            if (data.url) data.url = normalizeFileUrl(data.url);
            resolve(data);
          } else {
            reject(body);
          }
        } catch (e) {
          reject({ code: -1, message: "上传响应解析失败" });
        }
      },
      fail: err =>
        reject({ code: -1, message: "网络异常", raw: err }),
    });
  });
}

export default { uploadImage };
