/**
 * @file 我的页组合式 API（composables 域文件）
 * @description 用户资料 + 记账统计（PATCH /users/me、POST /users/me/avatar、
 *              GET /users/me/stats）。
 * @author 夏季 <2937375029@qq.com>
 * @date 2026-10-11（自 useBookkeeping.js 按域拆分，逻辑零改动）
 */
import { computed } from 'vue'
import { useUserStore } from '@/store'
import { compressPhoto } from './_shared'

/**
 * 我的页数据：profile / avatar / joinDays 来自 user store（接口缓存）；
 * stats 来自 GET /users/me/stats；editName 调 PATCH /users/me；
 * changeAvatar 调 POST /users/me/avatar。
 * @returns {object}
 */
export function useProfile() {
  const userStore = useUserStore()

  const profile = computed(() => userStore.profile)
  const avatar = computed(() => userStore.avatar)
  const joinDays = computed(() => userStore.joinDays)
  const stats = computed(() => userStore.bookkeepingStats)

  /** 弹窗修改昵称（调 PATCH /users/me） */
  function editName() {
    return new Promise((resolve) => {
      uni.showModal({
        title: '修改昵称',
        editable: true,
        content: userStore.profile.name,
        success: async (res) => {
          if (res.confirm && res.content) {
            try {
              await userStore.updateProfile({ name: res.content })
              uni.showToast({ title: '已更新', icon: 'success' })
              resolve(true)
            } catch {
              resolve(false)
            }
          }
          resolve(false)
        },
        fail: () => resolve(false),
      })
    })
  }

  /** 选择头像并上传到服务端（POST /users/me/avatar） */
  function changeAvatar() {
    return new Promise((resolve) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 选图阶段先走系统压缩
        success: async (res) => {
          const path = res.tempFilePaths?.[0]
          if (!path) {
            resolve(null)
            return
          }
          uni.showLoading({ title: '上传中', mask: true })
          try {
            // 二次压缩（quality 80），失败回退原图，不阻断上传
            const src = await compressPhoto(path)
            const url = await userStore.changeAvatar(src)
            uni.showToast({ title: '头像已更新', icon: 'success' })
            resolve(url)
          } catch {
            resolve(null)
          } finally {
            uni.hideLoading()
          }
        },
        fail: () => resolve(null),
      })
    })
  }

  return {
    profile,
    avatar,
    joinDays,
    stats,
    editName,
    changeAvatar,
    userStore,
  }
}
