<!--
  @file 登录/注册页（pages/login/index.vue）
  @description 账号密码登录与注册切换；登录成功后 reLaunch 到首页。
               未登录访问其他页面时由 App.vue onLaunch / http 401 拦截统一跳转。
               macOS 26 Liquid Glass 版：壁纸铺底 + 玻璃页头 + 玻璃表单卡
               + 凹陷玻璃输入框 + 品牌渐变主按钮（玻璃高光 / 按压态）。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-16
  @modify 2026-10-11 抽取 PageHeader 公共渐变页头
  @modify 2026-10-12 深色模式：根节点接 themeClass，表单卡 / 输入框 / 勾选框
               底色边框收敛至主题 token（头部深绿渐变与品牌区保持）
  @modify 2026-11-04 Liquid Glass 重构：壁纸 + 玻璃页头 + .g-glass 表单卡
               输入框改凹陷玻璃、主按钮加玻璃高光与按压态（逻辑零改动）
-->
<template>
  <view class="login" :class="themeClass">
    <!-- 桌面壁纸：玻璃面的折射来源（固定铺满视口、不拦截事件） -->
    <GlassBackground />

    <!-- 内容层：抬到壁纸之上，玻璃页头 / 卡片才能折射其下的极光 -->
    <view class="login__content">
      <!-- 顶部玻璃页头（圆角 / 双圆 + 双点由 PageHeader 内聚，现为玻璃面） -->
      <PageHeader variant="login">
        <view class="brand">
          <view class="brand-coin">
            <text class="brand-coin-text">绿</text>
          </view>
          <text class="brand-title">小绿记账</text>
          <text class="brand-sub">记一笔，知一月</text>
        </view>
      </PageHeader>

      <!-- 表单卡片（玻璃面：模糊折射 / 亮边 / 高光由 .g-glass 承担） -->
      <view class="card g-glass">
        <!-- 模式切换 -->
        <view class="tabs">
          <view
            class="tab"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            <text>登录</text>
          </view>
          <view
            class="tab"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            <text>注册</text>
          </view>
          <view
            class="tab-indicator"
            :class="{ right: mode === 'register' }"
          ></view>
        </view>

        <!-- 表单字段 -->
        <view class="field">
          <text class="label">手机号</text>
          <input
            class="input"
            v-model="form.phone"
            placeholder="请输入手机号"
            maxlength="11"
            cursor-spacing="20"
          />
        </view>

        <view class="field" v-if="mode === 'register'">
          <text class="label">昵称</text>
          <input
            class="input"
            v-model="form.nickname"
            placeholder="请输入昵称（可留空）"
            maxlength="12"
            cursor-spacing="20"
          />
        </view>

        <view class="field">
          <text class="label">密码</text>
          <input
            class="input"
            v-model="form.password"
            password
            placeholder="请输入密码"
            maxlength="32"
            cursor-spacing="20"
          />
        </view>

        <view class="field" v-if="mode === 'register'">
          <text class="label">确认密码</text>
          <input
            class="input"
            v-model="form.confirm"
            password
            placeholder="请再次输入密码"
            maxlength="32"
            cursor-spacing="20"
          />
        </view>

        <!-- 协议勾选（仅注册强制；点击文案跳协议页） -->
        <view class="agree-row" v-if="mode === 'register'">
          <view
            class="agree-box"
            :class="{ checked: form.agree }"
            @click="toggleAgree"
          >
            <text v-if="form.agree" class="agree-tick">✓</text>
          </view>
          <text class="agree-text" @click="toggleAgree">我已阅读并同意</text>
          <text class="agree-link" @click.stop="openAgreement"
            >《用户协议与隐私政策》</text
          >
        </view>

        <button
          class="submit g-btn-primary"
          :loading="loading"
          @click="onSubmit"
        >
          {{ mode === 'login' ? '登录' : '注册并登录' }}
        </button>
      </view>

      <view
        class="footer-tip"
        @click="switchMode(mode === 'login' ? 'register' : 'login')"
      >
        <text>{{
          mode === 'login' ? '还没有账号？点击注册' : '已有账号？去登录'
        }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 登录页脚本
 * - mode: 'login' | 'register' 双模切换；
 * - submit 调 authApi，成功后 reLaunch 到首页。
 */
import { ref } from 'vue'
import { authApi } from '@/api'
import { useTheme } from '@/composables/useTheme'

// 主题外观：根节点挂 themeClass（theme-light / theme-dark），联动全局 CSS 变量
const { themeClass } = useTheme()

const mode = ref('login')
const loading = ref(false)
const form = ref({
  phone: '',
  nickname: '',
  password: '',
  confirm: '',
  agree: false, // 注册模式：协议勾选
})

/**
 * 切换协议勾选
 */
function toggleAgree() {
  form.value.agree = !form.value.agree
}

/**
 * 打开用户协议与隐私政策页
 */
function openAgreement() {
  uni.navigateTo({ url: '/pages/agreement/index' })
}

/**
 * 切换登录 / 注册模式，清空敏感字段但保留账号便于切换
 */
function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  form.value.confirm = ''
}

