# 状态管理与数据持久化使用文档

本项目基于 **Pinia 2（Vue 3 组合式写法）+ uni-app 存储适配**，实现了按业务模块拆分的状态管理、
跨端自动持久化、模块间状态联动，以及面向页面的组合式 API（composables）。

> 技术栈：uni-app（Vue3，JavaScript + JSDoc）、Pinia 2.3.x
> 兼容平台：iOS App、Android App、H5、各家小程序（uni 同步存储 API 统一适配）

---

## 一、目录结构

```
simple-bookkeeping/
├── main.js                       # 应用入口：// #ifdef VUE3 块内 app.use(pinia)
├── jsconfig.json                 # @/* 路径别名，让 JSDoc 类型在编辑器中可跳转/有提示
├── utils/
│   ├── storage.js                # 跨端存储适配器（uni 存储 → localStorage → 内存兜底）
│   ├── date.js                   # 纯函数日期工具（currentMonth / dayLabel / isSameMonth…）
│   └── rmb.js                    # 原有的人民币工具
├── store/
│   ├── index.js                  # createPinia + 注册持久化插件 + 统一转出出口
│   ├── persist.js                # 自研持久化插件（信封/版本迁移/白名单/容错合并）
│   ├── types.js                  # 全部 JSDoc typedef（.js 中只能用 @typedef，不能写 export type）
│   ├── seed.js                   # （已移除，首次启动账单为空）
│   ├── modules/
│   │   ├── category.js           # 分类字典（支出 9 类 / 收入 7 类，不持久化）
│   │   ├── book.js               # 账本、当前账本、预算、支付方式字典
│   │   ├── bill.js               # 账单（核心数据源）+ 全部查询聚合 + CRUD + 事件广播
│   │   ├── user.js               # 用户资料 + 由 bill/book 实时派生的我的页统计
│   │   └── app.js                # 轻量 UI 选择态（月份、筛选、记账表单记忆）
└── composables/
    └── useBookkeeping.js         # 面向页面的组合式 API（页面优先使用这一层）
```

### 数据流

```
                         ┌───────────────────────────┐
                         │      uni 本地存储           │
                         │ bk:bills / bk:book / ...   │
                         └─────────────▲─────────────┘
                                       │ $subscribe(flush:'sync') 同步落盘
┌───────────┐    读/写    ┌────────────┴────────────┐     派生/互调      ┌──────────────┐
│  6 个页面  │ ─────────▶ │  Pinia Stores（5 个模块）│ ◀───────────────▶ │ category 字典 │
│ .vue      │ ◀───────── │  bill / book / user /    │     uni.$emit     └──────────────┘
│           │  组合式 API │  app / category          │ ───bill:change───▶ 命令式联动
└───────────┘            └─────────────────────────┘
       ▲                          ▲
       └──── composables/useBookkeeping.js（多 store 拼装收口在这一层）
```

**核心约定**

- **金额模型**：存储层金额**恒为正数**，收支方向由 `type: 'expense' | 'income'` 决定；
  列表/详情使用的**视图模型**金额带符号（支出为负、收入为正）。所有累加经 `round2` 处理，规避浮点误差。
- **唯一数据源**：账单只存在于 bill store，首页 / 流水 / 统计 / 详情全部从它派生，口径天然一致。
- **页面不跨多个 store 取数**：统一走 `composables/useBookkeeping.js`。

---

## 二、快速上手

### 1. 安装依赖

HBuilderX 工程的 Vue 运行时由编译器内置，因此 `package.json` **只声明 pinia，不要安装 vue**
（装两份 Vue 会导致实例冲突）。首次拉取代码后在项目根目录执行：

```bash
npm install --legacy-peer-deps
```

入口已在 [main.js](../main.js) 的 `// #ifdef VUE3` 条件块中完成注册：

```js
import pinia from "./store";
export function createApp() {
  const app = createSSRApp(App);
  app.use(pinia); // 必须，插件在 install 后才会启用持久化
  return { app };
}
```

### 2. 页面中使用（推荐：组合式 API）

```vue
<script setup>
import { useHomeData, goBillDetail } from "@/composables/useBookkeeping";

const { stats, flowList, todayExpense, todayIncome, userName, todayDate } =
  useHomeData();
</script>

<template>
  <text>Hi, {{ userName }}！本月支出 {{ stats.expense }} 元</text>
  <view v-for="item in flowList" :key="item.id" @click="goBillDetail(item.id)">
    {{ item.iconText }} {{ item.title }} {{ item.amount.toFixed(2) }}
  </view>
</template>
```

