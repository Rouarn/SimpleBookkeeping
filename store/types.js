/**
 * @file 全局 JSDoc 类型定义（类型安全的单一事实来源）
 * @description 本文件不输出任何运行时代码（末尾仅 export {} 保证被识别为 ES 模块），
 *              仅供 IDE / TypeScript 语言服务做类型推断。
 *              类型分组：
 *              1. 账单模型：BillType / Bill / BillInput / BillViewModel；
 *              2. 统计派生：MonthSummary / FlowGroup / AggregateStat；
 *              3. 基础字典：CategoryMeta / Book / UserProfile / AppUIState；
 *              4. 基础设施：PersistOptions（持久化插件配置）。
 *              在任意 js/vue 文件中通过 `@param {import('@/store/types').Bill}` 等方式引用。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */

/**
 * 收支方向
 * @typedef {("expense" | "income")} BillType
 */

/**
 * 账单实体（持久化数据模型）
 * @typedef {Object} Bill
 * @property {string} id            账单唯一 ID
 * @property {BillType} type        收支方向：expense 支出 / income 收入
 * @property {number} amount        金额绝对值（恒为正数，方向由 type 决定，避免负数口径混乱）
 * @property {string} category      分类名称（关联 category store）
 * @property {string} payMethod     收/付款方式（关联 book store 的 payMethods）
 * @property {string} date          记账日期 'YYYY-MM-DD'
 * @property {string} time          记账时间 'HH:mm'
 * @property {string} remark        备注（最长 50 字）
 * @property {string[]} photos      凭证图片路径（最多 3 张）
 * @property {string} bookId        所属账本 ID（关联 book store）
 * @property {number} createdAt     创建时间戳（排序/编辑用）
 */

/**
 * 新增账单的入参（amount 可传字符串，store 内部统一清洗）
 * @typedef {Object} BillInput
 * @property {BillType} [type]
 * @property {number|string} amount
 * @property {string} [category]
 * @property {string} [payMethod]
 * @property {string} [date]
 * @property {string} [time]
 * @property {string} [remark]
 * @property {string[]} [photos]
 * @property {string} [bookId]
 */

/**
 * 列表用账单视图模型（供页面直接渲染，金额已带符号）
 * @typedef {Object} BillViewModel
 * @property {string} id
 * @property {string} title         标题（= 分类名）
 * @property {string} iconText      emoji 图标
 * @property {string} iconBg        图标浅底色
 * @property {number} amount        带符号金额：支出为负、收入为正
 * @property {string} date
 * @property {string} time
 * @property {string} payMethod
 * @property {BillType} type
 * @property {string} category
 * @property {string} remark
 * @property {string[]} photos
 */

/**
 * 收支汇总
 * @typedef {Object} MonthSummary
 * @property {number} expense       支出总额（正数）
 * @property {number} income        收入总额（正数）
 * @property {number} balance       结余 = 收入 - 支出
 * @property {number} expenseCount  支出笔数
 * @property {number} incomeCount   收入笔数
 * @property {number} count         总笔数
 */

/**
 * 流水分组（按天）
 * @typedef {Object} FlowGroup
 * @property {string} day           今天 / 昨天 / 周X
 * @property {string} date          'M月D日'
 * @property {string} expense       当日支出（两位小数字符串）
 * @property {string} income        当日收入（两位小数字符串）
 * @property {BillViewModel[]} items
 */

/**
 * 分类元数据
 * @typedef {Object} CategoryMeta
 * @property {string} name
 * @property {string} icon          emoji
 * @property {string} color         主题色
 * @property {string} bg            浅底色
 */

/**
 * 账本
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} name
 * @property {number} budget        月预算（元）
 */

/**
 * 用户资料
 * @typedef {Object} UserProfile
 * @property {string} name
 * @property {string} avatar
 * @property {string} joinDate      加入日期 'YYYY-MM-DD'
 */

/**
 * UI / 偏好状态（全部为轻量选择态，适合持久化）
 * @typedef {Object} AppUIState
 * @property {string} flowMonth           流水页选中月份 'YYYY-MM'
 * @property {string} flowType            流水页类型筛选
 * @property {string} statsMonth          统计页选中月份 'YYYY-MM'
 * @property {string} statsYear           统计页选中年份 'YYYY'（年视图用）
 * @property {"month"|"year"} statsScope  统计页时间粒度：单月 / 整年
 * @property {BillType} statsType         统计页收支切换
 * @property {BillType} lastBillType      记账页上次的收支选择
 * @property {string} lastPayMethod       记账页上次的收付款方式 id
 * @property {{expense: string, income: string}} lastCategory 各方向上次分类 id
 */

/**
 * 单条分类/支付方式聚合统计
 * @typedef {Object} AggregateStat
 * @property {string} name
 * @property {number} amount
 * @property {number} count
 * @property {number} percent
 * @property {string} [icon]
 * @property {string} [color]
 * @property {string} [bg]
 * @property {string} [short]
 */

/**
 * 持久化插件配置
 * @typedef {Object} PersistOptions
 * @property {string} [key]                  存储键（默认 store id），最终自动加 'bk:' 前缀
 * @property {number} [version]              数据版本号，默认 0
 * @property {string[]} [paths]              白名单字段，支持点路径如 'profile.name'；不传则持久化全部
 * @property {Record<number, (saved: any) => any>} [migrations]  旧版本 -> 新版本的迁移函数表
 */

export {};
