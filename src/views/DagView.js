/**
 * 研究项目 DAG 工作台 — DAG 视图。
 *
 * 每个模块一列卡片；模块内按分支分组，分支下挂该分支 handoff 的状态徽标。
 * 点击徽标在右侧展开交接详情（fetchHandoff 的纯文本渲染，不渲染 Markdown）。
 *
 * v1.1：支持自由命名（模块/分支 id 任意，不假设 Mxx/Bxx），提供
 * 「＋ 新建模块 / ＋ 新建分支 / ＋ 新建交接」入口；分支展示 id + name（/state 提供 branches[] 时）。
 */
import { STYLES, branchFromHandoffPath, handoffName, moduleFromHandoffPath, statusInfo } from '../core/constants.js'
import { renderStatusBadge } from '../components/StatusBadge.js'
import { renderHandoffActions } from '../components/HandoffTable.js'

/** 把 handoff 列表按模块 id 分组，组内按分支、版本排序。 */
export function groupHandoffsByModule(handoffs) {
  const grouped = new Map()
  for (const handoff of Array.isArray(handoffs) ? handoffs : []) {
    if (!handoff || !handoff.path) continue
    const moduleId = handoff.module || moduleFromHandoffPath(handoff.path)
    if (!grouped.has(moduleId)) grouped.set(moduleId, [])
    grouped.get(moduleId).push(handoff)
  }
  for (const list of grouped.values()) {
    list.sort((left, right) => {
      const branchCompare = String(left.branch || '').localeCompare(String(right.branch || ''))
      if (branchCompare !== 0) return branchCompare
      return (Number(left.version) || 1) - (Number(right.version) || 1)
    })
  }
  return grouped
}

/**
 * 汇总一个模块的分支列表：优先用 /state 的 branches[]（id + name），
 * 再用 handoff 里出现的 branch 补齐（v1.0 宿主无 branches[] 时的兜底）。
 */
export function collectModuleBranches(project, module, grouped) {
  const moduleId = module && module.id ? String(module.id) : ''
  const found = new Map()
  const stateBranches = project && Array.isArray(project.branches) ? project.branches : []
  for (const branch of stateBranches) {
    if (!branch || branch.id === undefined || branch.id === null) continue
    if (String(branch.module || '') !== moduleId) continue
    const id = String(branch.id)
    found.set(id, { id, name: branch.name ? String(branch.name) : '', dir: branch.dir ? String(branch.dir) : '' })
  }
  const handoffsByBranch = new Map()
  for (const handoff of grouped.get(moduleId) || []) {
    const branchId = handoff.branch || branchFromHandoffPath(handoff.path)
    if (!handoffsByBranch.has(branchId)) handoffsByBranch.set(branchId, [])
    handoffsByBranch.get(branchId).push(handoff)
    if (!found.has(branchId)) found.set(branchId, { id: branchId, name: '', dir: '' })
  }
  return Array.from(found.values()).map((branch) => ({
    ...branch,
    handoffs: handoffsByBranch.get(branch.id) || [],
  }))
}

/** frontmatter 值 → 可读字符串。 */
export function formatFrontmatterValue(value) {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.map((item) => formatFrontmatterValue(item)).join('；')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (problem) {
      return String(value)
    }
  }
  return String(value)
}

/**
 * 交接详情面板：frontmatter 字段表 + 正文纯文本（等宽 pre-wrap）。
 * @param {object} h React.createElement
 * @param {{detail?: object|null, onClose?: Function, onRetry?: Function,
 *          onAction?: Function, busy?: string}} props
 */
