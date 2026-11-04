<!--
  @file 账单详情页（pages/detail/index.vue）
  @description 以票据卡片样式展示单笔账单的完整信息：
               1. 顶部分类 emoji 图标、分类名与带符号金额；
               2. 票据分隔线及信息列表：所属账本、账户（支付方式）、记录人、
                  记录时间、备注、凭证照片缩略图（点击全屏预览）；
               3. 卡片底部展示「截止本单该月目前支出」累计金额；
               4. 底部操作：删除（二次确认）与编辑（携 id 跳转记账页）；
                  右上角「再记一笔」复制本单要素（金额/类型/分类/支付方式/备注）
                  经 storage 中转跳转记账页预填。
               页面自身不持有数据，onLoad 时优先取 query 中的 id（深链 / 分享
               落地 / H5 刷新场景），缺省再从上一页 eventChannel 兜底，从
               bill store 装载，账单被编辑后会依据变更事件自动刷新；
               详情展示分「加载中 / 失败（含不存在）/ 正常」三态，失败态
               提供重试与返回入口。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-10-11 金额格式化收敛至 utils/rmb；凭证 key 去 index；
               页面底色渐变改走 design token
  @modify 2026-10-12 深色模式：根节点接 themeClass，票据卡 / 操作圆钮底色与
               分隔线收敛至主题 token，删除 / 编辑图标色随主题取值
  @modify 2026-11-04 Liquid Glass 重构：壁纸 + 玻璃卡 + 玻璃浮层
