/**
 * @file 账单 store（核心业务模块 bill）
 * @description 全应用唯一的账单数据源，首页 / 流水 / 统计 / 详情全部从这里派生，保证统计口径一致。
 *              核心约定：
 *              - 金额统一存正数 + type(expense/income) 表示方向，对外通过视图模型暴露带符号金额；
 *              - 跨模块联动：分类图标/底色来自 category store，默认账本与支付信息来自 book store；
 *              - 增删改后通过 uni.$emit 广播 BILL_CHANGE_EVENT('bill:change')，供页面做命令式响应；
 *              - 整 store 持久化（key: bills），并内置 v0「带符号金额」→ v1「正数+type」迁移。
 *              模块结构：基础派生(sortedBills/totalCount/activeDays) → 查询类 getter
 *              (月汇总/按天分组/分类聚合/支付方式聚合/详情) → 写入类 action(增/改/删/清空)。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useCategoryStore } from "./category";
import { useBookStore } from "./book";
import {
  isSameMonth,
  dayLabel,
  formatMD,
  todayStr,
  nowTime,
} from "@/utils/date";

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

/**
 * 生成账单唯一 ID：时间戳 36 进制 + 随机串，同毫秒内新增也不会碰撞
 * @returns {string} 形如 'b_mr3x2k_a8f3k1'
 */
