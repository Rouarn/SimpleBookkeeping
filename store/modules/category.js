/**
 * @file 分类 store（category 模块，接口字典缓存）
 * @description 收支分类由服务端字典接口提供（GET /categories?type=expense|income），
 *              本 store 作为接口数据缓存层：首次访问 / 登录后由调用方触发 fetch。
 *              主要导出：useCategoryStore，提供分类列表、名称列表、元数据查询
 *              getMeta（找不到时安全兜底「其他」）与合法性校验 isValid。
 *              persist: false —— 数据来源为服务端，本地不再持久化。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { dictionariesApi } from "@/api";

/** 兜底元数据（fetch 完成前 / 名称不匹配时保证 UI 不空） */
const FALLBACK_META = {
  name: "其他",
  icon: "📦",
  color: "#ff6a3d",
  bg: "#fff0ea",
};

/**
 * 把服务端分类字段映射为本地 CategoryMeta 结构（含 id，记账页需用 id 提交）
 * @param {object} item 服务端 {id,name,icon,color,bg,...}
 * @returns {{id:string,name:string,icon:string,color:string,bg:string}}
 */
function toMeta(item) {
  return {
    id: item.id,
    name: item.name,
    icon: item.icon || FALLBACK_META.icon,
    color: item.color || FALLBACK_META.color,
    bg: item.bg || FALLBACK_META.bg,
  };
}

export const useCategoryStore = defineStore(
  "category",
  () => {
    /** @type {import('vue').Ref<import('@/store/types').CategoryMeta[]>} */
    const expenseList = ref([]);
    /** @type {import('vue').Ref<import('@/store/types').CategoryMeta[]>} */
    const incomeList = ref([]);

    const expenseNames = computed(() => expenseList.value.map(i => i.name));
    const incomeNames = computed(() => incomeList.value.map(i => i.name));

    /** @type {Record<string, boolean>} 各类型是否已拉取过（避免重复请求） */
    const loaded = { expense: false, income: false };

    /**
     * 拉取指定类型的分类字典；已拉取过则跳过（除非 force）
     * @param {import('@/store/types').BillType} type
     * @param {boolean} [force=false]
     */
    async function fetchCategories(type, force = false) {
      if (loaded[type] && !force) return;
      const list = await dictionariesApi.getCategories({ type });
      const mapped = (list || []).map(toMeta);
      if (type === "income") incomeList.value = mapped;
      else expenseList.value = mapped;
      loaded[type] = true;
    }

    /** 拉取全部类型字典 */
    async function fetchAll(force = false) {
      await Promise.all([
        fetchCategories("expense", force),
        fetchCategories("income", force),
      ]);
    }

    /**
     * 按类型取分类列表
     * @param {import('@/store/types').BillType} type
     * @returns {import('@/store/types').CategoryMeta[]}
     */
    function listByType(type) {
      return type === "income" ? incomeList.value : expenseList.value;
    }

    /**
     * 取某条分类的元数据；找不到时回退兜底，保证 UI 永不出现空图标
     * @param {import('@/store/types').BillType} type
     * @param {string} name
     * @returns {import('@/store/types').CategoryMeta}
     */
    function getMeta(type, name) {
      const found = listByType(type).find(i => i.name === name);
      return found ? { ...found } : { ...FALLBACK_META };
    }

    /**
     * 校验分类名在当前类型下是否合法
     * @param {import('@/store/types').BillType} type
     * @param {string} name
     */
    function isValid(type, name) {
      return listByType(type).some(i => i.name === name);
    }

    /** 重置本地缓存与加载标记（退出登录时调用） */
    function reset() {
      expenseList.value = [];
      incomeList.value = [];
      loaded.expense = false;
      loaded.income = false;
    }

    return {
      expenseList,
      incomeList,
      expenseNames,
      incomeNames,
      fetchCategories,
      fetchAll,
      listByType,
      getMeta,
      isValid,
      reset,
    };
  },
  // 字典数据来源为服务端，不启用本地持久化
  { persist: false },
);
