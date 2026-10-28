/**
 * 研究项目 DAG 工作台 — 运行记录控制台。
 *
 * 展示最近 runs（action/状态/退出码），点选一条展开 stdout/stderr 等宽输出。
 */
import { STYLES, ACTION_LABELS, formatTimeText, runStatusInfo } from '../core/constants.js'

/**
 * @param {object} h React.createElement
 * @param {{runs?: object[], run?: object|null, busy?: string,
 *          selectedId?: string, onSelect?: Function}} props
 */
export function renderRunConsole(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const { card, row, chip, mono, muted, tableWrap, table, th, td } = STYLES
  const busy = options.busy || ''
  const history = Array.isArray(options.runs) ? options.runs.slice() : []
  const current = options.run && typeof options.run === 'object' ? options.run : null
  const list = current && !history.some((item) => item && item.id === current.id) ? [current, ...history] : history
  const selected = list.find((item) => item && item.id === options.selectedId) || list[0] || null
  const actionLabel = (action) => ACTION_LABELS[action] || action || '—'
  const statusInfoOf = (status) => runStatusInfo(status)

  return h(
    'div',
    { style: { ...card, marginTop: 4 } },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
      h('strong', { style: { fontSize: 12 } }, '运行记录'),
      h('span', { style: muted }, busy ? `执行中：${busy}` : `共 ${list.length} 条`),
    ),
    list.length === 0
      ? h('div', { style: muted }, '尚未执行任何命令；可先点「运行校验」或「重写报告」。')
      : h(
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
                ...['run', '动作', '状态', '退出码', '开始时间'].map((label) =>
                  h('th', { key: label, style: th }, label),
                ),
              ),
            ),
            h(
              'tbody',
              null,
              ...list.map((item) => {
                const info = statusInfoOf(item.status)
                const isSelected = selected && item.id === selected.id
                return h(
                  'tr',
                  {
                    key: item.id || `${item.action}-${item.startedAt}`,
                    style: { cursor: 'pointer', background: isSelected ? 'color-mix(in srgb, currentColor 6%, transparent)' : 'transparent' },
                    onClick: () => {
                      if (typeof options.onSelect === 'function') options.onSelect(item.id)
                    },
                  },
                  h('td', { style: { ...td, fontFamily: STYLES.mono.fontFamily } }, item.id || '—'),
                  h('td', { style: td }, actionLabel(item.action)),
                  h(
                    'td',
                    { style: td },
                    h(
                      'span',
                      { style: { ...chip, color: info.color, background: info.bg, borderColor: 'transparent' } },
                      info.label,
                    ),
                  ),
                  h('td', { style: td }, item.exitCode === null || item.exitCode === undefined ? '—' : String(item.exitCode)),
                  h('td', { style: td }, formatTimeText(item.startedAt)),
                )
              }),
            ),
          ),
        ),
    selected
      ? h(
          'div',
          { style: { marginTop: 8 } },
          h(
            'div',
            { style: { ...row, justifyContent: 'space-between', marginBottom: 4 } },
            h('span', { style: { fontSize: 11, fontWeight: 600 } }, `输出 · ${selected.id || ''} · ${actionLabel(selected.action)}`),
            h(
              'span',
              { style: muted },
              selected.timedOut ? '已超时' : selected.status === 'running' ? '仍在运行…' : `退出码 ${selected.exitCode}`,
            ),
          ),
          h(
            'pre',
            { style: { ...mono, ...STYLES.pre, maxHeight: 300, whiteSpace: 'pre-wrap' } },
            [
              selected.stdout ? `[stdout]\n${selected.stdout}` : '',
              selected.stderr ? `[stderr]\n${selected.stderr}` : '',
              selected.json ? `[json]\n${JSON.stringify(selected.json, null, 2)}` : '',
            ]
              .filter(Boolean)
              .join('\n\n') || '(无输出)',
          ),
        )
      : null,
  )
}
