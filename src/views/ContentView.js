/**
 * 研究项目 DAG 工作台 — 内容页（v2.1，默认页）。
 *
 * 给人看的内容层：项目概览 + 需要你关注 + 子项目（模块）内容卡 + 详情抽屉 + 记想法。
 * 数据来自 GET /content（results/status/network/review 合并）；不要求用户理解状态机与门控。
 * 旧宿主（无 content 能力）的降级由面板处理，本模块只负责新内容页渲染。
 */
import {
  STYLES,
  countOf,
  firstLineText,
  handoffName,
  moduleFromHandoffPath,
  moduleStatusInfo,
  normalizeQuestions,
  phaseLabel,
  reviewKeyOf,
  takeLines,
  truncateText,
} from '../core/constants.js'
import { renderStatusBadge } from '../components/StatusBadge.js'
import { emptyBodyStyle, emptyIconStyle, emptyStateStyle, emptyTitleStyle } from '../core/theme.js'
import { renderHandoffDetail } from './DagView.js'

/** 结果按 decidedAt 倒序。 */
function sortResults(results) {
  return (Array.isArray(results) ? results : []).slice().sort((left, right) => {
    const leftTime = left && (left.decidedAt || left.acceptedAt) ? String(left.decidedAt || left.acceptedAt) : ''
    const rightTime = right && (right.decidedAt || right.acceptedAt) ? String(right.decidedAt || right.acceptedAt) : ''
    return leftTime < rightTime ? 1 : leftTime > rightTime ? -1 : 0
  })
}

/**
 * 渲染内容页。
 * @param {object} h React.createElement
 * @param {{content?: object|null, contentLoading?: boolean, contentError?: string,
 *          busy?: string, detail?: object|null, ideaError?: string,
 *          onRetry?: Function, onPublish?: Function, onOpenDetail?: Function,
 *          onOpenHandoff?: Function, onReview?: Function, onReviewItem?: Function,
 *          onIdea?: Function, onCloseDetail?: Function, onRetryHandoff?: Function,
 *          onGoEngineering?: Function, onPull?: Function, networkError?: string}} props
 */
