/**
 * 研究项目 DAG 工作台 — 网络页（v2.1）。
 *
 * 数据来自 GET /content 的 network（TeamMCP digest JSON）：
 *   网络概览 / 待你复核 / 待主项目关注（attention + stale）/ 每项目折叠详情。
 * 操作：刷新网络、发布本项目、拉取消息（POST /bridge）。
 * TeamMCP 不可用时显示连接失败卡片与启动提示。
 */
import {
  STYLES,
  moduleStatusInfo,
  phaseLabel,
  reviewKeyOf,
  truncateText,
} from '../core/constants.js'

const ATTENTION_KIND = {
  pending: { label: '待决定', color: 'var(--rdw-st-provisional)' },
  blocked: { label: '阻塞', color: 'var(--rdw-st-blocked)' },
  idea: { label: '想法', color: 'var(--rdw-accent)' },
  result: { label: '结果', color: 'var(--rdw-st-accepted)' },
  stale: { label: '停滞', color: 'var(--rdw-st-draft)' },
}

function kindInfo(kind) {
  return ATTENTION_KIND[kind] || { label: kind || '关注', color: 'var(--rdw-st-draft)' }
}

function formatUpdated(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (!text) return '—'
  return text.length > 19 ? text.slice(0, 19).replace('T', ' ') : text.replace('T', ' ')
}

/**
 * 渲染网络页。
 * @param {object} h React.createElement
 * @param {{content?: object|null, contentLoading?: boolean, contentError?: string,
 *          busy?: string, run?: object|null, onRefresh?: Function, onPublish?: Function,
 *          onPull?: Function, onReviewItem?: Function, onOpenHandoff?: Function,
 *          expandedProjects?: object, onToggleProject?: Function}} props
 */
