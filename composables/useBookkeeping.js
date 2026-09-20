/**
 * @file 记账业务组合式 API（Composables 层）
 * @description 改造为基于服务端接口：Pinia store 退化为接口数据缓存，本层负责
 *              按页面拉取接口数据并拼装视图模型，页面只关心渲染与交互。
 *              按页面划分的功能模块：
 *              1. useStores：一次性获取全部 store（复杂场景用）；
 *              2. useHomeData：首页聚合（GET /overview/home）；
 *              3. useFlowingData：流水页（GET /bills/grouped + /bills/summary）；
 *              4. useStatisticsData：统计页（statistics 系列接口）；
 *              5. useBillForm：记账页（GET/POST/PATCH /bills，POST /uploads/image）；
 *              6. useBillDetail：详情页（GET /bills/:id，DELETE）；
 *              7. useProfile：我的页（PATCH /users/me，POST /users/me/avatar，GET /users/me/stats）；
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
import { billsApi, statisticsApi, uploadsApi } from "@/api";
import { normalizeFileUrl } from "@/api";
import { todayStr, formatMD } from "@/utils/date";

/**
 * 把服务端 BillVM 映射为列表视图模型（字段名对齐原 BillViewModel）
 * @param {object} b 服务端账单
 * @returns {object}
 */
function toBillVM(b) {
  return {
    id: b.id,
    title: b.category,
    iconText: b.iconText,
    iconColor: b.iconColor,
    iconBg: b.iconBg,
    amount: Number(b.amount) || 0, // 已带符号
    date: b.date,
    time: b.time,
    payMethod: b.payMethod,
    type: b.type,
    category: b.category,
    remark: b.remark,
    photos: (b.photos || []).map(normalizeFileUrl),
  };
}

/**
 * 一次拿到全部 store（少数复杂页面使用；普通页面优先使用下方按页拆分的 composable）
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
 * 首页：本月统计卡 + 今日流水（GET /overview/home 聚合）
 * ----------------------------------------------------------- */
/**
 * 首页数据：调 GET /overview/home 一次聚合，返回 ref；load() 供页面 onShow 调用。
 * @returns {object} stats / flowList / todayExpense / todayIncome / userName /
 *                   todayDate / editBudget / load / loading
 */
