<!--
  @file 记账页（pages/add/index.vue，新增 / 编辑共用）
  @description 账单录入与编辑页面，通过 onLoad 是否携带 id 区分两种模式：
 *               1. 顶部深绿区：收支切换（支出/收入）、记账日期选择、大金额输入、
 *                  横向滚动的分类图标（线性 SVG，选中态使用分类主题色）；
               2. 白色内容区：收/付款方式选择、凭证照片（最多 3 张，可删可拍）、
                  备注（限 50 字）；
               3. 底部保存：校验金额 → 凭证图片统一转 base64 → 写入 bill store
                  （持久化由 Pinia 插件同步完成）→ 提示并返回上一页。
               新增时表单默认值取上次记账记忆；编辑时按 id 回填原账单。
  @author 夏季 <2937375029@qq.com>
  @date 2026-09-14
  @modify 2026-09-15
-->
<template>
  <view class="add-page">
    <!-- 导航栏 -->
    <uni-nav-bar
      :title="pageTitle"
      left-icon="closeempty"
      background-color="transparent"
      color="#ffffff"
      :border="false"
      status-bar
      fixed
      @clickLeft="handleClose"
    />

    <!-- 顶部深绿区域 -->
    <view class="header">
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
        <picker mode="date" :value="date" @change="onDateChange">
          <view class="date-pill">
            <text>{{ dateText }}</text>
            <uni-icons type="arrow-down" size="13" color="#ffffff"></uni-icons>
          </view>
        </picker>
      </view>

      <!-- 金额 -->
      <view class="amount-row">
        <input
          v-model="amount"
          class="amount-input"
          type="digit"
          placeholder="0.0"
          placeholder-style="color: rgba(255,255,255,0.55)"
        />
      </view>

      <!-- 分类图标 -->
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-list">
          <view
            v-for="item in categoryList"
            :key="item.name"
            class="category-item"
            @click="activeCategory = item.name"
          >
            <view
              class="category-icon"
              :class="{ on: activeCategory === item.name }"
            >
              <image
                class="category-img"
                :src="
                  activeCategory === item.name ? item.activeIcon : item.icon
                "
                mode="aspectFit"
              />
            </view>
            <text
              class="category-name"
              :class="{ on: activeCategory === item.name }"
              >{{ item.name }}</text
            >
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 白色内容区：外壳只负责白色圆角与剩余高度，滚动交给内部 scroll-view -->
    <view class="sheet">
      <scroll-view class="sheet-scroll" scroll-y :show-scrollbar="false">
        <view class="sheet-inner">
          <!-- 收/付款方式 -->
          <view class="section">
            <view class="section-title">{{ paySectionTitle }}</view>
            <view class="pay-list">
              <view
                v-for="pay in payMethods"
                :key="pay"
                class="pay-pill"
                :class="{ on: payMethod === pay }"
                @click="payMethod = pay"
              >
                {{ pay }}
              </view>
            </view>
          </view>

          <!-- 凭证照片 -->
          <view class="section">
            <view class="section-title">上传照片或拍摄凭证（最多3张）</view>
            <view class="photo-list">
              <view
                v-for="(photo, index) in photos"
                :key="photo.key || index"
                class="photo-item"
              >
                <image
                  class="photo-img"
                  :src="photo.url"
                  mode="aspectFill"
                  @click="previewPhoto(index)"
                />
                <view class="photo-del" @click="removePhoto(index)">
                  <uni-icons
                    type="closeempty"
                    size="11"
                    color="#ffffff"
                  ></uni-icons>
                </view>
              </view>
              <view
                v-if="photos.length < 3"
                class="photo-add"
                @click="choosePhoto"
              >
                <uni-icons type="plus" size="40" color="#2f6b54"></uni-icons>
              </view>
            </view>
          </view>

          <!-- 备注 -->
          <view class="section">
            <view class="section-title">备注</view>
            <input
              v-model="remark"
              class="remark-input"
              maxlength="50"
              placeholder="请填写备注信息（限50字）"
              placeholder-style="color: #b3b9c7"
            />
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 底部保存 -->
    <view class="footer">
      <view class="save-btn" @click="handleSave">保存</view>
    </view>
  </view>
