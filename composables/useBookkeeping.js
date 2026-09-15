/**
 * @file 记账业务组合式 API（Composables 层）
 * @description 把「多 store 联动 + 视图模型拼装 + 跨页事件通信」收口到这一层，
 *              页面只关心渲染与交互，不直接跨多个 store 取数。
 *              按页面划分的功能模块：
 *              1. useStores：一次性获取全部 store（复杂场景用）；
 *              2. useHomeData：首页本月统计卡 + 今日流水 + 预算设置；
 *              3. useFlowingData：流水页月份 / 类型筛选（与 app store 双向联动）；
 *              4. useStatisticsData：统计页分类 / 支付方式排行与月汇总；
 *              5. useBillForm：记账页默认表单（记忆上次选择）+ 新增 / 编辑保存；
 *              6. useBillDetail：详情页经 eventChannel 按 id 装载与删除；
 *              7. useProfile：我的页资料编辑与跨模块统计；
 *              8. onBillChange / goBillDetail：账单变更订阅与详情跳转的通用入口。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { computed, ref } from "vue";
import { onUnload } from "@dcloudio/uni-app";
import {
  useAppStore,
  useBillStore,
  useBookStore,
  useCategoryStore,
  useUserStore,
  BILL_CHANGE_EVENT,
  fmtMoney,
  round2,
} from "@/store";
import { currentMonth, todayStr, formatMD } from "@/utils/date";
import { fileToBase64 } from "@/utils/image";

/**
 * 一次拿到全部 store（少数复杂页面使用；普通页面优先使用下方按页拆分的 composable）
 * @returns {{app: object, bill: object, book: object, category: object, user: object}}
 *          分别为 app / bill / book / category / user 五个 store 实例
 */
export function useStores() {
  return {
    app: useAppStore(),
    bill: useBillStore(),
    book: useBookStore(),
    category: useCategoryStore(),
    user: useUserStore(),
  };
}

/* -------------------------------------------------------------
 * 首页：本月统计卡 + 今日流水
 * ----------------------------------------------------------- */
/**
 * 首页数据：本月收支 / 预算 / 结余 / 预算进度、今日流水与当日收支、
 * 用户昵称与今日日期，以及弹窗设置当月预算的动作 editBudget。
 * 月份固定取当前系统月；所有金额均以两位小数字符串输出供模板直接渲染。
 * @returns {object} 含 stats / flowList / todayExpense / todayIncome /
 *                   userName / todayDate / editBudget
 */
export function useHomeData() {
  const billStore = useBillStore();
  const bookStore = useBookStore();
  const userStore = useUserStore();

  const month = currentMonth();
  const summary = computed(() => billStore.monthSummary(month));
  const budget = computed(() => Number(bookStore.activeBook.budget) || 0);

  /** 首页统计卡（字符串金额 + 预算进度，直接对接模板） */
  const stats = computed(() => {
    const s = summary.value;
    return {
      expense: fmtMoney(s.expense),
      income: fmtMoney(s.income),
      budget: fmtMoney(budget.value),
      balance: fmtMoney(s.balance),
      progress:
        budget.value > 0
          ? Math.min(100, round2((s.expense / budget.value) * 100))
          : 0,
    };
  });

  /** 今日流水（带符号金额的视图模型，按时间倒序） */
  const flowList = computed(() => billStore.todayViewModels);

  const todayExpense = computed(() =>
    fmtMoney(
      flowList.value.reduce(
        (sum, i) => (i.amount < 0 ? sum + Math.abs(i.amount) : sum),
        0,
      ),
    ),
  );
  const todayIncome = computed(() =>
    fmtMoney(
      flowList.value.reduce(
        (sum, i) => (i.amount > 0 ? sum + i.amount : sum),
        0,
      ),
    ),
  );

  const userName = computed(() => userStore.name);
  const todayDate = computed(() => formatMD(todayStr()));

  /** 弹窗设置当月预算 */
  function editBudget() {
    uni.showModal({
      title: "设置本月预算",
      editable: true,
      placeholderText: "请输入预算金额",
      content: budget.value > 0 ? String(budget.value) : "",
      success: res => {
        if (res.confirm) {
          const value = Number(res.content);
          if (value > 0) {
            bookStore.setBudget(round2(value));
            uni.showToast({ title: "预算已更新", icon: "success" });
          } else if (res.content) {
            uni.showToast({ title: "金额需大于 0", icon: "none" });
          }
        }
      },
    });
  }

  return {
    stats,
    flowList,
    todayExpense,
    todayIncome,
    userName,
    todayDate,
    editBudget,
  };
}