export function renderHandoffDetail(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const detail = options.detail
  if (!detail) return null

  const { detailCard, row, muted, mono, button, sectionTitle } = STYLES
  const data = detail.data && typeof detail.data === 'object' ? detail.data : null
  const frontmatter = data && data.frontmatter && typeof data.frontmatter === 'object' ? data.frontmatter : null
  const status = frontmatter && frontmatter.status ? frontmatter.status : ''
  const close = () => {
    if (typeof options.onClose === 'function') options.onClose()
  }
  const retry = () => {
    if (typeof options.onRetry === 'function') options.onRetry(detail.path)
  }
  const actions = data && status
    ? renderHandoffActions(h, { row: { path: detail.path, status }, onAction: options.onAction, busy: options.busy })
    : []

  return h(
    'div',
    { style: detailCard },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 4 } },
      h('strong', { style: { fontSize: 12 } }, `交接详情 · ${handoffName(detail.path)}`),
      h(
        'div',
        { style: { ...row, gap: 6 } },
        ...actions,
        h('button', { type: 'button', style: button, onClick: close }, '关闭'),
      ),
    ),
    h('div', { style: { ...mono, opacity: 0.7, fontSize: 12, marginBottom: 8 } }, detail.path),
    detail.loading ? h('div', { style: muted }, '加载中…') : null,
    detail.error
      ? h(
          'div',
          { style: { ...STYLES.errorBanner, marginTop: 4 } },
          `详情加载失败：${detail.error}`,
          h('button', { type: 'button', style: { ...button, marginLeft: 8 }, onClick: retry }, '重试'),
        )
      : null,
    data
      ? h(
          'div',
          null,
          h(
            'div',
            { style: { ...row, marginBottom: 6 } },
            status ? renderStatusBadge(h, { status }) : null,
            frontmatter && frontmatter.stream ? h('span', { style: STYLES.chip }, frontmatter.stream) : null,
            frontmatter && frontmatter.version !== undefined
              ? h('span', { style: STYLES.chip }, `v${frontmatter.version}`)
              : null,
          ),
          frontmatter
            ? h(
                'div',
                { style: STYLES.tableWrap },
                h(
                  'table',
                  { style: STYLES.table },
                  h(
                    'tbody',
                    null,
                    ...Object.keys(frontmatter).map((key) =>
                      h(
                        'tr',
                        { key },
                        h('th', { style: { ...STYLES.th, fontSize: 12, width: '32%' } }, key),
                        h('td', { style: { ...STYLES.td, ...mono, fontSize: 12 } }, formatFrontmatterValue(frontmatter[key])),
                      ),
                    ),
                  ),
                ),
              )
            : null,
          h(
            'div',
            { style: { ...row, justifyContent: 'space-between', margin: '10px 0 4px' } },
            h('span', { style: { ...sectionTitle, margin: 0 } }, '正文（纯文本，不渲染 Markdown）'),
            h('span', { style: muted }, `${data.size || (data.content || '').length || 0} 字符`),
          ),
          h('pre', { style: { ...mono, ...STYLES.pre, maxHeight: 380 } }, data.body || data.content || '(空正文)'),
        )
      : null,
  )
}

/**
 * @param {object} h React.createElement
 * @param {{project?: object, onSelect?: Function, onAction?: Function, busy?: string,
 *          detail?: object|null, onCloseDetail?: Function, onRetryDetail?: Function,
 *          onCreate?: Function, createEnabled?: boolean}} props
 */