</template>

<script setup>
/**
 * 记账页脚本模块
 * 模块说明：
 * - 表单状态（收支类型 / 分类 / 金额 / 支付方式 / 日期 / 备注 / 照片）均为本地 ref；
 * - 分类与支付方式字典来自 category / book store（接口缓存），图标素材（SVG path）仅本页维护；
 * - useBillForm 提供「上次选择记忆」、编辑回填（GET /bills/:id）、统一保存动作（POST/PATCH /bills）；
 * - 图片通过 POST /uploads/image 上传到服务端，保存时传 key 数组。
 */
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useBookStore, useCategoryStore } from "@/store";
import { useBillForm } from "@/composables/useBookkeeping";
import { todayStr } from "@/utils/date";
import { normalizeFileUrl } from "@/api";

const categoryStore = useCategoryStore();
const bookStore = useBookStore();
// 表单记忆 + 保存动作（调服务端 POST/PATCH /bills）
const {
  remembered,
  saveBill,
  loadBillForEdit,
  uploadPhoto,
  getCategoryIdByName,
  getPayMethodIdByName,
} = useBillForm();

// 编辑模式：详情页携带账单 id 跳转进来，先回填再改存
const editId = ref("");
// 导航标题随模式切换
const pageTitle = computed(() => (editId.value ? "编辑账单" : "个人账本"));

/**
 * 生成线性 SVG 图标的 dataURL（默认白色，选中态使用分类主题色）
 * @param {string} inner SVG 内部 path 片段（见 ICON_PATHS）
 * @param {string} [color] 描边颜色，默认 '#ffffff'
 * @returns {string} 可直接绑定到 image src 的 dataURL
 */
const icon = (inner, color = "#ffffff") =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  );

// 分类名 -> 线性图标路径（分类名称以 category store 为准，这里只维护展示素材）
const ICON_PATHS = {
  // 其他（2x2 方格，寓意「更多/其他分类」）
  其他: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  购物: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  交通: '<rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 11h16"/><circle cx="8.5" cy="17.6" r="1.3"/><circle cx="15.5" cy="17.6" r="1.3"/><path d="M7 20l-1.2 1.6M17 20l1.2 1.6"/>',
  娱乐: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M9 21h6"/>',
  餐饮: '<path d="M12 4v2.5"/><circle cx="12" cy="3" r=".9" fill="#ff6a3d" stroke="none"/><path d="M5 16c.8-4.2 3.6-6.5 7-6.5s6.2 2.3 7 6.5"/><path d="M3.5 16h17"/><path d="M7 19h10"/>',
  住房: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V19h11V9.5"/><path d="M9.5 12l2.5 2.5L14.5 12M12 14.5V18M10.2 16.6h3.6"/>',
  就医: '<path d="M5 3.5v3M19 3.5v3"/><path d="M5 6.5V9a4 4 0 0 0 8 0V6.5"/><path d="M12 13v1.5a4 4 0 0 0 8 0V12.4"/><circle cx="20" cy="10" r="2.1"/>',
  教育: '<path d="M4 5c3-1 6 0 8 2 2-2 5-3 8-2v13c-3-1-6 0-8 2-2-2-5-3-8-2z"/><path d="M12 7v13"/>',
  旅行: '<path d="M21 3L10 12.5M21 3l-4.5 17L10 12.5 4 10.5 21 3z"/>',
  // 双向箭头（退还款）
  退还款:
    '<path d="M7.5 9h11M7.5 9L10 6.5M7.5 9L10 11.5"/><path d="M16.5 15h-11M16.5 15L14 12.5M16.5 15L14 17.5"/>',
  红包: '<rect x="4.5" y="5.5" width="15" height="13" rx="2.5"/><path d="M12 9.2c1.7 0 3 1 3 2.3 0 2.3-3 2.7-3 4.5 0-1.8-3-2.2-3-4.5 0-1.3 1.3-2.3 3-2.3z"/><path d="M12 5.5v3.7"/>',
  收益: '<path d="M4.5 16l4.8-4.8 3 3L19.5 7"/><path d="M14.5 7h5v5"/>',
  // 礼金（钞票 + ¥）
  礼金: '<rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="M12 9.2v3.6M10.3 10.2l1.7 1.8 1.7-1.8M10.6 13.4h2.8M10.6 14.9h2.8"/>',
  // 钱袋（佣金）
  佣金: '<path d="M9.6 7.2c-1.8 1.9-2.9 4.1-2.9 7a5.3 5.3 0 0 0 10.6 0c0-2.9-1.1-5.1-2.9-7z"/><path d="M9.6 7.2h4.8"/><path d="M12 10.4v3.2M10.4 11.3l1.6 1.5 1.6-1.5M10.9 14.2h2.2"/>',
  工资: '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.4"/><path d="M6 10.5h.01M18 14.5h.01"/>',
};