### 3. 直接使用 store（写操作 / 复杂逻辑）

```js
import { useBillStore } from "@/store";

const billStore = useBillStore();

// 新增（金额非法会 throw，建议走 useBillForm().saveBill，它已做 try/catch）
const bill = billStore.addBill({
  type: "expense", // 'expense' | 'income'
  amount: 35.5, // 支持字符串，内部 round2；必须 > 0
  category: "交通", // 非法分类自动回退「其他」
  payMethod: "微信支付", // 非法支付方式自动回退「现金」
  date: "2026-09-14", // 不传则今天
  time: "18:39", // 不传则当前时间
  remark: "地铁", // 自动截断 50 字
  photos: [], // 最多保留 3 张
});

billStore.updateBill(bill.id, { amount: 36 });
billStore.removeBill(bill.id); // 返回 boolean
billStore.monthSummary("2026-09"); // { expense, income, balance, expenseCount, incomeCount, count }
```

---

## 三、Store 模块说明

所有页面/组件统一从 `@/store` 引入：`import { useXxxStore } from '@/store'`。

### 1. `useBillStore`（id: `bill`，核心）

账单唯一数据源，持久化 key `bk:bills`。

| 类别        | 成员                              | 说明                                                |
| ----------- | --------------------------------- | --------------------------------------------------- |
| state       | `bills`                           | `Bill[]`，金额恒正数                                |
| getter      | `sortedBills`                     | 按日期/时间/创建时间倒序                            |
| getter      | `totalCount` / `activeDays`       | 总笔数 / 有记录的去重天数                           |
| getter      | `todayViewModels`                 | 今日账单视图模型（金额带符号、含分类图标底色）      |
| 函数 getter | `getById(id)`                     | 取原始实体，找不到返回 `null`                       |
| 函数 getter | `billsOfMonth(month)`             | 指定月账单（倒序）                                  |
| 函数 getter | `monthSummary(month)`             | 月收支汇总，见 `MonthSummary`                       |
| 函数 getter | `groupedByDay(month, filterType)` | 流水页按天分组，`filterType`：`全部类型/支出/收入`  |
| 函数 getter | `monthCategoryStats(month, type)` | 分类排行（金额/笔数/占比/图标配色）                 |
| 函数 getter | `monthPayStats(month)`            | 支出支付方式排行（元数据来自 book store）           |
| 函数 getter | `detailById(id)`                  | 详情 VM：账本名、`recordTime`、截止本单当月累计支出 |
| 函数 getter | `toViewModel(bill)`               | 原始实体 → 视图模型                                 |
| action      | `addBill(input)`                  | 新增；金额非法 throw；非法分类/支付方式做安全清洗   |
| action      | `updateBill(id, patch)`           | 局部更新（同样做合法性清洗）                        |
| action      | `removeBill(id)`                  | 删除，返回是否成功                                  |
| action      | `clearAllBills()`                 | 清空全部账单                                        |

增删改后都会 `uni.$emit('bill:change', { action, id?, bill? })`。
模块还导出常量/工具：`BILL_CHANGE_EVENT`、`round2(n)`、`fmtMoney(n) → '0.00'`。

### 2. `useBookStore`（id: `book`）

| 成员                                                                                     | 说明                                                                         |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `books` / `activeBookId`                                                                 | 账本列表 / 当前账本 id（默认 `book_1` 个人账本，预算 9900）                  |
| `payMethods`                                                                             | 支付方式运行时字典（现金/微信支付/支付宝/信用卡/储蓄卡），**静态数据不入库** |
| `activeBook`                                                                             | 当前账本 getter，找不到时安全兜底                                            |
| `getBook(id)` / `getPayMeta(name)`                                                       | 账本 / 支付方式元数据（简称、主题色、浅底色），找不到有兜底                  |
| `setActiveBook(id)` / `addBook({name,budget})` / `updateBook(id,patch)` / `setBudget(n)` | 写操作                                                                       |

持久化 key `bk:book`，**paths 白名单 `['books', 'activeBookId']`**。

### 3. `useCategoryStore`（id: `category`，`persist: false`）

纯字典：支出 9 类（其他/购物/交通/娱乐/餐饮/住房/就医/教育/旅行）、
收入 7 类（含工资、红包、收益、退还款、佣金等）。每类含 `name/icon/color/bg`。