export function renderNetworkView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const content = options.content && typeof options.content === 'object' && options.content.ok !== false ? options.content : null
  const busy = typeof options.busy === 'string' ? options.busy : ''
  const { card, row, chip, muted, button, primaryButton, sectionTitle, tableWrap, table, th, td, mutedBox } = STYLES
  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }
  const expandedProjects = options.expandedProjects && typeof options.expandedProjects === 'object' ? options.expandedProjects : {}
  const network = content && content.network && typeof content.network === 'object' ? content.network : null
  const networkError = content && typeof content.networkError === 'string' ? content.networkError : typeof options.networkError === 'string' ? options.networkError : ''

  const opsBar = h(
    'div',
    { style: { ...row, justifyContent: 'space-between', marginBottom: 10 } },
    h(
      'div',
      { style: { ...row } },
      h(
        'button',
        { type: 'button', style: primaryButton, disabled: Boolean(busy), onClick: () => call(options.onRefresh) },
        busy === 'content' ? '刷新中…' : '刷新网络',
      ),
      h(
        'button',
        { type: 'button', style: button, disabled: Boolean(busy), onClick: () => call(options.onPublish) },
        busy === 'bridge:publish' ? '发布中…' : '发布本项目',
      ),
      h(
        'button',
        { type: 'button', style: button, disabled: Boolean(busy), onClick: () => call(options.onPull) },
        busy === 'bridge:pull' ? '拉取中…' : '拉取消息',
      ),
    ),
    h(
      'div',
      { style: { ...row, ...muted } },
      options.run && options.run.action
        ? h('span', null, `最近桥操作：${options.run.action} · ${options.run.status || ''}`)
        : null,
      network && network.generatedAt ? h('span', null, `网络摘要 ${formatUpdated(network.generatedAt)}`) : null,
    ),
  )

  if (!content) {
    return h(
      'div',
      null,
      opsBar,
      options.contentLoading
        ? h('div', { style: { ...muted, padding: '12px 0' } }, '正在加载项目网络…')
        : h('div', { style: { ...muted, padding: '12px 0' } }, '暂无网络数据'),
    )
  }

  if (!network) {
    return h(
      'div',
      null,
      opsBar,
      h(
        'div',
        { style: { ...card, borderColor: 'color-mix(in srgb,var(--rdw-st-rejected) 32%,transparent)' } },
        h('div', { style: { fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--rdw-st-rejected)' } }, '项目网络连接失败'),
        h('div', { style: { ...muted, marginBottom: 8 } }, networkError || 'TeamMCP 桥未运行或不可用。'),
        h(
          'div',
          { style: { ...mutedBox, marginBottom: 8 } },
          '可在终端运行 ~/.teammcp/start-teammcp.cmd 启动 TeamMCP 后点「重试」；内容页与工程页不受影响。',
        ),
        h(
          'button',
          { type: 'button', style: primaryButton, disabled: Boolean(busy), onClick: () => call(options.onRefresh) },
          '重试',
        ),
      ),
    )
  }

  const projects = Array.isArray(network.projects) ? network.projects : []
  const selfProjectId = network.selfProjectId || ''
  const pendingReviewAll = Array.isArray(network.pendingReview) ? network.pendingReview : []
  const selfPendingReview = pendingReviewAll.filter((item) => item && item.projectId === selfProjectId)
  const otherPendingReview = pendingReviewAll.filter((item) => item && item.projectId !== selfProjectId)
  const attention = Array.isArray(network.attention) ? network.attention : []
  const stale = Array.isArray(network.stale) ? network.stale : []

  const overviewRows = projects.map((project) => {
    const isSelf = project && project.projectId === selfProjectId
    const review = project && project.review && typeof project.review === 'object' ? project.review : null
    return h(
      'tr',
      { key: `project-${project && project.projectId}` },
      h(
        'td',
        { style: td },
        h('div', { style: { fontWeight: isSelf ? 700 : 400 } }, (project && project.title) || (project && project.projectId) || '—'),
        h('div', { style: { ...muted, fontSize: 12 } }, (project && project.projectId) || ''),
      ),
      h('td', { style: td }, project && project.phase ? phaseLabel(project.phase) : '—'),
      h('td', { style: td }, `${project && Number.isFinite(Number(project.percent)) ? Number(project.percent) : 0}%`),
      h('td', { style: td }, String((project && project.accepted) || 0)),
      h('td', { style: td }, String((project && project.pending) || 0)),
      h('td', { style: td }, String((project && project.blocked) || 0)),
      h(
        'td',
        { style: td },
        h(
          'div',
          { style: { ...row, gap: 4 } },
          isSelf
            ? h(
                'span',
                { style: { ...chip, fontSize: 12, color: 'var(--rdw-st-accepted)', borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' } },
                review ? `本项目 · 已复核 ${review.reviewed}/${review.accepted}` : '本项目',
              )
            : h('span', { style: { ...chip, fontSize: 12 } }, '其它项目'),
        ),
        h('div', { style: { ...muted, fontSize: 12 } }, formatUpdated(project && project.updated)),
      ),
    )
  })

  const renderPendingReviewRow = (item, canReview) =>
    h(
      'div',
      { key: `pv-${item && item.projectId}-${item && item.stream}-${item && item.version}`, style: { ...mutedBox, marginBottom: 6 } },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between' } },
        h(
          'div',
          { style: { minWidth: 0 } },
          h('div', { style: { fontWeight: 600 } }, `${(item && item.stream) || '—'} v${(item && item.version) || 1} · ${(item && item.module) || ''}`),
          h('div', { style: { ...muted, fontSize: 12 } }, `${(item && item.projectId) || ''} · ${formatUpdated(item && item.acceptedAt)}`),
        ),
        canReview
          ? h(
              'button',
              {
                type: 'button',
                style: primaryButton,
                disabled: Boolean(busy),
                onClick: () => call(options.onReviewItem, item, true),
              },
              '满意',
            )
          : h('span', { style: { ...muted, fontSize: 12 } }, '其它项目（只读）'),
      ),
    )

  const attentionNodes = []
  for (const item of attention) {
    const info = kindInfo(item && item.kind)
    attentionNodes.push(
      h(
        'div',
        { key: `att-${attentionNodes.length}`, style: { ...mutedBox, marginBottom: 6, borderLeft: `3px solid ${info.color}` } },
        h(
          'div',
          { style: { ...row, gap: 6 } },
          h('span', { style: { ...chip, fontSize: 12, color: info.color, borderColor: info.color } }, info.label),
          h('span', { style: { fontSize: 12, opacity: 0.7 } }, (item && item.projectId) || ''),
        ),
        h('div', { style: { marginTop: 2 } }, truncateText((item && item.text) || '', 200)),
      ),
    )
  }
  for (const item of stale) {
    attentionNodes.push(
      h(
        'div',
        {
          key: `stale-${(item && item.projectId) || attentionNodes.length}`,
          style: { ...mutedBox, marginBottom: 6, borderLeft: '3px solid var(--rdw-st-draft)' },
        },
        h(
          'div',
          { style: { ...row, gap: 6 } },
          h('span', { style: { ...chip, fontSize: 12, color: 'var(--rdw-st-draft)', borderColor: 'var(--rdw-st-draft)' } }, '停滞'),
          h('span', { style: { fontSize: 12, opacity: 0.7 } }, (item && item.projectId) || ''),
        ),
        h('div', { style: { marginTop: 2 } }, `最近更新 ${formatUpdated(item && item.updated)} · 停滞 ${(item && item.ageHours) || '?'} 小时`),
      ),
    )
  }

  const renderProjectDetail = (project) => {
    const projectId = (project && project.projectId) || ''
    const isExpanded = Boolean(expandedProjects[projectId])
    const completion = project && Array.isArray(project.completion) ? project.completion : []
    const results = project && Array.isArray(project.results) ? project.results : []
    const ideas = project && Array.isArray(project.ideas) ? project.ideas : []
    const blockers = project && Array.isArray(project.blockers) ? project.blockers : []
    const reviewed = project && Array.isArray(project.reviewed) ? project.reviewed : []
    const review = project && project.review && typeof project.review === 'object' ? project.review : null
    return h(
      'div',
      { key: `detail-${projectId}`, style: { ...card, padding: '10px 12px', marginBottom: 8 } },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', cursor: 'pointer' }, onClick: () => call(options.onToggleProject, projectId) },
        h(
          'div',
          { style: { minWidth: 0 } },
          h(
            'div',
            { style: { fontSize: 13, fontWeight: 700 } },
            `${(project && project.title) || projectId}${projectId === selfProjectId ? '（本项目）' : ''}`,
          ),
          h(
            'div',
            { style: { ...muted, fontSize: 12 } },
            `${project && project.phase ? phaseLabel(project.phase) : '—'} · 进度 ${(project && project.percent) || 0}% · 更新 ${formatUpdated(project && project.updated)}${review ? ` · 已复核 ${review.reviewed}/${review.accepted}` : ''}`,
          ),
        ),
        h('span', { style: { ...muted } }, isExpanded ? '收起' : '展开'),
      ),
      isExpanded
        ? h(
            'div',
            { style: { marginTop: 8 } },
            h('div', { style: sectionTitle }, '完成度（子项目）'),
            completion.length === 0
              ? h('div', { style: muted }, '暂无完成度数据')
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
                        ...['子项目', '状态', '已接受', '已复核'].map((label) => h('th', { key: label, style: th }, label)),
                      ),
                    ),
                    h(
                      'tbody',
                      null,
                      ...completion.map((item) => {
                        const statusTheme = moduleStatusInfo(item && item.status)
                        return h(
                          'tr',
                          { key: `c-${projectId}-${item && item.module}` },
                          h('td', { style: td }, `${(item && item.name) || (item && item.module) || '—'}`),
                          h('td', { style: td }, h('span', { style: { ...chip, fontSize: 12, color: statusTheme.color, borderColor: statusTheme.color } }, statusTheme.label)),
                          h('td', { style: td }, String((item && item.acceptedCount) || (item && Array.isArray(item.accepted) ? item.accepted.length : 0))),
                          h('td', { style: td }, String((item && item.reviewedCount) || 0)),
                        )
                      }),
                    ),
                  ),
                ),
            h('div', { style: sectionTitle }, '最近结果'),
            results.length === 0
              ? h('div', { style: muted }, '暂无已发布结果')
              : h(
                  'div',
                  { style: STYLES.column },
                  ...results.slice(0, 5).map((result) =>
                    h(
                      'div',
                      { key: `r-${projectId}-${result && result.stream}-${result && result.version}`, style: { ...muted, fontSize: 11 } },
                      `· ${(result && result.stream) || ''} v${(result && result.version) || 1}（${(result && result.module) || ''}）${result && result.reviewed ? ' · 已复核' : ' · 待复核'} — ${truncateText((result && result.summary) || '', 100)}`,
                    ),
                  ),
                ),
            ideas.length > 0
              ? h(
                  'div',
                  null,
                  h('div', { style: sectionTitle }, '最近想法'),
                  ...ideas.slice(0, 4).map((idea, index) =>
                    h(
                      'div',
                      { key: `i-${projectId}-${index}`, style: { ...muted, fontSize: 11 } },
                      `· ${formatUpdated(idea && idea.at)}${idea && idea.tag ? ` [${idea.tag}]` : ''} ${truncateText((idea && idea.text) || '', 120)}`,
                    ),
                  ),
                )
              : null,
            blockers.length > 0
              ? h(
                  'div',
                  null,
                  h('div', { style: sectionTitle }, '阻塞'),
                  ...blockers.slice(0, 5).map((blocker, index) =>
                    h('div', { key: `b-${projectId}-${index}`, style: { ...muted, fontSize: 11, color: 'var(--rdw-st-blocked)' } }, `· ${truncateText(String(blocker), 160)}`),
                  ),
                )
              : null,
            reviewed.length > 0
              ? h(
                  'div',
                  null,
                  h('div', { style: sectionTitle }, '复核记录'),
                  ...reviewed.slice(0, 5).map((record, index) =>
                    h(
                      'div',
                      { key: `rv-${projectId}-${index}`, style: { ...muted, fontSize: 11 } },
                      `· ${(record && record.stream) || ''} v${(record && record.version) || 1} · ${record && record.satisfied ? '满意' : '待复核'} · ${formatUpdated(record && record.at)}`,
                    ),
                  ),
                )
              : null,
          )
        : null,
    )
  }

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', margin: '2px 0 8px' } },
      h(
        'div',
        { style: { minWidth: 0 } },
        h('div', { style: { fontSize: 16, fontWeight: 700 } }, '项目网络'),
        h(
          'div',
          { style: { ...muted } },
          `共 ${projects.length} 个项目 · 待复核 ${Number(network.pendingReviewTotal) || pendingReviewAll.length} 条 · 关注 ${attention.length} 条 · 停滞 ${stale.length} 个`,
        ),
      ),
    ),
    opsBar,
    h(
      'div',
      { style: card },
      h('h3', { style: { ...sectionTitle, margin: '0 0 6px' } }, '网络概览'),
      h(
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
              ...['项目', '阶段', '进度', '已接受', '待决定', '阻塞', '最近更新'].map((label) =>
                h('th', { key: label, style: th }, label),
              ),
            ),
          ),
          h('tbody', null, ...overviewRows),
        ),
      ),
    ),
    h(
      'div',
      { style: card },
      h('h3', { style: { ...sectionTitle, margin: '0 0 6px' } }, '待你复核'),
      selfPendingReview.length === 0 && otherPendingReview.length === 0
        ? h('div', { style: muted }, '全部已复核')
        : h(
            'div',
            null,
            selfPendingReview.length > 0 ? h('div', { style: { ...muted, marginBottom: 4 } }, '本项目（可标记满意）') : null,
            ...selfPendingReview.map((item) => renderPendingReviewRow(item, true)),
            otherPendingReview.length > 0 ? h('div', { style: { ...muted, margin: '6px 0 4px' } }, '其它项目（只读）') : null,
            ...otherPendingReview.map((item) => renderPendingReviewRow(item, false)),
          ),
    ),
    h(
      'div',
      { style: card },
      h('h3', { style: { ...sectionTitle, margin: '0 0 6px' } }, '待主项目关注'),
      attentionNodes.length === 0
        ? h('div', { style: muted }, '暂无需要关注的事项')
        : h('div', null, ...attentionNodes),
    ),
    h('h3', { style: sectionTitle }, '项目详情'),
    projects.length > 0
      ? h('div', null, ...projects.map(renderProjectDetail))
      : h('div', { style: mutedBox }, '网络里还没有已发布的项目。'),
  )
}
