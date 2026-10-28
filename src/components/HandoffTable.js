/**
 * 研究项目 DAG 工作台 — 交接表格与按状态操作。
 *
 * 操作口径：DRAFT→提交；PROVISIONAL→接受/拒绝；BLOCKED→恢复；
 * ACCEPTED/REJECTED/SUPERSEDED 为终态，只读（点击路径或行查看详情）。
 */
import { STYLES, statusInfo } from '../core/constants.js'
import { renderStatusBadge } from './StatusBadge.js'

/** 阻止事件冒泡（行点击会打开详情，按钮点击不应重复触发）。 */
function stopEvent(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
}

/** 按状态渲染一行的操作按钮/只读标签。 */
export function renderHandoffActions(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const rowData = options.row && typeof options.row === 'object' ? options.row : {}
  const busy = options.busy || ''
  const status = String(rowData.status || '').toUpperCase()
  const disabled = Boolean(busy)
  const call = (payload) => (event) => {
    stopEvent(event)
    if (typeof options.onAction === 'function') options.onAction(payload)
  }

  if (status === 'DRAFT') {
    return [
      h(
        'button',
        { key: 'submit', type: 'button', style: STYLES.button, disabled, onClick: call({ action: 'submit', handoff: rowData.path }) },
        '提交',
      ),
    ]
  }
  if (status === 'PROVISIONAL') {
    return [
      h(
        'button',
        {
          key: 'accept',
          type: 'button',
          style: STYLES.primaryButton,
          disabled,
          onClick: call({ action: 'accept', handoff: rowData.path }),
        },
        '接受',
      ),
      h(
        'button',
        {
          key: 'reject',
          type: 'button',
          style: STYLES.dangerButton,
          disabled,
          onClick: call({ action: 'reject', handoff: rowData.path }),
        },
        '拒绝',
      ),
    ]
  }
  if (status === 'BLOCKED') {
    return [
      h(
        'button',
        { key: 'unblock', type: 'button', style: STYLES.button, disabled, onClick: call({ action: 'unblock', handoff: rowData.path }) },
        '恢复',
      ),
    ]
  }
  return [h('span', { key: 'readonly', style: STYLES.muted }, '只看')]
}

/**
 * @param {object} h React.createElement
 * @param {{handoffs?: object[], onSelect?: Function, onAction?: Function,
 *          busy?: string, emptyText?: string}} props
 */
export function renderHandoffTable(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const rows = Array.isArray(options.handoffs) ? options.handoffs : []
  const { tableWrap, table, th, td, mono, link, muted } = STYLES

  if (rows.length === 0) {
    return h('div', { style: { ...muted, padding: '8px 0' } }, options.emptyText || '没有符合条件的交接')
  }

  const openDetail = (event, pathValue) => {
    stopEvent(event)
    if (typeof options.onSelect === 'function') options.onSelect(pathValue)
  }

  return h(
    'div',
    { style: tableWrap },
    h(
      'table',
      { style: table },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ...['路径', '模块', '分支', 'stream', '版本', '状态', '创建时间', '操作'].map((label) =>
            h('th', { key: label, style: th }, label),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        ...rows.map((rowData) =>
          h(
            'tr',
            {
              key: rowData.path,
              style: { cursor: 'pointer' },
              onClick: () => {
                if (typeof options.onSelect === 'function') options.onSelect(rowData.path)
              },
            },
            h(
              'td',
              { style: td },
              h(
                'span',
                {
                  style: { ...mono, ...link, fontSize: 12 },
                  onClick: (event) => openDetail(event, rowData.path),
                },
                rowData.path,
              ),
            ),
            h('td', { style: td }, rowData.module || '—'),
            h('td', { style: td }, rowData.branch || '—'),
            h('td', { style: td }, rowData.stream || '—'),
            h('td', { style: td }, `v${rowData.version || 1}`),
            h(
              'td',
              { style: td },
              renderStatusBadge(h, {
                status: rowData.status,
                plain: Boolean(options.plainStatus),
                title: options.plainStatus
                  ? `${statusInfo(rowData.status).label}（${String(rowData.status || '').toUpperCase()}）`
                  : statusInfo(rowData.status).label,
              }),
            ),
            h('td', { style: td }, rowData.created_at || '—'),
            h(
              'td',
              { style: { ...td, whiteSpace: 'nowrap' } },
              ...renderHandoffActions(h, { row: rowData, onAction: options.onAction, busy: options.busy }),
            ),
          ),
        ),
      ),
    ),
  )
}
