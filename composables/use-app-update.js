/**
 * @file APP 在线更新核心状态机（composables/use-app-update.js）
 * @description 模块级单例：整个 APP 共享同一份弹窗状态与下载任务，串联
 *              「检查更新 → 弹窗确认（普通/强更）→ 下载 APK（进度+自动
 *              重试）→ 调起系统安装器」全流程。
 *              关键约定（见 composables/uni-app安卓更新客户端接入文档.md）：
 *              1. 仅 APP-PLUS 端执行，非 App 端 check 直接返回；
 *              2. 版本比较由服务端完成（返回 hasUpdate），本机只上报
 *                 versionCode，客户端不再自行比较；
 *              3. 静默检查带 6h 节流，无更新/失败均不打扰、不阻断启动；
 *              4. downloadUrl 只用服务端当次下发的绝对地址；
 *              5. plus.runtime.install 成功回调只代表「成功调起系统
 *                 安装器」，APK 场景禁止调用 plus.runtime.restart()；
 *              6. 安装前写待安装版本标记，由 install-result 模块在新包
 *                 首启时回补 install_success 事件。
 * @date 2026-09-15
 * @modify 2026-10-12 安装失败引导修复：「安装未知应用」开关在 Android
 *              系统的按应用授权页（系统设置→应用管理→本应用），App 内无此
 *              开关。安装失败时缓存已下载 APK，直接调起系统授权页
 *              （MANAGE_UNKNOWN_APP_SOURCES），授权后可重试安装免重复下载。
 *              小米/Redmi 机型：MIUI 在「开发者选项→USB 安装」未开启时
 *              会把该授权页开关置灰，失败文案针对小米追加 USB 安装引导。
 */

import { reactive } from 'vue'
import { UPDATE_CONFIG } from '@/utils/app-update/config'
import { request } from '@/utils/app-update/http'
import { getCurrentVersion, getDeviceId } from '@/utils/app-update/device'
import { reportEvent } from '@/utils/app-update/reporter'

const LAST_SILENT_CHECK_KEY = 'app_update_last_check_at'
const PENDING_INSTALL_KEY = 'app_update_pending_install_code'

// 模块级单例状态：整个 APP 共享同一个弹窗
const state = reactive({
  visible: false, // 弹窗展示
  info: null, // 服务端下发的更新信息
  downloading: false,
  progress: 0, // 0~100
  downloadedBytes: 0,
  totalBytes: 0,
  failedMsg: '',
  // 失败类型：'' 无 | 'download' 下载失败（重下） | 'install' 调起安装失败（去授权+重试安装）
  failedType: '',
})

let downloadTask = null
// 最近一次已下载完成且校验通过的 APK 本地路径：授权后重试安装时免重复下载
let lastApkPath = ''

/**
 * 请求检查接口，有更新返回更新信息，无更新返回 null
 * @returns {Promise<object|null>}
 */
async function fetchUpdateInfo() {
  const { versionCode, versionName } = getCurrentVersion()
  if (!versionCode) return null // 拿不到版本号（如标准基座异常）直接跳过
  const data = await request({
    url: '/app-updates/check',
    data: {
      platform: 'android',
      appKey: UPDATE_CONFIG.appKey,
      versionCode,
      versionName,
      deviceId: getDeviceId(),
    },
  })
  return data?.hasUpdate ? data : null
}

/**
 * 下载 APK（单次）：uni.downloadFile 自带进度回调
 * 安全约束：downloadUrl 强制改写为 HTTPS（服务端误配 http 时兜底）；
 * 下载完成后由调用方按 packageSize 校验完整性。
 * @returns {Promise<string>} 下载完成的临时文件路径
 */
function downloadOnce() {
  return new Promise((resolve, reject) => {
    // 强制 HTTPS：防中间人降级替换安装包（服务端若下发 http 一律升级）
    const url = String(state.info.downloadUrl || '').replace(
      /^http:\/\//i,
      'https://',
    )
    downloadTask = uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200) resolve(res.tempFilePath)
        else if (res.statusCode === 404) reject(new Error('安装包已被下架'))
        else reject(new Error(`下载失败（${res.statusCode}）`))
      },
      fail: (err) => reject(new Error(err.errMsg || '下载失败')),
    })
    downloadTask.onProgressUpdate((p) => {
      state.progress = p.progress
      state.downloadedBytes = p.totalBytesWritten || 0
      state.totalBytes =
        p.totalBytesExpectedToWrite || state.info.packageSize || 0
    })
  })
}

/**
 * 完整性校验（P1-08 降级方案：更新服务契约暂无文件 hash 字段，
 * 以服务端下发的 packageSize 与实际 Content-Length 比对，偏差 >1% 视为
 * 包损坏或被替换）。后续更新服务增加 fileHash 后应升级为强校验。
 * @returns {boolean} true 表示校验通过
 */
function verifyPackage() {
  const expected = Number(state.info.packageSize)
  const actual = Number(state.totalBytes)
  if (!(expected > 0)) return true // 服务端未下发 size，无法校验，放行
  if (!(actual > 0)) return false // 拿不到实际大小，视为异常
  return Math.abs(actual - expected) / expected <= 0.01
}

