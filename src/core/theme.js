/**
 * 研究项目 DAG 工作台 — 设计令牌层（v3.4）。
 *
 * 设计语言来自三个参照项目的共同经验：
 *   - OliverLiy/projectHub：宿主令牌 → 本地别名 → 回退值 三段式；
 *   - gjz18342624299-arch/dsh-content-workbench：低饱和紫主色 + 半透明同色徽章 + 3px 焦点环；
 *   - cinderzhan/bianqu-workbench：容器查询断点 + 工具栏紧凑化 + 卡片栅格自适应。
 *
 * 核心原则：
 *   1. **一切颜色走变量**。组件里不再出现裸 hex / rgba，避免明暗主题下「配色不对」。
 *   2. **宿主优先**。能用 `--dsw-alias-*`（DSH Desktop 主题）表达的就用宿主变量，
 *      本地只定义「宿主没给但本工作台需要」的少量语义色，并给静态回退值。
 *   3. **三层结构**：宿主 token → `--rdw-*` 语义别名 → 组件内联样式。
 *   4. **形状参与语义**：圆点=状态、圆角方块=分类、3px 左竖条=分组强调（色弱友好）。
 */

/**
 * 令牌定义（挂在 `.rdw-shell` 上，覆盖整页与所有内联浮层）。
 *
 * 注意：宿主浅色主题下 `bg-base / layer-1 / layer-2 / layer-3` 全是纯白，
 * 靠 border 分层；因此「凹陷底色」需要自己用 color-mix 造（sunken）。
 */
/**
 * 研究项目 DAG 工作台 — 设计令牌层（v3.5 高阶学术美学版）。
 *
 * 作者：lineex (https://github.com/lineex)
 *
 * 融合顶尖工作台设计经验：
 *   - OliverLiy/projectHub：现代多维度看板、KPI 层次、手绘 SVG 数据图表、多层微弥散阴影；
 *   - gjz18342624299-arch/dsh-content-workbench：低饱和学术配色、优雅色块软底、三栏流式布局；
 *   - cinderzhan/bianqu-workbench：容器查询自适应、极窄工具栏唯一性、精致胶囊药丸；
 *   - sara2398/xiaohongshu-note-workbench：轻盈直观的卡片与微交互反馈。
 *
 * 核心审美原则：
 *   1. 【科学克制与层次】：冷灰底色（#f8fafc / #0f172a）配合科研靛蓝（#4f46e5 / #3b82f6），拒绝高饱和塑料感。
 *   2. 【语义双编码】：所有状态均由「颜色 + 形状 + 标签」三重表达，对色弱极度友好。
 *   3. 【微立体与弥散光影】：卡片采用 1px 发丝边线 + 悬停微微浮起（-2px），主脊骨采用渐变管线与发光节点。
 *   4. 【全套明暗主题支持】：支持 DSH Desktop 原生深色主题自适应。
 */

