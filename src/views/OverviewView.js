/**
 * 研究项目 DAG 工作台 — 概览视图。
 *
 * 统计卡 + 下一步/阻塞 + 「待主项目决定」（接受/拒绝）+「已接受结果」。
 */
import {
  STYLES,
  branchFromHandoffPath,
  handoffName,
  moduleFromHandoffPath,
  normalizeQuestions,
  phaseLabel,
  versionFromHandoffPath,
} from '../core/constants.js'
import { renderStatCards } from '../components/StatCards.js'
import { renderStatusBadge } from '../components/StatusBadge.js'
import { renderDonutChart, renderModuleProgressBars } from '../components/Charts.js'
import { renderHandoffDetail } from './DagView.js'

/**
 * @param {object} h React.createElement
 * @param {{project?: object, onAction?: Function, onSelect?: Function, busy?: string,
 *          detail?: object|null, onCloseDetail?: Function, onRetryDetail?: Function}} props
 */
export function renderOverviewView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const project = options.project && typeof options.project === 'object' ? options.project : null
  const { card, row, chip, muted, button, primaryButton, dangerButton, sectionTitle, tableWrap, table, th, td, mono } = STYLES

  if (!project || project.exists === false) {
    return h(
      'div',
      { style: { ...card } },
      h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, '尚未加载 DAG 项目'),
      h(
        'div',
        { style: muted },
        '工作台会自动加载配置文件中的项目；也可以在顶部输入项目绝对路径后点「加载」，或点「加载示例项目」。',
      ),
    )
  }

  const nextSteps = Array.isArray(project.next_steps) ? project.next_steps : []
  const blockers = Array.isArray(project.blockers) ? project.blockers : []
  const pending = Array.isArray(project.pending_decisions) ? project.pending_decisions : []
  const accepted = Array.isArray(project.accepted) ? project.accepted : []
  const counts = project && project.counts && typeof project.counts === 'object' ? project.counts : {}
  const modules = project && Array.isArray(project.modules) ? project.modules : []

  const callAction = (payload) => {
    if (typeof options.onAction === 'function') options.onAction(payload)
  }
  const openDetail = (pathValue) => {
    if (typeof options.onSelect === 'function') options.onSelect(pathValue)
  }

  const renderList = (items, emptyText) =>
    items.length === 0
      ? h('div', { style: muted }, emptyText)
      : h(
          'div',
          { style: STYLES.column },
          ...items.map((item, index) => h('div', { key: index, style: STYLES.listItem }, `· ${String(item)}`)),
        )

  const projectCard = h(
    'div',
    { style: card },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between' } },
      h('strong', { style: { fontSize: 13 } }, project.title || project.id || '未命名研究项目'),
      h(
        'span',
        { style: chip },
        `阶段 ${project.phase ? phaseLabel(project.phase) : '未设置'}`,
      ),
    ),
    project.goal ? h('div', { style: { ...muted, marginTop: 4 } }, project.goal) : null,
    h('div', { style: { ...mono, opacity: 0.62, fontSize: 12, marginTop: 6 } }, project.root || ''),
  )

  const pendingSection = h(
    'div',
    null,
    h('h3', { style: sectionTitle }, '待主项目决定'),
    pending.length === 0
      ? h('div', { style: { ...muted, marginBottom: 10 } }, '当前没有待主项目决定的交接')
      : h(
          'div',
          { style: { ...tableWrap, marginBottom: 10 } },
          h(
            'table',
            { style: table },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                ...['模块', '分支', '版本', 'stream', '要决定的问题', '操作'].map((label) =>
                  h('th', { key: label, style: th }, label),
                ),
              ),
            ),
            h(
              'tbody',
              null,
              ...pending.map((item, index) => {
                const pathValue = item && item.path ? item.path : ''
                const moduleId = (item && item.module) || moduleFromHandoffPath(pathValue)
                const branch = (item && item.branch) || branchFromHandoffPath(pathValue)
                const version = (item && item.version) || versionFromHandoffPath(pathValue)
                return h(
                  'tr',
                  { key: pathValue || index },
                  h(
                    'td',
                    { style: td },
                    h('div', null, moduleId),
                    h(
                      'div',
                      { style: { ...mono, fontSize: 11, opacity: 0.62, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } },
                      handoffName(pathValue),
                    ),
                  ),
                  h('td', { style: td }, branch),
                  h('td', { style: td }, `v${version}`),
                  h('td', { style: td }, (item && item.stream) || '—'),
                  h(
                    'td',
                    { style: { ...td, minWidth: 180 } },
                    h(
                      'div',
                      { style: { ...mono, fontSize: 12, whiteSpace: 'pre-wrap' } },
                      normalizeQuestions(item && item.questions) || '—',
                    ),
                  ),
                  h(
                    'td',
                    { style: { ...td, whiteSpace: 'nowrap' } },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: { ...primaryButton, marginRight: 6 },
                        disabled: Boolean(options.busy),
                        onClick: () => callAction({ action: 'accept', handoff: pathValue }),
                      },
                      '接受',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: { ...dangerButton, marginRight: 6 },
                        disabled: Boolean(options.busy),
                        onClick: () => callAction({ action: 'reject', handoff: pathValue }),
                      },
                      '拒绝',
                    ),
                    h(
                      'button',
                      { type: 'button', style: button, disabled: Boolean(options.busy), onClick: () => openDetail(pathValue) },
                      '详情',
                    ),
                  ),
                )
              }),
            ),
          ),
        ),
  )

  const acceptedSection = h(
    'div',
    null,
    h('h3', { style: sectionTitle }, '已接受结果'),
    accepted.length === 0
      ? h('div', { style: { ...muted, marginBottom: 10 } }, '尚无已接受结果')
      : h(
          'div',
          { style: { ...tableWrap, marginBottom: 10 } },
          h(
            'table',
            { style: table },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                ...['stream', '版本', '路径', '状态', '操作'].map((label) => h('th', { key: label, style: th }, label)),
              ),
            ),
            h(
              'tbody',
              null,
              ...accepted.map((item, index) => {
                const pathValue = item && item.path ? item.path : ''
                return h(
                  'tr',
                  { key: pathValue || index },
                  h('td', { style: td }, (item && item.stream) || '—'),
                  h('td', { style: td }, `v${(item && item.version) || versionFromHandoffPath(pathValue)}`),
                  h(
                    'td',
                    { style: td },
                    h(
                      'span',
                      { style: { ...mono, ...STYLES.link, fontSize: 12 }, onClick: () => openDetail(pathValue) },
                      pathValue || handoffName(pathValue),
                    ),
                  ),
                  h('td', { style: td }, renderStatusBadge(h, { status: 'ACCEPTED' })),
                  h(
                    'td',
                    { style: { ...td, whiteSpace: 'nowrap' } },
                    h('button', { type: 'button', style: button, onClick: () => openDetail(pathValue) }, '查看'),
                  ),
                )
              }),
            ),
          ),
        ),
  )

  return h(
    'div',
    null,
    projectCard,
    renderStatCards(h, { project }),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
          marginBottom: 14,
        },
      },
      h(
        'div',
        { style: card },
        h(
          'div',
          { style: { ...row, justifyContent: 'space-between', marginBottom: 12 } },
          h('div', { style: { ...sectionTitle, margin: 0 } }, '🎯 成果与交接状态分布'),
          h('span', { style: { ...muted, fontSize: 12.5 } }, `${Array.isArray(project.handoffs) ? project.handoffs.length : 0} 条记录`),
        ),
        renderDonutChart(h, {
          total: Array.isArray(project.handoffs) ? project.handoffs.length : 0,
          title: '成果',
          sub: '交接记录',
          segments: [
            { label: '已接受', value: Number(counts.accepted) || 0, color: 'var(--rdw-st-accepted)' },
            { label: '待决定', value: Number(counts.provisional) || 0, color: 'var(--rdw-st-provisional)' },
            { label: '草稿', value: Number(counts.draft) || 0, color: 'var(--rdw-st-draft)' },
            { label: '阻塞', value: Number(counts.blocked) || 0, color: 'var(--rdw-st-blocked)' },
            { label: '已拒绝', value: Number(counts.rejected) || 0, color: 'var(--rdw-st-rejected)' },
            { label: '已取代', value: Number(counts.superseded) || 0, color: 'var(--rdw-st-superseded)' },
          ].filter((s) => s.value > 0),
        }),
      ),
      h(
        'div',
        { style: card },
        h(
          'div',
          { style: { ...row, justifyContent: 'space-between', marginBottom: 12 } },
          h('div', { style: { ...sectionTitle, margin: 0 } }, '📈 各模块进度与分支负载'),
          h('span', { style: { ...muted, fontSize: 12.5 } }, `${modules.length} 个模块`),
        ),
        renderModuleProgressBars(h, { modules }),
      ),
    ),
    h(
      'div',
      { style: { ...row, alignItems: 'flex-start', gap: 8, marginBottom: 4 } },
      h(
        'div',
        { style: { ...card, flex: '1 1 220px', minWidth: 200 } },
        h('h3', { style: { ...sectionTitle, margin: '0 0 6px' } }, '下一步'),
        renderList(nextSteps, '暂无记录的下一步'),
      ),
      h(
        'div',
        { style: { ...card, flex: '1 1 220px', minWidth: 200 } },
        h(
          'h3',
          { style: { ...sectionTitle, margin: '0 0 6px', color: blockers.length > 0 ? 'var(--rdw-st-blocked)' : 'inherit' } },
          '阻塞',
        ),
        blockers.length > 0
          ? renderList(blockers, '无')
          : h('div', { style: muted }, '当前没有阻塞项'),
      ),
    ),
    pendingSection,
    acceptedSection,
    renderHandoffDetail(h, {
      detail: options.detail,
      onClose: options.onCloseDetail,
      onRetry: options.onRetryDetail,
      onAction: options.onAction,
      busy: options.busy,
    }),
  )
}