- `listByType(type)`、`expenseList` / `incomeList`
- `expenseNames` / `incomeNames`
- `getMeta(type, name)`：找不到回退「其他」的图标配色，**保证任何脏数据都能渲染**
- `isValid(type, name)`：分类名合法性校验

字典属于随版本发布的静态数据，显式 `{ persist: false }`，不入库、升级即更新。

### 4. `useUserStore`（id: `user`）

- state `profile`：`{ name, avatar, joinDate }`，paths 白名单 `['profile']`，key `bk:user`
- getter `name` / `avatar` / `joinDays`（加入第 N 天，含当天）
- getter `bookkeepingStats`：`{ records, days, books }` —— **跨模块联动派生**，
  `records/days` 实时取自 bill store，`books` 取自 book store，不冗余存储
- action `updateProfile(patch)`：白名单字段 + 长度截断 + 日期格式校验，拒绝脏字段
- action `resetProfile()`

### 5. `useAppStore`（id: `app`）

轻量 UI 选择态，整体持久化（key `bk:app_ui`）：

```js
ui: {
  flowMonth, flowType,          // 流水页月份/类型筛选
  statsMonth, statsType,        // 统计页月份/收支 tab
  lastBillType, lastPayMethod,  // 记账页上次的收支方向/支付方式
  lastCategory: { expense, income }, // 各方向上次使用的分类
}
```

方法：`setFlowMonth / setFlowType / setStatsMonth / setStatsType / rememberBillForm / resetUI`。
页面中用**可写 computed** 与之双向绑定（见下文示例），切换后自动记忆、重启保留。

---

## 四、组合式 API（composables）

位于 [composables/useBookkeeping.js](../composables/useBookkeeping.js)，把「多 store 联动 +
视图模型拼装 + 事件/导航」收口，页面只与这一层对话。

| Hook                                   | 返回                                                                        | 用于                                   |
| -------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `useStores()`                          | 全部 5 个 store                                                             | 少数需要直接操作多 store 的场景        |
| `useHomeData()`                        | `stats, flowList, todayExpense, todayIncome, userName, todayDate`           | 首页                                   |
| `useFlowingData()`                     | `currentMonth, currentType, groups, monthCard`（前两个是**可写 computed**） | 流水页                                 |
| `useStatisticsData(monthRef, typeRef)` | `categoryStats, payStats, summary, flatBills`                               | 统计页                                 |
| `useBillForm()`                        | `remembered, saveBill(input)`                                               | 记账页                                 |
| `useBillDetail()`                      | `detail, currentId, loadFromChannel, removeCurrent`                         | 详情页                                 |
| `useProfile()`                         | `profile, joinDays, stats, editName, changeAvatar`                          | 我的页                                 |
| `onBillChange(handler)`                | —                                                                           | 订阅账单变更，页面 `onUnload` 自动解绑 |
| `goBillDetail(id)`                     | —                                                                           | 跳详情，**只通过 eventChannel 传 id**  |

### 示例 1：流水页月份/类型双向绑定 app store

```js
const { currentMonth, currentType, groups, monthCard } = useFlowingData();

// 直接赋值即可：写入 app store → 自动持久化，groups/monthCard 自动重算
currentMonth.value = "2026-08";
currentType.value = "支出";
```

### 示例 2：统计页

```js
import { computed } from "vue";
import { useAppStore } from "@/store";
import { useStatisticsData } from "@/composables/useBookkeeping";

const appStore = useAppStore();
const month = computed({
  get: () => appStore.ui.statsMonth,
  set: v => appStore.setStatsMonth(v),
});
const billType = computed({
  get: () => appStore.ui.statsType,
  set: v => appStore.setStatsType(v),
});
const { categoryStats, payStats, summary } = useStatisticsData(month, billType);
```

### 示例 3：记账页保存（含错误反馈与表单记忆）

```js
const { remembered, saveBill } = useBillForm();
// remembered.value => { type, category, payMethod }，用于初始化表单

const result = saveBill({
  type: billType.value,
  amount: Number(amount.value),
  category: activeCategory.value,
  payMethod: payMethod.value,
  date: date.value,
  remark: remark.value,
  photos: photos.value,
});
if (!result.ok) {
  uni.showToast({ title: result.error, icon: "none" }); // 如「金额必须大于 0」
} else {
  uni.showToast({ title: "保存成功", icon: "success" });
  setTimeout(() => uni.navigateBack(), 600); // 插件已同步落盘，返回即见新数据
}
```

