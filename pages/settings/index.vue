<!--
  @file 设置页（pages/settings/index.vue）
  @description 应用设置中心：
               1. 关于：App 端提供「检查更新」入口（右侧展示当前运行时版本号，
                  点击走在线更新流程；更新弹窗全局仅首页挂载一份，本页检查到
                  新版本时返回上一页由首页弹出）；
               2. 退出登录：二次确认后吊销服务端 token（失败不阻断），
                  按 key 清单清理账号相关本地数据（refresh token、旧版本
                  遗留的账单/账本/资料持久化键），并重置内存中的接口缓存 store；
                  设备标识、更新待安装回补标记、一言缓存等与账号无关的数据保留，
                  最后 reLaunch 回登录页。
               视觉延续全站设计语言：深松绿渐变头 + 暖灰背景 + 白卡。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-16
  @modify 2026-10-11 抽取 PageHeader / MenuItem 公共组件
-->
<template>
  <view class="settings">
    <!-- 顶部导航区（渐变 / 圆角 / 双圆由 PageHeader 内聚，settings 变体无色点） -->
    <PageHeader variant="settings">
      <view class="nav">
        <view class="back-btn" @click="onBack">
          <uni-icons type="left" size="20" color="#eaf3ee"></uni-icons>
        </view>
        <text class="nav-title">设置</text>
      </view>
    </PageHeader>

    <view class="content">
      <!-- 关于（非 App 端菜单为空时不渲染该分组） -->
      <view v-if="aboutMenu.length" class="group">
        <text class="group-label">关于</text>
        <view class="card">
          <MenuItem
            v-for="item in aboutMenu"
            :key="item.title"
            :icon="item.icon"
            :label="item.title"
            :value="item.extra"
            @click="onMenuTap(item)"
          />
        </view>
      </view>

      <!-- 退出登录 -->
      <button class="logout" :loading="loggingOut" @click="onLogout">
        退出登录
      </button>

      <text class="slogan">小绿记账 · 记一笔，知一月</text>
    </view>
  </view>
</template>

<script setup>
/**
 * 设置页脚本
 * - 「关于」菜单（「检查更新」仅 App 端注入，其余死入口已清理，只保留真实项）；
 * - 退出登录：服务端吊销 token → 按 key 清单清理账号数据 → 重置内存缓存 → 回登录页。
 */
import { ref } from 'vue'
import { authApi } from '@/api'
import {
  useAppStore,
  useBookStore,
  useCategoryStore,
  useUserStore,
} from '@/store'
import { useAppUpdate } from '@/composables/use-app-update'
import { getCurrentVersion } from '@/utils/app-update/device'

// APP 在线更新：手动检查入口（state 为模块级单例，弹窗仅挂载在首页，
// 本页发现新版本时返回上一页由首页弹出）
const { state: updateState, check: checkAppUpdate } = useAppUpdate()

// 退出登录需重置的接口缓存 store（避免换号登录后闪现上一位用户的数据）
const userStore = useUserStore()
const appStore = useAppStore()
const bookStore = useBookStore()
const categoryStore = useCategoryStore()

/** 关于菜单（App 端在下方条件编译内注入「检查更新」；非 App 端为空不渲染分组） */
const aboutMenu = ref([])

// 「检查更新」入口仅 App 端展示，右侧显示当前运行时版本号
// #ifdef APP-PLUS
const currentVersionName = getCurrentVersion().versionName
aboutMenu.value.push({
  title: '检查更新',
  icon: 'download',
  extra: currentVersionName ? `v${currentVersionName}` : '',
})
// #endif

/**
 * 菜单项点击：仅处理「检查更新」（走在线更新流程），
 * 其余占位反馈的死入口已随菜单项一并清理
 * @param {{title: string, icon: string, extra?: string}} item 被点击的菜单项
 */
const onMenuTap = (item) => {
  // #ifdef APP-PLUS
  if (item.title === '检查更新') {
    onManualCheck()
  }
  // #endif
}

/**
 * 手动检查更新：带 loading，无更新/失败由更新模块给出 toast；
 * 检查到新版本（弹窗状态已置 visible）时返回上一页，由首页挂载的
 * 全局唯一弹窗承接展示，本页不再重复挂载
 */
const onManualCheck = async () => {
  uni.showLoading({ title: '检查中…' })
  try {
    await checkAppUpdate({ silent: false })
  } finally {
    uni.hideLoading()
  }
  if (updateState.visible && getCurrentPages().length > 1) {
    uni.navigateBack()
  }
}