/**
 * 组装单个分类的展示素材：未选中白色图标 + 选中后彩色图标
 * @param {string} name 分类名（需能在 ICON_PATHS 中命中，否则回退「其他」图标）
 * @param {string} color 分类主题色（选中态描边色）
 * @returns {{name: string, color: string, icon: string, activeIcon: string}}
 */
const makeCategory = (name, color) => {
  const inner = ICON_PATHS[name] || ICON_PATHS["其他"];
  return {
    name,
    color,
    icon: icon(inner),
    activeIcon: icon(inner, color),
  };
};

/**
 * 取某收支方向的默认分类名（字典第一项「其他」），编辑模式改由 onLoad 回填
 * @param {import('@/store/types').BillType} type 收支类型
 * @returns {string}
 */
const defaultCategory = type =>
  categoryStore.listByType(type)[0]?.name || "其他";

// ---------- 表单状态：初始值取自上次记账记忆（分类始终默认第一个） ----------
const billType = ref(remembered.value.type); // 收支方向 expense / income
const activeCategory = ref(defaultCategory(billType.value)); // 当前选中分类名
const amount = ref(""); // 金额输入（字符串，保存时统一转 Number）
const remark = ref(""); // 备注
const payMethod = ref(remembered.value.payMethod); // 收/付款方式（名称）
const photos = ref([]); // 凭证图片 [{key,url}]，最多 3 张

// 收付款方式以 book store 字典为准（name 列表，用于渲染选项）
const payMethods = computed(() => bookStore.payMethods.map(p => p.name));

const categoryList = computed(() =>
  categoryStore
    .listByType(billType.value)
    .map(meta => makeCategory(meta.name, meta.color)),
);

// 区块标题随收支方向变化（支出→支付方式，收入→收款方式）
const paySectionTitle = computed(() =>
  billType.value === "expense" ? "支付方式" : "收款方式",
);

// 记账日期，默认今天；dateText 为日期 pill 上的中文展示 'M月D日'
const date = ref(todayStr());
const dateText = computed(() => {
  const [, m, d] = date.value.split("-");
  return `${Number(m)}月${Number(d)}日`;
});

/**
 * 从服务端签名 URL 解析出图片 key（用于编辑模式回填后保存时传 key）
 * URL 形如 .../api/v1/files/bills/xxx.jpg?e=&sign= ，key 为 bills/xxx.jpg
 * @param {string} url
 * @returns {string}
 */
function parseKeyFromUrl(url) {
  if (!url) return "";
  const idx = url.indexOf("/files/");
  if (idx === -1) return "";
  const tail = url.slice(idx + 7);
  const qIdx = tail.indexOf("?");
  return qIdx === -1 ? tail : tail.slice(0, qIdx);
}

/**
 * 页面加载生命周期：
 * - 无 id（从中间 + 按钮进入）→ 新增模式，保留记忆默认值，并预热字典；
 * - 携带 id（从详情页编辑进入）→ 调 GET /bills/:id 拉取详情并逐项回填。
 * @param {{id?: string}} [options] 页面路由参数
 */