export const RDW_THEME_CSS = `
.rdw-shell{
  /* —— 画布与面板表面 —— */
  --rdw-bg:var(--dsw-alias-bg-base,#f8fafc);
  --rdw-panel:var(--dsw-alias-bg-layer-1,#ffffff);
  --rdw-panel-2:var(--dsw-alias-bg-layer-2,#fbfcfd);
  --rdw-panel-3:var(--dsw-alias-bg-layer-3,#f1f5f9);
  --rdw-sunken:color-mix(in srgb,var(--rdw-text) 4%,var(--rdw-panel));
  --rdw-sunken-2:color-mix(in srgb,var(--rdw-text) 7%,var(--rdw-panel));
  --rdw-hover:color-mix(in srgb,var(--rdw-text) 5%,transparent);

  /* —— 文字排版层次 —— */
  --rdw-text:var(--dsw-alias-label-primary,#0f172a);
  --rdw-text-2:var(--dsw-alias-label-secondary,#475569);
  --rdw-text-3:var(--dsw-alias-label-tertiary,#64748b);
  --rdw-text-4:var(--dsw-alias-label-caption,#94a3b8);
  --rdw-on-brand:var(--dsw-alias-label-primary-foreground,#ffffff);

  /* —— 边框与发丝线 —— */
  --rdw-line:var(--dsw-alias-border-l1,rgba(15,23,42,.06));
  --rdw-line-2:var(--dsw-alias-border-l2,rgba(15,23,42,.10));
  --rdw-line-3:var(--dsw-alias-border-l3,rgba(15,23,42,.16));

  /* —— 品牌与核心语义 —— */
  --rdw-brand:var(--dsw-alias-brand-primary,#0f172a);
  --rdw-brand-hover:var(--dsw-alias-button-primary-hover,#1e293b);
  --rdw-brand-gradient:linear-gradient(135deg,#1e293b 0%,#3b82f6 100%);
  --rdw-accent:var(--dsw-alias-state-business-primary,#3b82f6);
  --rdw-accent-dark:#2563eb;
  --rdw-danger:var(--dsw-alias-state-error-primary,#e11d48);
  --rdw-warn:var(--dsw-alias-state-warn-primary,#d97706);
  --rdw-ok:var(--dsw-alias-state-success-primary,#059669);
  --rdw-idle:var(--dsw-alias-state-idle-primary,#94a3b8);

  /* 语义半透软底（明暗模式通透高级） */
  --rdw-accent-soft:color-mix(in srgb,var(--rdw-accent) 12%,transparent);
  --rdw-danger-soft:color-mix(in srgb,var(--rdw-danger) 12%,transparent);
  --rdw-warn-soft:color-mix(in srgb,var(--rdw-warn) 14%,transparent);
  --rdw-ok-soft:color-mix(in srgb,var(--rdw-ok) 13%,transparent);

  /* —— 科研状态色体系（学术级严谨配色）—— */
  --rdw-st-draft:var(--dsw-alias-label-tertiary,#64748b);
  --rdw-st-provisional:var(--dsw-alias-state-warn-primary,#d97706);
  --rdw-st-accepted:var(--dsw-alias-state-success-primary,#059669);
  --rdw-st-rejected:#e11d48;
  --rdw-st-superseded:#7c3aed;
  --rdw-st-blocked:#ea580c;

  --rdw-st-draft-soft:color-mix(in srgb,var(--rdw-st-draft) 12%,transparent);
  --rdw-st-provisional-soft:color-mix(in srgb,var(--rdw-st-provisional) 13%,transparent);
  --rdw-st-accepted-soft:color-mix(in srgb,var(--rdw-st-accepted) 13%,transparent);
  --rdw-st-rejected-soft:color-mix(in srgb,var(--rdw-st-rejected) 12%,transparent);
  --rdw-st-superseded-soft:color-mix(in srgb,var(--rdw-st-superseded) 12%,transparent);
  --rdw-st-blocked-soft:color-mix(in srgb,var(--rdw-st-blocked) 13%,transparent);

  /* —— 鱼骨主线科研管线色 —— */
  --rdw-bone:color-mix(in srgb,var(--rdw-text) 24%,transparent);
  --rdw-bone-strong:color-mix(in srgb,var(--rdw-text) 44%,transparent);
  --rdw-spine:var(--rdw-accent);
  --rdw-spine-glow:color-mix(in srgb,var(--rdw-accent) 22%,transparent);
  --rdw-spine-soft:color-mix(in srgb,var(--rdw-accent) 14%,transparent);
  --rdw-plate:color-mix(in srgb,var(--rdw-accent) 8%,var(--rdw-panel));
  --rdw-plate-line:color-mix(in srgb,var(--rdw-accent) 28%,transparent);

  /* —— 圆角与规格 —— */
  --rdw-r-xs:var(--dsw-radius-xs,4px);
  --rdw-r-sm:var(--dsw-radius-sm,8px);
  --rdw-r-md:var(--dsw-radius-md,12px);
  --rdw-r-lg:var(--dsw-radius-lg,16px);
  --rdw-r-pill:999px;

  /* —— 现代弥散层级阴影（Tailwind / Linear 级）—— */
  --rdw-shadow-1:0 1px 3px rgba(15,23,42,.06),0 1px 2px rgba(15,23,42,.04);
  --rdw-shadow-2:0 6px 16px -2px rgba(15,23,42,.08),0 2px 6px -1px rgba(15,23,42,.04);
  --rdw-shadow-3:0 18px 36px -4px rgba(15,23,42,.12),0 6px 16px -2px rgba(15,23,42,.06);

  /* —— 缓动与动效 —— */
  --rdw-ease:cubic-bezier(.22,.61,.36,1);
  --rdw-dur:.2s;

  /* —— 字体 —— */
  --rdw-font:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue','Segoe UI Variable Text','Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif);
  --rdw-font-mono:var(--ds-font-family-code,'SF Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,'Liberation Mono',monospace);

  /* ═══════════════════════════════════════════════════════════════════════
   * Apple / macOS 原生语汇层（v5）
   *
   * 用户反馈「排版太多密集的字体」——根因是旧版把 9px/9.5px/10px/10.5px/11px
   * 五级「微字号」混用，信息层级靠字号堆叠而非字重/灰度区分。
   *
   * 新规则（对齐 macOS 原生 App）：
   *   1. 【字号阶梯收敛到 4 级】11（辅助）/ 12（正文小）/ 13（正文）/
   *      15（区块标题）/ 20（页面标题）。不再出现 9px/9.5px/10px。
   *   2. 【层级靠字重 + 灰度】font-weight 只用 400 / 500 / 600；
   *      次要信息降到 label-3 灰度，而不是缩小字号。
   *   3. 【系统语义色】蓝/绿/橙/红/灰五色，全部用淡底 tinted capsule 表达。
   *   4. 【材质分层】毛玻璃（vibrancy）+ 白面 + 极轻阴影，不靠满屏边框。
   *   5. 【连续圆角】7 / 10 / 13 / 18 / pill——观感接近 Apple 连续曲率。
   * ═══════════════════════════════════════════════════════════════════════ */

  /* —— 系统语义色（macOS light）—— */
  --rdw-sys-blue:#007aff;
  --rdw-sys-green:#34c759;
  --rdw-sys-orange:#ff9500;
  --rdw-sys-red:#ff3b30;
  --rdw-sys-gray:#8e8e93;

  /* —— 表面与材质 —— */
  --rdw-organic-bg:#f2f2f7;              /* 系统 groupBackground */
  --rdw-organic-surface:#ffffff;         /* 内容面 */
  --rdw-organic-raised:#ffffff;
  --rdw-organic-input:#ffffff;
  --rdw-organic-hover:rgba(120,120,128,.08);
  --rdw-organic-strip:rgba(250,250,252,.78);
  --rdw-glass:rgba(246,246,248,.82);     /* 侧栏 vibrancy */
  --rdw-glass-strong:rgba(255,255,255,.86);

  /* —— 文字（Apple label 层级）—— */
  --rdw-organic-ink:#1d1d1f;
  --rdw-organic-ink-2:rgba(60,60,67,.72);
  --rdw-organic-ink-3:rgba(60,60,67,.50);
  --rdw-organic-ink-4:rgba(60,60,67,.32);

  /* —— 填充与分隔 —— */
  --rdw-fill-quat:rgba(120,120,128,.08);
  --rdw-fill-tert:rgba(120,120,128,.12);
  --rdw-fill-sec:rgba(120,120,128,.16);

  /* —— 语义色别名（旧令牌名保持不变，值切到系统色，避免改所有组件）—— */
  --rdw-sage:var(--rdw-sys-blue);
  --rdw-sage-hover:#0a6fdb;
  --rdw-sage-tint:#5ac8fa;
  --rdw-tan:var(--rdw-sys-orange);
  --rdw-tan-ink:#b25000;
  --rdw-mist:#f2f2f7;
  --rdw-teal:#5ac8fa;
  --rdw-teal-ink:#0071a4;
  --rdw-soil:var(--rdw-sys-blue);
  --rdw-warm-line:rgba(60,60,67,.10);
  --rdw-warm-line-2:rgba(60,60,67,.06);

  /* —— 圆角（Apple 连续曲率观感，非"有机不等角"）—— */
  --rdw-r-blob:18px;
  --rdw-r-blob-lg:22px;
  --rdw-r-pebble:13px;
  --rdw-r-pebble-sm:7px;
  --rdw-r-dot:50%;
  --rdw-r-bubble-ai:13px;
  --rdw-r-bubble-user:13px;

  /* —— 标题不再用衬线，改用系统 SF Pro 的紧凑字距 —— */
  --rdw-font-serif:var(--rdw-font);

  /* —— 动效：Apple 的缓动更顺，时长更短 —— */
  --rdw-ease-organic:cubic-bezier(.32,.72,0,1);
  --rdw-dur-organic:220ms;
  --rdw-dur-quick:140ms;

  /* —— 阴影：极轻（Apple 靠材质与边框分层，不用重投影）—— */
  --rdw-shadow-organic-1:0 1px 2px rgba(0,0,0,.05);
  --rdw-shadow-organic-2:0 4px 14px rgba(0,0,0,.08);
  --rdw-shadow-organic-3:0 12px 32px rgba(0,0,0,.14);

  /* —— 纹理：Apple 无纸纹，置空 —— */
  --rdw-organic-grain:none;
}

/* 深色模式全局调优 */
body[data-ds-dark-theme] .rdw-shell{
  --rdw-bg:var(--dsw-alias-bg-base,#0b0f19);
  --rdw-panel:var(--dsw-alias-bg-layer-1,#131b2e);
  --rdw-panel-2:var(--dsw-alias-bg-layer-2,#17223b);
  --rdw-panel-3:var(--dsw-alias-bg-layer-3,#1e293b);
  --rdw-line:var(--dsw-alias-border-l1,rgba(255,255,255,.08));
  --rdw-line-2:var(--dsw-alias-border-l2,rgba(255,255,255,.12));
  --rdw-line-3:var(--dsw-alias-border-l3,rgba(255,255,255,.18));
  --rdw-text:var(--dsw-alias-label-primary,#f8fafc);
  --rdw-text-2:var(--dsw-alias-label-secondary,#cbd5e1);
  --rdw-text-3:var(--dsw-alias-label-tertiary,#94a3b8);
  --rdw-text-4:var(--dsw-alias-label-caption,#64748b);
  --rdw-st-accepted:#10b981;
  --rdw-st-provisional:#f59e0b;
  --rdw-st-rejected:#f43f5e;
  --rdw-st-superseded:#a78bfa;
  --rdw-st-blocked:#fb923c;
  --rdw-shadow-1:0 1px 3px rgba(0,0,0,.4);
  --rdw-shadow-2:0 6px 18px rgba(0,0,0,.5);
  --rdw-shadow-3:0 20px 40px rgba(0,0,0,.65);

  /* —— Apple 深色语义色 —— */
  --rdw-sys-blue:#0a84ff;
  --rdw-sys-green:#30d158;
  --rdw-sys-orange:#ff9f0a;
  --rdw-sys-red:#ff453a;
  --rdw-sys-gray:#98989d;

  /* —— 表面与材质（深）—— */
  --rdw-organic-bg:#000000;
  --rdw-organic-surface:#1c1c1e;
  --rdw-organic-raised:#2c2c2e;
  --rdw-organic-input:#1c1c1e;
  --rdw-organic-hover:rgba(120,120,128,.18);
  --rdw-organic-strip:rgba(28,28,30,.80);
  --rdw-glass:rgba(30,30,32,.82);
  --rdw-glass-strong:rgba(44,44,46,.92);

  /* —— 文字（深）—— */
  --rdw-organic-ink:#f5f5f7;
  --rdw-organic-ink-2:rgba(235,235,245,.72);
  --rdw-organic-ink-3:rgba(235,235,245,.50);
  --rdw-organic-ink-4:rgba(235,235,245,.30);

  /* —— 填充与分隔（深）—— */
  --rdw-fill-quat:rgba(120,120,128,.18);
  --rdw-fill-tert:rgba(120,120,128,.26);
  --rdw-fill-sec:rgba(120,120,128,.34);

  /* —— 语义别名 —— */
  --rdw-sage:var(--rdw-sys-blue);
  --rdw-sage-hover:#409cff;
  --rdw-sage-tint:#64d2ff;
  --rdw-tan:var(--rdw-sys-orange);
  --rdw-tan-ink:#ffb340;
  --rdw-mist:#2c2c2e;
  --rdw-teal:#64d2ff;
  --rdw-teal-ink:#9ee7ff;
  --rdw-soil:var(--rdw-sys-blue);
  --rdw-warm-line:rgba(84,84,88,.48);
  --rdw-warm-line-2:rgba(84,84,88,.32);
  --rdw-shadow-organic-1:0 1px 2px rgba(0,0,0,.40);
  --rdw-shadow-organic-2:0 4px 14px rgba(0,0,0,.50);
  --rdw-shadow-organic-3:0 12px 32px rgba(0,0,0,.60);
  --rdw-organic-grain:none;
}
`

