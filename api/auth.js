/**
 * @file 鉴权 API：注册 / 登录 / 刷新 / 登出
 * @see docs/server/04a-api-auth-user.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from "./http";
import { setTokens, clearTokens, getRefreshToken } from "@/utils/auth";

/**
 * 注册（返回 user 与 token）
 * @param {{username:string,password:string,name?:string}} payload
 * @returns {Promise<{user:object,accessToken:string,refreshToken:string}>}
 */
export function register(payload) {
  return http.post("/auth/register", payload).then(data => {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data;
  });
}

/**
 * 登录
 * @param {{username:string,password:string}} payload
 * @returns {Promise<{user:object,accessToken:string,refreshToken:string}>}
 */
export function login(payload) {
  return http.post("/auth/login", payload).then(data => {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data;
  });
}

/**
 * 刷新 access token（需传 refreshToken，服务端校验后下发新 token 对）
 * @returns {Promise<{accessToken:string,refreshToken:string}>}
 */
export function refresh() {
  const refreshToken = getRefreshToken();
  return http.post("/auth/refresh", { refreshToken }).then(data => {
    setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data;
  });
}

/**
 * 登出：清本地 token（服务端可选吊销）
 */
export function logout() {
  return http
    .post("/auth/logout")
    .catch(() => {})
    .finally(() => {
      clearTokens();
    });
}

export default { register, login, refresh, logout };
