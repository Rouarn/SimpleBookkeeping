<!--
  @file 分类选择区（pages/add/components/CategoryPicker.vue）
  @description 记账页顶部横向滚动的分类图标（自 pages/add/index.vue 拆分）：
               线性 SVG（dataURL，默认白色、选中态用分类主题色），选中分类 id
               经 v-model 双向同步；分类字典来自 category store（接口缓存）。
               图标 SVG path 表随组件搬迁，本轮不换图标方案。
  @author 夏季 <2937375029@qq.com>
  @date 2026-10-11
-->
<template>
  <!-- 分类图标 -->
  <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
    <view class="category-list">
      <view
        v-for="item in categoryList"
        :key="item.id"
        class="category-item"
        @click="emit('update:modelValue', item.id)"
      >
        <view
          class="category-icon"
          :class="{ on: selectedName === item.name }"
        >
          <image
            class="category-img"
            :src="selectedName === item.name ? item.activeIcon : item.icon"
            mode="aspectFit"
          />
        </view>
        <text
          class="category-name"
          :class="{ on: selectedName === item.name }"
          >{{ item.name }}</text
        >
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
/**
 * 分类选择：v-model 为选中分类 id；选中名由 id 在当前方向字典中反查，
 * 渲染高亮沿用原页面的「按名称比较」口径（字典名唯一，与按 id 等价）。
 */
import { computed } from 'vue'
import { useCategoryStore } from '@/store'

const props = defineProps({
  /** 当前选中分类 id（提交口径） */
  modelValue: { type: String, default: '' },
  /** 收支方向 'expense' | 'income'（决定取哪一组字典） */
  billType: { type: String, default: 'expense' },
})

const emit = defineEmits(['update:modelValue'])

const categoryStore = useCategoryStore()

/**
 * 生成线性 SVG 图标的 dataURL（默认白色，选中态使用分类主题色）。
 * 结果按「图标片段 + 颜色」缓存在模块级 Map 中：同一图标同一颜色只编码一次，
 * 避免 categoryList computed 反复重算时重复 encodeURIComponent。
 * @param {string} inner SVG 内部 path 片段（见 ICON_PATHS）
 * @param {string} [color] 描边颜色，默认 '#ffffff'
 * @returns {string} 可直接绑定到 image src 的 dataURL
 */
const ICON_DATAURL_CACHE = new Map()

const icon = (inner, color = '#ffffff') => {
  const key = `${inner}|${color}`
  const cached = ICON_DATAURL_CACHE.get(key)
  if (cached) return cached
  const url =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
    )
  ICON_DATAURL_CACHE.set(key, url)
  return url
}

// 分类名 -> 线性图标路径（分类名称以 category store 为准，这里只维护展示素材）
const ICON_PATHS = {
  // 其他（2x2 方格，寓意「更多/其他分类」）
  其他: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  购物:
    '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  交通:
    '<rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 11h16"/><circle cx="8.5" cy="17.6" r="1.3"/><circle cx="15.5" cy="17.6" r="1.3"/><path d="M7 20l-1.2 1.6M17 20l1.2 1.6"/>',
  娱乐:
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M9 21h6"/>',
  餐饮:
    '<path d="M12 4v2.5"/><circle cx="12" cy="3" r=".9" fill="#ff6a3d" stroke="none"/><path d="M5 16c.8-4.2 3.6-6.5 7-6.5s6.2 2.3 7 6.5"/><path d="M3.5 16h17"/><path d="M7 19h10"/>',
  住房:
    '<path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M9.5 12l2.5 2.5L14.5 12M12 14.5V18M10.2 16.6h3.6"/>',
  就医:
    '<path d="M5 3.5v3M19 3.5v3"/><path d="M5 6.5V9a4 4 0 0 0 8 0V6.5"/><path d="M12 13v1.5a4 4 0 0 0 8 0V12.4"/><circle cx="20" cy="10" r="2.1"/>',
  教育:
    '<path d="M4 5c3-1 6 0 8 2 2-2 5-3 8-2v13c-3-1-6 0-8 2-2-2-5-3-8-2z"/><path d="M12 7v13"/>',
  旅行:
    '<path d="M21 3L10 12.5M21 3l-4.5 17L10 12.5 4 10.5 21 3z"/>',
  // 双向箭头（退还款）
  退还款:
    '<path d="M7.5 9h11M7.5 9L10 6.5M7.5 9L10 11.5"/><path d="M16.5 15h-11M16.5 15L14 12.5M16.5 15L14 17.5"/>',
  红包:
    '<rect x="4.5" y="5.5" width="15" height="13" rx="2.5"/><path d="M12 9.2c1.7 0 3 1 3 2.3 0 2.3-3 2.7-3 4.5 0-1.8-3-2.2-3-4.5 0-1.3 1.3-2.3 3-2.3z"/><path d="M12 5.5v3.7"/>',
  收益:
    '<path d="M4.5 16l4.8-4.8 3 3L19.5 7"/><path d="M14.5 7h5v5"/>',
  // 礼金（钞票 + ¥）
  礼金:
    '<rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="M12 9.2v3.6M10.3 10.2l1.7 1.8 1.7-1.8M10.6 13.4h2.8M10.6 14.9h2.8"/>',
  // 钱袋（佣金）
  佣金:
    '<path d="M9.6 7.2c-1.8 1.9-2.9 4.1-2.9 7a5.3 5.3 0 0 0 10.6 0c0-2.9-1.1-5.1-2.9-7z"/><path d="M9.6 7.2h4.8"/><path d="M12 10.4v3.2M10.4 11.3l1.6 1.5 1.6-1.5M10.9 14.2h2.2"/>',
  工资:
    '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.4"/><path d="M6 10.5h.01M18 14.5h.01"/>',
}

/**
 * 组装单个分类的展示素材：未选中白色图标 + 选中后彩色图标（携带 id 供提交用）
 * @param {{id:string,name:string,color:string}} meta 分类字典项
 * @returns {{id:string,name:string,color:string,icon:string,activeIcon:string}}
 */
const makeCategory = (meta) => {
  const inner = ICON_PATHS[meta.name] || ICON_PATHS['其他']
  return {
    id: meta.id,
    name: meta.name,
    color: meta.color,
    icon: icon(inner),
    activeIcon: icon(inner, meta.color),
  }
}

// 当前收支方向的分类展示列表
const categoryList = computed(() =>
  categoryStore.listByType(props.billType).map(makeCategory),
)

/** 当前选中分类名（由选中 id 反查，供图标 / 文案高亮） */
const selectedName = computed(
  () => categoryList.value.find((c) => c.id === props.modelValue)?.name || '',
)
</script>

<style lang="scss" scoped>
// 分类图标
.category-scroll {
  margin-top: 38rpx;
  white-space: nowrap;

  .category-list {
    display: flex;
    padding: 4rpx 4rpx 0;
  }

  .category-item {
    flex-shrink: 0;
    width: 128rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .category-icon {
      width: 106rpx;
      height: 106rpx;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.13);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;

      .category-img {
        width: 52rpx;
        height: 52rpx;
      }

      &.on {
        background: #ffffff;
        box-shadow: 0 8rpx 20rpx rgba(4, 24, 18, 0.28);
      }
    }

    .category-name {
      margin-top: 14rpx;
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.55);

      &.on {
        color: #ffffff;
        font-weight: 600;
      }
    }
  }
}
</style>