### 示例 4：详情页

```js
import { onLoad } from "@dcloudio/uni-app";
import { useBillDetail } from "@/composables/useBookkeeping";

const { detail, loadFromChannel, removeCurrent } = useBillDetail();
onLoad(() => loadFromChannel()); // 自动从上一页 eventChannel 的 { id } 装载

const handleDelete = () => {
  uni.showModal({
    title: "提示",
    content: "确定删除该账单吗？",
    success: res => {
      if (res.confirm && detail.value?.id) {
        removeCurrent();
        uni.navigateBack();
      }
    },
  });
};
```

### 示例 5：监听账单变更做命令式响应

```js
import { onBillChange } from "@/composables/useBookkeeping";

onBillChange(({ action, id }) => {
  console.log("账单发生变更:", action, id); // 页面卸载时自动 uni.$off，无需手动解绑
});
```

---

## 五、持久化机制（store/persist.js）

### 1. 跨端适配

[utils/storage.js](../utils/storage.js) 按优先级选择底层：

1. `uni.getStorageSync/setStorageSync` —— iOS/Android App、各家小程序；
2. `window.localStorage` —— H5（uni API 缺失时兜底）；
3. 进程内 `Map` —— SSR / 异常环境的最终兜底，保证不崩溃。

**统一协议**：写入一律先 `JSON.stringify`，读取再 `parse`。避免 boolean/object 直存、
读取侧按字符串解析造成的脏数据问题（历史项目踩过的坑）。任何单条读写失败都被 try/catch 吞掉并告警。

### 2. 存储信封与 key 清单

每个 store 独立 key、统一 `bk:` 前缀，互不覆盖：

| key         | store    | 内容                                 | 版本 |
| ----------- | -------- | ------------------------------------ | ---- |
| `bk:bills`  | bill     | `{ bills }` 全量账单                 | 1    |
| `bk:book`   | book     | 仅 `books`、`activeBookId`（白名单） | 1    |
| `bk:user`   | user     | 仅 `profile`（白名单）               | 1    |
| `bk:app_ui` | app      | 全部 UI 选择态                       | 1    |
| ——          | category | 纯字典，不持久化                     | ——   |

落盘格式为信封：`{ "__v": 1, "value": { ...state } }`。订阅方式为
`store.$subscribe(cb, { flush: 'sync', detached: true })`，**状态变更同步写盘**，
杀进程/闪退不丢数据；写入失败只告警不崩溃。

### 3. 恢复合并策略

启动时以「代码中的默认状态」为底，合并磁盘快照：

- **对象递归合并**：新版本新增的字段会自动用默认值补齐；
- **数组整体替换**：用户删掉的数据不会被默认种子「复活」（如清空账单后重启仍是空的）；
- **基本类型**：磁盘值覆盖默认值；
- 兼容历史上**非信封**的裸 state 对象；
- 快照损坏 / 迁移异常：回退默认状态并自动删除坏 key，杜绝白屏。

### 4. 字段白名单 `paths`

只持久化需要的片段，支持点路径（如 `['profile', 'ui.sidebar.collapsed']`）：

```js
defineStore('book', () => { ... }, {
  persist: {
    key: 'book',
    version: 1,
    paths: ['books', 'activeBookId'], // payMethods 等静态字典不会入库
  },
})
```

### 5. 版本号与数据迁移

模型演进时：**bump `version`，并在 `migrations` 中补一个从上一版本升级的纯函数**，
插件会按 `v0 → v1 → v2 …` 顺序执行迁移链。三个 store 都内置了迁移示例：

```js
persist: {
  key: 'bills',
  version: 2,                         // 从 1 升到 2
  migrations: {
    0: saved => { /* 老版本负金额 → 正数 + type（已有示例） */ return saved },
    1: saved => {
      // v1 → v2：例如给每条账单补 tags 字段
      saved.bills.forEach(b => { if (!b.tags) b.tags = [] })
      return saved
    },
  },
}
```

> 迁移函数必须是**纯数据变换**，不要在里面调用 store。

### 6. 手动清除持久化数据

```js
import { clearPersistedState } from "@/store";

clearPersistedState("bills"); // 自动补 bk: 前缀，等价于删除 bk:bills
clearPersistedState("bk:book");
```

---