/* -------------------------------------------------------------
 * 流水页：月份 / 类型筛选（与 app store 双向联动、可持久化）
 * ----------------------------------------------------------- */
/**
 * 流水页数据：月份与类型用可写 computed 双向绑定 app store（切换后自动持久化），
 * groups 为按天分组的流水，monthCard 为当月支出 / 收入汇总，三者均实时派生。
 * @returns {object} 含 currentMonth / currentType（可写 Ref）/ groups / monthCard
 */
export function useFlowingData() {
  const appStore = useAppStore();
  const billStore = useBillStore();

  const currentMonth = computed({
    get: () => appStore.ui.flowMonth,
    set: value => appStore.setFlowMonth(value),
  });
  const currentType = computed({
    get: () => appStore.ui.flowType,
    set: value => appStore.setFlowType(value),
  });

  const groups = computed(() =>
    billStore.groupedByDay(appStore.ui.flowMonth, appStore.ui.flowType),
  );

  const monthCard = computed(() => {
    const s = billStore.monthSummary(appStore.ui.flowMonth);
    return {
      expense: fmtMoney(s.expense),
      income: fmtMoney(s.income),
    };
  });

  return { currentMonth, currentType, groups, monthCard };
}

/* -------------------------------------------------------------
 * 统计页：分类排行 / 支付方式排行 / 当月汇总
 * ----------------------------------------------------------- */
/**
 * 统计页数据：分类聚合、支出支付方式聚合、当月汇总均由 bill store 实时计算，
 * 另产出 flatBills（与旧 mock 同构的扁平账单）兼容页面历史计算逻辑。
 * @param {import('vue').Ref<string>} monthRef 选中月份 'YYYY-MM'
 * @param {import('vue').Ref<import('@/store/types').BillType>} typeRef 收支类型
 * @returns {object} 含 flatBills / categoryStats / payStats / summary
 */
export function useStatisticsData(monthRef, typeRef) {
  const billStore = useBillStore();

  /** 与旧 mock 同构的扁平账单，便于复用页面既有计算逻辑 */
  const flatBills = computed(() =>
    billStore.billsOfMonth(monthRef.value).map(b => ({
      type: b.type,
      day: b.date.slice(5),
      category: b.category,
      amount: b.amount,
      payMethod: b.payMethod,
    })),
  );

  const categoryStats = computed(() =>
    billStore.monthCategoryStats(monthRef.value, typeRef.value),
  );
  const payStats = computed(() => billStore.monthPayStats(monthRef.value));
  const summary = computed(() => billStore.monthSummary(monthRef.value));

  return { flatBills, categoryStats, payStats, summary };
}

/* -------------------------------------------------------------
 * 记账页：默认表单（记忆上次选择）+ 保存
 * ----------------------------------------------------------- */
/**
 * 记账页表单逻辑：remembered 提供上次记账的收支方向 / 支付方式 / 分类（来自 app store），
 * loadBillForEdit 按 id 回填编辑数据，saveBill 统一处理新增与更新并回写记忆。
 * @returns {object} 含 remembered（ComputedRef）/ saveBill / loadBillForEdit
 */
export function useBillForm() {
  const appStore = useAppStore();
  const billStore = useBillStore();

  const remembered = computed(() => ({
    type: appStore.ui.lastBillType,
    payMethod: appStore.ui.lastPayMethod,
    category: appStore.ui.lastCategory[appStore.ui.lastBillType] || "其他",
  }));

  /**
   * 编辑模式：按 id 读取原始账单用于表单回填
   * @param {string} id
   * @returns {import('@/store/types').Bill | null}
   */
  function loadBillForEdit(id) {
    return billStore.getById(id);
  }

  /**
   * 保存一张账单；editId 存在时为更新该账单，否则新增
   * 失败时返回错误信息，由页面决定提示方式
   * @param {import('@/store/types').BillInput} input
   * @param {string} [editId] 编辑模式下的账单 id
   * @returns {{ ok: boolean, error?: string, bill?: import('@/store/types').Bill }}
   */
  function saveBill(input, editId) {
    try {
      const bill = editId
        ? billStore.updateBill(editId, input)
        : billStore.addBill(input);
      if (!bill) return { ok: false, error: "账单不存在或已被删除" };
      appStore.rememberBillForm({
        type: bill.type,
        category: bill.category,
        payMethod: bill.payMethod,
      });
      return { ok: true, bill };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "保存失败" };
    }
  }

  return { remembered, saveBill, loadBillForEdit };
}

/* -------------------------------------------------------------
 * 详情页：通过 eventChannel 的 id 装载账单详情
 * ----------------------------------------------------------- */
