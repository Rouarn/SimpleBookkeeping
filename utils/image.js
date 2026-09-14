/**
 * @file 图片转 base64 统一工具（跨端适配）
 * @description 账单凭证图片在落库前统一转为 dataURL，避免各端临时路径失效。
 *              平台适配策略：
 *              1. 小程序 / App：走 uni.getFileSystemManager().readFile（base64 编码）；
 *              2. H5：走 XMLHttpRequest + FileReader（临时路径转 dataURL）；
 *              3. 转换失败时回退原路径，保证保存流程不因单张图片失败而中断。
 *              对外暴露：isBase64Image / fileToBase64 / photosToBase64。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */

/**
 * 根据文件扩展名推断 MIME 类型，用于拼 dataURL 前缀
 * @param {string} path 图片路径（支持带 ? / # 查询参数）
 * @returns {string} MIME 字符串，无法识别时默认 image/png
 */
function guessMime(path) {
  const ext = (path.match(/\.(\w+)(\?|#|$)/) || [])[1]?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    default:
      return "image/png";
  }
}

/**
 * 判断字符串是否已经是 base64 图片（dataURL 形态）
 * @param {string} str
 * @returns {boolean}
 */
export function isBase64Image(str) {
  return typeof str === "string" && str.startsWith("data:image/");
}

/**
 * 单张图片转 base64 dataURL
 * @param {string} filePath 图片路径（临时路径 / 本地路径 / 网络地址）
 * @returns {Promise<string>} base64 dataURL；失败时 reject
 */
export function fileToBase64(filePath) {
  return new Promise((resolve, reject) => {
    // 小程序 / App 有 FileSystemManager，直接按 base64 读文件
    const fsm =
      typeof uni.getFileSystemManager === "function"
        ? uni.getFileSystemManager()
        : null;
    if (fsm?.readFile) {
      fsm.readFile({
        filePath,
        encoding: "base64",
        success: res =>
          resolve(`data:${guessMime(filePath)};base64,${res.data}`),
        fail: () => reject(new Error("图片读取失败")),
      });
      return;
    }
    // H5 无文件系统，走 XHR + FileReader 转 dataURL
    if (typeof XMLHttpRequest === "undefined") {
      reject(new Error("当前环境不支持图片读取"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filePath, true);
    xhr.responseType = "blob";
    xhr.onload = () => {
      const reader = new FileReader();
      reader.onloadend = () => {
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("base64 转换失败"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error("图片读取失败"));
    xhr.send();
  });
}

/**
 * 批量转换凭证图片：已经是 base64 的直接跳过，不重复转换
 * @param {string[]} paths 最多 3 张的图片路径数组
 * @returns {Promise<string[]>} 与入参顺序一致的数组；单张失败时保留原路径
 */
export async function photosToBase64(paths = []) {
  return Promise.all(
    paths.map(path =>
      isBase64Image(path)
        ? Promise.resolve(path)
        : fileToBase64(path).catch(() => path),
    ),
  );
}