-->
<template>
  <view class="detail-page" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源 -->
    <GlassBackground />

    <!-- 导航栏 -->
    <uni-nav-bar
      class="detail-nav"
      title="账单详情"
      left-icon="left"
      right-icon="redo"
      background-color="transparent"
      color="#ffffff"
      :border="false"
      status-bar
      @clickLeft="goBack"
      @clickRight="handleRedo"
    />

    <!-- 内容层：抬到壁纸之上 -->
    <view class="detail-page__content">
      <!-- 玻璃票据卡 -->
      <view v-if="detail" class="bill-card g-glass">
        <!-- 顶部图标 -->
        <view class="bill-icon-wrap">
          <text class="bill-icon">{{ detail.iconText }}</text>
        </view>

        <view class="bill-category">{{ detail.title }}</view>
        <view class="bill-amount">
          {{ detail.amount > 0 ? '+' : '' }}{{ formatMoney(detail.amount) }}
        </view>

        <!-- 票据分隔线 -->
        <view class="ticket-divider">
          <view class="notch notch-left"></view>
          <view class="notch notch-right"></view>
        </view>

        <!-- 详情信息 -->
        <view class="info-list">
          <view class="info-row">
            <text class="info-label">所属账本</text>
            <text class="info-value">{{ detail.bookName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">账户</text>
            <text class="info-value">{{ detail.payMethod }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">记录人</text>
            <text class="info-value">{{ detail.recorder }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">记录时间</text>
            <text class="info-value">{{ detail.recordTime }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">备注</text>
            <text class="info-value remark">{{ detail.remark }}</text>
          </view>
          <view v-if="detail.photos?.length" class="info-row photo-row">
            <text class="info-label">凭证照片</text>
            <view class="photo-thumbs">
              <template
                v-for="(photo, index) in detail.photos"
                :key="photo.key || photo.url"
              >
                <!-- 加载失败（如签名过期）的凭证图以灰底占位兜底 -->
                <view
                  v-if="photoFailed[index]"
                  class="photo-thumb photo-fallback"
                >
                  <text class="photo-fallback-text">加载失败</text>
                </view>
                <image
                  v-else
                  class="photo-thumb"
                  :src="photo.url"
                  mode="aspectFill"
                  lazy-load
                  @click="previewPhotos(index)"
                  @error="onPhotoError(index)"
                />
              </template>
            </view>
          </view>
        </view>

        <view class="month-summary">
          截止本单该月目前支出{{ detail.monthExpense }}元
        </view>
      </view>

      <!-- 数据加载中 -->
      <view
        v-else-if="detailLoading"
        class="loading-tip g-glass g-glass--thin g-pill"
      >
        账单加载中...
      </view>

      <!-- 加载失败 / 账单不存在：提供重试与返回 -->
      <view v-else-if="detailError" class="error-state g-glass g-glass--thick">
        <text class="error-title">账单不存在或加载失败</text>
        <text class="error-sub">请检查网络或链接是否有效</text>
        <view class="error-actions">
          <view class="error-btn primary g-press" @click="handleRetry">
            重试
          </view>
          <view class="error-btn g-press" @click="goBack">返回</view>
        </view>
      </view>
    </view>

    <!-- 底部玻璃操作区 -->
    <view
      v-if="detail"
      class="action-bar g-glass g-glass--thick g-float g-pill"
    >
      <view class="action-item g-press" @click="handleDelete">
        <view class="action-btn">
          <uni-icons type="trash" size="26" :color="dangerIcon"></uni-icons>
        </view>
        <text class="action-text">删除</text>
      </view>
      <view class="action-item g-press" @click="handleEdit">
        <view class="action-btn">
          <uni-icons type="compose" size="26" :color="primaryIcon"></uni-icons>
        </view>
        <text class="action-text">编辑</text>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 详情页脚本模块
 * 模块说明：
 * - useBillDetail()：优先按 query 中的 id（缺省走 eventChannel）装载详情
 *   视图模型（含账本名 / 记录人 / 记录时间 / 当月截止支出），提供
 *   loading / error / 正常三态与删除动作，编辑后依据变更事件自动刷新；
 * - 本页负责导航返回、删除二次确认、错误态重试、跳转编辑与图片预览交互，
 *   凭证图加载失败时展示占位并触发一次换签刷新（重拉详情取新签名 URL）。
 */
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useBillDetail, BILL_PREFILL_KEY } from '@/composables/useBookkeeping'
// 金额格式全应用统一收敛到 utils/rmb（四舍五入两位 + 固定两位小数）
import { formatMoney } from '@/utils/rmb'
import { useTheme } from '@/composables/useTheme'

// 主题外观：根节点挂 themeClass；uni-icons 的 color 为内联样式走不了 CSS 变量，
// 删除 / 编辑图标色需按 isDark 在 JS 侧取值（与 token 深浅两盘同色值）
const { themeClass, isDark } = useTheme()
const dangerIcon = computed(() => (isDark.value ? '#ef6f5c' : '#d54e3c'))
const primaryIcon = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))

// 详情数据按 id 从 bill store 读取，删除后通过 store 广播变更，各页面自动联动
const {
  detail,
  currentId,
  detailLoading,
  detailError,
  loadFromChannel,
  removeCurrent,
  reload,
} = useBillDetail()

// onLoad 入参（query）留档，供错误态「重试」重新解析（无 id 场景兜底）
let loadOptions = null

/** 页面加载：优先取 query 的 id，缺省注册 eventChannel 监听等待上一页 emit */
onLoad((options) => {
  loadOptions = options
  loadFromChannel(options)
})

/** 返回上一页 */
const goBack = () => {
  uni.navigateBack()
}

/**
 * 错误态重试：有 id 直接重拉详情；无 id（链接无效）时重新解析入参
 */
const handleRetry = () => {
  if (currentId.value) {
    reload(currentId.value)
    return
  }
  loadFromChannel(loadOptions)
}

/** 删除账单：先弹确认框，确认后调 DELETE /bills/:id；成功才提示并跳回 */
const handleDelete = () => {
  uni.showModal({
    title: '提示',
    content: '确定删除该账单吗？',
    success: async (res) => {
      if (!res.confirm) return
      if (!detail.value?.id) return
      try {
        const ok = await removeCurrent()
        if (!ok) return
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 300)
      } catch {
        // 删除失败：http 层已统一 toast 错误原因，这里仅中断跳转、停留原页
      }
    },
  })
}

/** 编辑账单：携带账单 id 跳转记账页，由其 onLoad 进入编辑回填模式 */
const handleEdit = () => {
  if (!detail.value?.id) return
  uni.navigateTo({ url: `/pages/add/index?id=${detail.value.id}` })
}

/**
 * 再记一笔：复制当前单据要素（金额 / 类型 / 分类 / 支付方式 / 备注）写入
 * storage 中转（BILL_PREFILL_KEY，记账页读取后即清），跳转记账页预填
 */
const handleRedo = () => {
  const d = detail.value
  if (!d) return
  try {
    uni.setStorageSync(BILL_PREFILL_KEY, {
      type: d.type,
      // 服务端 amount 带符号，预填表单输入用绝对值
      amount: String(Math.abs(Number(d.amount) || 0)),
      categoryId: d.categoryId || '',
      payMethodId: d.payMethodId || '',
      remark: d.remark || '',
    })
  } catch (e) {
    // storage 写入失败不阻断跳转，记账页按无预填处理
  }
  uni.navigateTo({ url: '/pages/add/index' })
}

/**
 * 点击缩略图全屏预览凭证（支持左右滑动查看多张）
 * @param {number} index 当前点击图片的下标，作为预览起始位置
 */
const previewPhotos = (index) => {
  // photos 为 {key,url} 对象数组，预览取 url 列表
  const urls = (detail.value.photos || []).map((p) => p.url)
  uni.previewImage({
    urls,
    current: urls[index],
  })
}

// 凭证图加载失败标记（下标 → true），失败图切换为灰底占位
const photoFailed = ref({})
// 换签刷新标记：凭证图为带签名的临时 URL，签名过期会导致加载失败；
// 现无单图换签接口，重拉详情（GET /bills/:id）即可拿到服务端重新签发的
// URL。仅自动触发一次，防止服务端持续异常时陷入「失败 → 重拉」死循环
let photoResigned = false

/**
 * 凭证图加载失败：标记占位；首次失败时重拉详情换签重试
 * @param {number} index 加载失败图片的下标
 */
const onPhotoError = (index) => {
  photoFailed.value[index] = true
  if (!photoResigned && currentId.value) {
    photoResigned = true
    reload(currentId.value)
  }
}

// 详情重拉成功（含换签刷新）后清空失败标记，给新签名 URL 一次加载机会
watch(detail, () => {
  photoFailed.value = {}
})
</script>

<style lang="scss" scoped>
.detail-page {
  position: relative;
  min-height: 100vh;
  /* 页面底色交给壁纸，页面自身透明 */
  background: transparent;
  /* 给底部悬浮玻璃操作区留出安全距离 */
  padding-bottom: calc(230rpx + env(safe-area-inset-bottom));
}

/* 导航栏：透明浮在壁纸上；color prop 为内联 #ffffff，浅色壁纸下需覆盖为标题墨色 */
.detail-nav {
  position: relative;
  z-index: 2;
}

.detail-nav :deep(.uni-nav-bar-text),
.detail-nav :deep(.uni-icons) {
  color: $text-title !important;
}

/* 内容层：抬到壁纸之上 */
.detail-page__content {
  position: relative;
  z-index: 1;
}

/* ---------- 玻璃票据卡 ---------- */
.bill-card {
  position: relative;
  margin: 120rpx 24rpx 0;
  padding: 0 40rpx 40rpx;
  border-radius: 48rpx;

  // 顶部图标：悬浮玻璃圆碟（一半探出卡片上沿）
  .bill-icon-wrap {
    position: absolute;
    top: -72rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 144rpx;
    height: 144rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--c-glass-strong, rgba(255, 255, 255, 0.72));
    background-image: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.42) 0%,
      rgba(255, 255, 255, 0) 62%
    );
    border: 1rpx solid var(--c-glass-border, rgba(255, 255, 255, 0.72));
    box-shadow:
      0 10rpx 28rpx rgba(4, 24, 18, 0.18),
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

    .bill-icon {
      font-size: 62rpx;
      line-height: 1;
    }
  }

  .bill-category {
    padding-top: 100rpx;
    text-align: center;
    font-size: 27rpx;
    color: $text-regular;
  }

  .bill-amount {
    margin-top: 16rpx;
    text-align: center;
    font-size: 62rpx;
    font-weight: 700;
    color: $text-title;
    font-variant-numeric: tabular-nums;
  }

  // 票据分隔线：虚线 + 两端凹陷缺口（半圆压在卡片边缘，读作「打孔」）
  .ticket-divider {
    position: relative;
    margin: 44rpx 0;
    height: 0;
    border-top: 2rpx dashed $divider-strong;

    .notch {
      position: absolute;
      top: -21rpx;
      width: 42rpx;
      height: 42rpx;
      border-radius: 50%;
      background: var(--c-glass-shade, rgba(12, 58, 46, 0.06));
      box-shadow: inset 0 2rpx 4rpx var(--c-glass-shade, rgba(12, 58, 46, 0.06));

      // 圆心正好落在卡片左右边缘（卡片内边距 40rpx + 半径 21rpx）
      &.notch-left {
        left: -61rpx;
      }

      &.notch-right {
        right: -61rpx;
      }
    }
  }

  // 详情信息
  .info-list {
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-size: 26rpx;
        color: $text-secondary;
        flex-shrink: 0;
      }

      .info-value {
        font-size: 27rpx;
        font-weight: 500;
        color: $text-primary;
        text-align: right;
        margin-left: 40rpx;

        &.remark {
          line-height: 1.5;
        }
      }

      // 凭证照片缩略图（.photo-row 与 .info-row 同节点，用复合选择器）
      &.photo-row {
        align-items: flex-start;

        .photo-thumbs {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12rpx;
          margin-left: 40rpx;

          .photo-thumb {
            width: 128rpx;
            height: 128rpx;
            border-radius: 16rpx;
          }

          // 凭证图加载失败占位（与缩略图同尺寸的凹陷玻璃块）
          .photo-fallback {
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
            box-shadow: inset 0 1rpx 0
              var(--c-glass-hi, rgba(255, 255, 255, 0.9));

            .photo-fallback-text {
              font-size: 20rpx;
              color: $text-secondary;
            }
          }
        }
      }
    }
  }

  // 当月累计：卡片内的凹陷玻璃条
  .month-summary {
    margin-top: 44rpx;
    padding: 18rpx 24rpx;
    text-align: center;
    font-size: 23rpx;
    color: $text-secondary;
    border-radius: 999rpx;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
  }
}

