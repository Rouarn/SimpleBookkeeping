/**
 * @file Pinia 状态管理统一入口
 * @description 1. 创建 pinia 实例并注册自研的多端持久化插件；
 *              2. 统一转出各业务 store（app / book / category / bill / user）
 *                 与持久化工具，页面与 composable 中一律 `from '@/store'` 引入，
 *                 不直接引用 modules 子目录，便于后续调整模块划分。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { createPinia } from "pinia";
import {
  createPersistPlugin,
  clearPersistedState,
  STORAGE_PREFIX,
} from "./persist";

const pinia = createPinia();
pinia.use(createPersistPlugin());

export default pinia;

// 持久化工具
export { clearPersistedState, STORAGE_PREFIX };

// 业务模块 stores
export { useAppStore } from "./modules/app";
export { useBookStore } from "./modules/book";
export { useCategoryStore } from "./modules/category";
export { useBillStore, BILL_CHANGE_EVENT, round2, fmtMoney } from "./modules/bill";
export { useUserStore, DEFAULT_AVATAR } from "./modules/user";
