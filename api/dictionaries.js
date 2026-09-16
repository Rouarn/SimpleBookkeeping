/**
 * @file 字典 API：分类 + 支付方式
 * @see docs/server/04c-api-books-dictionaries.md
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-16
 */
import { http } from "./http";

/**
 * 获取分类列表
 * @param {{type:"expense"|"income"}} params
 * @returns {Promise<object[]>} {id,name,type,iconText,iconColor,iconBg,sort,enabled}
 */
export function getCategories(params) {
  return http.get("/categories", params);
}

/**
 * 获取支付方式列表
 * @returns {Promise<object[]>} {id,name,iconText,iconColor,iconBg,sort,enabled}
 */
export function getPayMethods() {
  return http.get("/pay-methods");
}

export default { getCategories, getPayMethods };
