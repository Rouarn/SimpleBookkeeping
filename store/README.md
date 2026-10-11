# 状态管理与数据持久化使用文档

本项目基于 **Pinia（Vue 3 组合式 setup 写法）+ uni-app 存储适配**，业务数据以服务端接口为唯一
数据源，Pinia store 只承担「接口数据缓存 + 轻量 UI 选择态持久化」两类职责；面向页面的
视图模型拼装统一收口在 `composables/` 组合式层（按页面域拆分，`useBookkeeping.js` 仅保留兼容门面）。

> 技术栈：uni-app（Vue3 `<script setup>`，JavaScript + JSDoc）、Pinia
> 兼容平台：iOS App、Android App、H5、各家小程序（uni 同步存储 API 统一适配）

---

## 一、目录结构

```
simple-bookkeeping/
├── main.js                       # 应用入口：createApp 中 app.use(pinia)，返回值携带 pinia
├── jsconfig.json                 # @/* 路径别名（checkJs:false，不做全量类型检查）
├── api/
│   ├── http.js                   # 请求封装：信封解析 / 401 单飞刷新 / upload() / ApiError
│   ├── auth.js / users.js / bills.js / books.js
│   ├── dictionaries.js / statistics.js / uploads.js
│   └── index.js                  # 统一出口（xxxApi 命名空间 + 显式登记的具名导出）
├── utils/
│   ├── storage.js                # 跨端存储适配器（uni 存储 → localStorage → 内存兜底）
│   ├── auth.js                   # access（内存）/ refresh（bk:rt）/ 登录失效跳转
│   └── date.js                   # 纯函数日期工具
├── store/
│   ├── index.js                  # createPinia + 注册持久化插件 + 统一转出出口
│   ├── persist.js                # 自研持久化插件（信封 / 版本迁移 / 容错合并）
│   ├── types.js                  # 前端 JSDoc typedef（接口传输模型在 api/bills.js）
│   └── modules/
│       ├── app.js                # 轻量 UI 选择态（唯一持久化的 store，key: bk:app_ui）
│       ├── book.js               # 账本 / 激活账本 / 预算 / 支付方式字典缓存（不持久化）
│       ├── category.js           # 收支分类字典缓存（不持久化）
│       ├── bill.js               # 账单增删改 action + bill:change 事件广播（不持久化）
│       └── user.js               # 用户资料 / 记账统计缓存（不持久化）
└── composables/
    ├── _shared.js                # 域间共享内部工具（reqId 竞态 / toBillVM / compressPhoto）
    ├── useHome.js                # 首页 useHomeData
    ├── useFlowing.js             # 流水页 useFlowingData（分页 / 分组 / 搜索 / 筛选）
    ├── useStatistics.js          # 统计页 useStatisticsData / useTrendData
    ├── useBillEdit.js            # 记账页 useBillForm（记忆 / 回填 / 上传 / 保存）
    ├── useBillDetail.js          # 详情 useBillDetail / onBillChange / goBillDetail / BILL_PREFILL_KEY
    ├── useProfile.js             # 我的页 useProfile
    └── useBookkeeping.js         # 兼容门面：re-export 上述全部具名导出（新代码请直接按域 import）
```

### 数据流

```
  ┌───────────┐  composables   ┌────────────────────┐  xxxApi   ┌──────────────┐
  │  各页面    │ ─────────────▶ │ Pinia stores       │ ────────▶ │ 服务端 API    │
  │  .vue     │ ◀───────────── │ app / book / ...   │ ◀──────── │ /api/v1/*    │
  └───────────┘   视图模型拼装  └────────────────────┘           └──────────────┘
                       │                │
                       │           uni.$emit('bill:change')  增删改后命令式联动
                       ▼
             uni 本地存储：仅 bk:app_ui（UI 选择态）+ bk:rt（刷新令牌）
```

**核心约定**

- **服务端是业务数据唯一数据源**：账单 / 账本 / 分类 / 支付方式 / 用户资料均不本地持久化，
  store 只做进程内缓存，登录后由 `App.vue onLaunch` 与页面 `onShow` 触发拉取。
- **金额以服务端 DECIMAL 字符串传输**（支出为负、收入为正），前端累加前 `Number()` 转换，
  展示统一经 `fmtMoney()` 格式化为两位小数；接口传输模型见
  `api/bills.js` 的 `BillListItem / BillDetail / BillPhoto / PageData` typedef。
