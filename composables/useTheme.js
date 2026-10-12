/**
 * @file 应用主题（深色模式）切换（Composables 层）
 * @description 模块级单例：全应用共享同一份主题模式，各页面模板根 view 绑定
 *              themeClass 实现换肤，设定页提供「跟随系统 / 浅色 / 深色」三段选择。
 *              设计要点：
 *              1. mode：'auto'（跟随系统，默认）| 'light' | 'dark'，
 *                 持久化于 storage（key: bk:theme），启动时恢复；
 *              2. themeClass：统一返回 'theme-dark' / 'theme-light' 挂页面根
 *                 view 覆盖变量，auto 模式按系统主题实时解析（JS 驱动，
 *                 不依赖 CSS media query，跨端确定性生效）；
 *              3. isDark：解析后的实际深浅（auto 时按系统主题解析），供模板内
 *                 uni-icons color 等无法走 CSS 变量的场景做 JS 取色；
 *              4. CSS 变量本体声明在 App.vue（page 默认浅色 + media query 深色 +
 *                 .theme-dark / .theme-light 覆盖类，media query 兜底 page 底色）。
 *              前置条件：manifest.json 各平台节点（app-plus / h5 / mp-weixin）
 *              需配置 darkmode:true，theme 字段与 onThemeChange 才会生效；
 *              App 端还须调用 plus.nativeUI.setUIStyle('auto') 开启跟随系统。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-12
 * @modify 2026-10-12 修复 auto 模式不跟随系统：darkmode 平台配置前置说明 +
 *              App 端 setUIStyle('auto') + H5 matchMedia 兜底 + themeClass 改为
 *              auto 时按系统主题返回类名（不再依赖 webview media query）
 */
import { computed, ref } from 'vue'

/** 主题模式持久化 key（与账号数据无关，登出时保留） */
const THEME_STORAGE_KEY = 'bk:theme'

/** 合法主题模式集合 */
const THEME_MODES = ['auto', 'light', 'dark']

/**
 * 从 storage 恢复主题模式
 * @returns {'auto'|'light'|'dark'} 非法值或读取异常时回退 auto
 */
function readStoredMode() {
  try {
    const stored = uni.getStorageSync(THEME_STORAGE_KEY)
    return THEME_MODES.includes(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

/** 模块级单例状态：主题模式 + 系统主题（auto 模式跟随其变化） */
const mode = ref(readStoredMode())
const systemTheme = ref('light')

/**
 * 初始化系统主题并监听变化：
 * 1. App 端先调 plus.nativeUI.setUIStyle('auto') 开启「跟随系统」，
 *    否则 uni.onThemeChange 不会回调（官方要求）；
 * 2. getSystemInfoSync().theme 取启动时的系统主题（各端 manifest 声明
 *    darkmode:true 后才返回该字段，未配置时为 undefined）；
 * 3. uni.onThemeChange 监听运行期切换；
 * 4. H5 端再以 matchMedia 兜底（浏览器直接监听主题媒体查询，实时可靠）。
 * 平台全不支持时静默保持 light 兜底。
 */
function initSystemTheme() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.nativeUI) {
      plus.nativeUI.setUIStyle('auto')
    }
  } catch {
    // ignore：低版本基座不支持时退化为仅取启动时的系统主题
  }
  // #endif
  try {
    const info = uni.getSystemInfoSync()
    if (info && info.theme) systemTheme.value = info.theme
  } catch {
    // ignore：取不到系统主题时保持默认
  }
  if (typeof uni.onThemeChange === 'function') {
    uni.onThemeChange((res) => {
      if (res && res.theme) systemTheme.value = res.theme
    })
  }
  // #ifdef H5
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = (e) => {
        systemTheme.value = e.matches ? 'dark' : 'light'
      }
      apply(mq)
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', apply)
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(apply) // 旧版 Safari
      }
    }
  } catch {
    // ignore：媒体查询不可用时依赖 uni.onThemeChange
  }
  // #endif
}
initSystemTheme()

/**
 * 页面根节点主题类：统一走 .theme-dark / .theme-light 覆盖机制（App.vue 声明）。
 * auto 模式由 JS 按系统主题显式返回对应类名——App 端 webview 对
 * prefers-color-scheme 的响应不可靠，JS 驱动才能跨端确定性生效，
 * 同时保证 isDark（图标 JS 取色）与 CSS 变量取值永远同源。
 */
const themeClass = computed(() => {
  const dark =
    mode.value === 'dark' ||
    (mode.value === 'auto' && systemTheme.value === 'dark')
  return dark ? 'theme-dark' : 'theme-light'
})

/** 解析后的实际深浅（auto 按系统主题解析），供 JS 取色场景使用 */
const isDark = computed(() => {
  if (mode.value === 'dark') return true
  if (mode.value === 'light') return false
  return systemTheme.value === 'dark'
})

/**
 * 切换主题模式并落盘（幂等）
 * @param {'auto'|'light'|'dark'} next 目标模式
 */
function setMode(next) {
  if (!THEME_MODES.includes(next) || next === mode.value) return
  mode.value = next
  try {
    uni.setStorageSync(THEME_STORAGE_KEY, next)
  } catch {
    // 落盘失败不阻断本次切换，下次启动回退默认
  }
}

/**
 * 主题切换组合式 API
 * @returns {{mode: import('vue').Ref<'auto'|'light'|'dark'>,
 *            themeClass: import('vue').ComputedRef<string>,
 *            isDark: import('vue').ComputedRef<boolean>,
 *            setMode: (next:'auto'|'light'|'dark') => void}}
 */
export function useTheme() {
  return { mode, themeClass, isDark, setMode }
}
