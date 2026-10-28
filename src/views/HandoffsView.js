/**
 * 研究项目 DAG 工作台 — 交接视图。
 *
 * 状态筛选 + 模块筛选 + 交接表格；操作按状态显示，行点击查看详情。
 * v1.2：状态词平实化（进行中/待确认/已出结果/已放弃/旧版本/卡住），原始状态码放在 title。
 */
import { STYLES, STATUS_ORDER, STATUS_INFO, moduleFromHandoffPath, plainStatusLabel } from '../core/constants.js'
import { renderHandoffTable } from '../components/HandoffTable.js'
import { renderHandoffDetail } from './DagView.js'

/** 按状态与模块过滤 handoff 列表。 */
export function filterHandoffs(handoffs, statusFilter, moduleFilter) {
  const status = String(statusFilter || 'all').toUpperCase()
  const moduleId = moduleFilter || 'all'
  return (Array.isArray(handoffs) ? handoffs : []).filter((handoff) => {
    if (!handoff || !handoff.path) return false
    if (status !== 'ALL' && String(handoff.status || '').toUpperCase() !== status) return false
    const owner = handoff.module || moduleFromHandoffPath(handoff.path)
    if (moduleId !== 'all' && owner !== moduleId) return false
    return true
  })
}

/**
 * @param {object} h React.createElement
 * @param {{project?: object, statusFilter?: string, setStatusFilter?: Function,
 *          moduleFilter?: string, setModuleFilter?: Function, onSelect?: Function,
 *          onAction?: Function, busy?: string, detail?: object|null,
 *          onCloseDetail?: Function, onRetryDetail?: Function}} props
 */
export function renderHandoffsView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const project = options.project && typeof options.project === 'object' ? options.project : null
  const { row, select, chip, muted, card, sectionTitle } = STYLES
  const handoffs = project && Array.isArray(project.handoffs) ? project.handoffs : []
  const modules = project && Array.isArray(project.modules) ? project.modules : []
  const statusFilter = options.statusFilter || 'all'
  const moduleFilter = options.moduleFilter || 'all'
  const filtered = filterHandoffs(handoffs, statusFilter, moduleFilter)

  if (!project || project.exists === false) {
    return h(
      'div',
      { style: card },
      h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, '尚未加载 DAG 项目'),
      h('div', { style: muted }, '请先在顶部加载项目，或点「加载示例项目」。'),
    )
  }

  const counts = new Map()
  for (const handoff of handoffs) {
    const key = String(handoff.status || '').toUpperCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', margin: '2px 0 10px' } },
      h('span', { style: { ...sectionTitle, margin: 0 } }, `交接列表（共 ${handoffs.length} 个交接）`),
      h(
        'div',
        { style: { ...row, gap: 4 } },
        ...STATUS_ORDER.filter((key) => counts.has(key.toUpperCase())).map((key) =>
          h(
            'span',
            {
              key,
              title: key.toUpperCase(),
              style: {
                ...chip,
                fontSize: 12,
                color: STATUS_INFO[key.toUpperCase()].color,
                background: STATUS_INFO[key.toUpperCase()].bg,
                borderColor: STATUS_INFO[key.toUpperCase()].border,
              },
            },
            `${plainStatusLabel(key.toUpperCase())} ${counts.get(key.toUpperCase())}`,
          ),
        ),
      ),
    ),
    h(
      'div',
      { style: { ...row, marginBottom: 8 } },
      h(
        'label',
        { style: { ...row, gap: 4, ...muted } },
        '状态',
        h(
          'select',
          {
            style: select,
            value: statusFilter,
            onChange: (event) => {
              if (typeof options.setStatusFilter === 'function') options.setStatusFilter(event && event.target ? event.target.value : 'all')
            },
          },
          h('option', { value: 'all' }, '全部状态'),
          ...STATUS_ORDER.map((key) => h('option', { key, value: key.toUpperCase() }, plainStatusLabel(key.toUpperCase()))),
        ),
      ),
      h(
        'label',
        { style: { ...row, gap: 4, ...muted } },
        '模块',
        h(
          'select',
          {
            style: select,
            value: moduleFilter,
            onChange: (event) => {
              if (typeof options.setModuleFilter === 'function') options.setModuleFilter(event && event.target ? event.target.value : 'all')
            },
          },
          h('option', { value: 'all' }, '全部模块'),
          ...modules.map((module) =>
            h('option', { key: module.id || module.name, value: module.id || module.name }, `${module.id || ''} ${module.name || ''}`.trim()),
          ),
        ),
      ),
      h('span', { style: muted }, `筛选结果：${filtered.length} 个交接`),
    ),
    renderHandoffTable(h, {
      handoffs: filtered,
      onSelect: options.onSelect,
      onAction: options.onAction,
      busy: options.busy,
      plainStatus: true,
      emptyText: '没有符合筛选条件的交接',
    }),
    renderHandoffDetail(h, {
      detail: options.detail,
      onClose: options.onCloseDetail,
      onRetry: options.onRetryDetail,
      onAction: options.onAction,
      busy: options.busy,
    }),
  )
}