- **页面不跨多个 store 拼数据**：统一走 `composables/` 组合式层，新代码按域从
  `useHome / useFlowing / useStatistics / useBillEdit / useBillDetail / useProfile` 引入；
  `composables/useBookkeeping.js` 仅作 re-export 兼容门面（旧 import 路径零破坏）。

---

## 二、在页面中使用

新代码按域引入（下表给出每个 hook 的域文件）；旧路径 `@/composables/useBookkeeping`
仍可使用（兼容门面 re-export 全部具名导出）：

```vue
<script setup>
import { useHomeData } from '@/composables/useHome'
import { goBillDetail } from '@/composables/useBillDetail'

const {
  stats,
  flowList,
  todayExpense,
  todayIncome,
  userName,
  todayDate,
  load,
} = useHomeData()
</script>
```

写操作 / 复杂逻辑可直接使用 store（页面、composable 统一从 `@/store` 引入）：

```js
import { useBillStore } from '@/store'
const billStore = useBillStore()
await billStore.addBill(payload) // POST /bills，成功后广播 bill:change
```

API 调用统一走 `@/api` 的命名空间对象，禁止依赖 bills/books 的扁平同名导出：

```js
import { billsApi, booksApi, ApiError } from '@/api'
await billsApi.list({ month: '2026-10', type: 'ALL', page: 1, pageSize: 50 })
```

---

## 三、Store 模块说明

所有页面 / 组件统一从 `@/store` 引入：`import { useXxxStore } from '@/store'`。

### 1. `useAppStore`（id: `app`，**唯一持久化**，key `bk:app_ui`，version 2）

轻量 UI 选择态，整体持久化：

```js
ui: {
  flowMonth,                 // 流水页选中月份 'YYYY-MM'
  flowType,                  // 流水页筛选 code：'all' | 'expense' | 'income'
  statsMonth, statsYear,     // 统计页选中月 / 年
  statsScope,                // 'month' | 'year'
  statsType,                 // 'expense' | 'income'（本来就存英文 code）
  lastBillType,              // 记账页上次收支方向 'expense' | 'income'
  lastPayMethod,             // 上次支付方式 id
  lastCategory: { expense, income }, // 各方向上次分类 id
}
```

方法：`setFlowMonth / setFlowType / setStatsMonth / setStatsYear / setStatsScope /
setStatsType / rememberBillForm / resetUI`。页面用**可写 computed** 双向绑定，切换后自动记忆。

**flowType 存储约定（v2 起）**：

- 存储层只存 code：`'all' | 'expense' | 'income'`；服务端参数映射为
  `ALL / expense / income`（`all → ALL`）；
- 页面展示文案（全部类型 / 支出 / 收入）由 `useFlowingData()` 的 `currentType`
  计算属性做 code ↔ 文案双向适配，页面无需改动；
- **一次性兼容**：v1 持久化值是中文文案，插件恢复时执行 v1 → v2 迁移
  （`store/modules/app.js` 的 `migrations[1]`）映射为 code；
  `setFlowType` 也会对中文入参做防御性归一化。

### 2. `useBookStore`（id: `book`，`persist: false`）

| 成员                                                                                     | 说明                                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `books` / `activeBookId`                                                                 | 账本列表 / 当前激活账本 id                               |
| `payMethods`                                                                             | 支付方式运行时字典（GET /pay-methods 缓存）              |
| `booksLoaded` / `payLoaded`                                                              | **响应式加载标记（state）**，防止重复拉取，随 reset 复位 |
| `activeBook`                                                                             | 当前账本 getter，找不到时安全兜底「默认账本」            |
| `fetchBooks(force?)` / `fetchPayMethods(force?)`                                         | 拉取并缓存                                               |
| `getBook(id)` / `getPayMeta(name)`                                                       | 查询，找不到有兜底                                       |
| `setActiveBook(id)` / `addBook({name,budget})` / `updateBook(id,patch)` / `setBudget(n)` | 写操作                                                   |
| `reset()`                                                                                | 清空缓存与加载标记（退出登录时调用）                     |

### 3. `useCategoryStore`（id: `category`，`persist: false`）

分类字典缓存（GET /categories?type=expense|income）：

