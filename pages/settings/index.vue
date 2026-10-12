<!--
  @file 设置页（pages/settings/index.vue）
  @description 应用设置中心：
               1. 主题外观：深色模式三段选择器；
               2. 数据与提醒：「导出数据」（App 写入 _doc 后拉起系统应用打开 /
                  H5 Blob 触发浏览器下载；服务端限流 6 次/小时，超限映射提示）、
                  「记账提醒」（App 端注册每日本地推送，H5/小程序仅保存设置）；
               3. 账号：「注销账号」（editable 弹窗输入密码确认，成功后清理
                  本地登录态并回登录页）；
               4. 关于：App 端提供「检查更新」入口（右侧展示当前运行时版本号）；
               5. 退出登录：二次确认后吊销服务端 token（失败不阻断），
                  按 key 清单清理账号相关本地数据（refresh token、旧版本
                  遗留的账单/账本/资料持久化键），并重置内存中的接口缓存 store；
                  设备标识、更新待安装回补标记、一言缓存等与账号无关的数据保留，
                  最后 reLaunch 回登录页。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-16
  @modify 2026-10-11 抽取 PageHeader / MenuItem 公共组件
  @modify 2026-10-12 新增「主题外观」分组（深色模式三段选择器），根节点接 themeClass
  @modify 2026-10-12 新增导出数据 / 记账提醒 / 注销账号；登出与注销共用本地清理
  @modify 2026-10-12 修复检查更新无弹窗：本页挂载 UpdatePopup 就地展示，
               移除「发现新版本自动返回上一页」的跳转逻辑