/* ---------- 加载中 / 失败态：玻璃面板 ---------- */
.loading-tip {
  margin: 200rpx 24rpx 0;
  padding: 26rpx 0;
  text-align: center;
  font-size: 27rpx;
  color: $text-regular;
  border-radius: 999rpx;
}

// 错误态（账单不存在 / 加载失败）：提供重试与返回
.error-state {
  margin: 200rpx 24rpx 0;
  padding: 56rpx 40rpx 48rpx;
  border-radius: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .error-title {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-title;
  }

  .error-sub {
    margin-top: 14rpx;
    font-size: 24rpx;
    color: $text-secondary;
  }

  .error-actions {
    display: flex;
    gap: 24rpx;
    margin-top: 44rpx;
  }

  .error-btn {
    min-width: 200rpx;
    height: 76rpx;
    line-height: 76rpx;
    padding: 0 44rpx;
    box-sizing: border-box;
    text-align: center;
    font-size: 27rpx;
    border-radius: 999rpx;
    color: $text-regular;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));

    // 主按钮：品牌绿着色玻璃（比面板更浅，避免与厚玻璃面板同色糊在一起）
    &.primary {
      font-weight: 600;
      color: $color-primary;
      background: rgba(76, 175, 135, 0.16);
      border-color: rgba(76, 175, 135, 0.42);
    }

    &:active {
      transform: scale(0.96);
    }
  }
}

/* ---------- 底部玻璃操作区（悬浮胶囊） ---------- */
.action-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(20rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 18rpx 36rpx;

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .action-btn {
      width: 84rpx;
      height: 84rpx;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
      box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
    }

    .action-text {
      margin-top: 10rpx;
      font-size: 22rpx;
      font-weight: 500;
      color: $text-regular;
    }
  }
}
</style>
