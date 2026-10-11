/**
 * @file 应用入口 main.js
 * @description uni-app Vue3 入口：导出 createApp 工厂，创建 SSR App 实例并注册 Pinia。
 *              manifest.json 已固定 vueVersion=3，不再保留 Vue2 条件编译分支。
 *              注意：uni-app 要求 createApp 返回值中必须带上 pinia 实例，
 *              否则 Pinia 插件（含自研持久化插件）在小程序/App 端不会生效。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-10-11
 */
import { createSSRApp } from 'vue'
import App from './App.vue'
import pinia from './store'

/**
 * 创建应用实例（由 uni-app 框架在启动时调用）
 * @returns {{app: import('vue').App, pinia: import('pinia').Pinia}}
 */
export function createApp() {
  const app = createSSRApp(App)
  app.use(pinia)
  return {
    app,
    pinia, // uni-app 必须把 pinia 实例一并返回，否则 pinia 插件（持久化）不会生效
  }
}