-->
<template>
  <view class="settings" :class="themeClass">
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
      <!-- 主题外观：跟随系统 / 浅色 / 深色（持久化于本地，见 composables/useTheme.js） -->
      <view class="group">
        <text class="group-label">主题外观</text>
        <view class="card">
          <view class="theme-row">
            <view class="theme-seg">
              <view
                v-for="opt in themeOptions"
                :key="opt.value"
                class="seg-item"
                :class="{ on: themeMode === opt.value }"
                @click="onThemeModeTap(opt.value)"
              >
                <text class="seg-text">{{ opt.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 数据与提醒（导出仅 App / H5 端；记账提醒 H5/小程序仅保存设置） -->
      <view class="group">
        <text class="group-label">数据与提醒</text>
        <view class="card">
          <!-- #ifdef APP-PLUS || H5 -->
          <MenuItem
            icon="cloud-download-filled"
            label="导出数据"
            @click="onExport"
          />
          <!-- #endif -->
          <!-- 记账提醒：开关 + 时间选择（App 端注册每日本地推送） -->
          <view class="remind-row">
            <view class="row-icon">
              <uni-icons
                type="notification-filled"
                size="23"
                :color="menuIconColor"
              ></uni-icons>
            </view>
            <text class="row-title">记账提醒</text>
            <!-- #ifndef APP-PLUS -->
            <text class="row-note">提醒暂支持 App 端</text>
            <!-- #endif -->
            <switch
              class="row-switch"
              :checked="remind.enabled"
              :color="switchColor"
              @change="onRemindToggle"
            />
          </view>
          <!-- 开启时显示时间选择（默认 20:00），变更即重排本地推送 -->
          <view v-if="remind.enabled" class="remind-time-row">
            <view class="row-icon row-icon-placeholder"></view>
            <text class="row-title">提醒时间</text>
            <picker
              class="time-picker"
              mode="time"
              :value="remind.hhmm"
              @change="onRemindTimeChange"
            >
              <view class="time-value">
                <text class="time-text">{{ remind.hhmm }}</text>
                <uni-icons type="right" size="14" color="#c2c9c3"></uni-icons>
              </view>
            </picker>
          </view>
        </view>
      </view>

      <!-- 账号（危险操作：红色文字） -->
      <view class="group">
        <text class="group-label">账号</text>
        <view class="card">
          <view
            class="danger-row"
            hover-class="danger-hover"
            :hover-stay-time="60"
            @click="onDeactivate"
          >
            <view class="row-icon">
              <uni-icons
                type="trash"
                size="23"
                :color="dangerColor"
              ></uni-icons>
            </view>
            <text class="row-title danger-title">注销账号</text>
            <uni-icons type="right" size="14" color="#c2c9c3"></uni-icons>
          </view>
        </view>
      </view>

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

    <!-- 全局更新弹窗：检查到新版本时就地展示（弹窗为模块级单例状态，
         与首页挂载的实例共享，当前页可见时仅本页实例渲染） -->
    <UpdatePopup />
  </view>
</template>

<script setup>
/**
 * 设置页脚本
 * - 「数据与提醒」：导出数据（App 写 _doc + openFile / H5 Blob 下载，
 *   限流超限 42900 映射「导出次数已达上限」）；记账提醒（App 端每日本地
 *   推送，plus.push.createMessage/ removeMessage，设置持久化 bk:remind）；
 * - 「账号」：注销账号（editable 弹窗输密码 → POST /users/me/deactivate →
 *   清理本地登录态 → 回登录页；密码错误等 toast 由 http 层统一处理）；
 * - 「关于」菜单（「检查更新」仅 App 端注入）；
 * - 退出登录：与注销共用 clearLocalAccount() 本地清理。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { authApi, usersApi, bufferToText } from '@/api'
import {
  useAppStore,
  useBookStore,
  useCategoryStore,
  useUserStore,
} from '@/store'
import { useAppUpdate } from '@/composables/use-app-update'
import UpdatePopup from '@/components/update-popup.vue'
import { useTheme } from '@/composables/useTheme'
import { currentMonth } from '@/utils/date'
import { getCurrentVersion } from '@/utils/app-update/device'

// APP 在线更新：手动检查入口（弹窗组件已在本页挂载，发现新版本就地弹出；
// 弹窗状态为模块级单例，与首页挂载的实例共享）
const { check: checkAppUpdate } = useAppUpdate()

// 深色模式：根节点主题类 + JS 取色（switch / uni-icons color 走不了 CSS 变量）
const {
  mode: themeMode,
  themeClass,
  isDark,
  setMode: setThemeMode,
} = useTheme()
// 菜单行图标色（浅 #2f6b54 / 深 #58b992，与 token 深浅两盘同色值）
const menuIconColor = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))
// switch 选中色（同 token 两盘）
const switchColor = menuIconColor
// 危险行图标 / 文字色（浅 #d54e3c / 深调亮 #e06651）
const dangerColor = computed(() => (isDark.value ? '#e06651' : '#d54e3c'))

const themeOptions = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

/**
 * 切换主题模式
 * @param {'auto'|'light'|'dark'} value 目标模式
 */
const onThemeModeTap = (value) => {
  setThemeMode(value)
}

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
 * 检查到新版本时就地弹出更新弹窗（本页已挂载 UpdatePopup，不再跳转）
 */
const onManualCheck = async () => {
  uni.showLoading({ title: '检查中…' })
  try {
    await checkAppUpdate({ silent: false })
  } finally {
    uni.hideLoading()
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

// ==================== 数据导出 ====================

const exporting = ref(false)

/** 点击「导出数据」：ActionSheet 选择范围（本账单月 / 全部） */
function onExport() {
  const month = currentMonth()
  uni.showActionSheet({
    itemList: [`本账单月（${month}）`, '全部账单'],
    success: ({ tapIndex }) => {
      doExport(tapIndex === 0 ? month : '')
    },
  })
}

/**
 * 执行导出：拉取 CSV 流 → 端侧落盘/下载 → 打开
 * @param {string} month 'YYYY-MM'，空串导出全部
 */
async function doExport(month) {
  if (exporting.value) return
  exporting.value = true
  uni.showLoading({ title: '导出中…', mask: true })
  try {
    const buffer = await usersApi.exportCsv(month ? { month } : {})
    const filename = `导出账单_${month ? month.replace('-', '') : 'all'}.csv`
    // #ifdef APP-PLUS
    await saveCsvFile(bufferToText(buffer), filename)
    uni.hideLoading()
    uni.showToast({ title: '已导出，选择应用打开', icon: 'none' })
    openCsvFile(filename)
    // #endif
    // #ifdef H5
    downloadCsvH5(buffer, filename)
    uni.hideLoading()
    uni.showToast({ title: '已下载', icon: 'none' })
    // #endif
  } catch (err) {
    uni.hideLoading()
    // 导出限流 6 次/小时（错误码 42900）单独映射文案
    const title =
      err && err.code === 42900
        ? '导出次数已达上限，请稍后再试'
        : (err && err.message) || '导出失败，请稍后再试'
    uni.showToast({ title, icon: 'none' })
  } finally {
    exporting.value = false
  }
}

// #ifdef APP-PLUS
/**
 * App 端：CSV 文本写入 _doc（中文文件名 OK），成功返回文件句柄
 * @param {string} text CSV 全文（UTF-8 含 BOM）
 * @param {string} filename 文件名
 * @returns {Promise<void>}
 */
function saveCsvFile(text, filename) {
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      '_doc/',
      (dirEntry) => {
        dirEntry.getFile(
          filename,
          { create: true },
          (fileEntry) => {
            fileEntry.createWriter(
              (writer) => {
                writer.onwrite = () => resolve()
                writer.onerror = () => reject(new Error('写入文件失败'))
                writer.write(text)
              },
              () => reject(new Error('创建写入器失败')),
            )
          },
          () => reject(new Error('创建文件失败')),
        )
      },
      () => reject(new Error('访问存储目录失败')),
    )
  })
}

/**
 * App 端：拉起系统应用打开已导出的 CSV（分享给可处理 CSV 的应用）
 * @param {string} filename 文件名（_doc 相对路径）
 */
function openCsvFile(filename) {
  try {
    plus.runtime.openFile(`_doc/${filename}`, {}, () => {
      uni.showToast({ title: '未找到可打开 CSV 的应用', icon: 'none' })
    })
  } catch (e) {
    uni.showToast({ title: '打开文件失败', icon: 'none' })
  }
}
// #endif

// #ifdef H5
/**
 * H5：Blob + a[download] 触发浏览器下载
 * @param {ArrayBuffer} buffer CSV 二进制
 * @param {string} filename 下载文件名
 */
function downloadCsvH5(buffer, filename) {
  const blob = new Blob([buffer], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
// #endif

// ==================== 记账提醒（App 本地通知） ====================

/** 提醒设置持久化 key：{enabled, hhmm}；本地推送 message id key */
const REMIND_KEY = 'bk:remind'
const REMIND_ID_KEY = 'bk:remind_id'
/** 默认提醒时间 20:00 */
const DEFAULT_REMIND_TIME = '20:00'

/**
 * 归一化提醒设置（脏值回退默认）
 * @param {unknown} raw 本地读取值
 * @returns {{enabled: boolean, hhmm: string}}
 */
function normalizeRemind(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: obj.enabled === true,
    hhmm:
      typeof obj.hhmm === 'string' && /^\d{2}:\d{2}$/.test(obj.hhmm)
        ? obj.hhmm
        : DEFAULT_REMIND_TIME,
  }
}

/** @type {import('vue').Ref<{enabled: boolean, hhmm: string}>} */
const remind = ref(
  (() => {
    try {
      return normalizeRemind(uni.getStorageSync(REMIND_KEY))
    } catch {
      return normalizeRemind(null)
    }
  })(),
)

/** 落盘提醒设置 */
function persistRemind() {
  try {
    uni.setStorageSync(REMIND_KEY, remind.value)
  } catch {
    // ignore：落盘失败不阻断本次会话
  }
}

// #ifdef APP-PLUS
/**
 * Android 13+ 申请通知运行时权限（POST_NOTIFICATIONS）。
 * 低版本（SDK<33）无此运行时权限、已授权或平台不支持时均直接放行；
 * 用户拒绝返回 false，由调用方回滚开关并引导系统设置。
 * @returns {Promise<boolean>}
 */
function ensureNotificationPermission() {
  return new Promise((resolve) => {
    try {
      const Build = plus.android.importClass('android.os.Build')
      if (Number(Build.VERSION.SDK_INT) < 33) return resolve(true)
      plus.android.requestPermissions(
        ['android.permission.POST_NOTIFICATIONS'],
        (res) =>
          resolve(
            !(res.deniedPresent?.length > 0 || res.deniedAlways?.length > 0),
          ),
        () => resolve(false),
      )
    } catch {
      resolve(true)
    }
  })
}

/** 跳转系统「应用详情」设置页（用户永久拒绝通知后的兜底引导） */
function openAppSettings() {
  try {
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    const Uri = plus.android.importClass('android.net.Uri')
    const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.setData(
      Uri.fromParts(
        'package',
        plus.android.runtimeMainActivity().getPackageName(),
        null,
      ),
    )
    plus.android.runtimeMainActivity().startActivity(intent)
  } catch {
    // ignore：跳转失败时用户仍可手动从系统设置进入
  }
}

/** 取消已注册的提醒本地推送（按持久化 message id），并清掉 id */
function cancelRemindMessage() {
  try {
    const id = uni.getStorageSync(REMIND_ID_KEY)
    if (id) plus.push.removeMessage(String(id))
  } catch {
    // ignore：推送中心异常不阻断设置流程
  }
  try {
    uni.removeStorageSync(REMIND_ID_KEY)
  } catch {
    // ignore
  }
}

/**
 * 注册每日本地推送：先取消旧的，再按 hh:mm 计算下一次触发时刻
 * （当天已过则排明天），记录返回的 message id 供关闭/重排时删除
 * @param {string} hhmm 'HH:mm'
 */
function scheduleRemindMessage(hhmm) {
  cancelRemindMessage()
  const [h, m] = String(hhmm || DEFAULT_REMIND_TIME)
    .split(':')
    .map(Number)
  const now = new Date()
  const next = new Date()
  next.setHours(h || 0, m || 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  const delaySec = Math.max(
    1,
    Math.round((next.getTime() - now.getTime()) / 1000),
  )
  try {
    // 签名：createMessage(content, payload, options)，content 必须是字符串
    //（传对象会被序列化成通知正文原文显示），delay/title 放第三参 options
    const msgId = plus.push.createMessage('今天还没记账哦，来记一笔吧', '', {
      title: '小绿记账',
      delay: delaySec,
      sound: 'system',
    })
    if (msgId) uni.setStorageSync(REMIND_ID_KEY, String(msgId))
  } catch {
    // ignore：注册失败静默，设置已保存，下次开关/改时间会重试
  }
}
// #endif

/** 开关记账提醒：App 端先申请通知权限，通过后持久化并注册本地推送 */
async function onRemindToggle(e) {
  const want = !!e.detail.value
  // #ifdef APP-PLUS
  if (want) {
    const granted = await ensureNotificationPermission()
    if (!granted) {
      // 回滚开关（UI 随之弹回），不落盘、不注册推送
      remind.value = { ...remind.value, enabled: false }
      uni.showModal({
        title: '通知权限未开启',
        content: '记账提醒需要通知权限，是否前往系统设置开启？',
        confirmText: '去设置',
        success: (r) => {
          if (r.confirm) openAppSettings()
        },
      })
      return
    }
  }
  // #endif
  remind.value = { ...remind.value, enabled: want }
  persistRemind()
  // #ifdef APP-PLUS
  if (want) {
    scheduleRemindMessage(remind.value.hhmm)
  } else {
    cancelRemindMessage()
  }
  // #endif
}

/** 变更提醒时间：持久化 + App 端重排本地推送 */
function onRemindTimeChange(e) {
  remind.value = { ...remind.value, hhmm: e.detail.value }
  persistRemind()
  // #ifdef APP-PLUS
  if (remind.value.enabled) scheduleRemindMessage(remind.value.hhmm)
  // #endif
}

// 已开启提醒时进页重排一次（先删旧再建新，避免本地消息触发后节奏中断）
onShow(() => {
  // #ifdef APP-PLUS
  if (remind.value.enabled) scheduleRemindMessage(remind.value.hhmm)
  // #endif
})

// ==================== 账号：注销 / 退出登录 ====================

/**
 * 注销账号：editable 弹窗输入密码确认（说明 30 天保留期后永久删除）
 * → POST /users/me/deactivate → 清理本地登录态 → reLaunch 登录页
 */
function onDeactivate() {
  uni.showModal({
    title: '注销账号',
    editable: true,
    placeholderText: '请输入登录密码确认',
    content:
      '数据将在 30 天保留期后永久删除，期间无法恢复；确认请输入登录密码。',
    confirmText: '确认注销',
    confirmColor: '#e06651',
    success: ({ confirm, content }) => {
      if (!confirm) return
      const password = (content || '').trim()
      if (!password) {
        uni.showToast({ title: '请输入登录密码', icon: 'none' })
        return
      }
      doDeactivate(password)
    },
  })
}

const deactivating = ref(false)

/**
 * 执行注销：成功后服务端已吊销全部登录态，本地仅做清理（不再调 logout），
 * 保留设备标识等白名单数据；密码错误等错误提示由 http 层统一 toast
 * @param {string} password 登录密码（8~32 位）
 */
async function doDeactivate(password) {
  if (deactivating.value) return
  deactivating.value = true
  uni.showLoading({ title: '注销中…', mask: true })
  try {
    await usersApi.deactivate({ password })
    uni.hideLoading()
    await clearLocalAccount({ serverLogout: false })
    uni.reLaunch({
      url: '/pages/login/index',
      complete: () => {
        deactivating.value = false
        uni.showToast({ title: '账号已注销', icon: 'none' })
      },
    })
  } catch (e) {
    deactivating.value = false
    uni.hideLoading()
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
 * bk:bill_prefill（「再记一笔」一次性中转值，读取即删，与账号无关）、
 * bk:theme（主题外观）与 bk:remind*（记账提醒，设备级偏好）。
 */
const LOGOUT_REMOVE_KEYS = ['bk:rt', 'bk:bills', 'bk:book', 'bk:user']

/**
 * 账号本地数据清理（退出登录 / 注销账号共用）：
 * 1. 按需调服务端吊销 refresh token（注销成功后服务端已吊销，无需再调）；
 * 2. 按 key 清单清理账号相关本地数据（保留设备标识 / 更新标记 / 一言缓存）；
 * 3. 重置内存中的接口缓存 store（appStore.resetUI 会以默认值重写 bk:app_ui）。
 * @param {{serverLogout?: boolean}} [opts]
 */
async function clearLocalAccount({ serverLogout = true } = {}) {
  if (serverLogout) {
    try {
      await authApi.logout()
    } catch (e) {
      // 防御：logout 内部已吞错，任何异常都不阻断本地清理
    }
  }
  // 精确清理账号相关键，单条失败不影响其余键与后续流程
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
}

/**
 * 登出流程：clearLocalAccount（含服务端吊销）→ reLaunch 回登录页
 * （清空页面栈，杜绝返回键回到已登出的页面）
 */
async function doLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  uni.showLoading({ title: '退出中…', mask: true })
  try {
    await clearLocalAccount()
  } finally {
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
    background: $bg-card;
    border-radius: $radius-card;
    box-shadow: $shadow-card-lg;
    overflow: hidden;
  }
}

// 主题外观：三段选择器（与统计页月/年切换同一视觉语言）
.theme-row {
  padding: 20rpx 24rpx;
}

.theme-seg {
  display: flex;
  padding: 4rpx;
  background: $bg-toggle;
  border-radius: 999rpx;

  .seg-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14rpx 0;
    border-radius: 999rpx;
    transition: all 0.25s ease;

    .seg-text {
      font-size: 26rpx;
      color: $text-regular;
    }

    &.on {
      background: $bg-card;
      box-shadow: $shadow-float;

      .seg-text {
        color: $color-primary-mid;
        font-weight: 600;
      }
    }
  }
}

// 数据与提醒 / 账号分组里的自定义行（图标砖 + 标题 + 右侧控件，
// 与 MenuItem 同一套行高与分割线视觉）。
// 分割线约定：导出数据 MenuItem 自带底部分割线（非 last-child 时显示），
// 提醒时间行自带顶部分割线；提醒主行与注销行分别处于卡片首行/独立卡片，无需分割线。
.remind-row,
.remind-time-row,
.danger-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
}

.remind-time-row::before {
  content: '';
  position: absolute;
  left: 104rpx;
  right: 0;
  top: 0;
  height: 1rpx;
  background: $divider;
}

.remind-row .row-icon,
.remind-time-row .row-icon,
.danger-row .row-icon {
  width: 64rpx;
  height: 64rpx;
  margin-right: 22rpx;
  border-radius: $radius-md;
  background: $bg-tint-icon;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.remind-row .row-title,
.remind-time-row .row-title,
.danger-row .row-title {
  flex: 1;
  font-size: 29rpx;
  font-weight: 500;
  color: $text-primary;
}

// 非 App 端的「提醒暂支持 App 端」标注（弱化灰字）
.remind-row .row-note {
  margin-right: 16rpx;
  font-size: 23rpx;
  color: $text-secondary;
  flex-shrink: 0;
}

.remind-row .row-switch {
  flex-shrink: 0;
  transform: scale(0.85);
  transform-origin: right center;
}

// 提醒时间行：picker 触发区右对齐
.remind-time-row {
  .row-icon-placeholder {
    background: transparent;
  }

  .time-picker {
    flex-shrink: 0;
  }

  .time-value {
    display: flex;
    align-items: center;

    .time-text {
      margin-right: 10rpx;
      font-size: 27rpx;
      color: $text-regular;
      font-variant-numeric: tabular-nums;
    }
  }
}

// 注销账号：危险行（红字），按压底色随主题 token
.danger-row {
  &.danger-hover {
    background: $bg-hover;
  }

  .danger-title {
    color: $color-danger-btn;
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
  color: $color-danger-btn;
  background: $bg-card;
  border-radius: $radius-card;
  border: none;
  box-shadow: $shadow-card-lg;

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
  color: $text-secondary;
}
</style>