- `expenseList` / `incomeList`、`expenseNames` / `incomeNames`；
- `loaded`：`{ expense: boolean, income: boolean }` **响应式加载标记（state）**；
- `fetchCategories(type, force?)` / `fetchAll(force?)` / `listByType(type)`；
- `getMeta(type, name)`：找不到回退兜底图标配色，保证脏数据也能渲染；
- `isValid(type, name)` / `reset()`。

### 4. `useBillStore`（id: `bill`，`persist: false`）

只保留写操作 action（列表 / 详情 / 统计等只读派生由 composable 直接调 API）：

- `addBill(input)` → POST /bills；`updateBill(id, patch)` → PATCH /bills/:id；
  `removeBill(id)` → DELETE /bills/:id；
- 成功后均 `uni.$emit('bill:change', { action, id?, bill? })`
  （常量 `BILL_CHANGE_EVENT`）；
- 另导出工具：`round2(n)`、`fmtMoney(n) → '0.00'`。

### 5. `useUserStore`（id: `user`，`persist: false`）

- state `profile`：`{ name, avatar, joinDate }`（头像经 `normalizeAvatar` 兜底）；
- `stats`：GET /users/me/stats 的 `{ records, days, books }`，getter `bookkeepingStats`；
- getter：`name` / `avatar` / `joinDays`（加入第 N 天，含当天）；
- action：`fetchMe()` / `fetchStats()` / `updateProfile(patch)` /
  `changeAvatar(filePath)`（POST /users/me/avatar）/ `resetProfile()`。

---

## 四、组合式 API（composables/ 按域拆分）

域文件划分：`useHome.js` / `useFlowing.js` / `useStatistics.js` / `useBillEdit.js` /
`useBillDetail.js` / `useProfile.js`，域间共享工具在 `_shared.js`（reqId 竞态序号、
toBillVM 视图模型映射、compressPhoto 图片压缩）；`useBookkeeping.js` 仅为兼容门面，
re-export 下表全部具名导出，旧 import 路径零破坏。

| Hook / 导出（域文件）                                       | 返回要点                                                                                                                                  | 用于                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `useHomeData()`（useHome.js）                               | stats / flowList / todayExpense / todayIncome / userName / todayDate / editBudget / load / loading                                        | 首页                                    |
| `useFlowingData()`（useFlowing.js）                         | currentMonth、currentType（**可写 computed**，code↔文案适配）、keyword、groups、monthCard、load、loadMore、loading、loadingMore、finished | 流水页                                  |
| `useStatisticsData(periodRef, typeRef)`（useStatistics.js） | overview / categoryStats / payStats / overviewError / load / loading                                                                      | 统计页                                  |
| `useTrendData(months?, yearRef?)`（useStatistics.js）       | trend / loadTrend / loading                                                                                                               | 收支趋势                                |
| `useBillForm()`（useBillEdit.js）                           | remembered / saveBill / loadBillForEdit / uploadPhoto                                                                                     | 记账页                                  |
| `useBillDetail()`（useBillDetail.js）                       | detail / currentId / detailLoading / detailError / loadFromChannel / removeCurrent / reload                                               | 详情页                                  |
| `useProfile()`（useProfile.js）                             | profile / avatar / joinDays / stats / editName / changeAvatar / userStore                                                                 | 我的页                                  |
| `onBillChange(handler)`（useBillDetail.js）                 | —                                                                                                                                         | 订阅账单变更，页面 `onUnload` 自动解绑  |
| `goBillDetail(id)`（useBillDetail.js）                      | —                                                                                                                                         | 跳详情，query 带 id + eventChannel 兜底 |
| `BILL_PREFILL_KEY`（useBillDetail.js）                      | `'bk:bill_prefill'` 常量                                                                                                                  | 「再记一笔」预填 storage 中转 key       |
| `compressPhoto(filePath)`（_shared.js）                     | Promise<压缩后路径，失败回退原图>                                                                                                         | 头像 / 凭证图片二次压缩                 |

---

## 五、鉴权令牌策略（utils/auth.js + api/http.js）

- **access token 仅存内存**（进程级，2h 失效，重启即无）；
- **refresh token 存本地 `bk:rt`**（30d），登录 / 注册时写入，登出 / 失效时移除；
- **冷启动单飞**：`ensureAccessToken()` 保证全应用每次冷启动最多一次 `/auth/refresh`，
  首批请求经闸门共享同一次刷新；无 rt（invalid）→ 清态 reLaunch 登录页；
  断网 / 5xx / 429（unavailable）→ 保留 rt，不误清登录态；
