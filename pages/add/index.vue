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
  @modify 2026-10-11
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
        <view class="pill-group">
          <picker mode="date" :value="date" @change="onDateChange">
            <view class="date-pill">
              <text>{{ dateText }}</text>
              <uni-icons
                type="arrow-down"
                size="13"
                color="#ffffff"
              ></uni-icons>
            </view>
          </picker>
          <!-- 时间选择：与日期联动，默认当前时刻；编辑时回填已选时间 -->
          <picker mode="time" :value="time" @change="onTimeChange">
            <view class="date-pill time-pill">
              <text>{{ time }}</text>
              <uni-icons
                type="arrow-down"
                size="13"
                color="#ffffff"
              ></uni-icons>
            </view>
          </picker>
        </view>
      </view>

      <!-- 金额：仅数字与一位小数点、最多 2 位小数、上限 99999999.99；
           失焦千分位展示、聚焦去格式便于编辑 -->
      <view class="amount-row">
        <input
          :value="amountDisplay"
          class="amount-input"
          type="digit"
          placeholder="0.0"
          placeholder-style="color: rgba(255,255,255,0.55)"
          @input="onAmountInput"
          @focus="onAmountFocus"
          @blur="onAmountBlur"
        />
      </view>

      <!-- 分类图标 -->
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-list">
          <view
            v-for="item in categoryList"
            :key="item.id"
            class="category-item"
            @click="selectCategory(item)"
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
                :key="pay.id"
                class="pay-pill"
                :class="{ on: payMethodId === pay.id }"
                @click="selectPayMethod(pay)"
              >
                {{ pay.name }}
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
 * - 表单状态（收支类型 / 分类 / 金额 / 支付方式 / 日期时间 / 备注 / 照片）均为本地 ref；
 * - 分类与支付方式字典来自 category / book store（接口缓存），选中态同时维护
 *   名称（渲染）与 id（提交）；时间默认当前时刻（mode=time picker），编辑时回填；
 * - 金额输入仅允许数字与一位小数点、最多 2 位小数、上限 99999999.99（与 BE 口径
 *   一致），失焦千分位展示、聚焦去格式，提交前规范化为纯数字字符串；
 * - useBillForm 提供「上次选择记忆」（存 id，失效自动回退第一项）、编辑回填
 *   （GET /bills/:id）、统一保存动作（POST/PATCH /bills）；
 * - 「再记一笔」预填经 storage 中转（BILL_PREFILL_KEY，详情页写入、本页读取即清）；
 * - 图片通过 POST /uploads/image 上传到服务端，保存时传 key 数组（编辑回填直接
 *   使用详情返回的 {key,url} 中的 key，不再从 URL 反解）。
 */
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useBookStore, useCategoryStore } from "@/store";
import {
  useBillForm,
  compressPhoto,
  BILL_PREFILL_KEY,
} from "@/composables/useBookkeeping";
import { todayStr, nowTime } from "@/utils/date";
import { normalizeFileUrl } from "@/api";

const categoryStore = useCategoryStore();
const bookStore = useBookStore();
// 表单记忆 + 保存动作（调服务端 POST/PATCH /bills）
const { remembered, saveBill, loadBillForEdit, uploadPhoto } = useBillForm();

// 编辑模式：详情页携带账单 id 跳转进来，先回填再改存
const editId = ref("");
// 导航标题随模式切换
const pageTitle = computed(() => (editId.value ? "编辑账单" : "个人账本"));

/**
 * 生成线性 SVG 图标的 dataURL（默认白色，选中态使用分类主题色）。
 * 结果按「图标片段 + 颜色」缓存在模块级 Map 中：同一图标同一颜色只编码一次，
 * 避免 categoryList computed 反复重算时重复 encodeURIComponent。
 * @param {string} inner SVG 内部 path 片段（见 ICON_PATHS）
 * @param {string} [color] 描边颜色，默认 '#ffffff'
 * @returns {string} 可直接绑定到 image src 的 dataURL
 */
const ICON_DATAURL_CACHE = new Map();

const icon = (inner, color = "#ffffff") => {
  const key = `${inner}|${color}`;
  const cached = ICON_DATAURL_CACHE.get(key);
  if (cached) return cached;
  const url =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
    );
  ICON_DATAURL_CACHE.set(key, url);
  return url;
};

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
 * 组装单个分类的展示素材：未选中白色图标 + 选中后彩色图标（携带 id 供提交用）
 * @param {{id:string,name:string,color:string}} meta 分类字典项
 * @returns {{id:string,name:string,color:string,icon:string,activeIcon:string}}
 */
