/**
 * @file API 统一出口
 * @description 集中导出所有资源 API 与 http 封装，页面/store 直接 import 使用。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
export { http, request, BASE_URL, normalizeFileUrl } from "./http";
export { default as authApi } from "./auth";
export { default as usersApi } from "./users";
export { default as billsApi } from "./bills";
export { default as booksApi } from "./books";
export { default as dictionariesApi } from "./dictionaries";
export { default as statisticsApi } from "./statistics";
export { default as uploadsApi } from "./uploads";

// 具名导出（便于 import { getMe } from "@/api"）
export * from "./auth";
export * from "./users";
export * from "./bills";
export * from "./books";
export * from "./dictionaries";
export * from "./statistics";
export * from "./uploads";