function genId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useBillStore = defineStore(
  "bill",
  () => {
    const categoryStore = useCategoryStore();
    const bookStore = useBookStore();

    /** @type {import('vue').Ref<import('@/store/types').Bill[]>} */
    const bills = ref([]);

    // ---------------- 基础派生 ----------------

    /** 按日期、时间倒序排列的全部账单（原始实体） */
    const sortedBills = computed(() =>
      [...bills.value].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.time !== b.time) return b.time.localeCompare(a.time);
        return b.createdAt - a.createdAt;
      }),
    );

    const totalCount = computed(() => bills.value.length);

    /** 有记账记录的天数（去重日期数） */
    const activeDays = computed(
      () => new Set(bills.value.map(i => i.date)).size,
    );

    /**
     * 原始实体 → 列表视图模型（金额转带符号，附带分类展示元数据）
     * @param {import('@/store/types').Bill} bill
     * @returns {import('@/store/types').BillViewModel}
     */
    function toViewModel(bill) {
      const meta = categoryStore.getMeta(bill.type, bill.category);
      return {
        id: bill.id,
        title: bill.category,
        iconText: meta.icon,
        iconBg: meta.bg,
        amount:
          bill.type === "expense"
            ? -Math.abs(round2(bill.amount))
            : Math.abs(round2(bill.amount)),
        date: bill.date,
        time: bill.time,
        payMethod: bill.payMethod,
        type: bill.type,
        category: bill.category,
        remark: bill.remark,
        photos: bill.photos,
      };
    }

    // ---------------- 查询类（函数 getter，支持传参） ----------------

    /**
     * 按 id 取账单原始实体
     * @param {string} id 账单 ID
     * @returns {import('@/store/types').Bill | null} 不存在时返回 null
     */
    function getById(id) {
      return bills.value.find(i => i.id === id) || null;
    }

    /**
     * 指定月份的账单（倒序）
     * @param {string} month 'YYYY-MM'
     * @returns {import('@/store/types').Bill[]}
     */
    function billsOfMonth(month) {
      return sortedBills.value.filter(i => isSameMonth(i.date, month));
    }

    /** 今天的账单视图模型（时间倒序） */
    const todayViewModels = computed(() =>
      sortedBills.value.filter(i => i.date === todayStr()).map(toViewModel),
    );

    /**
     * 任意月份的收支汇总
     * @param {string} month
     * @returns {import('@/store/types').MonthSummary}
     */
    function monthSummary(month) {
      const summary = {
        expense: 0,
        income: 0,
        balance: 0,
        expenseCount: 0,
        incomeCount: 0,
        count: 0,
      };
      billsOfMonth(month).forEach(i => {
        const amount = round2(i.amount);
        if (i.type === "expense") {
          summary.expense += amount;
          summary.expenseCount += 1;
        } else {
          summary.income += amount;
          summary.incomeCount += 1;
        }
      });
      summary.expense = round2(summary.expense);
      summary.income = round2(summary.income);
      summary.balance = round2(summary.income - summary.expense);
      summary.count = summary.expenseCount + summary.incomeCount;
      return summary;
    }

    /**
     * 流水页：按月 + 类型筛选并按天分组
     * @param {string} month 'YYYY-MM'
     * @param {string} filterType '全部类型' | '支出' | '收入'
     * @returns {import('@/store/types').FlowGroup[]}
     */
    function groupedByDay(month, filterType = "全部类型") {
      /** @type {Map<string, import('@/store/types').Bill[]>} */
      const groupMap = new Map();
      sortedBills.value.forEach(bill => {
        if (!isSameMonth(bill.date, month)) return;
        if (filterType === "支出" && bill.type !== "expense") return;
        if (filterType === "收入" && bill.type !== "income") return;
        if (!groupMap.has(bill.date)) groupMap.set(bill.date, []);
        groupMap.get(bill.date).push(bill);
      });

      return [...groupMap.entries()].map(([date, items]) => {
        let expense = 0;
        let income = 0;
        items.forEach(i => {
          if (i.type === "expense") expense += i.amount;
          else income += i.amount;
        });
        return {
          day: dayLabel(date),
          date: formatMD(date),
          expense: fmtMoney(expense),
          income: fmtMoney(income),
          items: items
            .slice()
            .sort((a, b) => b.time.localeCompare(a.time))
            .map(toViewModel),
        };
      });
    }

    /**
     * 统计页：分类聚合（金额/笔数/占比），带分类元数据
     * @param {string} month
     * @param {import('@/store/types').BillType} type
     * @returns {import('@/store/types').AggregateStat[]}
     */
    function monthCategoryStats(month, type) {
      /** @type {Record<string, {amount:number, count:number}>} */
      const map = {};
      billsOfMonth(month).forEach(i => {
        if (i.type !== type) return;
        if (!map[i.category]) map[i.category] = { amount: 0, count: 0 };
        map[i.category].amount += i.amount;
        map[i.category].count += 1;
      });
      const total =
        Object.values(map).reduce((sum, v) => sum + v.amount, 0) || 1;
      return Object.keys(map)
        .map(name => ({
          name,
          amount: round2(map[name].amount),
          count: map[name].count,
          percent: round2((map[name].amount / total) * 100),
          ...categoryStore.getMeta(type, name),
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    /**
     * 统计页：支出场景下按支付方式聚合
     * @param {string} month
     * @returns {import('@/store/types').AggregateStat[]}
     */
    function monthPayStats(month) {
      /** @type {Record<string, {amount:number, count:number}>} */
      const map = {};
      billsOfMonth(month).forEach(i => {
        if (i.type !== "expense") return;
        if (!map[i.payMethod]) map[i.payMethod] = { amount: 0, count: 0 };
        map[i.payMethod].amount += i.amount;
        map[i.payMethod].count += 1;
      });
      const total =
        Object.values(map).reduce((sum, v) => sum + v.amount, 0) || 1;
      return Object.keys(map)
        .map(name => ({
          name,
          amount: round2(map[name].amount),
          count: map[name].count,
          percent: round2((map[name].amount / total) * 100),
          ...bookStore.getPayMeta(name),
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    /**
     * 详情页视图模型：在列表 VM 基础上补充账本名、记录时间、当月截止支出
     * @param {string} id
     */
    function detailById(id) {
      const bill = getById(id);
      if (!bill) return null;
      const monthPrefix = bill.date.slice(0, 7);
      let monthExpense = 0;
      bills.value.forEach(i => {
        if (i.type !== "expense" || !i.date.startsWith(monthPrefix)) return;
        // 截止本单：日期更早，或同一天时间不晚于本单
        if (
          i.date < bill.date ||
          (i.date === bill.date && i.time <= bill.time)
        ) {
          monthExpense += i.amount;
        }
      });
      return {
        ...toViewModel(bill),
        bookId: bill.bookId,
        bookName:
          bookStore.getBook(bill.bookId)?.name || bookStore.activeBook.name,
        createdAt: bill.createdAt,
        recordTime: `${bill.date} ${bill.time}:00`,
        monthExpense: fmtMoney(monthExpense),
      };
    }

    // ---------------- 写入类（action） ----------------

    /**
     * 新增账单
     * @param {import('@/store/types').BillInput} input
     * @returns {import('@/store/types').Bill}
     * @throws {Error} 金额非法时抛出，由调用方提示用户
     */
    function addBill(input) {
      const amount = round2(input.amount);
      if (!(amount > 0)) throw new Error("金额必须大于 0");

      /** @type {import('@/store/types').BillType} */
      const type = input.type === "income" ? "income" : "expense";
      const category = categoryStore.isValid(type, input.category)
        ? input.category
        : "其他";
      const payMethod = bookStore.payMethods.includes(input.payMethod)
        ? input.payMethod
        : "现金";
      const date = input.date || todayStr();

      /** @type {import('@/store/types').Bill} */
      const bill = {
        id: genId(),
        type,
        amount,
        category,
        payMethod,
        date,
        time:
          input.time ||
          (date === todayStr() ? nowTime() : input.time || "12:00"),
        remark: String(input.remark || "").slice(0, 50),
        photos: Array.isArray(input.photos) ? input.photos.slice(0, 3) : [],
        bookId: bookStore.getBook(input.bookId)
          ? input.bookId
          : bookStore.activeBookId,
        createdAt: Date.now(),
      };
      bills.value.push(bill);
      uni.$emit(BILL_CHANGE_EVENT, { action: "add", id: bill.id, bill });
      return bill;
    }

    /**
     * 更新账单
     * @param {string} id
     * @param {Partial<import('@/store/types').BillInput>} patch
     */
    function updateBill(id, patch) {
      const bill = getById(id);
      if (!bill) return null;
      if (patch.amount !== undefined) {
        const amount = round2(patch.amount);
        if (amount > 0) bill.amount = amount;
      }
      if (patch.type === "expense" || patch.type === "income") {
        bill.type = patch.type;
      }
      if (patch.category !== undefined) {
        bill.category = categoryStore.isValid(bill.type, patch.category)
          ? patch.category
          : bill.category;
      }
      if (patch.payMethod !== undefined) {
        bill.payMethod = bookStore.payMethods.includes(patch.payMethod)
          ? patch.payMethod
          : bill.payMethod;
      }
      if (patch.date) bill.date = patch.date;
      if (patch.time) bill.time = patch.time;
      if (patch.remark !== undefined) {
        bill.remark = String(patch.remark).slice(0, 50);
      }
      if (Array.isArray(patch.photos)) bill.photos = patch.photos.slice(0, 3);
      uni.$emit(BILL_CHANGE_EVENT, { action: "update", id: bill.id, bill });
      return bill;
    }

    /**
     * 删除账单
     * @param {string} id
     * @returns {boolean}
     */
    function removeBill(id) {
      const index = bills.value.findIndex(i => i.id === id);
      if (index === -1) return false;
      const [removed] = bills.value.splice(index, 1);
      uni.$emit(BILL_CHANGE_EVENT, { action: "remove", id, bill: removed });
      return true;
    }

    /** 清空全部账单 */
    function clearAllBills() {
      bills.value = [];
      uni.$emit(BILL_CHANGE_EVENT, { action: "clear" });
    }

    return {
      // state
      bills,
      // getters
      sortedBills,
      totalCount,
      activeDays,
      todayViewModels,
      // 函数式 getter
      getById,
      billsOfMonth,
      monthSummary,
      groupedByDay,
      monthCategoryStats,
      monthPayStats,
      detailById,
      toViewModel,
      // actions
      addBill,
      updateBill,
      removeBill,
      clearAllBills,
    };
  },
  {
    persist: {
      key: "bills",
      version: 1,
      // 迁移示例：v0 时代金额存的是带符号数值，v1 改为「正数 + type」
      migrations: {
        0: saved => {
          if (Array.isArray(saved?.bills)) {
            saved.bills.forEach(b => {
              if (typeof b.amount === "number" && b.amount < 0) {
                b.amount = Math.abs(b.amount);
                b.type = "expense";
              }
            });
          }
          return saved;
        },
      },
    },
  },
);
