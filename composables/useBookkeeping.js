/**
 * @file 记账业务组合式 API（Composables 层）
 * @description 改造为基于服务端接口：Pinia store 退化为接口数据缓存，本层负责
 *              按页面拉取接口数据并拼装视图模型，页面只关心渲染与交互。
 *              按页面划分的功能模块：
 *              1. useStores：一次性获取全部 store（复杂场景用）；
 *              2. useHomeData：首页聚合（GET /overview/home）；
 *              3. useFlowingData：流水页（GET /bills 分页 + /bills/summary）；
 *              4. useStatisticsData：统计页（statistics 系列接口）；
 *              5. useBillForm：记账页（GET/POST/PATCH /bills，POST /uploads/image）；
 *              6. useBillDetail：详情页（GET /bills/:id，DELETE）；
 *              7. useProfile：我的页（PATCH /users/me，POST /users/me/avatar，GET /users/me/stats）；
 *              8. onBillChange / goBillDetail：账单变更订阅与详情跳转的通用入口。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-10-11
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
import { todayStr, formatMD, dayLabel } from "@/utils/date";

/**
 * 模块内自增请求序号：每次发起加载时记下当前序号（reqId），回包后与最新序号
 * 比对，不一致说明期间已发起了更新的加载，本次旧响应整体作废丢弃（不清
 * loading 之外的任何状态），从根本上消除快速切月 / 切类型时的请求竞态。
 */
let reqSeq = 0;

/**
 * 对选中的图片做二次压缩（quality 80），用于减小上传体积；
 * 平台不支持或压缩失败时回退原图路径，不阻断上传流程。
 * @param {string} filePath 选图得到的临时文件路径
 * @returns {Promise<string>} 压缩后的临时文件路径（失败则为原路径）
 */