onLoad(async options => {
  // 预热字典（App.vue 已预热过则跳过）
  categoryStore.fetchAll().catch(() => {});
  bookStore.fetchPayMethods().catch(() => {});

  if (!options?.id) return;
  const bill = await loadBillForEdit(options.id);
  if (!bill) return;
  editId.value = bill.id;
  billType.value = bill.type;
  activeCategory.value = bill.category;
  // 服务端 amount 带符号，表单输入用绝对值
  amount.value = String(Math.abs(Number(bill.amount) || 0));
  payMethod.value = bill.payMethod;
  date.value = bill.date;
  remark.value = bill.remark;
  // 回填凭证：服务端返回签名 URL，归一化后解析出 key 便于保存时传回
  photos.value = Array.isArray(bill.photos)
    ? bill.photos.slice(0, 3).map(url => ({
        key: parseKeyFromUrl(url),
        url: normalizeFileUrl(url),
      }))
    : [];
});

/**
 * 切换收支方向，同时把选中分类重置为该方向的第一个分类
 * @param {import('@/store/types').BillType} type 目标类型
 */
function switchType(type) {
  billType.value = type;
  activeCategory.value = defaultCategory(type);
}

/**
 * 日期 picker 选中回调
 * @param {object} e e.detail.value 形如 '2026-09-14'
 */
function onDateChange(e) {
  date.value = e.detail.value;
}

/**
 * 调起系统选图 / 拍照，逐张上传到服务端拿 {key,url}，拼接到 photos（截断至 3 张）
 */
function choosePhoto() {
  const remain = 3 - photos.value.length;
  if (remain <= 0) return;
  uni.chooseImage({
    count: remain,
    success: async res => {
      const paths = res.tempFilePaths || [];
      uni.showLoading({ title: "上传中", mask: true });
      try {
        for (const p of paths) {
          if (photos.value.length >= 3) break;
          try {
            const r = await uploadPhoto(p);
            photos.value.push({
              key: r.key,
              url: normalizeFileUrl(r.url),
            });
          } catch (e) {
            // 单张失败跳过，不中断其余
            console.error("上传失败:", e);
            uni.showToast({
              title: e?.message || "图片上传失败",
              icon: "none",
            });
          }
        }
      } finally {
        uni.hideLoading();
      }
    },
  });
}

/**
 * 删除指定位置的凭证图片
 * @param {number} index 图片在 photos 中的下标
 */
function removePhoto(index) {
  photos.value.splice(index, 1);
}

/**
 * 全屏预览凭证图片，支持左右滑动切换
 * @param {number} index 当前点击图片在 photos 中的下标
 */
function previewPhoto(index) {
  uni.previewImage({
    current: photos.value[index].url,
    urls: photos.value.map(p => p.url),
  });
}

/** 点击左上角关闭：放弃录入 / 编辑并返回上一页 */
function handleClose() {
  uni.navigateBack();
}

/**
 * 保存账单（新增或更新）：
 * 1. 校验金额为正数；2. 按 name 反查 categoryId / payMethodId；3. 提取 photos key 数组；
 * 4. 交给 useBillForm.saveBill 调 POST/PATCH /bills；5. 成功后提示并返回。
 */
