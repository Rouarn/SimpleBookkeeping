/**
 * @file API 统一出口
 * @description 各资源模块默认以 xxxApi 命名空间对象导出，页面 / store 一律走命名空间调用：
 *              bills 与 books 都存在 list/create/update/remove/getOne 等同名方法，
 *              扁平具名导出会互相遮蔽（ESM 下重名静默失效），故这两个模块不再做
 *              具名导出；其余模块无命名冲突的函数在下方「显式登记」后具名导出，
 *              新增具名导出必须先确认无同名冲突。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
export {
  http,
  request,
  upload,
  download,
  bufferToText,
  BASE_URL,
  normalizeFileUrl,
  ApiError,
} from './http'

// —— 资源命名空间（推荐用法：billsApi.list() / booksApi.update() 等）——
export { default as authApi } from './auth'
export { default as usersApi } from './users'
export { default as billsApi } from './bills'
export { default as booksApi } from './books'
export { default as dictionariesApi } from './dictionaries'
export { default as statisticsApi } from './statistics'
export { default as uploadsApi } from './uploads'
export { default as messagesApi } from './messages'

// —— 无同名冲突的具名导出（显式登记，禁止改回 export *）——
export { register, login, logout } from './auth'
export { getMe, updateMe, uploadAvatar, getStats } from './users'
export { getCategories, getPayMethods } from './dictionaries'
export { overview, categories, payMethods, trend, home } from './statistics'
export { uploadImage } from './uploads'
export { list as listMessages, unreadCount, markRead } from './messages'