/** 返回上一页（页面栈只有当前页时兜底回首页） */
const onBack = () => {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/index/index' })
  }
}

/** 退出登录：二次确认后执行登出流程 */
const onLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '退出后将清空本机的登录信息与本地数据',
    confirmText: '退出',
    confirmColor: '#e06651',
    success: ({ confirm }) => {
      if (confirm) doLogout()
    },
  })
}

const loggingOut = ref(false)

/**
 * 退出登录时需清理的「账号相关」本地存储 key 清单（精确清理，不使用 clearStorageSync）：
 * - bk:rt：refresh token（authApi.logout 内部也会清，这里做兜底）；
 * - bk:bills / bk:book / bk:user：旧版本持久化遗留键（现版本这些 store 已不持久化，
 *   但老用户设备上可能残留上一位用户的数据）。
 * 刻意保留：app_update_device_id（灰度设备标识）、
 * app_update_pending_install_code（更新待安装回补标记）、
 * app_update_last_check_at（静默检查节流时间戳）、hitokoto_last（一言缓存）、
 * bk:bill_prefill（「再记一笔」一次性中转值，读取即删，与账号无关）。
 */
const LOGOUT_REMOVE_KEYS = ['bk:rt', 'bk:bills', 'bk:book', 'bk:user']

/**
 * 登出流程：
 * 1. 调服务端吊销 refresh token（内部已吞错并清本地 token，失败不阻断）；
 * 2. 按 key 清单清理账号相关本地数据（保留设备标识 / 更新标记 / 一言缓存）；
 * 3. 重置内存中的接口缓存 store（appStore.resetUI 会以默认值重写 bk:app_ui）；
 * 4. reLaunch 回登录页（清空页面栈，杜绝返回键回到已登出的页面）。
 */
async function doLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  uni.showLoading({ title: '退出中…', mask: true })
  try {
    await authApi.logout()
  } catch (e) {
    // 防御：logout 内部已吞错，任何异常都不阻断本地清理
  } finally {
    // 精确清理账号相关键，单条失败不影响其余键与后续登出流程
    LOGOUT_REMOVE_KEYS.forEach((key) => {
      try {
        uni.removeStorageSync(key)
      } catch (e) {
        // ignore：极端环境清理失败也不阻断登出
      }
    })
    // 重置内存缓存（book / category 的加载标记随 reset 一并复位）
    userStore.resetProfile()
    appStore.resetUI()
    bookStore.reset()
    categoryStore.reset()
    uni.hideLoading()
    uni.reLaunch({
      url: '/pages/login/index',
      complete: () => {
        loggingOut.value = false
        uni.showToast({ title: '已退出登录', icon: 'none' })
      },
    })
  }
}
</script>

<style lang="scss" scoped>
.settings {
  min-height: 100vh;
  background: $bg-page;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

// 顶部导航区：渐变 / 圆角 / 双圆装饰由 PageHeader 组件内聚，本页只保留插槽内导航样式
.nav {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  height: 96rpx;

  .back-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-title {
    margin-left: 22rpx;
    font-size: 36rpx;
    font-weight: 700;
    color: $text-inverse;
    letter-spacing: 1rpx;
  }
}

// 内容区（白卡上浮压住头部圆角）
.content {
  position: relative;
  z-index: 2;
  margin: -64rpx 24rpx 0;
}

.group {
  & + & {
    margin-top: 32rpx;
  }

  .group-label {
    display: block;
    margin: 0 8rpx 12rpx;
    font-size: 24rpx;
    color: $text-secondary;
  }

  // 菜单行本体（图标砖 / 标题 / 版本号 / 箭头 / 分割线）由 MenuItem 组件内聚
  .card {
    background: #fff;
    border-radius: $radius-card;
    box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);
    overflow: hidden;
  }
}

// 退出登录
.logout {
  margin-top: 48rpx;
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #e06651;
  background: #fff;
  border-radius: $radius-card;
  border: none;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.08);

  &::after {
    border: none;
  }

  &[loading] {
    opacity: 0.85;
  }
}

.slogan {
  display: block;
  margin-top: 36rpx;
  text-align: center;
  font-size: 22rpx;
  letter-spacing: 1rpx;
  color: #a9b3a9;
}
</style>
