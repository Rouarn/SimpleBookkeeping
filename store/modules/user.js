/**
 * @file 用户 store（user 模块）
 * @description 持久化用户资料（昵称 / 头像 / 加入日期）；「我的」页的记账统计
 *              （总笔数 / 记账天数 / 账本数）不在此存储，全部实时从 bill / book store
 *              派生，天然与账单数据保持一致（跨模块联动，无冗余口径）。
 *              持久化仅白名单 profile 字段，并内置 v0 平铺字段 → v1 profile 对象的迁移。
 *              主要导出：useUserStore，暴露 profile、派生统计与 updateProfile / resetProfile。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useBillStore } from "./bill";
import { useBookStore } from "./book";
import { diffFromToday, todayStr } from "@/utils/date";

/** 默认头像（应用内置静态资源，任何异常头像值的最终兜底） */
export const DEFAULT_AVATAR = "/static/other/01.png";

/**
 * 归一化头像地址：非字符串 / 空白 / "null" / "undefined" 等脏值一律回退默认头像。
 * 历史上换头像失败可能把临时路径或异常字符串持久化（临时路径重启后失效），
 * 在数据层统一清洗，保证头像位永远拿到可用地址。
 * @param {unknown} value 待校验的头像值
 * @returns {string} 合法头像地址
 */
export function normalizeAvatar(value) {
  if (typeof value !== "string") return DEFAULT_AVATAR;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return DEFAULT_AVATAR;
  }
  return trimmed;
}

/**
 * 生成默认用户资料（首次安装时的种子数据，加入日期取当天）
 * @returns {import('@/store/types').UserProfile}
 */
function createDefaultProfile() {
  return {
    name: "小绿",
    avatar: DEFAULT_AVATAR,
    joinDate: todayStr(),
  };
}

export const useUserStore = defineStore(
  "user",
  () => {
    const billStore = useBillStore();
    const bookStore = useBookStore();

    /** @type {import('vue').Ref<import('@/store/types').UserProfile>} */
    const profile = ref(createDefaultProfile());

    const name = computed(() => profile.value.name);
    // 出口处再归一化一次：即使持久化恢复了历史脏值，渲染取到的仍是合法地址
    const avatar = computed(() => normalizeAvatar(profile.value.avatar));

    /** 加入产品的第 N 天（含加入当天） */
    const joinDays = computed(() => {
      const diff = diffFromToday(profile.value.joinDate);
      return Number.isFinite(diff) ? Math.max(1, diff + 1) : 1;
    });

    /**
     * 「我的」页统计 —— 跨模块联动派生：
     * records 来自 bill store，books 来自 book store，任一侧变更都会自动刷新
     */
    const bookkeepingStats = computed(() => ({
      records: billStore.totalCount,
      days: billStore.activeDays,
      books: bookStore.books.length,
    }));

    /**
     * 更新资料（白名单字段，防止外部写入脏字段）
     * @param {Partial<import('@/store/types').UserProfile>} patch
     */
    function updateProfile(patch) {
      if (typeof patch.name === "string" && patch.name.trim()) {
        profile.value.name = patch.name.trim().slice(0, 12);
      }
      if (typeof patch.avatar === "string" && patch.avatar) {
        profile.value.avatar = normalizeAvatar(patch.avatar);
      }
      if (
        typeof patch.joinDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(patch.joinDate)
      ) {
        profile.value.joinDate = patch.joinDate;
      }
    }

    /** 恢复默认资料 */
    function resetProfile() {
      profile.value = createDefaultProfile();
    }

    return {
      profile,
      name,
      avatar,
      joinDays,
      bookkeepingStats,
      updateProfile,
      resetProfile,
    };
  },
  {
    persist: {
      key: "user",
      version: 1,
      paths: ["profile"],
      migrations: {
        // 迁移示例：v0 资料字段平铺在根上，v1 收拢到 profile
        0: saved => {
          if (saved && !saved.profile) {
            saved.profile = {
              name: saved.name ?? "小绿",
              avatar: normalizeAvatar(saved.avatar),
              joinDate: saved.joinDate ?? "2026-06-09",
            };
            delete saved.name;
            delete saved.avatar;
            delete saved.joinDate;
          }
          return saved;
        },
      },
    },
  },
);
