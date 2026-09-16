/**
 * @file 用户 store（user 模块，接口数据缓存）
 * @description 用户资料（昵称 / 头像 / 加入日期）与记账统计均由服务端接口提供：
 *              GET /users/me、PATCH /users/me、POST /users/me/avatar、GET /users/me/stats。
 *              本 store 作为缓存层：登录后由 App.vue onLaunch 触发 fetchMe。
 *              persist: false —— 数据来源为服务端，本地不再持久化。
 *              主要导出：useUserStore，暴露 profile、派生统计与 fetchMe / updateProfile / changeAvatar。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-09-14
 * @modify 2026-09-16
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { usersApi, normalizeFileUrl } from "@/api";
import { diffFromToday, todayStr, formatDate } from "@/utils/date";

/** 默认头像（应用内置静态资源，任何异常头像值的最终兜底） */
export const DEFAULT_AVATAR = "/static/other/01.png";

/**
 * 归一化头像地址：非字符串 / 空白 / "null" / "undefined" 等脏值一律回退默认头像；
 * 服务端签名 URL 统一归一化为客户端可达的 BASE_URL。
 * @param {unknown} value 待校验的头像值
 * @returns {string} 合法头像地址
 */
export function normalizeAvatar(value) {
  if (typeof value !== "string") return DEFAULT_AVATAR;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return DEFAULT_AVATAR;
  }
  return normalizeFileUrl(trimmed);
}

/**
 * 生成默认用户资料（fetchMe 前的占位种子数据）
 * @returns {import('@/store/types').UserProfile}
 */
function createDefaultProfile() {
  return {
    name: "",
    avatar: DEFAULT_AVATAR,
    joinDate: todayStr(),
  };
}

export const useUserStore = defineStore(
  "user",
  () => {
    /** @type {import('vue').Ref<import('@/store/types').UserProfile>} */
    const profile = ref(createDefaultProfile());

    /** @type {import('vue').Ref<{records:number,days:number,books:number}>} */
    const stats = ref({ records: 0, days: 0, books: 0 });

    const name = computed(() => profile.value.name || "");
    // 出口处再归一化一次：脏值自动回退默认头像
    const avatar = computed(() => normalizeAvatar(profile.value.avatar));

    /** 加入产品的第 N 天（含加入当天） */
    const joinDays = computed(() => {
      const diff = diffFromToday(profile.value.joinDate);
      return Number.isFinite(diff) ? Math.max(1, diff + 1) : 1;
    });

    /** 「我的」页记账统计（来自 GET /users/me/stats） */
    const bookkeepingStats = computed(() => stats.value);

    /**
     * 拉取当前用户资料
     */
    async function fetchMe() {
      const me = await usersApi.getMe();
      if (!me) return null;
      // 服务端 joinDate 可能为 ISO 时间戳，统一转本地 YYYY-MM-DD 供 diffFromToday 计算
      const joinDate = me.joinDate ? formatDate(new Date(me.joinDate)) : "";
      profile.value = {
        name: me.name || "",
        avatar: normalizeAvatar(me.avatar),
        joinDate: joinDate || todayStr(),
      };
      return profile.value;
    }

    /**
     * 拉取记账统计
     */
    async function fetchStats() {
      const s = await usersApi.getStats();
      stats.value = {
        records: Number(s?.records) || 0,
        days: Number(s?.days) || 0,
        books: Number(s?.books) || 0,
      };
    }

    /**
     * 更新资料（白名单字段，调服务端 PATCH /users/me）
     * @param {{name?:string}} patch
     */
    async function updateProfile(patch) {
      const payload = {};
      if (typeof patch.name === "string" && patch.name.trim()) {
        payload.name = patch.name.trim().slice(0, 12);
      }
      const updated = await usersApi.updateMe(payload);
      if (updated) {
        if (typeof updated.name === "string") profile.value.name = updated.name;
      }
    }

    /**
     * 更换头像：上传文件到服务端，返回新头像 URL
     * @param {string} filePath 临时文件路径
     */
    async function changeAvatar(filePath) {
      const res = await usersApi.uploadAvatar(filePath);
      if (res && res.avatar) {
        profile.value.avatar = normalizeAvatar(res.avatar);
      }
      return profile.value.avatar;
    }

    /** 恢复默认资料（退出登录时调用） */
    function resetProfile() {
      profile.value = createDefaultProfile();
      stats.value = { records: 0, days: 0, books: 0 };
    }

    return {
      profile,
      stats,
      name,
      avatar,
      joinDays,
      bookkeepingStats,
      fetchMe,
      fetchStats,
      updateProfile,
      changeAvatar,
      resetProfile,
    };
  },
  // 数据来源为服务端，不启用本地持久化
  { persist: false },
);