export function compressPhoto(filePath) {
  return new Promise(resolve => {
    uni.compressImage({
      src: filePath,
      quality: 80,
      success: res => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath), // 压缩失败回退原图，不阻断上传
    });
  });
}

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
    payMethodId: b.payMethodId,
    type: b.type,
    category: b.category,
    categoryId: b.categoryId,
    remark: b.remark,
    // 兼容两种口径：列表接口 photos 为签名 URL 字符串数组；详情为 {key,url} 对象数组
    photos: (b.photos || []).map(p =>
      typeof p === "string"
        ? { key: "", url: normalizeFileUrl(p) }
        : { key: p?.key || "", url: normalizeFileUrl(p?.url) },
    ),
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
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = ++reqSeq;
    loading.value = true;
    try {
      const data = await statisticsApi.home();
      if (reqId !== reqSeq) return; // 已有更新的请求，丢弃本次旧响应
      home.value = data;
    } finally {
      // 仅当仍是最新请求时才收 loading，避免提前关闭新请求的加载态
      if (reqId === reqSeq) loading.value = false;
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
 * 流水页：月份 / 类型筛选 + 按天分组（GET /bills 分页 + /bills/summary）
 * ----------------------------------------------------------- */
/** 流水页每页条数（触底分页加载） */
const FLOW_PAGE_SIZE = 50;

/**
 * 流水页数据：currentMonth/currentType 双向绑定 app store（持久化）；
 * groups 为按天分组流水（分页加载、新页按日合并），monthCard 为当月收支汇总
 * （来自 /bills/summary，不随分页截断，始终是该月完整口径）。
 * load() 拉取第一页并重置分页；loadMore() 触底加载下一页；均带序号防竞态。
 * keyword 为搜索关键字（非空时透传 billsApi.list 的 keyword 参数），变化后由页面防抖调 load()。
 * @returns {object} currentMonth / currentType（可写 Ref）/ keyword / groups /
 *                   monthCard / load / loadMore / loading / loadingMore / finished
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
  /** 分页状态：当前已加载页码 / 触底加载中 / 是否已加载全部 */
  const page = ref(1);
  const loadingMore = ref(false);
  const finished = ref(false);
  /** 搜索关键字（空串表示未搜索）；写入后由页面防抖调用 load() 从第一页重查 */
  const keyword = ref("");

  /** 类型文案 → 服务端 type 参数 */
  const TYPE_MAP = {
    全部类型: "ALL",
    支出: "expense",
    收入: "income",
  };

  /**
   * 新建一个按日分组结构（格式对齐原 GET /bills/grouped 的 groups 项）
   * @param {string} recordDate 'YYYY-MM-DD'
   * @returns {object}
   */
  function createGroup(recordDate) {
    return {
      day: dayLabel(recordDate),
      date: formatMD(recordDate),
      recordDate,
      // 原始数值用于跨页累加，expense/income 为格式化后的展示文案
      expenseRaw: 0,
      incomeRaw: 0,
      expense: "0.00",
      income: "0.00",
      items: [],
    };
  }

  /**
   * 把账单（toBillVM 后、按日期倒序）按日合并进分组数组：
   * 已存在的日期追加条目并累加日合计；全新日期在尾部新建分组。
   * 注意：分页后日合计只对已加载页累加，若某天的记录被页边界截断，
   * 该组合计为「已加载部分」口径（月卡汇总仍用 /bills/summary 完整数据）。
   * @param {object[]} list 分组数组（原地修改）
   * @param {object[]} items 账单视图模型数组
   */
  function mergeIntoGroups(list, items) {
    for (const item of items) {
      let grp = list.find(g => g.recordDate === item.date);
      if (!grp) {
        grp = createGroup(item.date);
        list.push(grp);
      }
      grp.items.push(item);
      if (item.amount > 0) grp.incomeRaw += item.amount;
      else grp.expenseRaw += -item.amount;
      grp.expense = fmtMoney(round2(grp.expenseRaw));
      grp.income = fmtMoney(round2(grp.incomeRaw));
    }
  }

  /** 拉取第一页并重置分页（切月 / 切类型 / 关键词变化 / 下拉刷新 / onShow 走这里） */
  async function load() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = ++reqSeq;
    loading.value = true;
    page.value = 1;
    finished.value = false;
    loadingMore.value = false;
    try {
      const type = TYPE_MAP[appStore.ui.flowType] || "ALL";
      const month = appStore.ui.flowMonth;
      const kw = keyword.value.trim();
      const [res, s] = await Promise.all([
        // 关键字非空才透传 keyword，避免无意义的空参
        billsApi.list({
          month,
          type,
          page: 1,
          pageSize: FLOW_PAGE_SIZE,
          ...(kw ? { keyword: kw } : {}),
        }),
        billsApi.summary({ month }),
      ]);
      if (reqId !== reqSeq) return; // 已有更新的请求，丢弃本次旧响应
      const items = (res?.list || []).map(toBillVM);
      groups.value = [];
      mergeIntoGroups(groups.value, items);
      monthCard.value = {
        expense: fmtMoney(Number(s?.expense) || 0),
        income: fmtMoney(Number(s?.income) || 0),
      };
      if (items.length < FLOW_PAGE_SIZE) finished.value = true;
    } finally {
      if (reqId === reqSeq) loading.value = false;
    }
  }

  /** 触底加载下一页：按日合并进现有分组；失败保持未完成态，下次触底自动重试 */
  async function loadMore() {
    if (loading.value || loadingMore.value || finished.value) return;
    loadingMore.value = true;
    const reqId = ++reqSeq;
    try {
      const type = TYPE_MAP[appStore.ui.flowType] || "ALL";
      const month = appStore.ui.flowMonth;
      const kw = keyword.value.trim();
      const next = page.value + 1;
      const res = await billsApi
        .list({
          month,
          type,
          page: next,
          pageSize: FLOW_PAGE_SIZE,
          ...(kw ? { keyword: kw } : {}),
        })
        .catch(() => null);
      if (reqId !== reqSeq) return; // 已被更新的请求作废
      if (!res) return; // 拉取失败：不推进页码，等待下次触底重试
      const items = (res?.list || []).map(toBillVM);
      mergeIntoGroups(groups.value, items);
      page.value = next;
      if (items.length < FLOW_PAGE_SIZE) finished.value = true;
    } finally {
      loadingMore.value = false;
    }
  }

  return {
    currentMonth,
    currentType,
    keyword,
    groups,
    monthCard,
    load,
    loadMore,
    loading,
    loadingMore,
    finished,
  };
}

/* -------------------------------------------------------------
 * 统计页：分类 / 支付方式排行 + 月度概览
 * ----------------------------------------------------------- */
