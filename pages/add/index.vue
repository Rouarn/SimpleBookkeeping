<!--
  @file 记账页（pages/add/index.vue，新增 / 编辑共用）
  @description 账单录入与编辑页面，通过 onLoad 是否携带 id 区分两种模式。本页只保留
               表单状态组合、字典匹配、编辑回填 / 预填 / 记忆应用与提交编排；
               金额输入（AmountField）、分类选择（CategoryPicker）、
               收付款方式（PayMethodPicker）、凭证照片（PhotoUploader）拆至
               pages/add/components/ 下，录入时间 picker 留在本页。
               新增时表单默认值取上次记账记忆；编辑时按 id 回填原账单。
               视觉层（Liquid Glass）：本页以 slide-in-bottom 方式打开（非 tab 页，
               无底部导航），首帧铺壁纸 GlassBackground，自上而下为
               ① 悬浮玻璃标题栏（关闭 + 标题）② 玻璃记账主面板（收支分段 /
               日期时间胶囊 / 凹陷金额格 / 分类玻璃块）③ 厚玻璃内容面板
               （支付方式 / 凭证照片 / 备注，内部滚动）④ 悬浮玻璃保存按钮。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 凭证 v-for key 去 index（key + 自增 _uid 兜底）；
               页面底色渐变 / 保存按钮渐变改走 design token；
               P2-15 金额 / 照片 / 分类 / 支付方式拆为子组件，本页瘦身为编排层
  @modify 2026-10-12 深色模式：根节点接 themeClass，白色内容区 / 文字色收敛至主题 token
  @modify 2026-11-04 Liquid Glass 重构：去掉整页深绿渐变 + 白色内容区 + uni-nav-bar，
                改为壁纸 + 玻璃标题栏 + 玻璃面板 + 悬浮保存按钮；数据流 / 事件 /
                表单状态与改造前完全一致，仅重排视觉层与容器结构
-->
<template>
  <view class="add-page" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源 -->
    <GlassBackground />

    <!-- 悬浮玻璃标题栏：关闭 + 标题（替代原 uni-nav-bar，status-bar 高度自管） -->
    <view class="add-bar g-glass g-glass--thin g-pill g-float">
      <view class="add-bar__close g-press" @click="handleClose">
        <uni-icons
          type="closeempty"
          size="16"
          color="var(--c-text, #202622)"
        ></uni-icons>
      </view>
      <text class="add-bar__title">{{ pageTitle }}</text>
      <!-- 与关闭钮等宽的占位，保证标题视觉居中 -->
      <view class="add-bar__ghost"></view>
    </view>

    <!-- 顶部记账主面板：收支切换 + 日期 / 时间 + 金额 + 分类 -->
    <view class="header">
      <view class="hero g-glass">
        <!-- 收支切换 + 日期 -->
        <view class="toolbar">
          <view class="tabs">
            <text
              class="tab"
              :class="{ on: billType === 'expense' }"
              @click="switchType('expense')"
              >支出</text
            >
            <text
              class="tab"
              :class="{ on: billType === 'income' }"
              @click="switchType('income')"
              >收入</text
            >
          </view>
          <view class="pill-group">
            <picker mode="date" :value="date" @change="onDateChange">
              <view class="date-pill">
                <text>{{ dateText }}</text>
                <uni-icons
                  type="arrow-down"
                  size="12"
                  color="var(--c-text-2, #6c736b)"
                ></uni-icons>
              </view>
            </picker>
            <!-- 时间选择：与日期联动，默认当前时刻；编辑时回填已选时间 -->
            <picker mode="time" :value="time" @change="onTimeChange">
              <view class="date-pill time-pill">
                <text>{{ time }}</text>
                <uni-icons
                  type="arrow-down"
                  size="12"
                  color="var(--c-text-2, #6c736b)"
                ></uni-icons>
              </view>
            </picker>
          </view>
        </view>

        <!-- 金额（约束 / 千分位 / 键盘内聚在 AmountField） -->
        <AmountField v-model="amount" />

        <!-- 分类图标（图标表与选中态内聚在 CategoryPicker） -->
        <CategoryPicker v-model="activeCategoryId" :bill-type="billType" />
      </view>
    </view>

    <!-- 厚玻璃内容面板：外壳只负责玻璃圆角与剩余高度，滚动交给内部 scroll-view -->
    <view class="sheet g-glass g-glass--thick g-radius-lg">
      <scroll-view class="sheet-scroll" scroll-y :show-scrollbar="false">
        <view class="sheet-inner">
          <!-- 收/付款方式 -->
          <PayMethodPicker v-model="payMethodId" :bill-type="billType" />

          <!-- 凭证照片（选图 / 压缩 / 上传 / 预览 / 删除内聚在 PhotoUploader） -->
          <PhotoUploader ref="photoUploaderRef" :photos="photos" />

          <!-- 备注 -->
          <view class="section">
            <view class="section-title">备注</view>
            <input
              v-model="remark"
              class="remark-input"
              maxlength="50"
              placeholder="请填写备注信息（限50字）"
              placeholder-style="color: var(--c-text-placeholder, #8b938d)"
            />
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 底部悬浮玻璃保存按钮 -->
    <view class="footer">
      <view class="save-btn g-btn-primary g-press" @click="handleSave"
        >保存</view
      >
    </view>
  </view>