/**
 * 组件样式片段（内联样式用；全部只引用 var(--rdw-*)，不出现裸色值）。
 */
export const RDW_TOKENS = {
  /** 通用面板（卡片/区块）。 */
  panel: {
    border: '1px solid var(--rdw-line-2)',
    borderRadius: 'var(--rdw-r-md)',
    background: 'var(--rdw-panel)',
    boxShadow: 'var(--rdw-shadow-1)',
  },
  /** 凹陷区块（提示框/引用块）。 */
  sunken: {
    border: '1px solid var(--rdw-line)',
    borderRadius: 'var(--rdw-r-sm)',
    background: 'var(--rdw-sunken)',
  },
  /** 分组标题（11.5px / 600 / 字距 / 三级字色）。 */
  sectionTitle: {
    margin: '0',
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: '.01em',
    color: 'var(--rdw-text)',
  },
  /** 分组小标题（弱化）。 */
  groupTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    color: 'var(--rdw-text-3)',
  },
  /** 数字列等宽对齐。 */
  num: {
    fontVariantNumeric: 'tabular-nums',
  },
  /** 焦点环（3px 同色软底，不使用 outline）。 */
  focusRing: '0 0 0 3px var(--rdw-accent-soft)',
}

/**
 * 语义色 → tone 映射。
 * tone 贯穿徽章 / 进度条 / 圆点 / 时间轴圆点 / 图表切片，全链路一致。
 */