export function useHomeData() {
  const userStore = useUserStore();
  const bookStore = useBookStore();
  const home = ref(null);
  const loading = ref(false);

  async function load() {
    if (loading.value) return;
    loading.value = true;
    try {
      home.value = await statisticsApi.home();
    } finally {
      loading.value = false;
    }
  }

  const stats = computed(() => {
    const h = home.value;
    if (!h) {
      return {
        expense: "0.00",
        income: "0.00",
        budget: "0.00",
        balance: "0.00",
        progress: 0,
        overBudget: false,
      };
    }
    const m = h.month || {};
    const b = h.budget || {};
    const budget = Number(b.budget) || 0;
    const expense = Number(m.expense) || 0;
    const income = Number(m.income) || 0;
    return {
      expense: fmtMoney(expense),
      income: fmtMoney(income),
      budget: fmtMoney(budget),
      balance: fmtMoney(income - expense),
      progress:
        budget > 0 ? Math.min(100, round2((expense / budget) * 100)) : 0,
      overBudget: !!b.overBudget,
    };
  });

  const flowList = computed(() => {
    const t = home.value?.today;
    if (!t) return [];
    return (t.list || []).map(toBillVM);
  });

  const todayExpense = computed(() =>
    fmtMoney(Number(home.value?.today?.expense) || 0),
  );
  const todayIncome = computed(() =>
    fmtMoney(Number(home.value?.today?.income) || 0),
  );

  const userName = computed(
    () => home.value?.user?.name || userStore.name || "",
  );
  const todayDate = computed(
    () => home.value?.todayDate || formatMD(todayStr()),
  );

  /** 弹窗设置当月预算（调 PUT /books/:id） */
  function editBudget() {
    const budget = Number(home.value?.budget?.budget) || 0;
    uni.showModal({
      title: "设置本月预算",
      editable: true,
      placeholderText: "请输入预算金额",
      content: budget > 0 ? String(budget) : "",
      success: async res => {
        if (res.confirm) {
          const value = Number(res.content);
          if (value > 0) {
            await bookStore.setBudget(round2(value));
            uni.showToast({ title: "预算已更新", icon: "success" });
            await load();
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
    load,
    loading,
  };
}

/* -------------------------------------------------------------
 * 流水页：月份 / 类型筛选 + 按天分组（GET /bills/grouped + /bills/summary）
 * ----------------------------------------------------------- */
/**
 * 流水页数据：currentMonth/currentType 双向绑定 app store（持久化）；
 * groups 为按天分组流水，monthCard 为当月收支汇总，均由 load() 异步拉取。
 * @returns {object} currentMonth / currentType（可写 Ref）/ groups / monthCard /
 *                   load / loading
 */
export function useFlowingData() {
  const appStore = useAppStore();

  const currentMonth = computed({
    get: () => appStore.ui.flowMonth,
    set: value => appStore.setFlowMonth(value),
  });
  const currentType = computed({
    get: () => appStore.ui.flowType,
    set: value => appStore.setFlowType(value),
  });

  const groups = ref([]);
  const monthCard = ref({ expense: "0.00", income: "0.00" });
  const loading = ref(false);

  /** 类型文案 → 服务端 type 参数 */
  const TYPE_MAP = {
    全部类型: "ALL",
    支出: "expense",
    收入: "income",
  };

  async function load() {
    if (loading.value) return;
    loading.value = true;
    try {
      const type = TYPE_MAP[appStore.ui.flowType] || "ALL";
      const [g, s] = await Promise.all([
        billsApi.grouped({ month: appStore.ui.flowMonth, type }),
        billsApi.summary({ month: appStore.ui.flowMonth }),
      ]);
      groups.value = (g?.groups || []).map(grp => ({
        day: grp.day,
        date: grp.date,
        recordDate: grp.recordDate,
        expense: fmtMoney(grp.expense),
        income: fmtMoney(grp.income),
        items: (grp.items || []).map(toBillVM),
      }));
      monthCard.value = {
        expense: fmtMoney(Number(s?.expense) || 0),
        income: fmtMoney(Number(s?.income) || 0),
      };
    } finally {
      loading.value = false;
    }
  }

  return { currentMonth, currentType, groups, monthCard, load, loading };
}

/* -------------------------------------------------------------
 * 统计页：分类 / 支付方式排行 + 月度概览
 * ----------------------------------------------------------- */
/**
 * 统计页数据：调 statistics 系列接口；period/type 改变时由页面 watch 调 load()。
 * @param {import('vue').Ref<{month?: string, year?: string}>} periodRef
 *        时间范围：{ month: 'YYYY-MM' } 单月 或 { year: 'YYYY' } 整年（二选一）
 * @param {import('vue').Ref<import('@/store/types').BillType>} typeRef
 * @returns {object} overview / categoryStats / payStats / load / loading
 */
export function useStatisticsData(periodRef, typeRef) {
  const overview = ref(null);
  const categoryStats = ref([]);
  const payStats = ref([]);
  const loading = ref(false);

  async function load() {
    if (loading.value) return;
    loading.value = true;
    try {
      const period = periodRef.value || {};
      const base = period.year
        ? { year: period.year }
        : { month: period.month };
      const type = typeRef.value;
      const [ov, cats, pays] = await Promise.all([
        statisticsApi.overview({ ...base, type }).catch(() => null),
        statisticsApi.categories({ ...base, type }).catch(() => ({ list: [] })),
        type === "expense"
          ? statisticsApi.payMethods({ ...base }).catch(() => ({ list: [] }))
          : Promise.resolve({ list: [] }),
      ]);
      overview.value = ov;
      categoryStats.value = (cats?.list || []).map(i => ({
        name: i.name,
        icon: i.icon,
        color: i.color,
        bg: i.bg,
        amount: Number(i.amount) || 0,
        count: Number(i.count) || 0,
        percent: Number(i.percent) || 0,
      }));
      payStats.value = (pays?.list || []).map(i => ({
        name: i.name,
        short: i.shortName,
        color: i.color,
        bg: i.bg,
        amount: Number(i.amount) || 0,
        count: Number(i.count) || 0,
        percent: Number(i.percent) || 0,
      }));
    } finally {
      loading.value = false;
    }
  }

  return { overview, categoryStats, payStats, load, loading };
}

/**
 * 收支趋势（GET /statistics/trend）
 * @param {number} [months=6] 月维度：近 N 个月
 * @param {import('vue').Ref<string|null>} [yearRef] 年维度：传 'YYYY' 时拉取该年 12 个月
 * @returns {{trend: import('vue').Ref<object[]>, loadTrend: Function, loading: import('vue').Ref<boolean>}}
 */
export function useTrendData(months = 6, yearRef = null) {
  const trend = ref([]);
  const loading = ref(false);

  async function loadTrend() {
    if (loading.value) return;
    loading.value = true;
    try {
      const year = yearRef?.value;
      const res = await statisticsApi.trend(year ? { year } : { months });
      trend.value = (res?.list || []).map(i => ({
        month: i.month,
        label: i.label,
        expense: Number(i.expense) || 0,
        income: Number(i.income) || 0,
      }));
    } catch {
      trend.value = [];
    } finally {
      loading.value = false;
    }
  }

  return { trend, loadTrend, loading };
}

/* -------------------------------------------------------------
 * 记账页：默认表单（记忆）+ 编辑回填 + 保存（POST/PATCH /bills）
 * ----------------------------------------------------------- */
/**
 * 记账页表单逻辑：remembered 来自 app store 的本地记忆；loadBillForEdit(id) 调
 * GET /bills/:id 回填；saveBill 调 POST/PATCH /bills，photos 为已上传的 key 数组。
 * @returns {object} remembered / saveBill / loadBillForEdit / uploadPhoto
 */
export function useBillForm() {
  const appStore = useAppStore();
  const billStore = useBillStore();
  const bookStore = useBookStore();
  const categoryStore = useCategoryStore();

  const remembered = computed(() => ({
    type: appStore.ui.lastBillType,
    payMethod: appStore.ui.lastPayMethod,
    category: appStore.ui.lastCategory[appStore.ui.lastBillType] || "其他",
  }));

  /**
   * 编辑模式：调 GET /bills/:id 拉取详情用于表单回填
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async function loadBillForEdit(id) {
    try {
      const bill = await billsApi.getOne(id);
      return bill;
    } catch {
      return null;
    }
  }

  /**
   * 上传凭证图片，返回 {key,url}
   * @param {string} filePath 临时文件路径
   */
  async function uploadPhoto(filePath) {
    return uploadsApi.uploadImage(filePath, "bill");
  }

  /**
   * 保存账单（新增或更新）。
   * 输入字段以服务端口径为准：categoryId / payMethodId / photos(key 数组)。
   * @param {object} input
   * @param {string} [editId]
   * @returns {Promise<{ok:boolean,error?:string,bill?:object}>}
   */
  async function saveBill(input, editId) {
    try {
      const payload = {
        type: input.type,
        amount: input.amount,
        categoryId: input.categoryId,
        payMethodId: input.payMethodId,
        date: input.date,
        time: input.time,
        remark: input.remark,
        photos: input.photos || [],
      };
      const bill = editId
        ? await billStore.updateBill(editId, payload)
        : await billStore.addBill(payload);
      // 记忆上次选择（以 name 存储，便于下次渲染）
      appStore.rememberBillForm({
        type: input.type,
        category: input.category,
        payMethod: input.payMethod,
      });
      return { ok: true, bill };
    } catch (e) {
      return {
        ok: false,
        error: e?.message || "保存失败",
      };
    }
  }

  /**
   * 按 name 反查分类 id
   * @param {string} type
   * @param {string} name
   */
  function getCategoryIdByName(type, name) {
    const list = categoryStore.listByType(type);
    // categoryStore 的 list 项无 id（仅 name/icon/color/bg），需从服务端字典扩展
    // 这里通过 bookStore / categoryStore 的运行时缓存取，但 name 是唯一键，
    // 实际记账页应直接传 id。若 listByType 未含 id，则记账页需用 list 索引 + 接口结果。
    return list.find(i => i.name === name)?.id || "";
  }

  /**
   * 按 name 反查支付方式 id
   * @param {string} name
   */
  function getPayMethodIdByName(name) {
    return bookStore.payMethods.find(p => p.name === name)?.id || "";
  }

  return {
    remembered,
    saveBill,
    loadBillForEdit,
    uploadPhoto,
    getCategoryIdByName,
    getPayMethodIdByName,
  };
}

/* -------------------------------------------------------------
 * 详情页：GET /bills/:id + DELETE
 * ----------------------------------------------------------- */
/**
 * 详情页数据：loadFromChannel 从上一页 eventChannel 取 id 后异步拉详情；
 * 订阅账单变更事件实现编辑返回后自动刷新；removeCurrent 调 DELETE。
 * @returns {object} detail / currentId / loadFromChannel / removeCurrent / reload
 */
export function useBillDetail() {
  const billStore = useBillStore();

  /**
   * @type {import('vue').Ref<object|null>}
   */
  const detail = ref(null);
  const currentId = ref("");

  /** 按 id 重新拉取详情 */
  async function reload(id) {
    if (!id) return;
    try {
      const d = await billsApi.getOne(id);
      currentId.value = id;
      detail.value = d ? toBillVM(d) : null;
      if (d) {
        // 补充详情扩展字段
        detail.value = {
          ...toBillVM(d),
          bookId: d.bookId,
          bookName: d.bookName,
          recorder: d.recorder,
          recordTime: d.recordTime,
          monthExpense: fmtMoney(Number(d.monthExpense) || 0),
        };
      }
    } catch {
      detail.value = null;
    }
  }

  /** 在页面 onLoad 中调用，从上一页 eventChannel 读取 { id } 后异步拉详情 */
  function loadFromChannel() {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const eventChannel = page?.getOpenerEventChannel?.();
    eventChannel?.on("billData", data => {
      if (data?.id) reload(data.id);
    });
  }

  // 账单变更联动：编辑后返回自动刷新；当前账单被删除时仅清空本地态，
  // 不再请求 GET /bills/:id（账单已不存在，否则必然收到 404 并弹错）
  onBillChange(({ action, id }) => {
    if (action === "remove") {
      if (id && id === currentId.value) {
        currentId.value = "";
        detail.value = null;
      }
      return;
    }
    if (id && id === currentId.value) reload(id);
  });

  /** 删除当前账单（调 DELETE /bills/:id） */
  async function removeCurrent() {
    if (!currentId.value) return false;
    await billStore.removeBill(currentId.value);
    return true;
  }

  return { detail, currentId, loadFromChannel, removeCurrent, reload };
}

/* -------------------------------------------------------------
 * 我的页：资料 + 统计（PATCH /users/me、POST /users/me/avatar、GET /users/me/stats）
 * ----------------------------------------------------------- */
/**
 * 我的页数据：profile / avatar / joinDays 来自 user store（接口缓存）；
 * stats 来自 GET /users/me/stats；editName 调 PATCH /users/me；
 * changeAvatar 调 POST /users/me/avatar。
 * @returns {object}
 */
export function useProfile() {
  const userStore = useUserStore();

  const profile = computed(() => userStore.profile);
  const avatar = computed(() => userStore.avatar);
  const joinDays = computed(() => userStore.joinDays);
  const stats = computed(() => userStore.bookkeepingStats);

  /** 弹窗修改昵称（调 PATCH /users/me） */
  function editName() {
    return new Promise(resolve => {
      uni.showModal({
        title: "修改昵称",
        editable: true,
        content: userStore.profile.name,
        success: async res => {
          if (res.confirm && res.content) {
            try {
              await userStore.updateProfile({ name: res.content });
              uni.showToast({ title: "已更新", icon: "success" });
              resolve(true);
            } catch {
              resolve(false);
            }
          }
          resolve(false);
        },
        fail: () => resolve(false),
      });
    });
  }

  /** 选择头像并上传到服务端（POST /users/me/avatar） */
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
          uni.showLoading({ title: "上传中", mask: true });
          try {
            const url = await userStore.changeAvatar(path);
            uni.showToast({ title: "头像已更新", icon: "success" });
            resolve(url);
          } catch {
            resolve(null);
          } finally {
            uni.hideLoading();
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
 * 订阅账单增删改事件，页面卸载时自动解绑
 * @param {(payload: {action: string, id?: string, bill?: object}) => void} handler
 */
export function onBillChange(handler) {
  uni.$on(BILL_CHANGE_EVENT, handler);
  onUnload(() => {
    uni.$off(BILL_CHANGE_EVENT, handler);
  });
}

/**
 * 跳转账单详情（只传 id，详情页自行调接口）
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