## 六、模块间状态联动的三种方式

本项目按场景使用三种联动手段，保证跨模块数据一致：

1. **store 内直接互调（派生联动，首选）**
   bill store 的视图模型通过 `categoryStore.getMeta()` 取图标配色、
   通过 `bookStore.getPayMeta()/getBook()` 取支付方式与账本名；
   user store 的 `bookkeepingStats` 直接读 bill/book store。
   被依赖方变化，computed 自动刷新，无需任何手动同步。

2. **getter / 函数 getter 实时聚合**
   `monthSummary / groupedByDay / monthCategoryStats / monthPayStats / detailById`
   全部由 `bills` 实时计算，首页、流水、统计、详情永远同一口径。

3. **`uni.$emit` 全局事件（命令式联动）**
   账单增删改后广播 `bill:change`，页面用 `onBillChange` 订阅
   （卸载自动解绑）。适合「保存后返回刷新提示」「埋点」这类不适合走响应式派生的命令式动作。

---

## 七、类型安全（JavaScript + JSDoc）

项目是 JS 工程，类型能力通过 JSDoc 提供，无需 Typecript 编译：

- 全部业务类型集中在 [store/types.js](types.js)：
  `BillType`、`Bill`、`BillInput`、`BillViewModel`、`MonthSummary`、`FlowGroup`、
  `CategoryMeta`、`Book`、`UserProfile`、`AppUIState`、`AggregateStat`、`PersistOptions`；
- 各 store state 用 `@type {import('vue').Ref<import('@/store/types').Xxx>}` 标注；
- [jsconfig.json](../jsconfig.json) 配置 `@/* → ./*` 别名与 `allowJs`，
  HBuilderX / VS Code 中可获得补全、悬浮提示、引用跳转与类型检查提示。

在自己的函数中标注：

```js
/**
 * @param {import('@/store/types').BillInput} input
 * @returns {import('@/store/types').Bill}
 */
function createBill(input) { ... }
```

---

## 八、常见开发任务指引

### 新增一个分类

编辑 [store/modules/category.js](modules/category.js) 对应数组，追加
`{ name: '宠物', icon: '🐾', color: '#...', bg: '#...' }`。
分类是随版本发布的静态字典，新增后**老用户升级即生效，无需迁移**；
记账页线性图标在 [pages/add/index.vue](../pages/add/index.vue) 的 `ICON_PATHS` 中补同名 SVG path。

### 给 Bill 增加一个业务字段（如 tags）

1. 在 [store/types.js](types.js) 的 `Bill` typedef 补字段；
2. `addBill` 中写入该字段（注意清洗/默认值）；
3. bump bill store `version: 2`，写 `migrations.1` 给老数据补默认值；
4. 需要展示时在 `toViewModel` 透出，页面经 composable 取用。

### 新增一个 store

1. 在 `store/modules/` 新建 setup 风格 store，第三个参数声明 `persist`；
2. 在 [store/index.js](index.js) 转出 `useXxxStore`；
3. 页面优先在 composables 中拼装后再使用，不要让页面直接跨多个 store。

```js
import { defineStore } from "pinia";
import { ref } from "vue";

export const useTagStore = defineStore(
  "tag",
  () => {
    const tags = ref([]);
    return { tags };
  },
  {
    persist: { key: "tags", version: 1 }, // false 表示不持久化
  },
);
```

### 重置/清空

- `billStore.clearAllBills()`（清空全部账单）；
- `userStore.resetProfile()`、`appStore.resetUI()`；
- 彻底清除磁盘：`clearPersistedState(key)` 后重启。

---

## 九、验证情况

- 所有新增/修改的 `.js` 文件通过 `node --check` 语法校验；
- 在 Node 中以 mock uni 存储 + 真实 Pinia/Vue 运行时做了集成冒烟测试，覆盖：
  演示数据装载、月汇总、按天分组与筛选、分类/支付聚合、账单 CRUD、非法输入清洗、
  `bill:change` 事件、跨模块统计联动、持久化信封与白名单、**杀进程后重启恢复**、
  **v0→v1 数据迁移（账单负金额转正、用户资料平铺收拢）**、全部组合式 API 的输入输出。
- HBuilderX 工程无命令行构建，最终多端表现请在 HBuilderX 中运行到
  iOS/Android/H5 各端做一次回归（重点：首次启动演示数据、记账后杀进程重进、切换月份/类型记忆）。