export const RDW_TONE = {
  idle: { color: 'var(--rdw-st-draft)', bg: 'var(--rdw-st-draft-soft)' },
  info: { color: 'var(--rdw-accent)', bg: 'var(--rdw-accent-soft)' },
  warn: { color: 'var(--rdw-warn)', bg: 'var(--rdw-warn-soft)' },
  ok: { color: 'var(--rdw-ok)', bg: 'var(--rdw-ok-soft)' },
  danger: { color: 'var(--rdw-danger)', bg: 'var(--rdw-danger-soft)' },
  draft: { color: 'var(--rdw-st-draft)', bg: 'var(--rdw-st-draft-soft)' },
  provisional: { color: 'var(--rdw-st-provisional)', bg: 'var(--rdw-st-provisional-soft)' },
  accepted: { color: 'var(--rdw-st-accepted)', bg: 'var(--rdw-st-accepted-soft)' },
  rejected: { color: 'var(--rdw-st-rejected)', bg: 'var(--rdw-st-rejected-soft)' },
  superseded: { color: 'var(--rdw-st-superseded)', bg: 'var(--rdw-st-superseded-soft)' },
  blocked: { color: 'var(--rdw-st-blocked)', bg: 'var(--rdw-st-blocked-soft)' },
}

/**
 * tone → 徽章样式（胶囊 + 5px 圆点，形状参与语义）。
 * @param {string} tone tone 名（见 RDW_TONE）
 */
