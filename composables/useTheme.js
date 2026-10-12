/**
 * @file 应用主题（深色模式）切换（Composables 层）
 * @description 模块级单例：全应用共享同一份主题模式，各页面模板根 view 绑定
 *              themeClass 实现换肤，设定页提供「跟随系统 / 浅色 / 深色」三段选择。
 *              设计要点：
 *              1. mode：'auto'（跟随系统，默认）| 'light' | 'dark'，
 *                 持久化于 storage（key: bk:theme），启动时恢复；
 *              2. themeClass：手动模式返回 'theme-dark' / 'theme-light' 挂根节点，
 *                 auto 模式返回空串（此时靠 App.vue 的 media query 跟随系统）；
 *              3. isDark：解析后的实际深浅（auto 时按系统主题解析），供模板内
 *                 uni-icons color 等无法走 CSS 变量的场景做 JS 取色；
 *              4. CSS 变量本体声明在 App.vue（page 默认浅色 + media query 深色 +
 *                 .theme-dark / .theme-light 手动覆盖）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-12
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
 * 初始化系统主题并监听变化（仅 App / H5 / 微信小程序等支持，
 * 平台不支持时静默保持 light 兜底）
 */
function initSystemTheme() {
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
}
initSystemTheme()

/** 页面根节点主题类：手动模式返回对应类名，auto 交由 media query */
const themeClass = computed(() => {
  if (mode.value === 'dark') return 'theme-dark'
  if (mode.value === 'light') return 'theme-light'
  return ''
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