/**
 * 统计页数据：调 statistics 系列接口；period/type 改变时由页面 watch 调 load()。
 * @param {import('vue').Ref<{month?: string, year?: string}>} periodRef
 *        时间范围：{ month: 'YYYY-MM' } 单月 或 { year: 'YYYY' } 整年（二选一）
 * @param {import('vue').Ref<import('@/store/types').BillType>} typeRef
 * @returns {object} overview / categoryStats / payStats / overviewError /
 *                   load / loading
 */
export function useStatisticsData(periodRef, typeRef) {
  const overview = ref(null);
  const categoryStats = ref([]);
  const payStats = ref([]);
  const loading = ref(false);
  /** 概览接口是否失败（页面据此展示「加载失败，点击重试」，不再静默显示 ¥0） */
  const overviewError = ref(false);

  async function load() {
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = ++reqSeq;
    loading.value = true;
    overviewError.value = false;
    try {
      const period = periodRef.value || {};
      const base = period.year
        ? { year: period.year }
        : { month: period.month };
      const type = typeRef.value;
      const [ov, cats, pays] = await Promise.all([
        // 概览失败置错误态交由页面展示重试入口；旧请求失败不污染新请求状态
        statisticsApi.overview({ ...base, type }).catch(() => {
          if (reqId === reqSeq) overviewError.value = true;
          return null;
        }),
        statisticsApi.categories({ ...base, type }).catch(() => ({ list: [] })),
        type === "expense"
          ? statisticsApi.payMethods({ ...base }).catch(() => ({ list: [] }))
          : Promise.resolve({ list: [] }),
      ]);
      if (reqId !== reqSeq) return; // 已有更新的请求，丢弃本次旧响应
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

  return { overview, categoryStats, payStats, overviewError, load, loading };
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
    // 允许新请求直接发出（不再因 loading 中而丢弃），旧响应靠序号比对作废
    const reqId = ++reqSeq;
    loading.value = true;
    try {
      const year = yearRef?.value;
      const res = await statisticsApi.trend(year ? { year } : { months });
      if (reqId !== reqSeq) return; // 已有更新的请求，丢弃本次旧响应
      trend.value = (res?.list || []).map(i => ({
        month: i.month,
        label: i.label,
        expense: Number(i.expense) || 0,
        income: Number(i.income) || 0,
      }));
    } catch {
      // 仅最新请求失败时才清空，避免旧请求失败污染新请求的数据
      if (reqId === reqSeq) trend.value = [];
    } finally {
      if (reqId === reqSeq) loading.value = false;
    }
  }

  return { trend, loadTrend, loading };
}

/* -------------------------------------------------------------
 * 记账页：默认表单（记忆）+ 编辑回填 + 保存（POST/PATCH /bills）
 * ----------------------------------------------------------- */
/**
 * 记账页表单逻辑：remembered 为上次记账记忆（分类 / 支付方式存 id，失效时由
 * 记账页回退默认项）；loadBillForEdit(id) 调 GET /bills/:id 回填；saveBill 调
 * POST/PATCH /bills，photos 为已上传的 key 数组。
 * @returns {object} remembered / saveBill / loadBillForEdit / uploadPhoto
 */
export function useBillForm() {
  const appStore = useAppStore();
  const billStore = useBillStore();

  // 上次记账记忆：按 id 存储（分类 id 随收支方向分开记忆）
  const remembered = computed(() => ({
    type: appStore.ui.lastBillType,
    categoryId: appStore.ui.lastCategory[appStore.ui.lastBillType] || "",
    payMethodId: appStore.ui.lastPayMethod || "",
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
      // 记忆上次选择（存 id，按 id 匹配字典，分类 / 支付方式被改名后仍可命中）
      appStore.rememberBillForm({
        type: input.type,
        categoryId: input.categoryId,
        payMethodId: input.payMethodId,
      });
      return { ok: true, bill };
    } catch (e) {
      return {
        ok: false,
        error: e?.message || "保存失败",
      };
    }
  }

  return {
    remembered,
    saveBill,
    loadBillForEdit,
    uploadPhoto,
  };
}

/* -------------------------------------------------------------
 * 详情页：GET /bills/:id + DELETE
 * ----------------------------------------------------------- */
/**
 * 详情页数据：loadFromChannel 优先取页面 query 中的 id（分享落地 / H5 刷新 /
 * 深链直达场景），缺省再从上一页 eventChannel 兜底，之后异步拉详情；
 * 订阅账单变更事件实现编辑返回后自动刷新；removeCurrent 调 DELETE。
 * 状态三态：detail 有值 → 正常渲染；detailLoading → 加载中；
 * detailError → 加载失败或账单不存在（页面据此展示「重试 / 返回」）。
 * @returns {object} detail / currentId / detailLoading / detailError /
 *                   loadFromChannel / removeCurrent / reload
 */
export function useBillDetail() {
  const billStore = useBillStore();

  /**
   * @type {import('vue').Ref<object|null>}
   */
  const detail = ref(null);
  const currentId = ref("");
  /** 详情是否加载中（首屏与重拉共用） */
  const detailLoading = ref(true);
  /** 详情加载失败 / 账单不存在的终态（与「加载中」互斥） */
  const detailError = ref(false);

  /** 按 id 重新拉取详情（失败置 detailError，由页面展示重试 / 返回） */
  async function reload(id) {
    if (!id) return;
    detailLoading.value = true;
    try {
      const d = await billsApi.getOne(id);
      currentId.value = id;
      if (d) {
        detail.value = {
          ...toBillVM(d),
          // 补充详情扩展字段
          bookId: d.bookId,
          bookName: d.bookName,
          recorder: d.recorder,
          recordTime: d.recordTime,
          monthExpense: fmtMoney(Number(d.monthExpense) || 0),
        };
        detailError.value = false;
      } else {
        // 服务端返回空：视为账单不存在
        detail.value = null;
        detailError.value = true;
      }
    } catch {
      // 拉取失败（含账单已不存在）：进入错误态，不再与「加载中」混用文案
      detail.value = null;
      detailError.value = true;
    } finally {
      detailLoading.value = false;
    }
  }

  /**
   * 在页面 onLoad 中调用：优先取 query 的 id，无 query id 时兜底从
   * 上一页 eventChannel 读取 { id }（eventChannel 保留作大对象传参优化）
   * @param {object} [options] onLoad 入参（query）
   */
  function loadFromChannel(options) {
    if (options?.id) {
      reload(options.id);
      return;
    }
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const eventChannel = page?.getOpenerEventChannel?.();
    if (eventChannel) {
      eventChannel.on("billData", data => {
        if (data?.id) reload(data.id);
      });
    } else {
      // 深链无 id 且无 eventChannel：直接进入错误态，避免永久 loading
      detailError.value = true;
      detailLoading.value = false;
    }
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

  /**
   * 删除当前账单（调 DELETE /bills/:id）
   * 失败时抛错且不清空本地态，由页面决定停留或跳转（http 层已统一 toast）
   */
  async function removeCurrent() {
    if (!currentId.value) return false;
    await billStore.removeBill(currentId.value);
    return true;
  }

  return {
    detail,
    currentId,
    detailLoading,
    detailError,
    loadFromChannel,
    removeCurrent,
    reload,
  };
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
        sizeType: ["compressed"], // 选图阶段先走系统压缩
        success: async res => {
          const path = res.tempFilePaths?.[0];
          if (!path) {
            resolve(null);
            return;
          }
          uni.showLoading({ title: "上传中", mask: true });
          try {
            // 二次压缩（quality 80），失败回退原图，不阻断上传
            const src = await compressPhoto(path);
            const url = await userStore.changeAvatar(src);
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
 * 「再记一笔」预填数据的 storage 中转 key：详情页写入（金额/类型/分类/支付方式/备注），
 * 记账页 onLoad 读取后立即清除，用 storage 中转避免 eventChannel 的时序问题。
 */
export const BILL_PREFILL_KEY = "bk:bill_prefill";

/**
 * 跳转账单详情：query 统一携带 id（支持分享落地 / H5 刷新 / 深链直达），
 * 同时保留 eventChannel 传参兜底（详情页有 query id 时不依赖 eventChannel）
 * @param {string} id
 */
export function goBillDetail(id) {
  uni.navigateTo({
    url: `/pages/detail/index?id=${id}`,
    success: res => {
      res.eventChannel.emit("billData", { id });
    },
  });
}