</template>

<script setup>
/**
 * 记账页脚本模块（编排层）
 * 模块说明：
 * - 表单状态（收支类型 / 分类 id / 金额 / 支付方式 id / 日期时间 / 备注 / 照片）中，
 *   金额约束与照片上传由子组件内聚，本页保留提交口径的纯值与照片数组；
 * - 分类与支付方式字典来自 category / book store（接口缓存），选中态只维护 id
 *   （提交口径），渲染由子组件按 id 反查；时间默认当前时刻（mode=time picker），
 *   编辑时回填；
 * - useBillForm 提供「上次选择记忆」（存 id，失效自动回退第一项）、编辑回填
 *   （GET /bills/:id）、统一保存动作（POST/PATCH /bills）；
 * - 「再记一笔」预填经 storage 中转（BILL_PREFILL_KEY，详情页写入、本页读取即清）；
 * - 金额经 AmountField 的 v-model 统一规范化（2 位小数 / 上限 / 千分位仅展示）；
 * - 图片通过 POST /uploads/image 上传到服务端，保存时传 key 数组（编辑回填直接
 *   使用详情返回的 {key,url} 中的 key，不再从 URL 反解）。
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useBookStore, useCategoryStore } from '@/store'
import { useBillForm } from '@/composables/useBillEdit'
import { BILL_PREFILL_KEY } from '@/composables/useBillDetail'
import { todayStr, nowTime } from '@/utils/date'
import { useTheme } from '@/composables/useTheme'
// 页面目录子组件不走 easycom，需显式 import
import AmountField from './components/AmountField.vue'
import CategoryPicker from './components/CategoryPicker.vue'
import PayMethodPicker from './components/PayMethodPicker.vue'
import PhotoUploader from './components/PhotoUploader.vue'

const categoryStore = useCategoryStore()
const bookStore = useBookStore()
// 主题外观：根节点挂 themeClass（theme-light / theme-dark），联动全局 CSS 变量
const { themeClass } = useTheme()
// 表单记忆 + 保存动作（调服务端 POST/PATCH /bills）
const { remembered, saveBill, loadBillForEdit } = useBillForm()

// 编辑模式：详情页携带账单 id 跳转进来，先回填再改存
const editId = ref('')
// 导航标题随模式切换
const pageTitle = computed(() => (editId.value ? '编辑账单' : '个人账本'))

// ---------- 表单状态：初始值在字典就绪后由 onLoad 应用记忆 / 预填 / 编辑回填 ----------
const billType = ref(remembered.value.type) // 收支方向 expense / income
// 当前选中分类 id（提交用）；字典已预热时初始高亮第一项（与原默认名高亮等价）
const activeCategoryId = ref(
  categoryStore.listByType(billType.value)[0]?.id || '',
)
const amount = ref('') // 金额纯数字字符串（无千分位，保存时直接提交）
const remark = ref('') // 备注
const payMethodId = ref('') // 收/付款方式 id（提交用）
const photos = ref([]) // 凭证图片 [{key,url,_uid}]，最多 3 张（子组件原地增删）
// 照片子组件实例：编辑回填时调 setPhotos 归一化注入
const photoUploaderRef = ref(null)

// 记账时间（HH:mm）：默认当前时刻，编辑时回填已选时间
const time = ref(nowTime())
// 用户是否手动改过时间：未改过时把日期切回「今天」则时间跟随当前时刻
let timeTouched = false

/**
 * 选中分类：只维护 id（名称渲染由 CategoryPicker 按 id 反查）；
 * 保留对空字典项的防御性忽略（与原页面一致）
 * @param {{id?:string,name?:string}} [meta] 分类项（字典为空时忽略）
 */
