/**
 * 研究项目 DAG 工作台 — 结果视图（v1.2 默认页，结果优先）。
 *
 * 给人看：不出现状态机术语，不要求用户手动操作门控。
 *   - 「需要你关注」：/results.attention 校验问题（code + 自然语言）、pending 待确认摘要、blocked；
 *   - 「让系统处理可自动通过的结果」按钮：POST /run {action:'auto'}（宿主缺 auto 时隐藏并提示重启）；
 *   - 已接受结果：按模块分组卡片（stream · vN / 日期 / title / question / keyResults 截断可展开
 *     / limitations 折叠 / 文件列表），点击卡片用 fetchHandoff 打开等宽纯文本详情；
 *   - 旧宿主降级：无 results 能力时显示提示 + /state.accepted 简表，不崩溃。
 */
import {
  STYLES,
  attentionText,
  countOf,
  handoffName,
  plainStatusLabel,
  truncateText,
} from '../core/constants.js'
import { renderStatusBadge } from '../components/StatusBadge.js'
import { renderHandoffDetail } from './DagView.js'

/** 阻止展开链接的点击冒泡到卡片（避免同时打开详情）。 */
function stopClickEvent(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
}

/**
 * @param {object} h React.createElement
 * @param {{project?: object, results?: object|null, resultsLoading?: boolean,
 *          resultsError?: string, autoEnabled?: boolean, resultsAvailable?: boolean,
 *          busy?: string, onAuto?: Function, onSelect?: Function, detail?: object|null,
 *          onCloseDetail?: Function, onRetryDetail?: Function,
 *          expandedResults?: object, expandedLimitations?: object,
 *          onToggleKeyResults?: Function, onToggleLimitations?: Function}} props
 */