export function toneBadgeStyle(tone) {
  const theme = RDW_TONE[tone] || RDW_TONE.idle
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 21,
    padding: '0 8px',
    borderRadius: 'var(--rdw-r-pill)',
    border: '1px solid color-mix(in srgb,' + theme.color + ' 26%,transparent)',
    background: theme.bg,
    color: theme.color,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: '18px',
    whiteSpace: 'nowrap',
  }
}

/** tone → 状态圆点样式（圆点=状态）。 */
export function toneDotStyle(tone, size) {
  const theme = RDW_TONE[tone] || RDW_TONE.idle
  const px = typeof size === 'number' && size > 0 ? size : 7
  return {
    width: px,
    height: px,
    borderRadius: 'var(--rdw-r-pill)',
    background: theme.color,
    flex: '0 0 auto',
    display: 'inline-block',
  }
}

/**
 * 空状态：虚线边框 + 圆形图标槽 + 标题 + 提示 + 可选操作。
 * 做法来自 dsh-content-workbench：空状态必须给出明确的下一步动作。
 */
export function emptyStateStyle() {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: '44px 20px',
    border: '1px dashed var(--rdw-line-3)',
    borderRadius: 'var(--rdw-r-md)',
    background: 'var(--rdw-sunken)',
    color: 'var(--rdw-text-3)',
    textAlign: 'center',
  }
}

/** 空状态图标槽（42px 圆形）。 */
export function emptyIconStyle() {
  return {
    display: 'grid',
    placeItems: 'center',
    width: 42,
    height: 42,
    borderRadius: 'var(--rdw-r-pill)',
    background: 'var(--rdw-panel)',
    border: '1px solid var(--rdw-line)',
    color: 'var(--rdw-text-3)',
    fontSize: 18,
    lineHeight: 1,
  }
}

/** 空状态标题。 */
export function emptyTitleStyle() {
  return {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--rdw-text)',
    lineHeight: 1.5,
  }
}

/** 空状态提示正文。 */
export function emptyBodyStyle() {
  return {
    fontSize: 11.5,
    lineHeight: 1.75,
    color: 'var(--rdw-text-3)',
    maxWidth: '52ch',
  }
}

/**
 * 骨架屏：透明度脉冲（不用位移，位移在 flex 栅格里会抖）。
 * 配合 prefers-reduced-motion 已在 SHELL_CSS 里降级。
 */
export function skeletonStyle(height, width) {
  return {
    height: typeof height === 'number' ? height : 10,
    width: typeof width === 'string' ? width : '100%',
    borderRadius: 'var(--rdw-r-pill)',
    background: 'var(--rdw-sunken-2)',
    animation: 'rdw-pulse 1.4s ease-in-out infinite',
  }
}

/** 骨架屏关键帧。 */
export const RDW_SKELETON_CSS = `
@keyframes rdw-pulse{0%,100%{opacity:1}50%{opacity:.5}}
`
