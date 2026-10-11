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
 */

import { reactive } from "vue";
import { UPDATE_CONFIG } from "@/utils/app-update/config";
import { request } from "@/utils/app-update/http";
import { getCurrentVersion, getDeviceId } from "@/utils/app-update/device";
import { reportEvent } from "@/utils/app-update/reporter";

const LAST_SILENT_CHECK_KEY = "app_update_last_check_at";
const PENDING_INSTALL_KEY = "app_update_pending_install_code";

// 模块级单例状态：整个 APP 共享同一个弹窗
const state = reactive({
  visible: false, // 弹窗展示
  info: null, // 服务端下发的更新信息
  downloading: false,
  progress: 0, // 0~100
  downloadedBytes: 0,
  totalBytes: 0,
  failedMsg: "",
});

let downloadTask = null;

/**
 * 请求检查接口，有更新返回更新信息，无更新返回 null
 * @returns {Promise<object|null>}
 */
async function fetchUpdateInfo() {
  const { versionCode, versionName } = getCurrentVersion();
  if (!versionCode) return null; // 拿不到版本号（如标准基座异常）直接跳过
  const data = await request({
    url: "/app-updates/check",
    data: {
      platform: "android",
      appKey: UPDATE_CONFIG.appKey,
      versionCode,
      versionName,
      deviceId: getDeviceId(),
    },
  });
  return data?.hasUpdate ? data : null;
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
    const url = String(state.info.downloadUrl || "").replace(
      /^http:\/\//i,
      "https://",
    );
    downloadTask = uni.downloadFile({
      url,
      success: res => {
        if (res.statusCode === 200) resolve(res.tempFilePath);
        else if (res.statusCode === 404) reject(new Error("安装包已被下架"));
        else reject(new Error(`下载失败（${res.statusCode}）`));
      },
      fail: err => reject(new Error(err.errMsg || "下载失败")),
    });
    downloadTask.onProgressUpdate(p => {
      state.progress = p.progress;
      state.downloadedBytes = p.totalBytesWritten || 0;
      state.totalBytes =
        p.totalBytesExpectedToWrite || state.info.packageSize || 0;
    });
  });
}

/**
 * 完整性校验（P1-08 降级方案：更新服务契约暂无文件 hash 字段，
 * 以服务端下发的 packageSize 与实际 Content-Length 比对，偏差 >1% 视为
 * 包损坏或被替换）。后续更新服务增加 fileHash 后应升级为强校验。
 * @returns {boolean} true 表示校验通过
 */
function verifyPackage() {
  const expected = Number(state.info.packageSize);
  const actual = Number(state.totalBytes);
  if (!(expected > 0)) return true; // 服务端未下发 size，无法校验，放行
  if (!(actual > 0)) return false; // 拿不到实际大小，视为异常
  return Math.abs(actual - expected) / expected <= 0.01;
}

/** 开始下载：失败自动重试（404 下架属业务失败，不重试），成功后调起安装 */
async function startDownload() {
  if (state.downloading) return;
  state.downloading = true;
  state.failedMsg = "";
  state.progress = 0;
  reportEvent("download_start", {
    toVersionCode: state.info.versionCode,
  });
  const t0 = Date.now();

  let lastErr;
  for (let attempt = 0; attempt <= UPDATE_CONFIG.maxRetry; attempt++) {
    try {
      const filePath = await downloadOnce();
      // 包大小校验失败属内容异常，重试无意义，直接终止
      if (!verifyPackage()) {
        throw new Error("安装包校验失败，已终止安装");
      }
      reportEvent("download_success", {
        toVersionCode: state.info.versionCode,
        costMs: Date.now() - t0,
      });
      installApk(filePath);
      return;
    } catch (e) {
      lastErr = e;
      // 404 下架 / 校验失败属业务性失败，不重试
      if (e.message.includes("下架") || e.message.includes("校验")) break;
    }
  }

  state.downloading = false;
  state.failedMsg = lastErr?.message || "下载失败，请稍后重试";
  reportEvent("download_fail", {
    toVersionCode: state.info.versionCode,
    failCode: state.failedMsg.slice(0, 64),
  });
}

/**
 * 调起系统安装器（用户需手动确认，无法静默）；安装前写回补标记
 * @param {string} filePath 下载完成的 APK 临时路径
 */
function installApk(filePath) {
  // #ifdef APP-PLUS
  uni.setStorageSync(PENDING_INSTALL_KEY, state.info.versionCode);
  plus.runtime.install(
    filePath,
    { force: false },
    () => {
      // 仅代表成功调起系统安装器，APK 场景不要调 plus.runtime.restart()
      state.downloading = false;
    },
    err => {
      state.downloading = false;
      state.failedMsg = "调起安装失败，请在系统设置中允许安装未知应用后重试";
      reportEvent("install_fail", {
        toVersionCode: state.info.versionCode,
        failCode: String(err.message || err.code || "install_error").slice(
          0,
          64,
        ),
      });
    },
  );
  // #endif
}

/** 用户点「稍后再说」（非强更、非下载中才允许关闭） */
function dismiss() {
  if (state.downloading) return;
  if (state.info?.forceUpdate) return;
  state.visible = false;
  state.info = null;
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
    return;
    // #endif

    // #ifdef APP-PLUS
    if (silent) {
      const last = Number(uni.getStorageSync(LAST_SILENT_CHECK_KEY) || 0);
      if (Date.now() - last < UPDATE_CONFIG.silentCheckIntervalMs) return;
      uni.setStorageSync(LAST_SILENT_CHECK_KEY, Date.now());
    }

    try {
      const info = await fetchUpdateInfo();
      if (!info) {
        if (!silent) uni.showToast({ title: "已是最新版本", icon: "none" });
        else reportEvent("check_no_update");
        return;
      }
      state.info = info;
      state.visible = true;
      state.progress = 0;
      state.failedMsg = "";
      reportEvent("prompt_show", { toVersionCode: info.versionCode });
    } catch (e) {
      if (!silent) {
        uni.showToast({ title: `检查失败：${e.message}`, icon: "none" });
      }
      // 静默模式下检测失败默认放行，不阻断启动（若产品要求阻断需另做阻断页）
    }
    // #endif
  }

  /** 退出 APP（强更下载失败且用户放弃重试时） */
  function exitApp() {
    // #ifdef APP-PLUS
    plus.runtime.quit();
    // #endif
  }

  return {
    state,
    check,
    startDownload,
    retry: startDownload,
    dismiss,
    exitApp,
  };
}
