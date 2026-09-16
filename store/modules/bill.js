/**
 * @file 账单 store（bill 模块，接口数据缓存 + 增删改查）
 * @description 改造为接口数据缓存层：
 *              - 列表 / 详情 / 今日 / 分组 / 汇总 / 统计等只读派生全部由 composables
 *                直接调 billsApi / statisticsApi，避免客户端与服务端聚合逻辑不一致；
 *              - 本 store 只保留增删改查 action：调服务端接口成功后广播
 *                BILL_CHANGE_EVENT('bill:change')，让依赖页面（首页/流水/统计/详情）
 *                在 onShow / 订阅事件时重新拉取；
 *              - 保留 round2 / fmtMoney 金额工具，供模板/composable 复用。
 *              persist: false —— 列表数据来源为服务端，本地不再持久化账单业务数据。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { defineStore } from "pinia";
import { billsApi } from "@/api";

/** 账单变更全局事件名（增 / 改 / 删 / 清空均会广播，payload 含 action 与账单信息） */
export const BILL_CHANGE_EVENT = "bill:change";

/**
 * 金额保留两位小数（先乘 100 取整再除回，避免浮点累加误差）
 * @param {number|string} n 原始数值
 * @returns {number} 两位小数数值
 */
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * 金额格式化为两位小数字符串（模板直接渲染用）
 * @param {number|string} n 原始数值
 * @returns {string} 如 '12.30'
 */
export const fmtMoney = n => round2(n).toFixed(2);

export const useBillStore = defineStore(
  "bill",
  () => {
    /**
     * 新增账单（调服务端 POST /bills，成功后广播变更事件）
     * @param {object} input {type,amount,categoryId,payMethodId,date,time,remark,photos,bookId?}
     * @returns {Promise<object>} 服务端返回的账单实体
     */
    async function addBill(input) {
      const bill = await billsApi.create(input);
      uni.$emit(BILL_CHANGE_EVENT, {
        action: "add",
        id: bill?.id,
        bill,
      });
      return bill;
    }

    /**
     * 更新账单（调服务端 PATCH /bills/:id）
     * @param {string} id
     * @param {object} patch 局部字段
     * @returns {Promise<object>}
     */
    async function updateBill(id, patch) {
      const bill = await billsApi.update(id, patch);
      uni.$emit(BILL_CHANGE_EVENT, {
        action: "update",
        id,
        bill,
      });
      return bill;
    }

    /**
     * 删除账单（调服务端 DELETE /bills/:id）
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async function removeBill(id) {
      await billsApi.remove(id);
      uni.$emit(BILL_CHANGE_EVENT, { action: "remove", id });
      return true;
    }

    /**
     * 清空全部账单（body: {confirm:true,bookId?}）
     * @param {{bookId?:string}} [params]
     */
    async function clearAllBills(params = {}) {
      await billsApi.clearAll({ confirm: true, ...params });
      uni.$emit(BILL_CHANGE_EVENT, { action: "clear" });
    }

    return {
      addBill,
      updateBill,
      removeBill,
      clearAllBills,
    };
  },
  // 列表数据来源为服务端，不启用本地持久化
  { persist: false },
);
