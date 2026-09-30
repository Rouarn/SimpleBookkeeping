/**
 * @file APP 在线更新配置（utils/app-update/config.js）
 * @description 更新模块的环境地址、应用标识与节流/重试参数。
 *              - baseUrl：开发联调用电脑局域网 IP（真机不可用 localhost，
 *                Android 模拟器用 10.0.2.2）；生产必须 HTTPS；
 *              - appKey：必须与服务端「APP 版本管理」中创建的应用标识一致；
 *              - silentCheckIntervalMs：启动静默检查节流；
 *              - maxRetry：下载失败自动重试次数。
 * @date 2026-09-15
 */

// HBuilderX/Vite 下 import.meta.env.DEV 可用；老工程可改为写死 isDev
const isDev = !!import.meta.env?.DEV;

export const UPDATE_CONFIG = {
  // 真机调试用电脑局域网 IP，不能用 localhost；模拟器用 10.0.2.2
  baseUrl: isDev
    ? "http://192.168.31.115:9867/static"
    : "https://static.shixian.xyz/static",
  // 必须与后台「APP 版本管理」里创建的应用标识一致
  appKey: "simple-bookkeeping",
  // 启动静默检查节流：6 小时内不重复发起检查请求
  silentCheckIntervalMs: 6 * 60 * 60 * 1000,
  // 下载失败自动重试次数
  maxRetry: 2,
};