/** 开始下载：失败自动重试（404 下架属业务失败，不重试），成功后调起安装 */
async function startDownload() {
  if (state.downloading) return
  state.downloading = true
  state.failedMsg = ''
  state.failedType = ''
  state.progress = 0
  reportEvent('download_start', {
    toVersionCode: state.info.versionCode,
  })
  const t0 = Date.now()

  let lastErr
  for (let attempt = 0; attempt <= UPDATE_CONFIG.maxRetry; attempt++) {
    try {
      const filePath = await downloadOnce()
      // 包大小校验失败属内容异常，重试无意义，直接终止
      if (!verifyPackage()) {
        throw new Error('安装包校验失败，已终止安装')
      }
      reportEvent('download_success', {
        toVersionCode: state.info.versionCode,
        costMs: Date.now() - t0,
      })
      installApk(filePath)
      return
    } catch (e) {
      lastErr = e
      // 404 下架 / 校验失败属业务性失败，不重试
      if (e.message.includes('下架') || e.message.includes('校验')) break
    }
  }

  state.downloading = false
  state.failedType = 'download'
  state.failedMsg = lastErr?.message || '下载失败，请稍后重试'
  reportEvent('download_fail', {
    toVersionCode: state.info.versionCode,
    failCode: state.failedMsg.slice(0, 64),
  })
}

/**
 * 当前设备是否为小米/Redmi 机型（MIUI 在未开启「USB 安装」时会把
 * 「安装未知应用」授权页开关置灰，需要针对性的引导文案）
 * @returns {boolean}
 */
function isXiaomiDevice() {
  // #ifdef APP-PLUS
  try {
    const info =
      typeof uni.getDeviceInfo === 'function'
        ? uni.getDeviceInfo()
        : uni.getSystemInfoSync()
    return /xiaomi|redmi/i.test(String(info.deviceBrand || ''))
  } catch (e) {
    return false
  }
  // #endif
}

/**
 * JS 直连调起系统安装器：FileProvider URI + ACTION_VIEW。
 * 兜底场景：plus.runtime.install 的 APK 分支内部硬依赖
 * io.dcloud.feature.pack.FileUtils（反射调用其 addFileToSystem），
 * 离线打包 SDK 5.26.82680 全部 aar 与部分云包运行时均不含该类，
 * 此时 plus.runtime.install 会静默失败：错误标志置位但不写错误消息，
 * JS 侧只收到空 message，且系统安装器从未被调起。
 * 本函数复刻其唯一实际动作（FileProvider.getUriForFile +
 * ACTION_VIEW + application/vnd.android.package-archive），
 * 不依赖该类，任何运行时可用。
 * @param {string} filePath APK 本地路径（_doc/、file:// 或绝对路径均可）
 * @returns {string} 成功调起返回空串；失败返回错误描述
 */
function installApkByNative(filePath) {
  // #ifdef APP-PLUS
  try {
    let absPath = plus.io.convertLocalFileSystemURL(filePath)
    if (!absPath.startsWith('/')) absPath = absPath.replace(/^file:\/\//, '')
    const File = plus.android.importClass('java.io.File')
    const apkFile = new File(absPath)
    if (!apkFile.exists()) return `安装包不存在（${absPath}）`
    const main = plus.android.runtimeMainActivity()
    plus.android.importClass(main)
    const FileProvider = plus.android.importClass(
      'androidx.core.content.FileProvider',
    )
    const Intent = plus.android.importClass('android.content.Intent')
    const authority = `${main.getPackageName()}.dc.fileprovider`
    const uri = FileProvider.getUriForFile(main, authority, apkFile)
    const intent = new Intent(Intent.ACTION_VIEW)
    intent.setDataAndType(uri, 'application/vnd.android.package-archive')
    intent.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION,
    )
    main.startActivity(intent)
    return ''
  } catch (e) {
    return String(e?.message || e || 'native-install-failed').slice(0, 64)
  }
  // #endif
}

/**
 * 调起系统安装器（用户需手动确认，无法静默）；安装前写回补标记。
 * Android 8.0+ 需用户为「本应用」授予安装未知应用权限（系统设置→应用
 * 管理→本应用→安装未知应用，App 内无该开关），未授权时安装调起失败，
 * 引导用户跳转系统授权页后重试安装（APK 已缓存，无需重新下载）。
 * Android 统一走 installApkByNative 直连调起（见其注释的运行时缺陷）；
 * 非 Android 平台保留 plus.runtime.install。
 * @param {string} filePath 下载完成的 APK 临时路径
 * @param {{isRetry?: boolean}} [opts] isRetry=true 表示授权后的重试安装
 */
