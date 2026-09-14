/**
 * @file 分类 store（category 模块，运行时字典，不持久化）
 * @description 收支分类是全局静态元数据：记账页图标、流水列表图标、统计页分类排行
 *              全部以这里为唯一来源，避免页面各自维护导致名称 / 颜色不一致。
 *              数据内置且不变，故显式关闭持久化（persist: false，减少冗余存储）。
 *              主要导出：useCategoryStore，提供分类列表、名称列表、
 *              元数据查询 getMeta（找不到时安全兜底「其他」）与合法性校验 isValid。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * 支出分类字典（name 唯一键，icon emoji，color 主题色，bg 浅底色）
 * @type {import('@/store/types').CategoryMeta[]}
 */
const EXPENSE_CATEGORIES = [
  { name: "其他", icon: "📦", color: "#ff6a3d", bg: "#fff0ea" },
  { name: "购物", icon: "🛍️", color: "#ff8f1f", bg: "#fff3e6" },
  { name: "交通", icon: "🚌", color: "#4a8cff", bg: "#eaf2ff" },
  { name: "娱乐", icon: "🎬", color: "#a45dff", bg: "#f4ecff" },
  { name: "餐饮", icon: "🍽️", color: "#ff6a3d", bg: "#ffefea" },
  { name: "住房", icon: "🏠", color: "#22b573", bg: "#e8f8f1" },
  { name: "就医", icon: "💊", color: "#f2484b", bg: "#ffecec" },
  { name: "教育", icon: "📚", color: "#2ea8e6", bg: "#e8f6fd" },
  { name: "旅行", icon: "✈️", color: "#14b8a6", bg: "#e6f7f5" },
];

/**
 * 收入分类字典（字段含义与支出分类一致）
 * @type {import('@/store/types').CategoryMeta[]}
 */
const INCOME_CATEGORIES = [
  { name: "其他", icon: "📦", color: "#ff6a3d", bg: "#fff0ea" },
  { name: "退还款", icon: "🔄", color: "#5b8ff9", bg: "#eaf2ff" },
  { name: "红包", icon: "🧧", color: "#ff7a45", bg: "#fff0e8" },
  { name: "收益", icon: "📈", color: "#34c759", bg: "#e9faf0" },
  { name: "礼金", icon: "🎁", color: "#ffb020", bg: "#fff7e3" },
  { name: "佣金", icon: "💰", color: "#b06be0", bg: "#f5edff" },
  { name: "工资", icon: "💵", color: "#f2484b", bg: "#ffecec" },
];

/** 兜底元数据（支出分类第一项「其他」），分类被删除 / 名称不匹配时保证 UI 不空 */
const FALLBACK_META = EXPENSE_CATEGORIES[0];

export const useCategoryStore = defineStore(
  "category",
  () => {
    /** @type {import('vue').Ref<import('@/store/types').CategoryMeta[]>} */
    const expenseList = ref(EXPENSE_CATEGORIES.map(item => ({ ...item })));
    /** @type {import('vue').Ref<import('@/store/types').CategoryMeta[]>} */
    const incomeList = ref(INCOME_CATEGORIES.map(item => ({ ...item })));

    const expenseNames = computed(() => expenseList.value.map(i => i.name));
    const incomeNames = computed(() => incomeList.value.map(i => i.name));

    /**
     * 按类型取分类列表
     * @param {import('@/store/types').BillType} type
     * @returns {import('@/store/types').CategoryMeta[]}
     */
    function listByType(type) {
      return type === "income" ? incomeList.value : expenseList.value;
    }

    /**
     * 取某条分类的元数据；找不到时回退到「其他」，保证 UI 永不出现空图标
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

    return {
      expenseList,
      incomeList,
      expenseNames,
      incomeNames,
      listByType,
      getMeta,
      isValid,
    };
  },
  // 纯字典数据，不启用持久化
  { persist: false },
);
