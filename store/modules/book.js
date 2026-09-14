/**
 * @file 账本 store（book 模块）
 * @description 管理账本（多账本能力预留）、当前选中账本、月预算与收付款方式字典。
 *              持久化策略：只持久化业务数据 books / activeBookId；
 *              支付方式的简称与配色（PAY_META / PAY_METHODS）属于静态元数据，不入库。
 *              主要导出：useBookStore，提供账本增改、当前账本切换、
 *              预算设置与支付方式元数据查询。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";

/** 支付方式展示元数据（简称 / 主题色 / 浅底色），统计页头像与流水页配色的唯一来源 */
const PAY_META = {
  微信支付: { short: "微", color: "#07c160", bg: "#e7f8ef" },
  支付宝: { short: "支", color: "#1677ff", bg: "#e8f2ff" },
  信用卡: { short: "信", color: "#ff7d00", bg: "#fff2e3" },
  储蓄卡: { short: "卡", color: "#5a6072", bg: "#eef0f5" },
  现金: { short: "现", color: "#f2994a", bg: "#fdf2e4" },
};

/** 收付款方式名称字典（运行时可扩展），记账页选项与账单合法性校验均以此为准 */
const PAY_METHODS = ["现金", "微信支付", "支付宝", "信用卡", "储蓄卡"];

/**
 * 生成内置默认账本（首次安装 / 持久化数据损坏时的种子数据）
 * @returns {import('@/store/types').Book[]}
 */
function createDefaultBooks() {
  return [{ id: "book_1", name: "个人账本", budget: 0 }];
}

export const useBookStore = defineStore(
  "book",
  () => {
    /** @type {import('vue').Ref<import('@/store/types').Book[]>} */
    const books = ref(createDefaultBooks());
    const activeBookId = ref("book_1");
    /** 收付款方式选项（运行时字典） */
    const payMethods = ref(PAY_METHODS.slice());

    const activeBook = computed(
      () =>
        books.value.find(b => b.id === activeBookId.value) ||
        books.value[0] || { id: "", name: "默认账本", budget: 0 },
    );

    /**
     * @param {string} id
     * @returns {import('@/store/types').Book | undefined}
     */
    function getBook(id) {
      return books.value.find(b => b.id === id);
    }

    /**
     * 支付方式元数据，找不到时返回安全兜底
     * @param {string} name
     */
    function getPayMeta(name) {
      return PAY_META[name] || { short: "其", color: "#8a8f9c", bg: "#f1f2f7" };
    }

    /**
     * 切换当前账本
     * @param {string} id
     */
    function setActiveBook(id) {
      if (books.value.some(b => b.id === id)) activeBookId.value = id;
    }

    /**
     * 新增账本
     * @param {{name: string, budget?: number}} input
     * @returns {import('@/store/types').Book}
     */
    function addBook({ name, budget = 0 }) {
      const book = {
        id: `book_${Date.now().toString(36)}`,
        name: String(name || "新账本").slice(0, 12),
        budget: Math.max(0, Number(budget) || 0),
      };
      books.value.push(book);
      return book;
    }

    /**
     * 更新账本（名称 / 预算）
     * @param {string} id
     * @param {Partial<Pick<import('@/store/types').Book,'name'|'budget'>>} patch
     */
    function updateBook(id, patch) {
      const book = getBook(id);
      if (!book) return;
      if (typeof patch.name === "string" && patch.name.trim()) {
        book.name = patch.name.trim().slice(0, 12);
      }
      if (patch.budget !== undefined) {
        book.budget = Math.max(0, Number(patch.budget) || 0);
      }
    }

    /**
     * 直接设置当前账本月预算
     * @param {number} budget
     */
    function setBudget(budget) {
      updateBook(activeBook.value.id, { budget });
    }

    return {
      books,
      activeBookId,
      payMethods,
      activeBook,
      getBook,
      getPayMeta,
      setActiveBook,
      addBook,
      updateBook,
      setBudget,
    };
  },
  {
    persist: {
      key: "book",
      version: 1,
      // 静态字典 payMethods 不入库，只持久化真正的业务数据
      paths: ["books", "activeBookId"],
      // 迁移示例：v0 版本的预算字段可能叫 monthBudget，这里重命名为 budget
      migrations: {
        0: saved => {
          if (Array.isArray(saved?.books)) {
            saved.books.forEach(b => {
              if (b.budget === undefined && b.monthBudget !== undefined) {
                b.budget = b.monthBudget;
                delete b.monthBudget;
              }
            });
          }
          return saved;
        },
      },
    },
  },
);