export function renderResultsView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const project = options.project && typeof options.project === 'object' ? options.project : null
  const results = options.results && typeof options.results === 'object' && options.results.ok !== false ? options.results : null
  const autoEnabled = options.autoEnabled === true
  const resultsAvailable = options.resultsAvailable === true
  const busy = options.busy || ''
  const resultsError = typeof options.resultsError === 'string' ? options.resultsError : ''
  const expandedResults = options.expandedResults && typeof options.expandedResults === 'object' ? options.expandedResults : {}
  const expandedLimitations =
    options.expandedLimitations && typeof options.expandedLimitations === 'object' ? options.expandedLimitations : {}

  const { card, row, chip, muted, mono, button, primaryButton, sectionTitle, tableWrap, table, th, td, noticeBanner, errorBanner } =
    STYLES

  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }

  if (!project || project.exists === false) {
    return h(
      'div',
      { style: card },
      h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 } }, '还没有加载项目'),
      h('div', { style: muted }, '在顶部加载项目或点「加载示例项目」，这里会展示研究结果。'),
    )
  }

  const detailNode = renderHandoffDetail(h, {
    detail: options.detail,
    onClose: options.onCloseDetail,
    onRetry: options.onRetryDetail,
    onBusy: options.busy,
    busy,
  })

  /* ------------------------------------------------- 旧宿主：/state.accepted 简表 */
  if (!resultsAvailable) {
    const accepted = Array.isArray(project.accepted) ? project.accepted : []
    return h(
      'div',
      null,
      h('div', { style: noticeBanner }, '宿主为旧版本，结果视图需重启 DSH 后启用；下方先显示项目已接受结果的简表。'),
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', margin: '2px 0 10px' } },
        h('span', { style: { ...sectionTitle, margin: 0 } }, '已接受结果（简表）'),
        h('span', { style: muted }, `共 ${accepted.length} 项`),
      ),
      accepted.length === 0
        ? h('div', { style: muted }, '这个项目还没有已接受结果。')
        : h(
            'div',
            { style: tableWrap },
            h(
              'table',
              { style: table },
              h(
                'thead',
                null,
                h('tr', null, ...['stream', '版本', '路径'].map((label) => h('th', { key: label, style: th }, label))),
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
                    h('td', { style: td }, `v${(item && item.version) || 1}`),
                    h(
                      'td',
                      { style: td },
                      h(
                        'span',
                        { style: { ...mono, ...STYLES.link, fontSize: 12 }, onClick: () => call(options.onSelect, pathValue) },
                        pathValue || handoffName(pathValue),
                      ),
                    ),
                  )
                }),
              ),
            ),
          ),
      detailNode,
    )
  }

  if (resultsError) {
    return h(
      'div',
      null,
      h('div', { style: errorBanner }, `结果读取失败：${resultsError}`),
      h('div', { style: muted }, '其他页签仍可正常使用；可点顶部「刷新」重试。'),
      detailNode,
    )
  }

  if (!results) {
    return h('div', { style: { ...muted, padding: '10px 0' } }, options.resultsLoading ? '加载中…' : '暂无结果数据')
  }

  const attention = Array.isArray(results.attention) ? results.attention : []
  const pending = Array.isArray(results.pending) ? results.pending : []
  const resultList = Array.isArray(results.results) ? results.results : []
  const modules = Array.isArray(results.modules) ? results.modules : Array.isArray(project.modules) ? project.modules : []
  const resultCounts = results.counts && typeof results.counts === 'object' ? results.counts : {}
  const blockedCount = countOf(resultCounts, 'blocked')
  const blockerTexts = Array.isArray(project.blockers) ? project.blockers : []
  const hasAttention = attention.length > 0 || pending.length > 0 || blockedCount > 0 || blockerTexts.length > 0

  /* ------------------------------------------------------------ 需要你关注 */
  const attentionItems = []
  for (const issue of attention) {
    attentionItems.push(
      h(
        'div',
        { key: `attention-${issue && issue.code}-${issue && issue.path}-${attentionItems.length}`, style: STYLES.attentionItem },
        h('span', { style: STYLES.codeChip }, (issue && issue.code) || '校验'),
        h('span', null, attentionText(issue)),
        issue && issue.path
          ? h('div', { style: { ...mono, fontSize: 11, opacity: 0.65, marginTop: 2, wordBreak: 'break-all' } }, issue.path)
          : null,
      ),
    )
  }
  for (const item of pending) {
    const question = item && item.question ? String(item.question) : '有一项结果等待确认'
    attentionItems.push(
      h(
        'div',
        { key: `pending-${item && item.path}-${attentionItems.length}`, style: STYLES.attentionItem },
        h('span', { style: { ...STYLES.codeChip, color: 'var(--rdw-st-provisional)', borderColor: 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)' } }, plainStatusLabel('PROVISIONAL')),
        h(
          'span',
          null,
          `待确认：${truncateText(question, 120)}`,
        ),
        h(
          'div',
          { style: { ...muted, marginTop: 2 } },
          `${(item && item.module) || '—'} · ${(item && item.stream) || '—'} · v${(item && item.version) || 1}`,
        ),
      ),
    )
  }
  for (const blocker of blockerTexts) {
    attentionItems.push(
      h(
        'div',
        { key: `blocked-${attentionItems.length}`, style: STYLES.attentionItem },
        h('span', { style: { ...STYLES.codeChip, color: 'var(--rdw-st-blocked)', borderColor: 'color-mix(in srgb,var(--rdw-st-blocked) 32%,transparent)' } }, plainStatusLabel('BLOCKED')),
        h('span', null, truncateText(String(blocker), 160)),
      ),
    )
  }
  if (blockedCount > 0 && blockerTexts.length === 0) {
    attentionItems.push(
      h(
        'div',
        { key: 'blocked-count', style: STYLES.attentionItem },
        h('span', { style: { ...STYLES.codeChip, color: 'var(--rdw-st-blocked)', borderColor: 'color-mix(in srgb,var(--rdw-st-blocked) 32%,transparent)' } }, plainStatusLabel('BLOCKED')),
        h('span', null, `有 ${blockedCount} 个交接卡住，可在「工程」页查看详情`),
      ),
    )
  }

  const attentionBox = h(
    'div',
    { style: STYLES.attentionBox },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 4 } },
      h('strong', { style: { fontSize: 12 } }, '需要你关注'),
      h('span', { style: { ...muted } }, hasAttention ? '系统已自动通过可安全通过的结果，以下需要你判断' : ''),
    ),
    hasAttention
      ? h('div', null, ...attentionItems)
      : h('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--rdw-st-accepted)' } }, '没有需要你处理的事，继续专注研究'),
  )

  /* -------------------------------------------------------------- 操作条 */
  const autoBar = h(
    'div',
    { style: { ...row, justifyContent: 'space-between', margin: '4px 0 10px' } },
    h(
      'span',
      { style: muted },
      autoEnabled
        ? '自动门控：只接受校验全绿、无冲突的结果；失败的会保留说明，不需要你手动操作'
        : '宿主为旧版本，重启 DSH 后可用「自动处理」；当前可手动在「工程」页接受/拒绝。',
    ),
    autoEnabled
      ? pending.length > 0
        ? h(
            'button',
            {
              type: 'button',
              style: primaryButton,
              disabled: Boolean(busy),
              onClick: () => call(options.onAuto),
            },
            busy === 'auto' ? '正在自动处理…' : '让系统处理可自动通过的结果',
          )
        : h('span', { style: { ...chip, color: 'var(--rdw-st-accepted)', borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' } }, '当前没有可自动处理的结果')
      : null,
  )

  /* ----------------------------------------------------------- 结果卡片 */
  const resultsByModule = new Map()
  for (const result of resultList) {
    const moduleId = (result && result.module) || '未分组'
    if (!resultsByModule.has(moduleId)) resultsByModule.set(moduleId, [])
    resultsByModule.get(moduleId).push(result)
  }

  const moduleEntries = modules.map((module) => ({
    id: module && module.id ? String(module.id) : '未分组',
    name: module && module.name ? String(module.name) : '',
  }))
  for (const moduleId of resultsByModule.keys()) {
    if (!moduleEntries.some((entry) => entry.id === moduleId)) {
      const first = resultsByModule.get(moduleId)[0]
      moduleEntries.push({ id: moduleId, name: first && first.moduleName ? String(first.moduleName) : '' })
    }
  }

  const stopThen = (handler, pathValue) => (event) => {
    stopClickEvent(event)
    call(handler, pathValue)
  }

  const renderResultCard = (result) => {
    const pathValue = result && result.path ? String(result.path) : ''
    const keyText = result && result.keyResults ? String(result.keyResults) : ''
    const keyExpanded = Boolean(expandedResults[pathValue])
    const limitsExpanded = Boolean(expandedLimitations[pathValue])
    const files = result && Array.isArray(result.files) ? result.files : []
    return h(
      'div',
      {
        key: pathValue || `${result && result.stream}-${result && result.version}`,
        style: STYLES.resultCard,
        title: pathValue ? `打开交接详情：${pathValue}` : '',
        onClick: () => call(options.onSelect, pathValue),
      },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', alignItems: 'flex-start' } },
        h(
          'span',
          { style: { ...chip, fontSize: 12, fontWeight: 600 } },
          `${(result && result.stream) || '未命名结果'} · v${(result && result.version) || 1}`,
        ),
        h('span', { style: { ...muted, fontSize: 11 } }, (result && (result.decidedAt || result.date)) || ''),
      ),
      h('div', { style: STYLES.resultTitle }, (result && result.title) || '（未提供标题）'),
      result && result.question
        ? h('div', { style: { ...STYLES.resultMeta, opacity: 0.85 } }, truncateText(String(result.question), 160))
        : null,
      keyText
        ? h(
            'div',
            { style: { marginTop: 6 } },
            h('div', { style: { ...STYLES.resultMeta, fontWeight: 600, opacity: 0.9 } }, '关键结果'),
            h('div', { style: STYLES.resultBody }, keyExpanded ? keyText : truncateText(keyText, 200)),
            keyText.length > 200
              ? h(
                  'span',
                  { style: STYLES.smallLink, onClick: stopThen(options.onToggleKeyResults, pathValue) },
                  keyExpanded ? '收起' : `展开（${keyText.length} 字）`,
                )
              : null,
          )
        : null,
      result && result.limitations
        ? h(
            'div',
            { style: { marginTop: 6 } },
            h(
              'span',
              { style: STYLES.smallLink, onClick: stopThen(options.onToggleLimitations, pathValue) },
              limitsExpanded ? '收起限制说明' : '限制与注意事项',
            ),
            limitsExpanded
              ? h(
                  'div',
                  { style: { ...STYLES.resultMeta, opacity: 0.75, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } },
                  String(result.limitations),
                )
              : null,
          )
        : null,
      files.length > 0
        ? h(
            'div',
            { style: { marginTop: 6 } },
            h('div', { style: { ...STYLES.resultMeta, opacity: 0.8 } }, `文件 ${files.length} 个`),
            ...files.slice(0, limitsExpanded ? files.length : 3).map((file) =>
              h('div', { key: String(file), style: { ...mono, fontSize: 11, opacity: 0.65, wordBreak: 'break-all' } }, String(file)),
            ),
            files.length > 3 && !limitsExpanded
              ? h(
                  'span',
                  { style: { ...muted, fontSize: 11, display: 'inline-block', marginTop: 2 } },
                  `…另有 ${files.length - 3} 个文件（点击卡片查看详情）`,
                )
              : null,
          )
        : null,
    )
  }

  const groupNodes = moduleEntries.map((entry) => {
    const groupResults = resultsByModule.get(entry.id) || []
    return h(
      'div',
      { key: `group-${entry.id}`, style: STYLES.resultGroup },
      h(
        'div',
        { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
        h(
          'span',
          { style: { ...sectionTitle, margin: 0 } },
          `${entry.id}${entry.name ? ` · ${entry.name}` : ''}`,
        ),
        h(
          'span',
          {
            style: {
              ...chip,
              fontSize: 12,
              color: groupResults.length > 0 ? 'var(--rdw-st-accepted)' : undefined,
              borderColor: groupResults.length > 0 ? 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' : undefined,
            },
          },
          groupResults.length > 0 ? `已出结果 ${groupResults.length}` : '暂无结果',
        ),
      ),
      groupResults.length === 0
        ? h('div', { style: muted }, '这个模块还没有已接受结果')
        : h('div', { style: STYLES.resultGrid }, ...groupResults.map(renderResultCard)),
    )
  })

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', margin: '2px 0 8px' } },
      h(
        'div',
        null,
        h('div', { style: { fontSize: 14, fontWeight: 700 } }, '研究结果'),
        h(
          'div',
          { style: muted },
          '门控交给系统：这里只展示已经通过校验的结果，以及真正需要你判断的事。',
        ),
      ),
      h(
        'div',
        { style: { ...row, gap: 4 } },
        h('span', { style: { ...chip, color: 'var(--rdw-st-accepted)', borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' } }, `已出结果 ${countOf(resultCounts, 'results')}`),
        h('span', { style: { ...chip, color: 'var(--rdw-st-provisional)', borderColor: 'color-mix(in srgb,var(--rdw-st-provisional) 32%,transparent)' } }, `待确认 ${pending.length}`),
        h('span', { style: { ...chip, color: 'var(--rdw-st-blocked)', borderColor: 'color-mix(in srgb,var(--rdw-st-blocked) 32%,transparent)' } }, `卡住 ${blockedCount}`),
      ),
    ),
    attentionBox,
    autoBar,
    options.resultsLoading ? h('div', { style: { ...muted, marginBottom: 8 } }, '正在刷新结果…') : null,
    groupNodes.length > 0 ? h('div', null, ...groupNodes) : h('div', { style: muted }, '这个项目还没有已接受结果。'),
    detailNode,
  )
}
