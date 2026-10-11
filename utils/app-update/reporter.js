/**
 * @file 升级漏斗事件上报（utils/app-update/reporter.js）
 * @description 向服务端 POST /app-updates/report 上报升级各环节事件，
 *              用于升级漏斗看板与问题排查。约定：
 *              1. 仅 APP-PLUS 端执行；
 *              2. 5s 超时、失败静默、绝不阻塞更新主流程；
 *              3. event 枚举由服务端约定（check_no_update/prompt_show/
 *                 download_start/download_success/download_fail/verify_fail/
 *                 install_success/install_fail/new_version_launch）。
 * @date 2026-09-15
 */

import { UPDATE_CONFIG } from './config'
import { getDeviceId, getNetworkType, getCurrentVersion } from './device'

/**
 * 上报单个升级事件
 * @param {string} event 事件名（服务端约定枚举）
 * @param {object} [extra] 可选字段：toVersionCode/failCode/costMs 等
 */
export function reportEvent(event, extra = {}) {
  // #ifndef APP-PLUS
  return
  // #endif

  // #ifdef APP-PLUS
  try {
    const { versionCode } = getCurrentVersion()
    const sys = uni.getSystemInfoSync()
    uni.request({
      url: `${UPDATE_CONFIG.baseUrl}/app-updates/report`,
      method: 'POST',
      timeout: 5000,
      header: { 'Content-Type': 'application/json' },
      data: {
        deviceId: getDeviceId(),
        appKey: UPDATE_CONFIG.appKey,
        event,
        fromVersionCode: extra.fromVersionCode ?? versionCode,
        networkType: getNetworkType(),
        osVersion:
          sys.osName && sys.osVersion ? `${sys.osName} ${sys.osVersion}` : '',
        deviceModel: sys.deviceModel || sys.model || '',
        ...extra,
      },
      fail: () => {},
    })
  } catch (e) {
    // 静默
  }
  // #endif
}