function selectCategory(meta) {
  if (!meta?.name) return
  activeCategoryId.value = meta.id || ''
}

/**
 * 选中收/付款方式：只维护 id
 * @param {{id?:string,name?:string}} [pay] 支付方式项
 */
function selectPayMethod(pay) {
  if (!pay?.name) return
  payMethodId.value = pay.id || ''
}

// 记账日期，默认今天；dateText 为日期 pill 上的中文展示 'M月D日'
const date = ref(todayStr())
const dateText = computed(() => {
  const [, m, d] = date.value.split('-')
  return `${Number(m)}月${Number(d)}日`
})

/**
 * 应用上次记账记忆（按 id 匹配字典）：记忆项已被删除 / 变更时自动回退
 * 该类型第一项并提示，不再阻断保存；首次使用（无记忆）静默取第一项
 */
function applyRemembered() {
  const cats = categoryStore.listByType(billType.value)
  const pays = bookStore.payMethods
  const rememberedCat = cats.find((c) => c.id === remembered.value.categoryId)
  const rememberedPay = pays.find((p) => p.id === remembered.value.payMethodId)
  // 仅当「记过但已失效」时提示；首用无记忆不提示
  const catStale = !!remembered.value.categoryId && !rememberedCat
  const payStale = !!remembered.value.payMethodId && !rememberedPay
  selectCategory(rememberedCat || cats[0])
  selectPayMethod(rememberedPay || pays[0])
  if (catStale || payStale) {
    uni.showToast({ title: '原记忆项已失效，已重置', icon: 'none' })
  }
}

/**
 * 应用「再记一笔」预填（详情页经 storage 中转）：复制当前单据的
 * 收支类型 / 金额 / 分类 / 支付方式 / 备注，日期时间重置为当前时刻。
 * 金额为纯数字串，规范化与千分位展示由 AmountField 的 v-model watcher 完成。
 * @param {{type?:string,amount?:string,categoryId?:string,payMethodId?:string,remark?:string}} data
 */
function applyPrefill(data) {
  if (!data) return
  if (data.type === 'expense' || data.type === 'income') {
    billType.value = data.type
  }
  // 原分类 / 支付方式已失效时回退该类型第一项（与记忆失效同口径）
  const cats = categoryStore.listByType(billType.value)
  selectCategory(cats.find((c) => c.id === data.categoryId) || cats[0])
  const pays = bookStore.payMethods
  selectPayMethod(pays.find((p) => p.id === data.payMethodId) || pays[0])
  amount.value = String(data.amount ?? '')
  remark.value = data.remark || ''
  date.value = todayStr()
  time.value = nowTime()
  timeTouched = true
}

/**
 * 编辑模式：调 GET /bills/:id 拉取详情并逐项回填；
 * 凭证直接使用详情返回 photos 的 key，不再从签名 URL 反解
 * @param {string} id 账单 id
 */
async function applyEditBackfill(id) {
  const bill = await loadBillForEdit(id)
  if (!bill) return
  editId.value = bill.id
  billType.value = bill.type
  activeCategoryId.value = bill.categoryId || ''
  // 服务端 amount 带符号，表单输入用绝对值（规范化由 AmountField watcher 完成）
  amount.value = String(Math.abs(Number(bill.amount) || 0))
  payMethodId.value = bill.payMethodId || ''
  date.value = bill.date
  time.value = bill.time || nowTime() // 回填已选时间（HH:mm）
  timeTouched = true
  remark.value = bill.remark
  // 回填凭证：归一化与截断 3 张由 PhotoUploader 负责
  photoUploaderRef.value?.setPhotos(bill.photos)
}

/**
 * 页面加载生命周期：
 * - 先等字典就绪（按 id 匹配分类 / 支付方式依赖字典）；
 * - 携带 id（从详情页编辑进入）→ 拉取详情回填；
 * - 无 id → 优先应用「再记一笔」预填（storage 中转），否则应用上次记忆。
 * @param {{id?: string}} [options] 页面路由参数
 */