const makeCategory = meta => {
  const inner = ICON_PATHS[meta.name] || ICON_PATHS["其他"];
  return {
    id: meta.id,
    name: meta.name,
    color: meta.color,
    icon: icon(inner),
    activeIcon: icon(inner, meta.color),
  };
};

/**
 * 取某收支方向的默认分类名（字典第一项「其他」），编辑模式改由 onLoad 回填
 * @param {import('@/store/types').BillType} type 收支类型
 * @returns {string}
 */
const defaultCategory = type =>
  categoryStore.listByType(type)[0]?.name || "其他";

// ---------- 表单状态：初始值在字典就绪后由 onLoad 应用记忆 / 预填 / 编辑回填 ----------
const billType = ref(remembered.value.type); // 收支方向 expense / income
const activeCategory = ref(defaultCategory(billType.value)); // 当前选中分类名（渲染用）
const activeCategoryId = ref(""); // 当前选中分类 id（提交用）
const amount = ref(""); // 金额纯数字字符串（无千分位，保存时直接提交）
const amountDisplay = ref(""); // 金额输入框展示值（失焦后带千分位）
const remark = ref(""); // 备注
const payMethod = ref(""); // 收/付款方式名（渲染用）
const payMethodId = ref(""); // 收/付款方式 id（提交用）
const photos = ref([]); // 凭证图片 [{key,url}]，最多 3 张

// 凭证图加载失败标记（url → true）：编辑回填的签名 URL 过期后图片无法展示，
// 失败图以灰底占位兜底（可删除后重传）。现无单图换签接口，不做自动重签；
// 如后续服务端提供换签能力，可在此触发重新签名并重试加载
const photoLoadFailed = ref({});

/** 凭证图加载失败：按 url 记录失败态，切换占位展示 */
const onPhotoError = url => {
  photoLoadFailed.value[url] = true;
};

// 收付款方式选项（book store 字典项 {id,name,...}，直接以 id 匹配选中态）
const payMethods = computed(() => bookStore.payMethods);

const categoryList = computed(() =>
  categoryStore.listByType(billType.value).map(makeCategory),
);

// 记账时间（HH:mm）：默认当前时刻，编辑时回填已选时间
const time = ref(nowTime());
// 用户是否手动改过时间：未改过时把日期切回「今天」则时间跟随当前时刻
let timeTouched = false;

/**
 * 金额上限（与 BE 口径一致：最多 2 位小数 + 99,999,999.99 上限）
 */
const AMOUNT_MAX = "99999999.99";
const AMOUNT_MAX_NUM = Number(AMOUNT_MAX);

/**
 * 规范化金额输入：仅保留数字与一个分隔点、最多 2 位小数、去无效前导零；
 * 超出上限时截断到上限并提示。提交口径与 BE 一致（纯数字字符串）。
 * @param {string} raw 输入框原始值
 * @returns {string} 规范化后的纯数字字符串
 */
function sanitizeAmount(raw) {
  let s = String(raw ?? "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    // 只保留第一个小数点
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    s = s.slice(0, dot + 3); // 最多 2 位小数
  }
  s = s.replace(/^0+(?=\d)/, ""); // 去多余前导零（保留单个 0）
  if (Number(s) > AMOUNT_MAX_NUM) {
    uni.showToast({ title: "金额最大 99,999,999.99", icon: "none" });
    return AMOUNT_MAX;
  }
  return s;
}

/**
 * 千分位格式化（仅展示用）：整数部分每 3 位插逗号，小数原样保留
 * @param {string} s 纯数字字符串
 * @returns {string}
 */
function formatAmountDisplay(s) {
  if (!s) return "";
  const [int, dec] = s.split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === undefined ? intFmt : `${intFmt}.${dec}`;
}

/** 金额输入：过滤非法字符 / 限制小数位与上限，同步纯数值与展示值 */
function onAmountInput(e) {
  const s = sanitizeAmount(e.detail.value);
  amount.value = s;
  amountDisplay.value = s;
}

/** 金额聚焦：去千分位，便于编辑 */
function onAmountFocus() {
  amountDisplay.value = amount.value;
}

/** 金额失焦：千分位格式化展示 */
function onAmountBlur() {
  amountDisplay.value = formatAmountDisplay(amount.value);
}