/**
 * 表单校验（手机号 11 位大陆号；密码 8~32 位；注册时确认密码一致、昵称≤12）
 * @returns {string} 校验失败文案，空串表示通过
 */
function validate() {
  const f = form.value
  if (!/^1[3-9]\d{9}$/.test(f.phone)) {
    return '请输入正确的手机号'
  }
  if (!f.password || f.password.length < 8 || f.password.length > 32) {
    return '密码需 8~32 位'
  }
  if (mode.value === 'register') {
    if (f.confirm !== f.password) {
      return '两次密码不一致'
    }
    if (f.nickname && f.nickname.length > 12) {
      return '昵称最多 12 字'
    }
    if (!f.agree) {
      return '请先阅读并同意用户协议与隐私政策'
    }
  }
  return ''
}

async function onSubmit() {
  if (loading.value) return
  const msg = validate()
  if (msg) {
    uni.showToast({ title: msg, icon: 'none' })
    return
  }
  loading.value = true
  // 成功后不再解锁：reLaunch 前 400ms 窗口内保持提交锁，按钮不可再点
  //（页面随跳转销毁，失败路径仍正常解锁供重试）
  let jumping = false
  try {
    const f = form.value
    if (mode.value === 'login') {
      await authApi.login({ phone: f.phone, password: f.password })
    } else {
      // nickname 可选，为空时不传（服务端默认「小绿」）
      const payload = { phone: f.phone, password: f.password }
      if (f.nickname) payload.nickname = f.nickname.slice(0, 12)
      await authApi.register(payload)
    }
    jumping = true
    uni.showToast({
      title: mode.value === 'login' ? '登录成功' : '注册成功',
      icon: 'success',
    })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' })
    }, 400)
  } catch (e) {
    // http.js 已统一 toast
  } finally {
    if (!jumping) loading.value = false
  }
}
</script>

<style lang="scss" scoped>
/* 页面根节点：透明；壁纸由 GlassBackground（固定定位、不拦截事件）绘制 */
.login {
  position: relative;
  min-height: 100vh;
  background: transparent;
}

/* 内容层：盖在壁纸（z-index 0）之上 */
.login__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: calc(8rpx + env(safe-area-inset-bottom));
}

/* 页头插槽内的品牌区。
   页头本体已改为玻璃面（不再压深绿渐变），原先的白色标题在浅色玻璃上
   不可读，故标题 / 副标题改用标题与辅助文本 token；品牌币保留深绿调，
   做成玻璃上的「着色玻璃」元器件。 */
.brand {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 56rpx;

  /* 着色玻璃球：深绿半透明底 + 亮边 + 顶内高光 + 底部内暗边 */
  .brand-coin {
    width: 132rpx;
    height: 132rpx;
    border-radius: 50%;
    background: linear-gradient(
      150deg,
      rgba(143, 226, 189, 0.3) 0%,
      rgba(23, 81, 66, 0.52) 100%
    );
    border: 3rpx solid var(--c-glass-border, rgba(255, 255, 255, 0.78));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      inset 0 2rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.95)),
      inset 0 -2rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.28)),
      0 18rpx 44rpx rgba(12, 58, 46, 0.22);

    &-text {
      font-size: 60rpx;
      font-weight: 700;
      color: #eaf3ee;
      letter-spacing: 2rpx;
    }
  }

  .brand-title {
    margin-top: 26rpx;
    font-size: 44rpx;
    font-weight: 700;
    color: $text-title;
    letter-spacing: 2rpx;
  }

  .brand-sub {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: $text-secondary;
    letter-spacing: 1rpx;
  }
}

