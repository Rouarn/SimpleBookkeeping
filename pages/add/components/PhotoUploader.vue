<!--
  @file 凭证照片上传区（pages/add/components/PhotoUploader.vue）
  @description 记账页凭证照片（自 pages/add/index.vue 拆分）：最多 3 张，
               选图 / 拍照 → 系统压缩 + quality 80 二次压缩 → 逐张上传拿
               {key,url} → 追加展示；支持全屏预览、删除、上传中 loading、
               签名过期加载失败的灰底占位兜底。v-for key 用 key 或自增 _uid，
               不用 index（删除中间项避免图片组件错误复用）。
               照片数组由父组件持有并以 :photos 传入（原地 push / splice 同步）；
               编辑回填经 expose 的 setPhotos(rawList) 归一化注入。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
  @modify 2026-10-12 深色模式：标题 / 添加格 / 失败占位收敛至主题 token，
               添加加号图标色随主题取值
-->
<template>
  <!-- 凭证照片 -->
  <view class="section">
    <view class="section-title">上传照片或拍摄凭证（最多3张）</view>
    <view class="photo-list">
      <view
        v-for="(photo, index) in photos"
        :key="photo.key || photo._uid"
        class="photo-item"
      >
        <!-- 加载失败（如签名过期）的凭证图以灰底占位兜底，可删除后重传 -->
        <view
          v-if="photoLoadFailed[photo.url]"
          class="photo-img photo-fallback"
        >
          <text class="photo-fallback-text">加载失败</text>
        </view>
        <image
          v-else
          class="photo-img"
          :src="photo.url"
          mode="aspectFill"
          lazy-load
          @click="previewPhoto(index)"
          @error="onPhotoError(photo.url)"
        />
        <view class="photo-del" @click="removePhoto(index)">
          <uni-icons type="closeempty" size="11" color="#ffffff"></uni-icons>
        </view>
      </view>
      <view v-if="photos.length < 3" class="photo-add" @click="choosePhoto">
        <uni-icons type="plus" size="40" :color="addIcon"></uni-icons>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 凭证照片：props 传入父组件持有的照片数组（原地增删，保持响应式与提交口径）；
 * setPhotos 供编辑模式回填，归一化详情 photos 并截断 3 张。
 */
import { ref, computed } from 'vue'
import { normalizeFileUrl } from '@/api'
import { compressPhoto } from '@/composables/_shared'
import { useBillForm } from '@/composables/useBillEdit'
import { useTheme } from '@/composables/useTheme'

// uni-icons 的 color 为内联样式走不了 CSS 变量，添加加号按 isDark 在 JS 侧取值
// （浅 #2f6b54 / 深 #58b992，与 token 深浅两盘同色值）
const { isDark } = useTheme()
const addIcon = computed(() => (isDark.value ? '#58b992' : '#2f6b54'))

const props = defineProps({
  /** 凭证图片 [{ key, url, _uid }]，最多 3 张（父组件持有，原地增删） */
  photos: { type: Array, default: () => [] },
})

// 上传动作（POST /uploads/image，返回 {key,url}）
const { uploadPhoto } = useBillForm()

// 列表渲染稳定 key：新上传图 key 可能为空串（兼容口径），用模块级自增 _uid 兜底，
// 禁止 v-for 使用 index 作 key（删除中间项会导致图片组件错误复用）
let photoSeq = 0

// 凭证图加载失败标记（url → true）：编辑回填的签名 URL 过期后图片无法展示，
// 失败图以灰底占位兜底（可删除后重传）。现无单图换签接口，不做自动重签；
// 如后续服务端提供换签能力，可在此触发重新签名并重试加载
const photoLoadFailed = ref({})

/** 凭证图加载失败：按 url 记录失败态，切换占位展示 */
const onPhotoError = (url) => {
  photoLoadFailed.value[url] = true
}

/**
 * 归一化凭证条目：详情接口返回 {key,url}；兼容历史签名 URL 字符串结构
 * @param {{key?:string,url?:string}|string} p 单条凭证
 * @returns {{key:string,url:string,_uid:number}}
 */
function toPhotoEntry(p) {
  if (typeof p === 'string')
    return { key: '', url: normalizeFileUrl(p), _uid: ++photoSeq }
  return {
    key: p?.key || '',
    url: normalizeFileUrl(p?.url),
    _uid: ++photoSeq,
  }
}

/**
 * 编辑回填：把详情 photos（{key,url}[]，兼容字符串结构）归一化后原地替换，
 * 截断至 3 张（与原页面 applyEditBackfill 口径一致）
 * @param {Array} list
 */
function setPhotos(list) {
  props.photos.splice(
    0,
    props.photos.length,
    ...(Array.isArray(list) ? list : []).slice(0, 3).map(toPhotoEntry),
  )
}

/**
 * 调起系统选图 / 拍照，逐张上传到服务端拿 {key,url}，拼接到 photos（截断至 3 张）
 */
function choosePhoto() {
  const remain = 3 - props.photos.length
  if (remain <= 0) return
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'], // 选图阶段先走系统压缩
    success: async (res) => {
      const paths = res.tempFilePaths || []
      uni.showLoading({ title: '上传中', mask: true })
      try {
        for (const p of paths) {
          if (props.photos.length >= 3) break
          try {
            // 选图后二次压缩（quality 80），失败回退原图，不阻断上传
            const src = await compressPhoto(p)
            const r = await uploadPhoto(src)
            props.photos.push({
              key: r.key,
              url: normalizeFileUrl(r.url),
              _uid: ++photoSeq,
            })
          } catch (e) {
            // 单张失败跳过，不中断其余
            console.error('上传失败:', e)
            uni.showToast({
              title: e?.message || '图片上传失败',
              icon: 'none',
            })
          }
        }
      } finally {
        uni.hideLoading()
      }
    },
  })
}

/**
 * 删除指定位置的凭证图片
 * @param {number} index 图片在 photos 中的下标
 */
function removePhoto(index) {
  props.photos.splice(index, 1)
}

/**
 * 全屏预览凭证图片，支持左右滑动切换
 * @param {number} index 当前点击图片在 photos 中的下标
 */
function previewPhoto(index) {
  uni.previewImage({
    current: props.photos[index].url,
    urls: props.photos.map((p) => p.url),
  })
}

defineExpose({ setPhotos })
</script>

<style lang="scss" scoped>
.section {
  .section-title {
    font-size: 32rpx;
    font-weight: 600;
    color: $text-title;
    margin: 36rpx 0 24rpx;
  }
}

// 凭证照片
.photo-list {
  display: flex;
  flex-wrap: wrap;

  .photo-item,
  .photo-add {
    width: 156rpx;
    height: 156rpx;
    border-radius: 20rpx;
    margin: 0 20rpx 20rpx 0;
  }

  .photo-add {
    background: $bg-tint;
    border: 2rpx dashed #b9d4c7;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .photo-item {
    position: relative;

    .photo-img {
      width: 100%;
      height: 100%;
      border-radius: 20rpx;
    }

    // 凭证图加载失败占位（与图片同尺寸的灰底块）
    .photo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: $bg-fallback;

      .photo-fallback-text {
        font-size: 20rpx;
        color: $text-secondary;
      }
    }

    .photo-del {
      position: absolute;
      top: -14rpx;
      right: -14rpx;
      width: 40rpx;
      height: 40rpx;
      border-radius: 50%;
      background: #2a3a33;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
