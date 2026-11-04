<!--
  @file 液态玻璃壁纸背景（components/GlassBackground/GlassBackground.vue）
  @description macOS 26 Liquid Glass 的底层「桌面壁纸」：四层纯 CSS 渐变
               （左上薄荷、右上暖沙、底部雾蓝 + 基底），外加一层极淡颗粒噪点。
               实现要点：全部是静态渐变，**不使用 filter: blur() / 动画**——
               真机（小米 10 / WebView 116）实测，三团 56px 高斯模糊色斑会让
               滚动帧率从 46fps 掉到 32fps；渐变在观感上等价，却没有逐帧合成成本。
               组件不接收事件（pointer-events: none），不影响页面交互。
  @author 夏季 <2937375029@qq.com>
  @date 2026-11-04
-->
<template>
  <view class="glass-wallpaper">
    <view class="glass-wallpaper__vignette"></view>
    <view class="glass-wallpaper__grain"></view>
  </view>
</template>

<script setup>
/**
 * 纯装饰组件：无 props、无事件、无状态。
 * 颜色全部走 App.vue 声明的 --g-wallpaper / --c-wall-vignette 主题变量，
 * 深浅色与手动换肤由页面根节点的 .theme-dark / .theme-light 自动接管。
 */
</script>