/**
 * 选中分类：同步名称（渲染）与 id（提交）
 * @param {{id?:string,name?:string}} [meta] 分类项（字典为空时忽略）
 */
function selectCategory(meta) {
  if (!meta?.name) return;
  activeCategoryId.value = meta.id || "";
  activeCategory.value = meta.name;
}

/**
 * 选中收/付款方式：同步名称（渲染）与 id（提交）
 * @param {{id?:string,name?:string}} [pay] 支付方式项
 */
function selectPayMethod(pay) {
  if (!pay?.name) return;
  payMethodId.value = pay.id || "";
  payMethod.value = pay.name;
}

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
 * 归一化凭证条目：详情接口返回 {key,url}；兼容历史签名 URL 字符串结构
 * @param {{key?:string,url?:string}|string} p 单条凭证
 * @returns {{key:string,url:string}}
 */
function toPhotoEntry(p) {
  if (typeof p === "string") return { key: "", url: normalizeFileUrl(p) };
  return { key: p?.key || "", url: normalizeFileUrl(p?.url) };
}

/**
 * 应用上次记账记忆（按 id 匹配字典）：记忆项已被删除 / 变更时自动回退
 * 该类型第一项并提示，不再阻断保存；首次使用（无记忆）静默取第一项
 */
function applyRemembered() {
  const cats = categoryStore.listByType(billType.value);
  const pays = bookStore.payMethods;
  const rememberedCat = cats.find(c => c.id === remembered.value.categoryId);
  const rememberedPay = pays.find(p => p.id === remembered.value.payMethodId);
  // 仅当「记过但已失效」时提示；首用无记忆不提示
  const catStale = !!remembered.value.categoryId && !rememberedCat;
  const payStale = !!remembered.value.payMethodId && !rememberedPay;
  selectCategory(rememberedCat || cats[0]);
  selectPayMethod(rememberedPay || pays[0]);
  if (catStale || payStale) {
    uni.showToast({ title: "原记忆项已失效，已重置", icon: "none" });
  }
}

/**
 * 应用「再记一笔」预填（详情页经 storage 中转）：复制当前单据的
 * 收支类型 / 金额 / 分类 / 支付方式 / 备注，日期时间重置为当前时刻
 * @param {{type?:string,amount?:string,categoryId?:string,payMethodId?:string,remark?:string}} data
 */
function applyPrefill(data) {
  if (!data) return;
  if (data.type === "expense" || data.type === "income") {
    billType.value = data.type;
  }
  // 原分类 / 支付方式已失效时回退该类型第一项（与记忆失效同口径）
  const cats = categoryStore.listByType(billType.value);
  selectCategory(cats.find(c => c.id === data.categoryId) || cats[0]);
  const pays = bookStore.payMethods;
  selectPayMethod(pays.find(p => p.id === data.payMethodId) || pays[0]);
  amount.value = sanitizeAmount(data.amount);
  amountDisplay.value = formatAmountDisplay(amount.value);
  remark.value = data.remark || "";
  date.value = todayStr();
  time.value = nowTime();
  timeTouched = true;
}

/**
 * 编辑模式：调 GET /bills/:id 拉取详情并逐项回填；
 * 凭证直接使用详情返回 photos 的 key，不再从签名 URL 反解
 * @param {string} id 账单 id
 */
async function applyEditBackfill(id) {
  const bill = await loadBillForEdit(id);
  if (!bill) return;
  editId.value = bill.id;
  billType.value = bill.type;
  activeCategoryId.value = bill.categoryId || "";
  activeCategory.value = bill.category;
  // 服务端 amount 带符号，表单输入用绝对值
  amount.value = sanitizeAmount(String(Math.abs(Number(bill.amount) || 0)));
  amountDisplay.value = formatAmountDisplay(amount.value);
  payMethodId.value = bill.payMethodId || "";
  payMethod.value = bill.payMethod;
  date.value = bill.date;
  time.value = bill.time || nowTime(); // 回填已选时间（HH:mm）
  timeTouched = true;
  remark.value = bill.remark;
  // 回填凭证：详情 photos 为 [{key,url}]（兼容旧签名 URL 字符串结构）
  photos.value = (Array.isArray(bill.photos) ? bill.photos : [])
    .slice(0, 3)
    .map(toPhotoEntry);
}

