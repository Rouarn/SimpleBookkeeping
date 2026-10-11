/**
 * @file 统一环境配置（config/env.js）
 * @description 全部服务端/静态资源地址集中于此，按 dev/prod 自动切换，
 *              杜绝 BASE_URL 散落硬编码（历史上曾出现 http 明文生产地址）。
 *              生产环境一律 HTTPS：API、静态资源、更新服务、签名文件均禁止
 *              明文 http 出网（APK 下载地址另有兜底强制升级，见 use-app-update.js）。
 * @date 2026-10-11
 */

// HBuilderX/Vite 下 import.meta.env.DEV 可用
const isDev = !!import.meta.env?.DEV;

/** API 服务基地址（真机联调用电脑局域网 IP，不能用 localhost） */
export const API_BASE = !isDev
  ? "http://192.168.31.115:9765"
  : "http://xl.shixian.xyz";

/** 自建静态资源基地址（一言等静态接口；生产必须 HTTPS） */
export const STATIC_BASE = isDev
  ? "http://192.168.31.115:9867/static"
  : "https://static.shixian.xyz/static";

/** APP 在线更新服务基地址 */
export const UPDATE_BASE = STATIC_BASE;

/** 签名文件访问基地址（与 API_BASE 同源，/api/v1/files/） */
export const FILES_BASE = API_BASE;

export default { isDev, API_BASE, STATIC_BASE, UPDATE_BASE, FILES_BASE };
