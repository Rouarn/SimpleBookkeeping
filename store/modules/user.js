/**
 * @file 用户 store（user 模块）
 * @description 持久化用户资料（昵称 / 头像 / 加入日期）；「我的」页的记账统计
 *              （总笔数 / 记账天数 / 账本数）不在此存储，全部实时从 bill / book store
 *              派生，天然与账单数据保持一致（跨模块联动，无冗余口径）。
 *              持久化仅白名单 profile 字段，并内置 v0 平铺字段 → v1 profile 对象的迁移。
 *              主要导出：useUserStore，暴露 profile、派生统计与 updateProfile / resetProfile。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-14
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useBillStore } from "./bill";
import { useBookStore } from "./book";
import { diffFromToday, todayStr } from "@/utils/date";

/**
 * 生成默认用户资料（首次安装时的种子数据，加入日期取当天）
 * @returns {import('@/store/types').UserProfile}
 */
function createDefaultProfile() {
  return {
    name: "小绿",
    avatar: "/static/other/01.png",
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
    const avatar = computed(() => profile.value.avatar);

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
        profile.value.avatar = patch.avatar;
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
              avatar: saved.avatar ?? "/static/other/01.png",
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
