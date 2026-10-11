/**
 * @file 覆盖安装成功事件回补（utils/app-update/install-result.js）
 * @description APK 覆盖安装后旧进程无法感知「安装完成」。安装前由
 *              use-app-update 写入待安装版本标记（storage），新版本
 *              首次启动（App.vue onLaunch，且在 check 之前）调用本模块：
 *              当前运行时版本 ≥ 待安装版本时，回补 install_success 与
 *              new_version_launch 两个事件并清除标记。
 * @date 2026-09-15
 */

import { getCurrentVersion } from './device'
import { reportEvent } from './reporter'

const PENDING_INSTALL_KEY = 'app_update_pending_install_code'

/** 新版本首次启动时调用：回补安装成功事件，无标记时直接返回 */
export function reportInstallResult() {
  // #ifndef APP-PLUS
  return
  // #endif

  // #ifdef APP-PLUS
  const pending = Number(uni.getStorageSync(PENDING_INSTALL_KEY) || 0)
  if (!pending) return
  const { versionCode } = getCurrentVersion()
  if (versionCode >= pending) {
    reportEvent('install_success', { toVersionCode: versionCode })
    reportEvent('new_version_launch', { toVersionCode: versionCode })
    uni.removeStorageSync(PENDING_INSTALL_KEY)
  }
  // #endif
}