function installApk(filePath, { isRetry = false } = {}) {
  // #ifdef APP-PLUS
  lastApkPath = filePath
  uni.setStorageSync(PENDING_INSTALL_KEY, state.info.versionCode)

  const fail = (raw) => {
    state.downloading = false
    // 重试安装仍失败且疑似安装包失效（缓存文件被清理等），退回重新下载
    if (isRetry && /不存在|找不到|not\s*found|解析|corrupt/i.test(raw)) {
      lastApkPath = ''
      state.failedType = 'download'
      state.failedMsg = '安装包已失效，请重新下载'
    } else {
      state.failedType = 'install'
      // 小米/Redmi：MIUI 未开「开发者选项→USB 安装」时授权页开关置灰，
      // 文案需先引导开启 USB 安装；尾部附带原始错误码便于排查
      // （权限已授仍失败多为 targetSdk 30+ 包可见性 queries 缺失等）
      const hint = isXiaomiDevice()
        ? '请先在「开发者选项」开启 USB 安装，再允许安装未知应用'
        : '需开启「安装未知应用」权限后才能安装更新'
      state.failedMsg = `安装失败：${hint}（${raw.slice(0, 24)}）`
    }
    reportEvent('install_fail', {
      toVersionCode: state.info.versionCode,
      failCode: raw.slice(0, 64),
    })
  }

  if (String(plus.os.name || '').toLowerCase() === 'android') {
    const err = installApkByNative(filePath)
    if (!err) {
      // 仅代表成功调起系统安装器，APK 场景不要调 plus.runtime.restart()
      state.downloading = false
      return
    }
    fail(err)
    return
  }

  plus.runtime.install(
    filePath,
    { force: false },
    () => {
      state.downloading = false
    },
    (err) => {
      fail(String(err?.message || err?.code || 'install_error'))
    },
  )
  // #endif
}

/**
 * 跳转 Android 系统「安装未知应用」按应用授权页；低版本系统（<8.0）
 * 无该 Action 时退回应用详情页，再失败兜底 toast 指引。
 */
function openInstallPermissionSettings() {
  // #ifdef APP-PLUS
  if (String(plus.os.name || '').toLowerCase() !== 'android') return
  try {
    const Intent = plus.android.importClass('android.content.Intent')
    const Uri = plus.android.importClass('android.net.Uri')
    const main = plus.android.runtimeMainActivity()
    plus.android.importClass(main)
    const uri = Uri.fromParts('package', main.getPackageName(), null)
    const intent = new Intent('android.settings.MANAGE_UNKNOWN_APP_SOURCES')
    intent.setData(uri)
    main.startActivity(intent)
  } catch (e) {
    try {
      const Intent = plus.android.importClass('android.content.Intent')
      const Uri = plus.android.importClass('android.net.Uri')
      const main = plus.android.runtimeMainActivity()
      plus.android.importClass(main)
      const uri = Uri.fromParts('package', main.getPackageName(), null)
      const intent = new Intent('android.settings.APPLICATION_DETAILS_SETTINGS')
      intent.setData(uri)
      main.startActivity(intent)
    } catch (e2) {
      uni.showToast({
        title: '请到系统设置-应用管理中，允许本应用安装未知应用',
        icon: 'none',
      })
    }
  }
  // #endif
}

/** 授权后重试安装：复用已下载并校验通过的 APK，不再重新下载 */
function retryInstall() {
  // #ifdef APP-PLUS
  if (!lastApkPath) return
  installApk(lastApkPath, { isRetry: true })
  // #endif
}

/** 用户点「稍后再说」（非强更、非下载中才允许关闭） */
function dismiss() {
  if (state.downloading) return
  if (state.info?.forceUpdate) return
  state.visible = false
  state.info = null
}

export function useAppUpdate() {
  /**
   * 检查更新
   * @param {{silent?: boolean}} [opts] silent=true 为启动静默检查
   *        （无更新/失败不打扰，且 6h 内有节流）；false 为手动检查，
   *        无更新/失败给 toast 反馈。
   */
  async function check({ silent = false } = {}) {
    // #ifndef APP-PLUS
    return
    // #endif

    // #ifdef APP-PLUS
    if (silent) {
      const last = Number(uni.getStorageSync(LAST_SILENT_CHECK_KEY) || 0)
      if (Date.now() - last < UPDATE_CONFIG.silentCheckIntervalMs) return
      uni.setStorageSync(LAST_SILENT_CHECK_KEY, Date.now())
    }

    try {
      const info = await fetchUpdateInfo()
      if (!info) {
        if (!silent) uni.showToast({ title: '已是最新版本', icon: 'none' })
        else reportEvent('check_no_update')
        return
      }
      state.info = info
      state.visible = true
      state.progress = 0
      state.failedMsg = ''
      state.failedType = ''
      reportEvent('prompt_show', { toVersionCode: info.versionCode })
    } catch (e) {
      if (!silent) {
        uni.showToast({ title: `检查失败：${e.message}`, icon: 'none' })
      }
      // 静默模式下检测失败默认放行，不阻断启动（若产品要求阻断需另做阻断页）
    }
    // #endif
  }

  /** 退出 APP（强更下载失败且用户放弃重试时） */
  function exitApp() {
    // #ifdef APP-PLUS
    plus.runtime.quit()
    // #endif
  }

  return {
    state,
    check,
    startDownload,
    retry: startDownload,
    retryInstall,
    openInstallPermissionSettings,
    dismiss,
    exitApp,
  }
}
