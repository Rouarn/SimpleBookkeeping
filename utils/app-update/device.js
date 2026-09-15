/**
 * @file 设备信息工具（utils/app-update/device.js）
 * @description 在线更新依赖的本机信息：
 *              1. getCurrentVersion()：读取本机 versionCode / versionName，
 *                 标准基座拿到的是基座版本号，必须自定义基座/正式包才准确；
 *              2. getDeviceId()：灰度分桶用稳定设备标识，plus.device.uuid
 *                 优先，本地缓存兜底；
 *              3. initNetworkType()/getNetworkType()：事件上报用网络类型，
 *                 uni 仅有异步 getNetworkType，启动时缓存一次。
 *              所有 plus.* 能力均通过条件编译限定在 APP-PLUS 端。
 * @date 2026-09-15
 */

/**
 * 读取本机版本号
 * @returns {{versionCode: number, versionName: string}} 整数版本号与版本名
 */
export function getCurrentVersion() {
  let versionCode = 0;
  let versionName = "";

  try {
    const sys = uni.getSystemInfoSync();
    versionName = sys.appVersion || "";
    versionCode = Number(sys.appVersionCode) || 0;
  } catch (e) {
    // ignore
  }

  // #ifdef APP-PLUS
  if (!versionCode) {
    const code = Number(plus.runtime.versionCode);
    if (!Number.isNaN(code)) versionCode = code;
  }
  if (!versionName) {
    versionName = plus.runtime.version || "";
  }
  // #endif

  return { versionCode, versionName };
}

const DEVICE_ID_KEY = "app_update_device_id";

/**
 * 获取稳定设备标识（灰度分桶依赖：同一设备必须稳定，卸载重装允许变化）
 * @returns {string} 设备唯一标识
 */
export function getDeviceId() {
  let id = uni.getStorageSync(DEVICE_ID_KEY);
  if (id) return id;

  // #ifdef APP-PLUS
  try {
    id = plus.device.uuid || "";
  } catch (e) {
    id = "";
  }
  // #endif

  if (!id) {
    id =
      "d-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(16).slice(2, 10);
  }
  uni.setStorageSync(DEVICE_ID_KEY, id);
  return id;
}

let cachedNetworkType = "unknown";

/** App 启动时调用一次缓存网络类型；uni 只有异步 getNetworkType，没有同步版本 */
export function initNetworkType() {
  // #ifdef APP-PLUS
  uni.getNetworkType({
    success: (res) => {
      cachedNetworkType = res.networkType || "unknown";
    },
  });
  // #endif
}

/**
 * 获取已缓存的网络类型
 * @returns {string} wifi / 4g / none / unknown 等
 */
export function getNetworkType() {
  return cachedNetworkType;
}
