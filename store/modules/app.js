/**
 * @file 应用 UI / 偏好 store（app 模块）
 * @description 只放轻量「选择态」：流水页/统计页选中的月份与筛选类型、
 *              记账页上次使用的收支方向 / 分类 / 支付方式。
 *              数据量小、重启后希望保留，因此整 store 持久化（key: app_ui）；
 *              业务列表等大对象一律不放进这里（选择性持久化原则）。
 *              主要导出：useAppStore；暴露 ui 状态与各 setter、rememberBillForm、resetUI。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { currentMonth, currentYear } from "@/utils/date";

/**
 * 生成默认 UI 偏好（月份默认取当前系统月，保证首次进入即有合理选中值）
 * @returns {import('@/store/types').AppUIState}
 */
function createDefaultUI() {
  return {
    flowMonth: currentMonth(),
    flowType: "全部类型",
    statsMonth: currentMonth(),
    statsYear: currentYear(),
    statsScope: "month",
    statsType: "expense",
    lastBillType: "expense",
    // 记忆按 id 存储：分类/支付方式改名后仍能匹配，失效时由记账页回退默认项
    lastPayMethod: "",
    lastCategory: {
      expense: "",
      income: "",
    },
  };
}

export const useAppStore = defineStore(
  "app",
  () => {
    /** @type {import('vue').Ref<import('@/store/types').AppUIState>} */
    const ui = ref(createDefaultUI());

    /** @param {string} month 'YYYY-MM' */
    function setFlowMonth(month) {
      ui.value.flowMonth = month;
    }

    /** @param {string} type 全部类型 / 支出 / 收入 */
    function setFlowType(type) {
      ui.value.flowType = type;
    }

    /** @param {string} month */
    function setStatsMonth(month) {
      ui.value.statsMonth = month;
    }

    /** @param {string} year 'YYYY' */
    function setStatsYear(year) {
      ui.value.statsYear = year;
    }

    /** @param {"month"|"year"} scope 统计页时间粒度 */
    function setStatsScope(scope) {
      ui.value.statsScope = scope === "year" ? "year" : "month";
    }

    /** @param {import('@/store/types').BillType} type */
    function setStatsType(type) {
      ui.value.statsType = type === "income" ? "income" : "expense";
    }

    /**
     * 记账页保存时记忆上次选择（分类 / 支付方式存 id，按 id 匹配字典更可靠）
     * @param {{type: import('@/store/types').BillType, categoryId: string, payMethodId: string}} form
     */
    function rememberBillForm({ type, categoryId, payMethodId }) {
      if (type === "expense" || type === "income") {
        ui.value.lastBillType = type;
        ui.value.lastCategory[type] = categoryId;
      }
      if (payMethodId) ui.value.lastPayMethod = payMethodId;
    }

    /** 重置全部 UI 偏好 */
    function resetUI() {
      ui.value = createDefaultUI();
    }

    return {
      ui,
      setFlowMonth,
      setFlowType,
      setStatsMonth,
      setStatsYear,
      setStatsScope,
      setStatsType,
      rememberBillForm,
      resetUI,
    };
  },
  {
    // 全部为轻量选择态，整体持久化
    persist: {
      key: "app_ui",
      version: 1,
    },
  },
);