/* 表单卡片：玻璃面（底色 / 折射 / 亮边 / 投影）全部由 .g-glass 提供，
   这里只保留几何、以及上压页头的负边距叠层 */
.card {
  margin: -64rpx 32rpx 0;
  position: relative;
  z-index: 2;
  padding: 36rpx 36rpx 44rpx;
  border-radius: $glass-radius-lg;
}

/* 模式切换：凹陷玻璃轨道 + 上浮玻璃指示块 */
.tabs {
  position: relative;
  display: flex;
  margin-bottom: 36rpx;
  padding: 6rpx;
  border-radius: $radius-sm;
  background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
  box-shadow:
    inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
    inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));

  .tab {
    position: relative;
    z-index: 2;
    flex: 1;
    text-align: center;
    padding: 18rpx 0;
    font-size: 28rpx;
    color: $text-regular;
    transition: color 0.2s;

    &.active {
      color: $color-primary-deep;
      font-weight: 600;
    }
  }

  .tab-indicator {
    position: absolute;
    top: 6rpx;
    left: 6rpx;
    width: calc(50% - 6rpx);
    height: calc(100% - 12rpx);
    background: var(--c-glass-strong, rgba(255, 255, 255, 0.74));
    border-radius: $radius-xs;
    box-shadow:
      var(--shadow-glass-soft, 0 10rpx 28rpx rgba(22, 48, 38, 0.08)),
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
    transition: transform 0.25s;

    &.right {
      transform: translateX(100%);
    }
  }
}

/* 输入字段 */
.field {
  margin-bottom: 28rpx;

  .label {
    display: block;
    font-size: 24rpx;
    color: $text-regular;
    margin-bottom: 12rpx;
    margin-left: 4rpx;
  }

  /* 凹陷玻璃输入槽：半透明白底 + 顶部内高光 + 底部内暗边，
     在玻璃卡片上形成「蚀刻」层次 */
  .input {
    width: 100%;
    height: 88rpx;
    padding: 0 24rpx;
    font-size: 30rpx;
    color: $text-primary;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    border: 1rpx solid var(--c-glass-border-soft, rgba(255, 255, 255, 0.44));
    border-radius: $radius-md;
    box-sizing: border-box;
    box-shadow:
      inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
      inset 0 -1rpx 0 var(--c-glass-shade, rgba(12, 58, 46, 0.06));
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    &:focus {
      border-color: $color-accent;
      box-shadow:
        inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9)),
        0 0 0 4rpx rgba(76, 175, 135, 0.16);
    }
  }
}

/* 协议勾选行（勾选逻辑不变，仅底色改凹陷玻璃） */
.agree-row {
  display: flex;
  align-items: center;
  margin: -4rpx 4rpx 8rpx;

  .agree-box {
    width: 32rpx;
    height: 32rpx;
    border-radius: 8rpx;
    border: 2rpx solid $border-strong;
    background: var(--c-glass-inner, rgba(255, 255, 255, 0.5));
    box-shadow: inset 0 1rpx 0 var(--c-glass-hi, rgba(255, 255, 255, 0.9));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12rpx;
    transition: all 0.15s;

    &.checked {
      background: $color-primary;
      border-color: $color-primary;
      box-shadow:
        inset 0 1rpx 0 rgba(255, 255, 255, 0.35),
        0 4rpx 12rpx rgba(23, 81, 66, 0.28);
    }
  }

  .agree-tick {
    font-size: 22rpx;
    color: #fff;
    line-height: 1;
  }

  .agree-text {
    font-size: 24rpx;
    color: $text-regular;
  }

  .agree-link {
    font-size: 24rpx;
    color: $color-primary;
    font-weight: 600;
  }
}

/* 主按钮：纸面 + 四色细环 + 墨色字（材质来自全局 .g-btn-primary） */
.submit {
  margin-top: 16rpx;
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  border: 3rpx solid transparent;
  transition:
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.18s ease;

  &::after {
    border: none;
  }

  &:active {
    transform: scale(0.985);
  }

  &[loading] {
    opacity: 0.85;
  }
}

/* 底部模式切换提示 */
.footer-tip {
  margin-top: 36rpx;
  text-align: center;
  font-size: 24rpx;
  color: $text-secondary;
}
</style>
