/**
 * @file ESLint 9 Flat Config（小绿记账前端）
 * @description 规则取向保守：存量代码量大，no-unused-vars / no-undef 等仅 warn，
 *              避免一次性产生几百个 error；真正会导致运行时错误的规则
 *              （no-const-assign / no-dupe-keys / no-dupe-args 等）保持 error。
 *              仅校验 *.js（未引入 eslint-plugin-vue，.vue 单文件组件不参与命令行 lint，
 *              其检查由 HBuilderX / 编辑器插件承担）。
 *              忽略构建产物 unpackage/ 与三方插件目录 uni_modules/。
 * @date 2026-10-11
 */
import js from '@eslint/js'
import globals from 'globals'

/** uni-app 多端运行时注入的全局（API / 小程序 / App 端） */
const uniAppGlobals = {
  uni: 'readonly',
  wx: 'readonly', // 微信小程序原生对象（条件编译分支内可能直接使用）
  plus: 'readonly', // App 端 5+ runtime
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  uniCloud: 'readonly',
}

export default [
  {
    // 构建产物与三方插件不参与 lint
    ignores: ['unpackage/**', 'uni_modules/**'],
  },
  // ESLint 官方推荐规则基线（其中的 error 级真错误在下一个块中按需放宽为 warn）
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...uniAppGlobals,
      },
    },
    rules: {
      // —— 存量代码体量较大：未使用变量 / 疑似未声明全局先告警，不阻断 ——
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      // —— 真错误级别：命中几乎必然是 bug，保持 error ——
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-func-assign': 'error',
      'no-class-assign': 'error',
      'no-obj-calls': 'error',
      'no-unreachable': 'error',
      'no-import-assign': 'error',
      'no-setter-return': 'error',
      'no-this-before-super': 'error',
    },
  },
  {
    // 配置文件自身运行在 Node 环境
    files: ['eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // uni-app 条件编译（// #ifdef ... // #endif）由构建预处理裁剪，
    // ESLint 看到的是"return 之后还有语句"的假阳性，直接关闭；
    // catch (e) 静默吞错也是该模块约定，忽略未使用的 catch 形参
    files: ['composables/use-app-update.js', 'utils/app-update/**/*.js'],
    rules: {
      'no-unreachable': 'off',
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
    },
  },
]
