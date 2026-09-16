/**
 * @file 用户 API：资料 / 头像 / 统计 / 偏好
 * @see docs/server/04a-api-auth-user.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http, BASE_URL, normalizeFileUrl } from "./http";
import { getAccessToken } from "@/utils/auth";

const API_PREFIX = "/api/v1";

/**
 * 获取当前用户资料
 * @returns {Promise<object>} {id,username,name,avatar,joinDate,...}
 */
export function getMe() {
  return http.get("/users/me");
}

/**
 * 更新资料（仅 name 等可改字段）
 * @param {{name?:string}} payload
 * @returns {Promise<object>} 更新后的用户
 */
export function updateMe(payload) {
  return http.patch("/users/me", payload);
}

/**
 * 上传头像（multipart，服务端直传并返回 url）
 * @param {string} filePath 临时文件路径
 * @returns {Promise<{avatar:string}>}
 */
export function uploadAvatar(filePath) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}${API_PREFIX}/users/me/avatar`,
      filePath,
      name: "file",
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
            if (data.avatar) data.avatar = normalizeFileUrl(data.avatar);
            if (data.url) data.url = normalizeFileUrl(data.url);
            resolve(data);
          } else {
            reject(body);
          }
        } catch (e) {
          reject({ code: -1, message: "头像上传响应解析失败" });
        }
      },
      fail: err => reject({ code: -1, message: "网络异常", raw: err }),
    });
  });
}

/**
 * 获取记账统计（累计笔数、金额、天数等）
 * @returns {Promise<object>}
 */
export function getStats() {
  return http.get("/users/me/stats");
}

/**
 * 读取偏好
 * @returns {Promise<object>}
 */
export function getPreferences() {
  return http.get("/users/me/preferences");
}

/**
 * 覆盖写入偏好
 * @param {object} payload
 * @returns {Promise<object>}
 */
export function putPreferences(payload) {
  return http.put("/users/me/preferences", payload);
}

export default {
  getMe,
  updateMe,
  uploadAvatar,
  getStats,
  getPreferences,
  putPreferences,
};
