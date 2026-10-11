<!--
  @file 用户协议与隐私政策（pages/agreement/index.vue）
  @description 静态文案页：注册流程勾选触点的落地页。使用系统导航栏自带返回。
               文案为合规基线版本，正式上线前建议由法务复核措辞与主体信息。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <view class="agreement">
    <view class="meta">
      <text>更新日期：2026-10-11　生效日期：2026-10-11</text>
    </view>

    <!-- 一、用户协议 -->
    <view class="doc">
      <text class="h1">一、用户协议</text>

      <text class="h2">1. 服务说明</text>
      <text class="p">「小绿记账」（以下简称"本应用"）是一款个人记账工具，为您提供账单记录、统计、账本管理、凭证图片留存等服务。您注册成功后即获得本应用的使用许可。</text>

      <text class="h2">2. 账号与安全</text>
      <text class="p">您应使用真实有效的手机号注册，并妥善保管账号密码。因您主动泄露密码或遭受他人攻击导致的损失，由您自行承担。发现账号被盗用时请及时与我们联系。</text>

      <text class="h2">3. 用户行为规范</text>
      <text class="p">您承诺不利用本应用从事任何违反法律法规或损害他人合法权益的行为；不上传违反法律、色情、暴力或侵犯他人知识产权的凭证图片。</text>

      <text class="h2">4. 服务的变更与终止</text>
      <text class="p">我们可能因业务调整对服务内容进行变更、中断或终止，并尽可能提前通知。您可随时停止使用并注销账号（可通过页面内功能或联系我们的方式办理）。</text>
    </view>

    <!-- 二、隐私政策 -->
    <view class="doc">
      <text class="h1">二、隐私政策</text>
      <text class="p">我们深知个人信息对您的重要性，将按照法律法规要求，采取相应安全保护措施，尽力保护您的个人信息安全可控。</text>

      <text class="h2">1. 我们收集的信息</text>
      <text class="p">· 账号信息：注册时提供的手机号与昵称；</text>
      <text class="p">· 记账数据：您主动录入的账单、金额、备注、分类、账本；</text>
      <text class="p">· 凭证图片：您主动上传的账单凭证与头像图片；</text>
      <text class="p">· 设备与日志信息：更新检查时的设备标识、版本号，用于应用更新与安全风控。</text>

      <text class="h2">2. 我们如何使用信息</text>
      <text class="p">上述信息仅用于为您提供记账服务、数据同步、凭证留存与应用更新，不用于广告推送，不向任何第三方出售。法律要求或您明确授权的情形除外。</text>

      <text class="h2">3. 存储与保护</text>
      <text class="p">您的数据存储于我们的服务器，凭证图片通过带有效期的签名链接访问。我们采用传输加密（HTTPS）、访问控制与日志审计等措施保护您的数据。</text>

      <text class="h2">4. 您的权利</text>
      <text class="p">您可以随时在本应用内查看、更正、删除您的账单与凭证；删除账单时其凭证图片将同步删除。您也可以联系我们注销账号，注销后个人信息将在合理期限内删除或匿名化。</text>

      <text class="h2">5. 联系我们</text>
      <text class="p">如您对本协议或个人信息处理有任何疑问，请联系：2937375029@qq.com。</text>
    </view>
  </view>
</template>

<script setup>
/**
 * 用户协议与隐私政策：纯静态展示页，无逻辑。
 */
</script>

<style lang="scss" scoped>
.agreement {
  min-height: 100vh;
  background: #f3f5f2;
  padding: 24rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
}

.meta {
  padding: 8rpx 4rpx 24rpx;
  font-size: 24rpx;
  color: #98a099;
}

.doc {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 32rpx 36rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(28, 54, 45, 0.06);
  display: flex;
  flex-direction: column;

  .h1 {
    font-size: 32rpx;
    font-weight: 700;
    color: #175142;
    margin-bottom: 20rpx;
  }

  .h2 {
    font-size: 28rpx;
    font-weight: 600;
    color: #202622;
    margin: 24rpx 0 10rpx;
  }

  .p {
    font-size: 26rpx;
    line-height: 1.75;
    color: #4b534c;
    margin-bottom: 6rpx;
  }
}
</style>
