/**
 * @file 应用入口 main.js
 * @description uni-app 标准入口文件，通过条件编译同时兼容 Vue2 / Vue3 两套运行时：
 *              - #ifndef VUE3：Vue2 工程下直接 new Vue 挂载 App（本项目实际走 Vue3 分支）；
 *              - #ifdef VUE3：导出 createApp 工厂，创建 SSR App 实例并注册 Pinia。
 *              注意：uni-app 要求 createApp 返回值中必须带上 pinia 实例，
 *              否则 Pinia 插件（含自研持久化插件）在小程序/App 端不会生效。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */

// #ifndef VUE3
// Vue2 运行时分支（仅当工程未启用 Vue3 时参与编译）
import Vue from "vue";
import App from "./App";

// 关闭生产环境提示，保持控制台输出整洁
Vue.config.productionTip = false;

// 标识为 app 类型组件（uni-app Vue2 固定要求）
App.mpType = "app";

const app = new Vue({
  ...App,
});
app.$mount();
// #endif

// #ifdef VUE3
// Vue3 运行时分支（本项目实际使用）
import { createSSRApp } from "vue";
import App from "./App.vue";
import pinia from "./store";

/**
 * 创建应用实例（由 uni-app 框架在启动时调用）
 * @returns {{app: import('vue').App, pinia: import('pinia').Pinia}}
 */
export function createApp() {
  const app = createSSRApp(App);
  app.use(pinia);
  return {
    app,
    pinia, // uni-app 必须把 pinia 实例一并返回，否则 pinia 插件（持久化）不会生效
  };
}
// #endif
