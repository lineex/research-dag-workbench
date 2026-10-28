/**
 * 研究项目 DAG 工作台 — verify issues 列表（按错误码分组计数）。
 */
import { STYLES } from '../core/constants.js'

/**
 * @param {object} h React.createElement
 * @param {{issues?: object[]}} props
 */
export function renderIssueList(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const issues = Array.isArray(options.issues) ? options.issues : []

  if (issues.length === 0) {
    return h(
      'div',
      { style: { ...STYLES.row, marginTop: 6 } },
      h(
        'span',
        {
          style: {
            ...STYLES.chip,
            color: 'var(--rdw-st-accepted)',
            borderColor: 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)',
            background: 'var(--rdw-st-accepted-soft)',
            fontWeight: 600,
          },
        },
        '校验通过 · 无问题',
      ),
    )
  }

  const counts = new Map()
  for (const issue of issues) {
    const code = issue && issue.code ? String(issue.code) : '未知错误'
    counts.set(code, (counts.get(code) || 0) + 1)
  }

  return h(
    'div',
    null,
    h(
      'div',
      { style: { ...STYLES.row, margin: '8px 0' } },
      ...Array.from(counts.entries()).map(([code, count]) =>
        h(
          'span',
          {
            key: code,
            style: {
              ...STYLES.chip,
              color: 'var(--rdw-st-rejected)',
              borderColor: 'color-mix(in srgb,var(--rdw-st-rejected) 30%,transparent)',
              background: 'var(--rdw-danger-soft)',
            },
          },
          `${code} × ${count}`,
        ),
      ),
    ),
    h(
      'div',
      { style: STYLES.tableWrap },
      h(
        'table',
        { style: STYLES.table },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            ...['错误码', '路径', '说明'].map((label) => h('th', { key: label, style: STYLES.th }, label)),
          ),
        ),
        h(
          'tbody',
          null,
          ...issues.map((issue, index) =>
            h(
              'tr',
              { key: `${issue && issue.code ? issue.code : 'issue'}-${index}` },
              h('td', { style: STYLES.td }, (issue && issue.code) || '—'),
              h('td', { style: STYLES.td }, h('span', { style: { ...STYLES.mono, fontSize: 12 } }, (issue && issue.path) || '—')),
              h('td', { style: STYLES.td }, (issue && issue.message) || ''),
            ),
          ),
        ),
      ),
    ),
  )
}