/**
 * 详情页数据：通过上一页 eventChannel 传来的 id 从 bill store 装载详情视图模型，
 * 订阅账单变更事件实现编辑返回后自动刷新，并提供删除当前账单的动作。
 * @returns {object} 含 detail（Ref，未载入为 null）/ currentId /
 *                   loadFromChannel / removeCurrent
 */
export function useBillDetail() {
  const billStore = useBillStore();
  const userStore = useUserStore();

  /**
   * 账单详情视图模型（含账本名/记录时间/当月截止支出），未载入时为 null
   * @type {import('vue').Ref<(import('@/store/types').BillViewModel & {
   *   bookName: string, recordTime: string, monthExpense: string,
   *   recorder?: string
   * }) | null>}
   */
  const detail = ref(null);
  const currentId = ref("");

  /** 按 id 重新装载详情视图模型 */
  function reload(id) {
    const found = billStore.detailById(id);
    if (found) detail.value = { ...found, recorder: userStore.name };
  }

  /** 在页面 onLoad 中调用，自动从上一页 eventChannel 读取 { id } */
  function loadFromChannel() {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const eventChannel = page?.getOpenerEventChannel?.();
    eventChannel?.on("billData", data => {
      if (data?.id) {
        const found = billStore.detailById(data.id);
        if (found) {
          currentId.value = data.id;
          detail.value = { ...found, recorder: userStore.name };
        }
      }
    });
  }

  // 编辑保存后返回详情页时自动刷新
  onBillChange(({ id }) => {
    if (id === currentId.value) reload(id);
  });

  /** @returns {boolean} */
  function removeCurrent() {
    if (!currentId.value) return false;
    return billStore.removeBill(currentId.value);
  }

  return { detail, currentId, loadFromChannel, removeCurrent };
}

/* -------------------------------------------------------------
 * 我的页：资料 + 跨模块统计
 * ----------------------------------------------------------- */
/**
 * 我的页数据：用户资料、加入天数与跨模块记账统计（bill + book 实时派生），
 * 以及弹窗修改昵称 editName、选择头像 changeAvatar 两个异步动作。
 * @returns {object} 含 profile / joinDays / stats（均为 ComputedRef）/
 *                   editName / changeAvatar / userStore
 */
export function useProfile() {
  const userStore = useUserStore();

  const profile = computed(() => userStore.profile);
  // 头像走 store 的归一化 getter：脏值（空串 / "null" / 历史异常值）自动回退默认头像
  const avatar = computed(() => userStore.avatar);
  const joinDays = computed(() => userStore.joinDays);
  const stats = computed(() => userStore.bookkeepingStats);

  /** 弹窗修改昵称 */
  function editName() {
    return new Promise(resolve => {
      uni.showModal({
        title: "修改昵称",
        editable: true,
        content: userStore.profile.name,
        success: res => {
          if (res.confirm && res.content) {
            userStore.updateProfile({ name: res.content });
            resolve(true);
          }
          resolve(false);
        },
        fail: () => resolve(false),
      });
    });
  }

  /** 选择头像并转 base64 写入 store 持久化 */
  function changeAvatar() {
    return new Promise(resolve => {
      uni.chooseImage({
        count: 1,
        success: async res => {
          const path = res.tempFilePaths?.[0];
          if (!path) {
            resolve(null);
            return;
          }
          try {
            const base64 = await fileToBase64(path);
            userStore.updateProfile({ avatar: base64 });
            resolve(base64);
          } catch {
            // 转换失败时回退临时路径，保证流程不中断
            userStore.updateProfile({ avatar: path });
            resolve(path);
          }
        },
        fail: () => resolve(null),
      });
    });
  }

  return {
    profile,
    avatar,
    joinDays,
    stats,
    editName,
    changeAvatar,
    userStore,
  };
}

/* -------------------------------------------------------------
 * 账单变更事件（跨页面 / 跨模块的命令式通信）
 * ----------------------------------------------------------- */

/**
 * 订阅账单增删改事件，页面卸载时自动解绑，避免重复监听与内存泄漏
 * @param {(payload: {action: string, id?: string, bill?: import('@/store/types').Bill}) => void} handler
 */
export function onBillChange(handler) {
  uni.$on(BILL_CHANGE_EVENT, handler);
  onUnload(() => {
    uni.$off(BILL_CHANGE_EVENT, handler);
  });
}

/**
 * 跳转账单详情（统一的跨页传参入口，只传 id，详情页自行从 store 取数）
 * @param {string} id
 */
export function goBillDetail(id) {
  uni.navigateTo({
    url: "/pages/detail/index",
    success: res => {
      res.eventChannel.emit("billData", { id });
    },
  });
}