onLoad(async (options) => {
  // 预热字典并等待完成（App.vue 已预热过则跳过）
  await Promise.all([
    categoryStore.fetchAll().catch(() => {}),
    bookStore.fetchPayMethods().catch(() => {}),
  ])

  if (options?.id) {
    await applyEditBackfill(options.id)
    return
  }

  // 「再记一笔」预填：详情页写入 storage，读取后立即清除避免残留
  let prefill = null
  try {
    prefill = uni.getStorageSync(BILL_PREFILL_KEY) || null
    if (prefill) uni.removeStorageSync(BILL_PREFILL_KEY)
  } catch (e) {
    prefill = null
  }
  if (prefill) applyPrefill(prefill)
  else applyRemembered()
})

/**
 * 切换收支方向，同时把选中分类重置为该方向的第一个分类
 * @param {import('@/store/types').BillType} type 目标类型
 */
function switchType(type) {
  billType.value = type
  selectCategory(categoryStore.listByType(type)[0])
}

/**
 * 日期 picker 选中回调；切回今天且未手动改过时间时，时间跟随当前时刻
 * @param {object} e e.detail.value 形如 '2026-09-14'
 */
function onDateChange(e) {
  date.value = e.detail.value
  if (!timeTouched && date.value === todayStr()) {
    time.value = nowTime()
  }
}

/**
 * 时间 picker 选中回调
 * @param {object} e e.detail.value 形如 '18:39'
 */
function onTimeChange(e) {
  timeTouched = true
  time.value = e.detail.value
}

/** 点击左上角关闭：放弃录入 / 编辑并返回上一页 */
function handleClose() {
  uni.navigateBack()
}

/**
 * 保存账单（新增或更新）：
 * 1. 金额规范化为纯数字字符串（去尾部小数点）并校验为正数；
 * 2. 校验分类 / 支付方式 id 已就绪（选中态即持 id，无需按 name 反查）；
 * 3. 提取 photos key 数组；4. 交给 useBillForm.saveBill 调 POST/PATCH /bills；
 * 5. 成功后提示并返回。
 */
async function handleSave() {
  // 提交前规范化：去掉仅用于输入过程的尾部小数点，与 BE 口径一致
  const amountStr = amount.value.replace(/\.$/, '')
  const value = Number(amountStr)
  if (!value || value <= 0) {
    uni.showToast({ title: '请输入正确的金额', icon: 'none' })
    return
  }
  if (!activeCategoryId.value) {
    uni.showToast({ title: '分类数据未就绪，请稍后', icon: 'none' })
    return
  }
  if (!payMethodId.value) {
    uni.showToast({ title: '支付方式未就绪，请稍后', icon: 'none' })
    return
  }
  uni.showLoading({ title: '保存中', mask: true })
  const result = await saveBill(
    {
      type: billType.value,
      amount: amountStr, // 纯数字字符串（最多 2 位小数，≤99999999.99）
      categoryId: activeCategoryId.value,
      payMethodId: payMethodId.value,
      date: date.value,
      time: time.value, // 'HH:mm'，服务端缺省时取当前时间
      remark: remark.value,
      photos: photos.value.map((p) => p.key).filter(Boolean),
    },
    editId.value || undefined,
  ).finally(() => uni.hideLoading())
  if (!result.ok) {
    uni.showToast({ title: result.error || '保存失败', icon: 'none' })
    return
  }
  uni.showToast({ title: '保存成功', icon: 'success' })
  // 增删改已通过 BILL_CHANGE_EVENT 广播，返回后首页/流水/统计 onShow 会重新拉取
  setTimeout(() => uni.navigateBack(), 600)
}
</script>

<style lang="scss" scoped>
.add-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  // 透明根节点：壁纸由 GlassBackground 铺底，玻璃面板才有可折射的内容
  background: transparent;
}