export function renderContentView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const content = options.content && typeof options.content === 'object' && options.content.ok !== false ? options.content : null
  const busy = typeof options.busy === 'string' ? options.busy : ''
  const contentError = typeof options.contentError === 'string' ? options.contentError : ''
  const { card, row, chip, muted, button, primaryButton, sectionTitle, contentGrid, contentCard, contentTitle, contentMeta, contentBody, mutedBox } =
    STYLES
  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }

  if (!content) {
    if (contentError) {
      const isNoProject = contentError.includes('未保存项目根路径') || contentError.includes('未提供 project')
      return h(
        'div',
        { style: card },
        h('div', { style: { fontSize: 14, fontWeight: 700, marginBottom: 6 } }, isNoProject ? '欢迎使用研究项目工作台' : '内容读取失败'),
        h('div', { style: { ...muted, marginBottom: 12 } }, isNoProject ? '当前尚未加载研究项目。请在顶部输入项目路径，或点击下方按钮直接加载完整示例：' : contentError),
        h(
          'div',
          { style: { ...row, gap: 8 } },
          isNoProject && typeof options.onLoadExample === 'function'
            ? h(
                'button',
                { type: 'button', style: primaryButton, disabled: Boolean(busy), onClick: () => call(options.onLoadExample) },
                '一键加载示例项目（early-phosphate）',
              )
            : h(
                'button',
                { type: 'button', style: primaryButton, disabled: Boolean(busy), onClick: () => call(options.onRetry) },
                '重试',
              ),
        ),
      )
    }
    return h('div', { style: { ...muted, padding: '12px 0' } }, options.contentLoading ? '正在加载内容…' : '暂无内容数据')
  }

  const resultsPayload = content.results && content.results.ok !== false ? content.results : null
  const statusPayload = content.status && content.status.ok !== false ? content.status : null
  const network = content.network && typeof content.network === 'object' ? content.network : null
  const review = content.review && typeof content.review === 'object' ? content.review : null
  const projectInfo = content.project && typeof content.project === 'object' ? content.project : {}
  const errors = content.errors && typeof content.errors === 'object' ? content.errors : {}

  const modules = resultsPayload && Array.isArray(resultsPayload.modules)
    ? resultsPayload.modules
    : statusPayload && Array.isArray(statusPayload.modules)
      ? statusPayload.modules
      : []
  const allResults = resultsPayload && Array.isArray(resultsPayload.results) ? resultsPayload.results : []
  const pendingDecisions = statusPayload && Array.isArray(statusPayload.pending_decisions) ? statusPayload.pending_decisions : []
  const blockers = statusPayload && Array.isArray(statusPayload.blockers) ? statusPayload.blockers : []
  const counts = resultsPayload && resultsPayload.counts && typeof resultsPayload.counts === 'object' ? resultsPayload.counts : {}
  const selfProjectId = (network && network.selfProjectId) || projectInfo.id || ''
  const selfNetworkProject =
    network && Array.isArray(network.projects) ? network.projects.find((item) => item && item.projectId === selfProjectId) || null : null
  const completionRows = selfNetworkProject && Array.isArray(selfNetworkProject.completion) ? selfNetworkProject.completion : []
  const completionByModule = new Map(completionRows.filter(Boolean).map((item) => [String(item.module), item]))
  const reviewByItem = review && review.byItem && typeof review.byItem === 'object' ? review.byItem : null
  const pendingReview = review && Array.isArray(review.pendingReview)
    ? review.pendingReview
    : network && Array.isArray(network.pendingReview)
      ? network.pendingReview.filter((item) => item && item.projectId === selfProjectId)
      : []
  const reviewSummary =
    review && review.summary && typeof review.summary === 'object'
      ? review.summary
      : selfNetworkProject && selfNetworkProject.review && typeof selfNetworkProject.review === 'object'
        ? selfNetworkProject.review
        : null

  const isReviewed = (result) => {
    if (!result) return false
    if (result.reviewed === true) return true
    if (!reviewByItem) return false
    const record = reviewByItem[reviewKeyOf(result.stream, result.version)]
    return Boolean(record && record.satisfied === true)
  }

  const resultsByModule = new Map()
  for (const result of allResults) {
    const moduleId = result && result.module ? String(result.module) : '未分组'
    if (!resultsByModule.has(moduleId)) resultsByModule.set(moduleId, [])
    resultsByModule.get(moduleId).push(result)
  }
  for (const list of resultsByModule.values()) {
    const sorted = sortResults(list)
    list.length = 0
    list.push(...sorted)
  }

  const moduleEntries = modules.map((module) => ({
    id: module && module.id !== undefined ? String(module.id) : '未分组',
    name: module && module.name ? String(module.name) : '',
    branches: module && module.branches !== undefined ? Number(module.branches) || 0 : 0,
    raw: module,
  }))
  for (const moduleId of resultsByModule.keys()) {
    if (!moduleEntries.some((entry) => entry.id === moduleId)) moduleEntries.push({ id: moduleId, name: '', branches: 0, raw: null })
  }

  const modulesWithResults = moduleEntries.filter((entry) => (resultsByModule.get(entry.id) || []).length > 0).length
  const acceptedTotal = reviewSummary && Number.isFinite(Number(reviewSummary.accepted))
    ? Number(reviewSummary.accepted)
    : allResults.length
  const reviewedTotal = reviewSummary && Number.isFinite(Number(reviewSummary.reviewed))
    ? Number(reviewSummary.reviewed)
    : allResults.filter((result) => isReviewed(result)).length
  const pendingDecisionCount = pendingDecisions.length
  const blockedCount = blockers.length > 0 ? blockers.length : countOf(counts, 'blocked')

  const moduleCardData = moduleEntries.map((entry) => {
    const moduleResults = resultsByModule.get(entry.id) || []
    const latest = moduleResults.length > 0 ? moduleResults[0] : null
    const completion = completionByModule.get(entry.id) || null
    const pendingInModule = pendingDecisions.filter(
      (item) => item && String(item.module || moduleFromHandoffPath(item.path)) === entry.id,
    )
    const acceptedCount =
      completion && Number.isFinite(Number(completion.acceptedCount))
        ? Number(completion.acceptedCount)
        : moduleResults.length
    const reviewedCount =
      completion && Number.isFinite(Number(completion.reviewedCount))
        ? Number(completion.reviewedCount)
        : moduleResults.filter((result) => isReviewed(result)).length
    const pendingCount =
      completion && Array.isArray(completion.pending) && completion.pending.length > 0
        ? completion.pending.length
        : pendingInModule.length
    const blockedInModule = completion && Array.isArray(completion.blocked) ? completion.blocked.length : 0
    const status =
      (completion && completion.status) ||
      (blockedInModule > 0
        ? 'blocked'
        : pendingCount > 0
          ? 'active'
          : acceptedCount > 0
            ? 'done'
            : 'idle')
    return {
      entry,
      latest,
      status,
      acceptedCount,
      reviewedCount,
      pendingCount,
      pendingStreams:
        completion && Array.isArray(completion.pending)
          ? completion.pending
          : pendingInModule.map((item) => (item && item.stream) || ''),
    }
  })

  /* -------------------------------------------------------- 需要你关注 */
  const attentionNodes = []
  for (const item of pendingDecisions) {
    const moduleId = (item && item.module) || moduleFromHandoffPath(item && item.path)
    const stream = (item && item.stream) || '待决定'
    const version = (item && item.version) || 1
    const question = firstLineText(normalizeQuestions(item && item.questions), 120)
    attentionNodes.push({
      key: `pending-${(item && item.path) || attentionNodes.length}`,
      kind: 'pending',
      node: h(
        'div',
        { key: `pending-${(item && item.path) || attentionNodes.length}`, style: { ...card, padding: '8px 10px', marginBottom: 6 } },
        h(
          'div',
          { style: { ...row, justifyContent: 'space-between', marginBottom: 2 } },
          h(
            'span',
            {
              style: {
                ...chip,
                color: item && item.needs_decision ? 'var(--rdw-st-provisional)' : 'var(--rdw-st-accepted)',
                borderColor: item && item.needs_decision ? 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)' : 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)',
              },
            },
            item && item.needs_decision ? '需人类决策' : '待决定',
          ),
          h('span', { style: { ...chip, fontSize: 12 } }, `${moduleId} · ${stream} v${version}`),
        ),
        h('div', { style: contentBody }, question || '有一项决定等你确认'),
        h(
          'div',
          { style: { ...row, justifyContent: 'flex-end', gap: 6, marginTop: 4 } },
          h(
            'button',
            { type: 'button', style: button, onClick: () => call(options.onOpenHandoff, item && item.path) },
            '查看交接',
          ),
          h(
            'button',
            {
              type: 'button',
              style: button,
              title: '撤回为 DRAFT 状态，解冻正文以便修改错别字或调整产物',
              onClick: () => call(options.onUnsubmit, item && item.path),
            },
            '撤回修改',
          ),
        ),
      ),
    })
  }
  for (const item of pendingReview) {
    const moduleId = (item && item.module) || moduleFromHandoffPath(item && item.path)
    const stream = (item && item.stream) || ''
    const version = (item && item.version) || 1
    const matched = allResults.find((result) => result && result.stream === stream && Number(result.version) === Number(version))
    const title = matched && matched.title ? String(matched.title) : ''
    attentionNodes.push({
      key: `review-${stream}-${version}-${attentionNodes.length}`,
      kind: 'review',
      node: h(
        'div',
        { key: `review-${stream}-${version}-${attentionNodes.length}`, style: { ...card, padding: '8px 10px', marginBottom: 6 } },
        h(
          'div',
          { style: { ...row, justifyContent: 'space-between', marginBottom: 2 } },
          h('span', { style: { ...chip, color: 'var(--rdw-st-provisional)', borderColor: 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)' } }, '待复核'),
          h('span', { style: { ...chip, fontSize: 12 } }, `${moduleId} · ${stream} v${version}`),
        ),
        title ? h('div', { style: contentBody }, truncateText(title, 120)) : null,
        h(
          'div',
          { style: { ...row, justifyContent: 'flex-end', marginTop: 4 } },
          h(
            'button',
            {
              type: 'button',
              style: primaryButton,
              disabled: Boolean(busy),
              onClick: () => call(options.onReviewItem, item, true),
            },
            '满意',
          ),
          h(
            'button',
            {
              type: 'button',
              style: button,
              onClick: () => (matched ? call(options.onOpenDetail, matched) : call(options.onOpenHandoff, item && item.path)),
            },
            '查看内容',
          ),
        ),
      ),
    })
  }
  for (const blocker of blockers) {
    attentionNodes.push({
      key: `blocked-${attentionNodes.length}`,
      kind: 'blocked',
      node: h(
        'div',
        { key: `blocked-${attentionNodes.length}`, style: { ...card, padding: '8px 10px', marginBottom: 6 } },
        h(
          'div',
          { style: { ...row, marginBottom: 2 } },
          h('span', { style: { ...chip, color: 'var(--rdw-st-blocked)', borderColor: 'color-mix(in srgb,var(--rdw-st-blocked) 32%,transparent)' } }, '阻塞'),
        ),
        h('div', { style: contentBody }, truncateText(String(blocker), 200)),
      ),
    })
  }
  const attentionVisible = attentionNodes.slice(0, 6)

  /* ---------------------------------------------------------- 模块卡片 */
  const renderModuleCard = (data) => {
    const { entry, latest, status, acceptedCount, reviewedCount, pendingCount, pendingStreams } = data
    const statusTheme = moduleStatusInfo(status)
    const latestReviewed = latest ? isReviewed(latest) : false
    const canSatisfy = Boolean(latest) && !(reviewByItem && latestReviewed) && !busy
    const keyLines = latest ? takeLines(latest.keyResults, 3, 120) : []
    const limitsLine = latest ? firstLineText(latest.limitations, 120) : ''
    return h(
      'div',
      { key: `module-${entry.id}`, className: 'rdw-card-hover', style: contentCard },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', alignItems: 'flex-start' } },
        h(
          'div',
          { style: { minWidth: 0 } },
          h('div', { style: contentTitle }, entry.name || entry.id),
          h('div', { style: contentMeta }, entry.id),
        ),
        h(
          'span',
          { style: { ...chip, color: statusTheme.color, borderColor: statusTheme.color, fontSize: 12, fontWeight: 600 } },
          statusTheme.label,
        ),
      ),
      h(
        'div',
        { style: { ...STYLES.statBar } },
        h('span', { style: { ...chip, fontSize: 12 } }, `已接受 ${acceptedCount}`),
        reviewByItem ? h('span', { style: { ...chip, fontSize: 12 } }, `已复核 ${reviewedCount}/${acceptedCount}`) : null,
        pendingCount > 0 ? h('span', { style: { ...chip, fontSize: 12, color: 'var(--rdw-st-provisional)' } }, `待决定 ${pendingCount}`) : null,
      ),
      latest
        ? h(
            'div',
            { style: { minWidth: 0 } },
            h(
              'div',
              { style: { ...contentBody, fontWeight: 600 } },
              `${truncateText(latest.title || latest.stream || '未命名结果', 80)} · ${latest.stream || ''} v${latest.version || 1}`,
            ),
            keyLines.length > 0
              ? h('div', { style: { ...contentBody, marginTop: 2, color: 'inherit', opacity: 0.9 } }, keyLines.join('\n'))
              : null,
            limitsLine ? h('div', { style: { ...muted, marginTop: 2 } }, `限制：${limitsLine}`) : null,
            reviewByItem
              ? h(
                  'div',
                  { style: { marginTop: 3 } },
                  h(
                    'span',
                    {
                      style: {
                        ...chip,
                        fontSize: 12,
                        color: latestReviewed ? 'var(--rdw-st-accepted)' : 'var(--rdw-st-provisional)',
                        borderColor: latestReviewed ? 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' : 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)',
                      },
                    },
                    latestReviewed ? '已复核' : '待复核',
                  ),
                  latest && latest.is_stale
                    ? h(
                        'span',
                        {
                          style: {
                            ...chip,
                            fontSize: 12,
                            color: 'var(--rdw-st-rejected)',
                            borderColor: 'color-mix(in srgb,var(--rdw-st-rejected) 32%,transparent)',
                            fontWeight: 700,
                            marginLeft: 4,
                          },
                          title: Array.isArray(latest.stale_reasons)
                            ? latest.stale_reasons.join('\n')
                            : '依赖的上游版本已被替代',
                        },
                        '⚠️ 级联失效',
                      )
                    : null,
                )
              : null,
            h(
              'div',
              { style: { ...row, gap: 6, marginTop: 4 } },
              h(
                'button',
                { type: 'button', style: button, onClick: () => call(options.onOpenDetail, latest) },
                '查看内容',
              ),
              latest && latest.branch
                ? h(
                    'button',
                    {
                      type: 'button',
                      style: button,
                      onClick: () => call(options.onOpenBranchWork, { module: latest.module, branch: latest.branch }),
                    },
                    '🤖 智能体工作与对话',
                  )
                : null,
            ),
          )
        : h(
            'div',
            { style: mutedBox },
            h('div', { style: { fontWeight: 600, marginBottom: 2 } }, '还没有可用的结果'),
            h(
              'div',
              { style: muted },
              pendingStreams.length > 0
                ? `待决定 ${pendingStreams.length} 项：${pendingStreams.filter(Boolean).slice(0, 3).join('、')}`
                : entry.branches > 0
                  ? `该子项目有 ${entry.branches} 个分支在推进`
                  : '尚在准备阶段',
            ),
          ),
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginTop: 'auto' } },
        h(
          'button',
          {
            type: 'button',
            style: canSatisfy ? primaryButton : { ...button, opacity: 0.55 },
            disabled: !canSatisfy,
            onClick: () => call(options.onReview, latest, true),
          },
          latest && reviewByItem && latestReviewed ? '已全部满意' : '满意',
        ),
        h(
          'button',
          {
            type: 'button',
            style: button,
            onClick: () =>
              call(options.onIdea, {
                module: entry.id,
                stream: latest && latest.stream ? latest.stream : '',
                version: latest && latest.version ? latest.version : '',
              }),
          },
          '记想法',
        ),
      ),
    )
  }

  /* ------------------------------------------------------------- 详情抽屉 */
  const detail = options.detail && typeof options.detail === 'object' ? options.detail : null
  let detailNode = null
  if (detail) {
    if (detail.type === 'handoff') {
      detailNode = h(
        'div',
        null,
        h('div', { style: STYLES.drawerBackdrop, onClick: () => call(options.onCloseDetail) }),
        h(
          'div',
          { style: STYLES.drawer, role: 'dialog', 'aria-modal': 'true', 'aria-label': '交接详情' },
          h('div', { style: mutedBox }, '这是待决定交接。接受/拒绝请在「工程 → 交接」页面完成。'),
          h(
            'div',
            { style: { marginTop: 8 } },
            renderHandoffDetail(h, {
              detail: { path: detail.path, loading: Boolean(detail.loading), data: detail.data || null, error: detail.error || '' },
              onClose: options.onCloseDetail,
              onRetry: options.onRetryHandoff,
              busy: Boolean(busy),
            }),
          ),
        ),
      )
    } else {
      const result = detail.result && typeof detail.result === 'object' ? detail.result : null
      if (!result) {
        detailNode = null
      } else {
        const files = Array.isArray(result.files) ? result.files : []
        const resultReviewed = isReviewed(result)
        detailNode = h(
          'div',
          null,
          h('div', { style: STYLES.drawerBackdrop, onClick: () => call(options.onCloseDetail) }),
          h(
            'div',
            { style: STYLES.drawer, role: 'dialog', 'aria-modal': 'true', 'aria-label': '内容详情' },
            h(
              'div',
              { style: { ...row, justifyContent: 'space-between', marginBottom: 4 } },
              h('strong', { style: { fontSize: 14, overflowWrap: 'anywhere' } }, result.title || result.stream || '内容详情'),
              h('button', { type: 'button', style: button, onClick: () => call(options.onCloseDetail) }, '关闭'),
            ),
            h(
              'div',
              { style: { ...contentMeta, marginBottom: 8 } },
              `${result.stream || ''} v${result.version || 1} · ${(result.moduleName || '') || result.module || ''} · ${result.decidedAt || result.acceptedAt || ''}`,
            ),
            result.question
              ? h(
                  'div',
                  { style: { marginBottom: 8 } },
                  h('div', { style: sectionTitle }, '研究问题'),
                  h('div', { style: contentBody }, String(result.question)),
                )
              : null,
            h('div', { style: sectionTitle }, '关键结果'),
            h('div', { style: { ...contentBody, whiteSpace: 'pre-wrap' } }, result.keyResults || '（未提供）'),
            result.limitations
              ? h(
                  'div',
                  { style: { marginTop: 8 } },
                  h('div', { style: sectionTitle }, '局限与注意事项'),
                  h('div', { style: { ...contentBody, opacity: 0.8 } }, String(result.limitations)),
                )
              : null,
            files.length > 0
              ? h(
                  'div',
                  { style: { marginTop: 8 } },
                  h('div', { style: sectionTitle }, `文件（${files.length}）— 点击直接预览代码与数据`),
                  h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 } },
                    ...files.map((file) => {
                      const str = String(file)
                      const ext = str.split('.').pop().toLowerCase()
                      const icon = ext === 'csv' || ext === 'tsv' ? '📊' : ext === 'r' || ext === 'py' || ext === 'sh' || ext === 'js' ? '💻' : ext === 'md' ? '📝' : ext === 'svg' || ext === 'png' ? '🖼️' : '📄'
                      return h(
                        'button',
                        {
                          key: str,
                          type: 'button',
                          style: {
                            ...button,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            fontSize: 11,
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: 'var(--rdw-sunken)',
                          },
                          onClick: () => call(options.onOpenFile, str),
                        },
                        h(
                          'div',
                          { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
                          h('span', null, icon),
                          h('span', { style: { ...STYLES.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, str),
                        ),
                        h('span', { style: { fontSize: 12, opacity: 0.7, color: 'var(--rdw-accent)', whiteSpace: 'nowrap', marginLeft: 8 } }, '查看内容 →'),
                      )
                    }),
                  ),
                )
              : null,
            result.path
              ? h('div', { style: { ...STYLES.mono, fontSize: 12, opacity: 0.6, marginTop: 8 } }, result.path)
              : null,
            h(
              'div',
              { style: { ...row, justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 } },
              h(
                'div',
                { style: { ...row } },
                h(
                  'button',
                  {
                    type: 'button',
                    style: resultReviewed ? { ...button, opacity: 0.55 } : primaryButton,
                    disabled: resultReviewed || Boolean(busy),
                    onClick: () => call(options.onReview, result, true),
                  },
                  resultReviewed ? '已满意' : '满意',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    style: button,
                    disabled: Boolean(busy),
                    onClick: () => call(options.onReview, result, false),
                  },
                  '待复核',
                ),
              ),
              h(
                'div',
                { style: { ...row, gap: 6 } },
                result && (result.branch || result.module)
                  ? h(
                      'button',
                      {
                        type: 'button',
                        style: button,
                        onClick: () => call(options.onOpenBranchWork, { module: result.module, branch: result.branch }),
                      },
                      '🤖 智能体工作与对话',
                    )
                  : null,
                h('button', { type: 'button', style: button, onClick: () => call(options.onGoEngineering) }, '在工程页查看交接'),
              ),
            ),
          ),
        )
      }
    }
  }

  const errorsLine = []
  if (errors.results) errorsLine.push(`results：${truncateText(errors.results, 120)}`)
  if (errors.status) errorsLine.push(`status：${truncateText(errors.status, 120)}`)

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...card, display: 'flex', flexDirection: 'column', gap: 6 } },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between' } },
        h(
          'div',
          { style: { minWidth: 0 } },
          h('div', { style: { fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' } }, projectInfo.title || '研究项目'),
          h('div', { style: contentMeta }, `${phaseLabel(projectInfo.phase)} · ${projectInfo.root || ''}`),
        ),
        h(
          'div',
          { style: { ...row } },
          h('button', { type: 'button', style: primaryButton, disabled: Boolean(busy), onClick: () => call(options.onPublish) }, busy === 'bridge:publish' ? '发布中…' : '发布到网络'),
          h('button', { type: 'button', style: button, disabled: Boolean(busy), onClick: () => call(options.onPull), title: '拉取 TeamMCP 网络消息' }, '拉取消息'),
        ),
      ),
      h(
        'div',
        { style: STYLES.statBar },
        h('span', { style: { ...chip, color: 'var(--rdw-st-accepted)', borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' } }, `子项目 ${modulesWithResults}/${moduleEntries.length} 已有结果`),
        reviewByItem ? h('span', { style: { ...chip } }, `已复核 ${reviewedTotal}/${acceptedTotal}`) : null,
        h('span', { style: { ...chip, color: 'var(--rdw-st-provisional)', borderColor: 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)' } }, `待决定 ${pendingDecisionCount}`),
        h('span', { style: { ...chip, color: 'var(--rdw-st-blocked)', borderColor: 'color-mix(in srgb,var(--rdw-st-blocked) 32%,transparent)' } }, `阻塞 ${blockedCount}`),
      ),
      options.networkError ? h('div', { style: { ...muted } }, `网络提示：${truncateText(options.networkError, 160)}`) : null,
      errorsLine.length > 0 ? h('div', { style: { ...muted } }, `部分数据读取失败：${errorsLine.join('；')}`) : null,
    ),
    attentionVisible.length > 0
      ? h(
          'div',
          null,
          h('h3', { style: sectionTitle }, '需要你关注'),
          ...attentionVisible.map((item) => item.node),
        )
      : h(
          'div',
          { style: { ...mutedBox, marginBottom: 12, color: 'var(--rdw-st-accepted)', borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 30%,transparent)' } },
          '没有需要你处理的事，继续专注研究',
        ),
    h('h3', { style: sectionTitle }, '子项目（模块）'),
    moduleCardData.length > 0
      ? h('div', { style: contentGrid }, ...moduleCardData.map(renderModuleCard))
      : h(
          'div',
          { style: emptyStateStyle() },
          h('div', { style: emptyIconStyle(), 'aria-hidden': 'true' }, '🧩'),
          h('div', { style: emptyTitleStyle() }, '这个项目还没有子项目（模块）'),
          h('div', { style: emptyBodyStyle() }, '子项目是研究主线的分段：文献检索、统计分析、论文写作等。先建一个模块，主任务才能沿着它推进。'),
        ),
    detailNode,
    renderFileModal(h, options.fileModal, options.onCloseFileModal, options.onOpenExternal),
    renderBranchWorkModal(
      h,
      options.branchWorkModal,
      options.onCloseBranchWorkModal,
      options.onOpenFile,
      options.onSendDirective,
      options.onDirectiveChange,
    ),
  )
}

/**
 * 记想法对话框：文本 + 可选 tag → POST /bridge {action:'idea'}。
 * @param {object} h React.createElement
 * @param {{dialog?: object|null, busy?: boolean, onChange?: Function,
 *          onConfirm?: Function, onCancel?: Function}} props
 */
export function renderIdeaDialog(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const dialog = options.dialog
  if (!dialog) return null
  const { row, muted, textarea, input, button, primaryButton, errorBanner } = STYLES
  const busy = Boolean(options.busy)
  const text = typeof dialog.text === 'string' ? dialog.text : ''
  const tag = typeof dialog.tag === 'string' ? dialog.tag : ''
  const canSave = text.trim().length > 0 && text.trim().length <= 2000 && !busy
  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }
  return h(
    'div',
    { style: STYLES.overlay, role: 'presentation' },
    h(
      'div',
      { style: STYLES.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': '记想法' },
      h('strong', { style: { fontSize: 14 } }, '记一条想法'),
      h('div', { style: { ...muted, margin: '4px 0 8px' } }, dialog.context ? `关联：${dialog.context}` : '记下当前的研究想法，会同步到项目网络。'),
      dialog.error ? h('div', { style: { ...errorBanner, marginBottom: 8 } }, dialog.error) : null,
      h('textarea', {
        value: text,
        'data-field': 'text',
        'aria-label': '想法内容',
        placeholder: '例如：亚组分析先按基线 SOFA 分层，再补 E-value 敏感性分析',
        style: { ...textarea, minHeight: 96 },
        disabled: busy,
        onChange: (event) => call(options.onChange, 'text', event && event.target ? event.target.value : ''),
      }),
      h('input', {
        value: tag,
        'data-field': 'tag',
        'aria-label': '想法标签（可选）',
        placeholder: '标签（可选，如 stats / methods）',
        style: { ...input, width: '100%', marginTop: 8 },
        disabled: busy,
        onChange: (event) => call(options.onChange, 'tag', event && event.target ? event.target.value : ''),
      }),
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginTop: 10 } },
        h('span', { style: muted }, `${text.trim().length} / 2000 字`),
        h(
          'div',
          { style: { ...row } },
          h('button', { type: 'button', style: button, disabled: busy, onClick: () => call(options.onCancel) }, '取消'),
          h(
            'button',
            {
              type: 'button',
              style: canSave ? primaryButton : { ...button, opacity: 0.55 },
              disabled: !canSave,
              'aria-label': '保存想法',
              onClick: () => {
                if (canSave) call(options.onConfirm)
              },
            },
            busy ? '保存中…' : '保存想法',
          ),
        ),
      ),
    ),
  )
}

/** 渲染 CSV 预览表格。 */
function renderCsvTable(h, text, ext) {
  const sep = ext === '.tsv' ? '\t' : ','
  const lines = String(text || '').trim().split('\n').filter(Boolean)
  if (lines.length === 0) return h('div', { style: STYLES.muted }, '（空表格）')
  const headers = lines[0].split(sep)
  const rows = lines.slice(1, 101).map((l) => l.split(sep))
  return h(
    'div',
    { style: { overflowX: 'auto', maxHeight: '55vh', border: '1px solid var(--rdw-line-2)', borderRadius: 'var(--rdw-r-sm)' } },
    h(
      'table',
      { style: { width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' } },
      h(
        'thead',
        { style: { background: 'var(--rdw-panel)', position: 'sticky', top: 0 } },
        h(
          'tr',
          null,
          ...headers.map((hd, idx) =>
            h('th', { key: idx, style: { padding: '6px 10px', borderBottom: '1px solid var(--rdw-line-2)', whiteSpace: 'nowrap' } }, hd.trim()),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        ...rows.map((row, rIdx) =>
          h(
            'tr',
            { key: rIdx, style: { background: rIdx % 2 === 1 ? 'var(--rdw-sunken)' : 'transparent' } },
            ...row.map((cell, cIdx) => {
              const val = cell.trim()
              const isNum = !isNaN(Number(val)) && val.length > 0
              return h(
                'td',
                {
                  key: cIdx,
                  style: {
                    padding: '5px 10px',
                    borderBottom: '1px solid var(--rdw-line)',
                    whiteSpace: 'nowrap',
                    textAlign: isNum ? 'right' : 'left',
                    fontFamily: isNum ? 'monospace' : 'inherit',
                  },
                },
                val,
              )
            }),
          ),
        ),
      ),
    ),
    lines.length > 101 ? h('div', { style: { ...STYLES.muted, padding: '4px 8px', fontSize: 12 } }, `已预览前 100 行（共 ${lines.length - 1} 行）`) : null,
  )
}

/** 渲染文件内容预览模态框。 */
export function renderFileModal(h, fileModal, onClose, onOpenExternal) {
  if (!fileModal) return null
  const { row, muted, button, primaryButton, card, dialog } = STYLES
  const isCsv = fileModal.data && (fileModal.data.ext === '.csv' || fileModal.data.ext === '.tsv')
  const extIcon = isCsv ? '📊' : fileModal.data && (fileModal.data.ext === '.r' || fileModal.data.ext === '.py') ? '💻' : '📄'

  return h(
    'div',
    { style: STYLES.overlay, role: 'presentation' },
    h(
      'div',
      { style: { ...dialog, width: '85%', maxWidth: 880, maxHeight: '85vh', display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginBottom: 8 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
          h('span', { style: { fontSize: 16 } }, extIcon),
          h('strong', { style: { fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, fileModal.path),
          fileModal.data ? h('span', { style: { ...muted, fontSize: 12 } }, `(${Math.round(fileModal.data.size / 1024 * 10) / 10} KB · ${fileModal.data.lines} 行)`) : null,
        ),
        h('button', { type: 'button', style: { ...button, padding: '2px 8px' }, onClick: onClose }, '✕'),
      ),
      h(
        'div',
        { style: { flex: 1, overflowY: 'auto', minHeight: 180, margin: '8px 0' } },
        fileModal.loading
          ? h('div', { style: { ...muted, padding: 20 } }, '正在读取文件...')
          : fileModal.error
            ? h('div', { style: { ...muted, color: 'var(--rdw-st-rejected)', padding: 20 } }, fileModal.error)
            : isCsv
              ? renderCsvTable(h, fileModal.data.content, fileModal.data.ext)
              : h(
                  'div',
                  {
                    style: {
                      background: 'var(--rdw-sunken)',
                      padding: 10,
                      borderRadius: 4,
                      overflowX: 'auto',
                      maxHeight: '55vh',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      lineHeight: 1.5,
                      whiteSpace: 'pre',
                    },
                  },
                  fileModal.data ? fileModal.data.content : '',
                ),
      ),
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginTop: 8 } },
        h(
          'div',
          { style: { ...row, gap: 6, flexWrap: 'wrap' } },
          h(
            'button',
            {
              type: 'button',
              style: primaryButton,
              title: '在 DSH 侧边栏编辑器中打开全文（比弹窗更适合读长文件与代码）',
              onClick: () => onOpenSidebar && onOpenSidebar(fileModal.path),
            },
            '📂 在侧边栏打开',
          ),
          h(
            'button',
            { type: 'button', style: button, onClick: () => onOpenExternal && onOpenExternal(fileModal.path) },
            '在系统资源管理器中定位',
          ),
        ),
        h('button', { type: 'button', style: button, onClick: onClose }, '关闭'),
      ),
    ),
  )
}

/** 渲染分支智能体工作区与对话模态框。 */
export function renderBranchWorkModal(h, branchWorkModal, onClose, onOpenFile, onSendDirective, onDirectiveChange) {
  if (!branchWorkModal) return null
  const { row, muted, button, primaryButton, dialog, chip, textarea } = STYLES
  const data = branchWorkModal.data
  const loading = branchWorkModal.loading
  const error = branchWorkModal.error
  const directiveText = branchWorkModal.directiveText || ''
  const sending = branchWorkModal.sending

  return h(
    'div',
    { style: STYLES.overlay, role: 'presentation' },
    h(
      'div',
      { style: { ...dialog, width: '90%', maxWidth: 920, maxHeight: '88vh', display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          h('span', { style: { fontSize: 16 } }, '🤖'),
          h('strong', { style: { fontSize: 14 } }, data ? `智能体工作区 · ${data.module.name} / ${data.branch.name}` : '智能体工作区与对话'),
          data ? h('span', { style: { ...chip, fontSize: 12 } }, data.branch.id) : null,
        ),
        h('button', { type: 'button', style: { ...button, padding: '2px 8px' }, onClick: onClose }, '✕'),
      ),
      h(
        'div',
        { style: { flex: 1, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 12 } },
        loading
          ? h('div', { style: { ...muted, padding: 20 } }, '正在读取智能体工作区...')
          : error
            ? h('div', { style: { ...muted, color: 'var(--rdw-st-rejected)', padding: 20 } }, error)
            : data
              ? [
                  // 1. 工作产出与代码
                  h(
                    'div',
                    { key: 'files', style: { border: '1px solid var(--rdw-line)', borderRadius: 'var(--rdw-r-sm)', padding: 10 } },
                    h('div', { style: { fontSize: 12, fontWeight: 700, marginBottom: 6 } }, '📁 智能体工作文件（代码与物料）'),
                    h('div', { style: { ...muted, fontSize: 12, marginBottom: 6 } }, '点击即可直接展开预览脚本代码或数据表格：'),
                    h(
                      'div',
                      { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                      ...(data.workFiles || []).map((wf) =>
                        h(
                          'button',
                          {
                            key: wf.rel,
                            type: 'button',
                            style: { ...button, fontSize: 12, padding: '3px 8px', cursor: 'pointer' },
                            onClick: () => onOpenFile && onOpenFile(wf.rel),
                          },
                          `💻 work/${wf.name}`,
                        ),
                      ),
                      ...(data.outputFiles || []).map((of) =>
                        h(
                          'button',
                          {
                            key: of.rel,
                            type: 'button',
                            style: { ...button, fontSize: 12, padding: '3px 8px', cursor: 'pointer', borderColor: 'color-mix(in srgb,var(--rdw-accent) 32%,transparent)' },
                            onClick: () => onOpenFile && onOpenFile(of.rel),
                          },
                          `📊 outputs/${of.name}`,
                        ),
                      ),
                    ),
                  ),

                  // 2. 思考与推理日志 (SESSION)
                  data.sessionNotes
                    ? h(
                        'div',
                        { key: 'session', style: { border: '1px solid var(--rdw-line)', borderRadius: 'var(--rdw-r-sm)', padding: 10 } },
                        h('div', { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, '🧠 智能体内部思考与会话推理记录'),
                        h(
                          'div',
                          {
                            style: {
                              background: 'var(--rdw-sunken)',
                              padding: 8,
                              borderRadius: 4,
                              maxHeight: 180,
                              overflowY: 'auto',
                              fontSize: 11,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace',
                              lineHeight: 1.4,
                            },
                          },
                          data.sessionNotes,
                        ),
                      )
                    : null,

                  // 3. 任务简报 (BRIEF)
                  data.brief
                    ? h(
                        'div',
                        { key: 'brief', style: { border: '1px solid var(--rdw-line)', borderRadius: 'var(--rdw-r-sm)', padding: 10 } },
                        h('div', { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, '📋 任务简报 BRIEF.md'),
                        h(
                          'div',
                          {
                            style: {
                              background: 'var(--rdw-sunken)',
                              padding: 8,
                              borderRadius: 4,
                              maxHeight: 140,
                              overflowY: 'auto',
                              fontSize: 11,
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4,
                            },
                          },
                          data.brief,
                        ),
                      )
                    : null,

                  // 4. 与智能体对话 / 派发调优指令
                  h(
                    'div',
                    { key: 'dialogue', style: { border: '1px solid var(--rdw-line)', borderRadius: 'var(--rdw-r-sm)', padding: 10 } },
                    h('div', { style: { fontSize: 12, fontWeight: 700, marginBottom: 4 } }, '💬 与该模块智能体直接对话 / 派发指令'),
                    data.directives
                      ? h(
                          'div',
                          {
                            style: {
                              background: 'var(--rdw-sunken)',
                              padding: 8,
                              borderRadius: 4,
                              maxHeight: 120,
                              overflowY: 'auto',
                              fontSize: 11,
                              whiteSpace: 'pre-wrap',
                              marginBottom: 8,
                            },
                          },
                          data.directives,
                        )
                      : null,
                    h('textarea', {
                      value: directiveText,
                      placeholder: '输入向该模块智能体下达的指令或追问（例如：将截尾阈值调整为 95% 重算，或检查乳酸缺失分布）...',
                      style: { ...textarea, minHeight: 64, width: '100%' },
                      onChange: (e) => onDirectiveChange && onDirectiveChange(e.target ? e.target.value : ''),
                    }),
                    h(
                      'div',
                      { style: { ...row, justifyContent: 'flex-end', marginTop: 6 } },
                      h(
                        'button',
                        {
                          type: 'button',
                          style: primaryButton,
                          disabled: !directiveText.trim() || sending,
                          onClick: () => onSendDirective && onSendDirective(directiveText),
                        },
                        sending ? '正在发送指令…' : '发送指令给该智能体',
                      ),
                    ),
                  ),
                ]
              : null,
      ),
      h(
        'div',
        { style: { ...row, justifyContent: 'flex-end', marginTop: 8 } },
        h('button', { type: 'button', style: button, onClick: onClose }, '关闭'),
      ),
    ),
  )
}