- 运行中 40100 / 40101 自动单飞刷新并重试一次；
- 刷新逻辑**只在 http.js 内聚**（`api/auth.js` 不再提供 refresh 方法），避免多点持锁
  造成 refresh token 重放连坐吊销；
- API 失败统一 reject **`ApiError`**（`api/http.js` 导出，Error 子类，
  含 `code / raw / message`，与历史裸对象形状兼容，catch 中可 `instanceof ApiError`）。

### 本地存储 key 清单

| key                                | 归属          | 内容                               | 退出登录                       |
| ---------------------------------- | ------------- | ---------------------------------- | ------------------------------ |
| `bk:app_ui`                        | app store     | UI 选择态信封 `{__v:2,value:{ui}}` | resetUI 以默认值重写           |
| `bk:rt`                            | utils/auth.js | refresh token                      | 删除（logout 内部 + 清单兜底） |
| `bk:bills` / `bk:book` / `bk:user` | 旧版本遗留    | 老版本持久化数据，现版本已不写入   | 删除（兼容老用户设备）         |
| `bk:bill_prefill`                  | composables   | 「再记一笔」一次性中转值，读取即删 | 保留（与账号无关）             |
| `app_update_device_id`             | app-update    | 灰度设备标识                       | **保留**                       |
| `app_update_pending_install_code`  | app-update    | 更新待安装回补标记                 | **保留**                       |
| `app_update_last_check_at`         | app-update    | 静默检查节流时间戳                 | **保留**                       |
| `hitokoto_last`                    | useHitokoto   | 一言缓存                           | **保留**                       |

---

## 六、持久化插件（store/persist.js）

- 基于 `@/utils/storage` 自动适配 uni 存储 / localStorage / 内存兜底；
- 信封 `{ __v, value }`，独立 key + `bk:` 前缀；支持 `paths` 白名单（点路径）；
- 恢复时「默认结构 + 已存结构」合并：对象递归合并补新字段、数组整体替换防复活、
  坏快照回退默认并删除坏 key；
- 迁移：bump `version` 并在 `migrations` 补上一版本纯函数，插件按序执行迁移链：

```js
persist: {
  key: 'app_ui',
  version: 2,
  migrations: {
    1: (saved) => {
      // v1 → v2：flowType 中文文案 → code
      return saved
    },
  },
}
```

> 当前仅 app store 持久化；book / category / bill / user 均为 `persist: false`。
> 迁移函数必须是纯数据变换，不要在里面调用 store。

---

## 七、类型说明（JavaScript + JSDoc）

- 前端视图 / UI 类型集中在 `store/types.js`：`BillType`、`Bill`（旧本地模型，逐步废弃中）、
  `BillViewModel`、`MonthSummary`、`FlowGroup`、`CategoryMeta`、`Book`、
  `UserProfile`、`AppUIState`、`AggregateStat`、`PersistOptions`；
- **接口传输模型**集中在 `api/bills.js`：`BillListItem` / `BillDetail` / `BillPhoto` /
  `PageData<T>`，字段以后端 `bill.vo.ts` 为准（金额字符串、列表 photos 为 string[]、
  详情 photos 为 `{key,url}[]`）；
- `jsconfig.json` 配置 `@/* → ./*` 别名（`checkJs:false`），在 HBuilderX / VS Code 中
  提供补全、悬浮提示与跳转。

---

## 八、常见开发任务

- **新增 store**：在 `store/modules/` 新建 setup store → `store/index.js` 转出 →
  页面优先经 composable 消费；
- **退出登录清理**：只按 `pages/settings/index.vue` 的 `LOGOUT_REMOVE_KEYS` 精确清理，
  禁止再使用 `uni.clearStorageSync()`（会误删设备标识 / 更新回补 / 一言缓存）；
- **新增持久化字段**：app store 直接加（整体持久化）；存储结构不兼容变更时 bump
  version 并补迁移函数；
- **重置缓存**：`userStore.resetProfile()` / `appStore.resetUI()` /
  `bookStore.reset()` / `categoryStore.reset()`。