/* ---------- 悬浮玻璃标题栏 ---------- */
.add-bar {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: calc(var(--status-bar-height) + 12rpx);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 96rpx;
  padding: 0 14rpx;
  box-sizing: border-box;

  // 关闭钮：凹陷玻璃圆钮（macOS 26 的交通灯位）
  &__close {
    width: 68rpx;
    height: 68rpx;
    flex-shrink: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
    box-shadow:
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
      inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
  }

  &__title {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 30rpx;
    font-weight: 600;
    letter-spacing: 0.5rpx;
    color: $text-title;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__ghost {
    width: 68rpx;
    height: 68rpx;
    flex-shrink: 0;
  }
}

/* ---------- 顶部记账主面板 ---------- */
.header {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  // 给悬浮标题栏让出位置（96rpx 高度 + 12rpx 顶部间距 + 16rpx 呼吸）
  padding: calc(var(--status-bar-height) + 124rpx) 20rpx 0;
}

.hero {
  // .g-glass 给的 36rpx 圆角在玻璃大卡上偏小，改用连续大圆角
  border-radius: 48rpx;
  padding: 20rpx 26rpx 26rpx;
}

// 收支切换 + 日期
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  // 分段控件：凹陷玻璃轨道 + 选中项强玻璃滑块
  .tabs {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 6rpx;
    border-radius: 999rpx;
    background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
    border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
    box-shadow:
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
      inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));

    .tab {
      padding: 10rpx 26rpx;
      border-radius: 999rpx;
      font-size: 28rpx;
      line-height: 1.25;
      color: $text-regular;
      transition:
        color 0.2s ease,
        background-color 0.2s ease,
        box-shadow 0.2s ease;

      &.on {
        background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.74));
        color: $color-primary-deep;
        font-weight: 600;
        box-shadow:
          0 6rpx 16rpx rgba(22, 48, 38, 0.14),
          inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95));
      }
    }
  }

  // 日期 / 时间胶囊：凹陷玻璃胶囊
  .date-pill {
    display: flex;
    align-items: center;
    padding: 11rpx 22rpx;
    border-radius: 999rpx;
    background-color: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
    border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
    box-shadow:
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
      inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));

    text {
      font-size: 25rpx;
      line-height: 1.2;
      color: $text-regular;
      margin-right: 6rpx;
      font-variant-numeric: tabular-nums;
    }
  }

  // 日期 + 时间胶囊组（时间胶囊与日期同款样式，仅加间距）
  .pill-group {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    .time-pill {
      margin-left: 12rpx;
    }
  }
}

/* ---------- 厚玻璃内容面板 ---------- */
// 外壳只负责玻璃圆角外形与「剩余高度」；滚动交给内部绝对定位铺满的 scroll-view
.sheet {
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
  margin: 20rpx 20rpx 0;
  overflow: hidden;
}

// scroll-view 用四边 inset 拿到确定高度：fixed 页面 -> flex:1 外壳 -> 绝对定位铺满，
// 在 H5 / App / 小程序下高度都可解析，避免键盘弹收、照片加载重排后滚动高度失真。
// scroll-view 在小程序 / App 端可能是独立原生渲染层，父级圆角裁不到它，
// 故圆角也要设在它自己身上（背景透明，由外层玻璃面板透出）
.sheet-scroll {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 48rpx;
  background: transparent;
}

// 内边距统一放在滚动内容上（直接给 scroll-view 设 padding 在部分平台会压缩滚动区）
.sheet-inner {
  padding: 26rpx 28rpx 36rpx;
  box-sizing: border-box;
}

.section {
  .section-title {
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.5rpx;
    color: $text-title;
    margin: 24rpx 0 20rpx;
  }
}

// 备注：凹陷玻璃输入格（内底 + 内高光 + 发丝描边，聚焦时主色环）
.remark-input {
  width: 100%;
  height: 96rpx;
  padding: 0 26rpx;
  box-sizing: border-box;
  border-radius: 26rpx;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.55));
  border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
  font-size: 29rpx;
  color: $text-title;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus {
    border-color: rgba($color-accent, 0.6);
    box-shadow:
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
      0 0 0 2rpx rgba($color-accent, 0.26);
  }
}

/* ---------- 底部悬浮玻璃保存按钮 ---------- */
.footer {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

// 主按钮：纸面 + 四色细环 + 墨色字（材质由全局 .g-btn-primary 提供）
.save-btn {
  height: 100rpx;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  /* 纸面 + 四色环 + 墨色字，与底部记账按钮同一套材质 */
}
</style>