export function renderDagView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const project = options.project && typeof options.project === 'object' ? options.project : null
  const modules = project && Array.isArray(project.modules) ? project.modules : []
  const handoffs = project && Array.isArray(project.handoffs) ? project.handoffs : []
  const grouped = groupHandoffsByModule(handoffs)
  const { row, chip, muted, card, column, sectionTitle, button, primaryButton } = STYLES
  const hasBranchIndex = Boolean(project && Array.isArray(project.branches) && project.branches.length > 0)
  const createEnabled = options.createEnabled !== false

  const callCreate = (payload) => {
    if (createEnabled && typeof options.onCreate === 'function') options.onCreate(payload)
  }
  const openCreate = (payload) => (event) => {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
    callCreate(payload)
  }

  if (!project || project.exists === false) {
    return h(
      'div',
      { style: { ...card } },
      h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, '尚未加载 DAG 项目'),
      h(
        'div',
        { style: muted },
        createEnabled
          ? '请输入项目绝对路径并点「加载」，或点「加载示例项目」；也可以点顶部「新建项目」初始化一个新 DAG 项目。'
          : '请输入项目绝对路径并点「加载」，或点「加载示例项目」；工作台会自动读取配置中保存的项目。',
      ),
    )
  }

  const renderModuleCard = (module) => {
    const moduleId = module && module.id ? String(module.id) : '未知模块'
    const moduleName = (module && module.name) || '未命名模块'
    const branches = collectModuleBranches(project, module, grouped)
    const declared =
      typeof module.branches === 'number'
        ? module.branches
        : Array.isArray(module.branches)
          ? module.branches.length
          : branches.length
    const missing = hasBranchIndex ? 0 : Math.max(0, declared - branches.length)
    const counts = module && module.counts && typeof module.counts === 'object' ? module.counts : {}

    const countChips = []
    for (const key of ['draft', 'provisional', 'accepted', 'rejected', 'superseded', 'blocked']) {
      const value = counts[key]
      if (!value) continue
      const info = statusInfo(key.toUpperCase())
      countChips.push(
        h(
          'span',
          {
            key,
            style: {
              ...chip,
              fontSize: 12,
              color: info.color,
              background: info.bg,
              borderColor: info.border,
            },
          },
          `${info.label} ${value}`,
        ),
      )
    }

    const branchRows = branches.map((branch) =>
      h(
        'div',
        {
          key: branch.id,
          style: {
            paddingTop: 6,
            marginTop: 6,
            borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          },
        },
        h(
          'div',
          { style: { ...row, gap: 6, marginBottom: 4 } },
          h(
            'span',
            { style: { ...chip, fontSize: 12, fontWeight: 600 }, title: branch.dir || '' },
            branch.name ? `${branch.id} · ${branch.name}` : branch.id,
          ),
          h(
            'span',
            { style: { ...muted, fontSize: 12, flex: '1 1 auto' } },
            branch.handoffs.map((handoff) => handoff.stream).filter(Boolean).join(' / ') || '暂无 stream',
          ),
          createEnabled
            ? h(
                'button',
                {
                  type: 'button',
                  style: { ...button, fontSize: 11, padding: '1px 7px' },
                  disabled: Boolean(options.busy),
                  onClick: openCreate({ kind: 'handoff-new', branch: branch.id, module: moduleId }),
                },
                '＋ 新建交接',
              )
            : null,
        ),
        branch.handoffs.length === 0
          ? h('div', { style: { ...muted, fontSize: 12 } }, '（该分支暂无交接）')
          : h(
              'div',
              { style: { ...row, gap: 4 } },
              ...branch.handoffs.map((handoff) => {
                const info = statusInfo(handoff.status)
                return h(
                  'span',
                  {
                    key: handoff.path,
                    title: handoff.path,
                    style: {
                      ...chip,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: info.color,
                      background: info.bg,
                      borderColor: info.border,
                    },
                    onClick: () => {
                      if (typeof options.onSelect === 'function') options.onSelect(handoff.path)
                    },
                  },
                  `v${handoff.version || 1} · ${info.label}`,
                )
              }),
            ),
      ),
    )

    return h(
      'div',
      {
        key: moduleId,
        style: { ...card, flex: '1 1 240px', minWidth: 220, marginBottom: 0 },
      },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between' } },
        h('div', { style: { ...row, gap: 6 } }, h('strong', { style: { fontSize: 12 } }, `${moduleId} · ${moduleName}`)),
        h(
          'div',
          { style: { ...row, gap: 4 } },
          h('span', { style: chip }, `${declared} 分支`),
          createEnabled
            ? h(
                'button',
                {
                  type: 'button',
                  style: { ...button, fontSize: 11, padding: '1px 7px' },
                  disabled: Boolean(options.busy),
                  onClick: openCreate({ kind: 'branch-add', module: moduleId, moduleName }),
                },
                '＋ 新建分支',
              )
            : null,
        ),
      ),
      countChips.length > 0 ? h('div', { style: { ...row, gap: 4, marginTop: 6 } }, ...countChips) : null,
      branches.length === 0
        ? h('div', { style: { ...muted, marginTop: 8 } }, '（该模块暂无分支）')
        : h('div', { style: column }, ...branchRows),
      missing > 0 ? h('div', { style: { ...muted, marginTop: 6 } }, `另有 ${missing} 个分支暂无交接`) : null,
    )
  }

  const moduleList =
    modules.length === 0
      ? h(
          'div',
          { style: { ...card } },
          h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, '该项目还没有模块'),
          h(
            'div',
            { style: muted },
            createEnabled
              ? '点右上角「＋ 新建模块」创建第一个模块（id 可为任意唯一名称，如 literature）。'
              : '当前宿主为旧版本，无法新建模块；重启 DSH 后可用。',
          ),
        )
      : h('div', { style: { ...row, alignItems: 'flex-start', gap: 8 } }, ...modules.map(renderModuleCard))
  const detailNode = renderHandoffDetail(h, {
    detail: options.detail,
    onClose: options.onCloseDetail,
    onRetry: options.onRetryDetail,
    onAction: options.onAction,
    busy: options.busy,
  })

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', margin: '2px 0 10px' } },
      h('span', { style: { ...sectionTitle, margin: 0 } }, `模块 DAG：${modules.length} 模块 / ${handoffs.length} 交接`),
      h(
        'div',
        { style: { ...row, gap: 8 } },
        h('span', { style: muted }, '点击分支下的状态徽标，在右侧查看交接详情'),
        createEnabled
          ? h(
              'button',
              {
                type: 'button',
                style: primaryButton,
                disabled: Boolean(options.busy),
                onClick: openCreate({ kind: 'module-add' }),
              },
              '＋ 新建模块',
            )
          : null,
      ),
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' } },
      h('div', { style: { flex: detailNode ? '2 1 320px' : '1 1 auto', minWidth: detailNode ? 280 : 0 } }, moduleList),
      detailNode,
    ),
  )
}