/**
 * 页面加载生命周期：
 * - 先等字典就绪（按 id 匹配分类 / 支付方式依赖字典）；
 * - 携带 id（从详情页编辑进入）→ 拉取详情回填；
 * - 无 id → 优先应用「再记一笔」预填（storage 中转），否则应用上次记忆。
 * @param {{id?: string}} [options] 页面路由参数
 */
onLoad(async options => {
  // 预热字典并等待完成（App.vue 已预热过则跳过）
  await Promise.all([
    categoryStore.fetchAll().catch(() => {}),
    bookStore.fetchPayMethods().catch(() => {}),
  ]);

  if (options?.id) {
    await applyEditBackfill(options.id);
    return;
  }

  // 「再记一笔」预填：详情页写入 storage，读取后立即清除避免残留
  let prefill = null;
  try {
    prefill = uni.getStorageSync(BILL_PREFILL_KEY) || null;
    if (prefill) uni.removeStorageSync(BILL_PREFILL_KEY);
  } catch (e) {
    prefill = null;
  }
  if (prefill) applyPrefill(prefill);
  else applyRemembered();
});

/**
 * 切换收支方向，同时把选中分类重置为该方向的第一个分类
 * @param {import('@/store/types').BillType} type 目标类型
 */
function switchType(type) {
  billType.value = type;
  selectCategory(categoryStore.listByType(type)[0]);
}

/**
 * 日期 picker 选中回调；切回今天且未手动改过时间时，时间跟随当前时刻
 * @param {object} e e.detail.value 形如 '2026-09-14'
 */
function onDateChange(e) {
  date.value = e.detail.value;
  if (!timeTouched && date.value === todayStr()) {
    time.value = nowTime();
  }
}

/**
 * 时间 picker 选中回调
 * @param {object} e e.detail.value 形如 '18:39'
 */
function onTimeChange(e) {
  timeTouched = true;
  time.value = e.detail.value;
}

/**
 * 调起系统选图 / 拍照，逐张上传到服务端拿 {key,url}，拼接到 photos（截断至 3 张）
 */
function choosePhoto() {
  const remain = 3 - photos.value.length;
  if (remain <= 0) return;
  uni.chooseImage({
    count: remain,
    sizeType: ["compressed"], // 选图阶段先走系统压缩
    success: async res => {
      const paths = res.tempFilePaths || [];
      uni.showLoading({ title: "上传中", mask: true });
      try {
        for (const p of paths) {
          if (photos.value.length >= 3) break;
          try {
            // 选图后二次压缩（quality 80），失败回退原图，不阻断上传
            const src = await compressPhoto(p);
            const r = await uploadPhoto(src);
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
 * 1. 金额规范化为纯数字字符串（去尾部小数点）并校验为正数；
 * 2. 校验分类 / 支付方式 id 已就绪（选中态即持 id，无需按 name 反查）；
 * 3. 提取 photos key 数组；4. 交给 useBillForm.saveBill 调 POST/PATCH /bills；
 * 5. 成功后提示并返回。
 */
async function handleSave() {
  // 提交前规范化：去掉仅用于输入过程的尾部小数点，与 BE 口径一致
  const amountStr = amount.value.replace(/\.$/, "");
  const value = Number(amountStr);
  if (!value || value <= 0) {
    uni.showToast({ title: "请输入正确的金额", icon: "none" });
    return;
  }
  if (!activeCategoryId.value) {
    uni.showToast({ title: "分类数据未就绪，请稍后", icon: "none" });
    return;
  }
  if (!payMethodId.value) {
    uni.showToast({ title: "支付方式未就绪，请稍后", icon: "none" });
    return;
  }
  uni.showLoading({ title: "保存中", mask: true });
  const result = await saveBill(
    {
      type: billType.value,
      amount: amountStr, // 纯数字字符串（最多 2 位小数，≤99999999.99）
      categoryId: activeCategoryId.value,
      payMethodId: payMethodId.value,
      date: date.value,
      time: time.value, // 'HH:mm'，服务端缺省时取当前时间
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

  // 日期 + 时间胶囊组（时间胶囊与日期同款样式，仅加间距）
  .pill-group {
    display: flex;
    align-items: center;

    .time-pill {
      margin-left: 14rpx;
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

    // 凭证图加载失败占位（与图片同尺寸的灰底块）
    .photo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef1ec;

      .photo-fallback-text {
        font-size: 20rpx;
        color: #98a099;
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