async function handleSave() {
  const value = Number(amount.value);
  if (!value || value <= 0) {
    uni.showToast({ title: "请输入正确的金额", icon: "none" });
    return;
  }
  const categoryId = getCategoryIdByName(billType.value, activeCategory.value);
  const payMethodId = getPayMethodIdByName(payMethod.value);
  if (!categoryId) {
    uni.showToast({ title: "分类数据未就绪，请稍后", icon: "none" });
    return;
  }
  if (!payMethodId) {
    uni.showToast({ title: "支付方式未就绪，请稍后", icon: "none" });
    return;
  }
  uni.showLoading({ title: "保存中", mask: true });
  const result = await saveBill(
    {
      type: billType.value,
      amount: value,
      category: activeCategory.value,
      categoryId,
      payMethod: payMethod.value,
      payMethodId,
      date: date.value,
      remark: remark.value,
      photos: photos.value.map(p => p.key).filter(Boolean),
    },
    editId.value || undefined,
  ).finally(() => uni.hideLoading());
  if (!result.ok) {
    uni.showToast({ title: result.error || "保存失败", icon: "none" });
    return;
  }
  uni.showToast({ title: "保存成功", icon: "success" });
  // 增删改已通过 BILL_CHANGE_EVENT 广播，返回后首页/流水/统计 onShow 会重新拉取
  setTimeout(() => uni.navigateBack(), 600);
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
  background: linear-gradient(160deg, #175142 0%, #0c3a2e 100%);
}

// ===== 顶部深绿区域 =====
.header {
  flex-shrink: 0;
  padding: 0 32rpx 24rpx;
}

// 收支切换 + 日期
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;

  .tabs {
    display: flex;
    align-items: center;

    .tab {
      font-size: 38rpx;
      color: rgba(255, 255, 255, 0.55);
      margin-right: 52rpx;
      transition: color 0.2s;

      &.on {
        color: #ffffff;
        font-weight: 700;
      }
    }
  }

  .date-pill {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.13);
    border-radius: 999rpx;
    padding: 11rpx 22rpx;

    text {
      font-size: 26rpx;
      color: rgba(255, 255, 255, 0.9);
      margin-right: 8rpx;
    }
  }
}

// 金额
.amount-row {
  margin-top: 34rpx;
  border-bottom: 2rpx solid rgba(255, 255, 255, 0.28);

  .amount-input {
    width: 100%;
    height: 120rpx;
    font-size: 92rpx;
    font-weight: 700;
    color: #ffffff;
    line-height: 120rpx;
    font-variant-numeric: tabular-nums;
  }
}

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

// ===== 白色内容区 =====
// 外壳只负责白色圆角外形与「剩余高度」；不再用负 margin 上提（负 margin 会被
// 计入 flex 主轴分配，偶发把 scroll-view 底部顶到 footer 下面）
.sheet {
  flex: 1;
  min-height: 0;
  position: relative;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  overflow: hidden;
}

// scroll-view 用四边 inset 拿到确定高度：fixed 页面 -> flex:1 外壳 -> 绝对定位铺满，
// 在 H5 / App / 小程序下高度都可解析，避免键盘弹收、照片加载重排后滚动高度失真
.sheet-scroll {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  // scroll-view 在小程序/App 端是独立原生渲染层，父级圆角裁不到它，
  // 白底与顶部圆角必须设在它自己身上，否则顶部会显示成方角
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
}

// 内边距统一放在滚动内容上（直接给 scroll-view 设 padding 在部分平台会压缩滚动区），
// 底部预留留白，保证最后一个区块（备注）在任何高度下都能完整滚出
.sheet-inner {
  padding: 20rpx 40rpx 48rpx;
  box-sizing: border-box;
}

.section {
  .section-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #1e2521;
    margin: 36rpx 0 24rpx;
  }
}

// 支付方式
.pay-list {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;

  .pay-pill {
    padding: 13rpx 30rpx;
    border: 2rpx solid #e3e8e3;
    border-radius: 999rpx;
    font-size: 27rpx;
    color: #767e78;
    background: #ffffff;
    box-sizing: border-box;
    text-align: center;

    &.on {
      border-color: transparent;
      background: #e6f3ec;
      color: #175142;
      font-weight: 600;
    }
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
    background: #f2f7f4;
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

// 备注
.remark-input {
  width: 100%;
  height: 96rpx;
  border-bottom: 2rpx solid #edf0ec;
  font-size: 29rpx;
  color: #1e2521;
}

// ===== 底部保存 =====
.footer {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  background: #ffffff;
  padding: 14rpx 32rpx;
  padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));

  .save-btn {
    height: 92rpx;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #175142 0%, #246b56 100%);
    color: #ffffff;
    font-size: 32rpx;
    font-weight: 600;
    letter-spacing: 4rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
