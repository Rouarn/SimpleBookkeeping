<!--
  @file 登录/注册页（pages/login/index.vue）
  @description 账号密码登录与注册切换；登录成功后 reLaunch 到首页。
               未登录访问其他页面时由 App.vue onLaunch / http 401 拦截统一跳转。
               设计语言与首页/我的页一致：深松绿渐变头 + 暖灰背景 + 白卡。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-16
  @modify 2026-10-11 抽取 PageHeader 公共渐变页头
-->
<template>
  <view class="login">
    <!-- 顶部装饰区（渐变 / 圆角 / 双圆 + 双点由 PageHeader 内聚） -->
    <PageHeader variant="login">
      <view class="brand">
        <view class="brand-coin">
          <text class="brand-coin-text">绿</text>
        </view>
        <text class="brand-title">小绿记账</text>
        <text class="brand-sub">记一笔，知一月</text>
      </view>
    </PageHeader>

    <!-- 表单卡片 -->
    <view class="card">
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

      <button class="submit" :loading="loading" @click="onSubmit">
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
</template>

<script setup>
/**
 * 登录页脚本
 * - mode: 'login' | 'register' 双模切换；
 * - submit 调 authApi，成功后 reLaunch 到首页。
 */
import { ref } from 'vue'
import { authApi } from '@/api'

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
.login {
  min-height: 100vh;
  background: $bg-page;
  display: flex;
  flex-direction: column;
}

// 顶部装饰区的渐变 / 圆角 / 双圆 + 双点由 PageHeader 组件内聚，
// 本页只保留插槽内品牌区样式
.brand {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 56rpx;

  .brand-coin {
    width: 132rpx;
    height: 132rpx;
    border-radius: 50%;
    background: linear-gradient(
      150deg,
      rgba(143, 226, 189, 0.25) 0%,
      rgba(23, 81, 66, 0.4) 100%
    );
    border: 3rpx solid rgba(143, 226, 189, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 14rpx 36rpx rgba(0, 0, 0, 0.25);

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
    color: $text-inverse;
    letter-spacing: 2rpx;
  }

  .brand-sub {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: rgba(237, 245, 240, 0.62);
    letter-spacing: 1rpx;
  }
}

// 表单卡片
.card {
  margin: -64rpx 32rpx 0;
  position: relative;
  z-index: 2;
  background: #fff;
  border-radius: $radius-xl;
  padding: 36rpx 36rpx 44rpx;
  box-shadow: 0 12rpx 36rpx rgba(28, 54, 45, 0.08);
}

.tabs {
  position: relative;
  display: flex;
  margin-bottom: 36rpx;
  background: $bg-page;
  border-radius: $radius-sm;
  padding: 6rpx;

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
    background: #fff;
    border-radius: $radius-xs;
    box-shadow: 0 4rpx 12rpx rgba(28, 54, 45, 0.08);
    transition: transform 0.25s;

    &.right {
      transform: translateX(100%);
    }
  }
}

.field {
  margin-bottom: 28rpx;

  .label {
    display: block;
    font-size: 24rpx;
    color: $text-regular;
    margin-bottom: 12rpx;
    margin-left: 4rpx;
  }

  .input {
    width: 100%;
    height: 88rpx;
    padding: 0 24rpx;
    font-size: 30rpx;
    color: #202622;
    background: $bg-warm;
    border: 1rpx solid #e6ebe6;
    border-radius: $radius-md;
    box-sizing: border-box;
    transition: border-color 0.2s;

    &:focus {
      border-color: $color-accent;
    }
  }
}

// 协议勾选行
.agree-row {
  display: flex;
  align-items: center;
  margin: -4rpx 4rpx 8rpx;

  .agree-box {
    width: 32rpx;
    height: 32rpx;
    border-radius: 8rpx;
    border: 2rpx solid #c3ccc4;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12rpx;
    transition: all 0.15s;

    &.checked {
      background: $color-primary;
      border-color: $color-primary;
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

.submit {
  margin-top: 16rpx;
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  letter-spacing: 2rpx;
  background: $gradient-submit;
  border-radius: $radius-btn-lg;
  border: none;

  &::after {
    border: none;
  }

  &[loading] {
    opacity: 0.85;
  }
}

.footer-tip {
  margin-top: 36rpx;
  text-align: center;
  font-size: 24rpx;
  color: $text-secondary;
}
</style>
