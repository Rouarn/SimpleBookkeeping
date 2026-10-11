/**
 * @file APP 在线更新配置（utils/app-update/config.js）
 * @description 更新模块的环境地址、应用标识与节流/重试参数。
 *              - baseUrl：统一来自 config/env.js（dev 局域网 / prod HTTPS，
 *                真机不可用 localhost，Android 模拟器用 10.0.2.2）；
 *              - appKey：必须与服务端「APP 版本管理」中创建的应用标识一致；
 *              - silentCheckIntervalMs：启动静默检查节流；
 *              - maxRetry：下载失败自动重试次数。
 * @date 2026-10-11
 */
import { UPDATE_BASE } from '@/config/env'

export const UPDATE_CONFIG = {
  // 更新服务基地址（生产 HTTPS，见 config/env.js）
  baseUrl: UPDATE_BASE,
  // 必须与后台「APP 版本管理」里创建的应用标识一致
  appKey: 'simple-bookkeeping',
  // 启动静默检查节流：6 小时内不重复发起检查请求
  silentCheckIntervalMs: 6 * 60 * 60 * 1000,
  // 下载失败自动重试次数
  maxRetry: 2,
}
