/**
 * 研究项目 DAG 工作台 — 校验与运行视图。
 *
 * 项目路径与配置保存、全项目校验（checked 计数 + issues 分组）、重写报告、
 * `state set` 表单（phase / next / blocker）与运行记录控制台。
 */
import { ACTION_LABELS, PHASES, STYLES } from '../core/constants.js'
import { renderIssueList } from '../components/IssueList.js'
import { renderRunConsole } from '../components/RunConsole.js'

/**
 * @param {object} h React.createElement
 * @param {{project?: object, health?: object, config?: object, verify?: object|null,
 *          cliError?: string, busy?: string, runs?: object[], run?: object|null,
 *          selectedRunId?: string, onSelectRun?: Function, onVerify?: Function,
 *          onReport?: Function, onStateSet?: Function, stateForm?: object,
 *          setStateForm?: Function, projectInput?: string, setProject?: Function,
 *          onSaveConfig?: Function}} props
 */
export function renderControlView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const { card, row, chip, muted, button, primaryButton, input, select, sectionTitle, errorBanner } = STYLES
  const project = options.project && typeof options.project === 'object' ? options.project : null
  const health = options.health && typeof options.health === 'object' ? options.health : null
  const verify = options.verify && typeof options.verify === 'object' ? options.verify : null
  const cliError = typeof options.cliError === 'string' ? options.cliError : ''
  const busy = options.busy || ''
  const stateForm = options.stateForm && typeof options.stateForm === 'object' ? options.stateForm : {}
  const config = options.config && typeof options.config === 'object' ? options.config : null
  const projectInput = typeof options.projectInput === 'string' ? options.projectInput : ''
  const call = (handler, value) => {
    if (typeof handler === 'function') handler(value)
  }
  const actionLabel = (action) => ACTION_LABELS[action] || action || ''

  const checked = verify && verify.checked && typeof verify.checked === 'object' ? verify.checked : null
  const verified = Boolean(verify)
  const passed = Boolean(verify && verify.ok)
  const issues = verify && Array.isArray(verify.issues) ? verify.issues : []
  const verifyStatusChip = verified
    ? h(
        'span',
        {
          style: {
            ...chip,
            color: passed ? 'var(--rdw-st-accepted)' : 'var(--rdw-st-rejected)',
            borderColor: passed ? 'color-mix(in srgb,var(--rdw-st-accepted) 32%,transparent)' : 'color-mix(in srgb,var(--rdw-st-rejected) 32%,transparent)',
            background: passed ? 'var(--rdw-st-accepted-soft)' : 'var(--rdw-danger-soft)',
            fontWeight: 600,
          },
        },
        passed ? '校验结果：通过' : `校验结果：存在问题（${issues.length} 项）`,
      )
    : h('span', { style: { ...chip, color: 'var(--rdw-st-draft)' } }, '校验结果：尚未获取')

  const checkedChips = checked
    ? [
        ['交接', checked.handoffs],
        ['模块', checked.modules],
        ['分支', checked.branches],
        ['文件', checked.files],
      ].map(([label, value]) =>
        h('span', { key: label, style: chip }, `${label} ${typeof value === 'number' ? value : 0}`),
      )
    : []

  const canWriteState = Boolean(project && project.exists !== false) && !busy
  const hasStateInput =
    Boolean(String(stateForm.phase || '').trim()) ||
    Boolean(String(stateForm.next || '').trim()) ||
    Boolean(String(stateForm.blocker || '').trim())

  const stateSetCard = h(
    'div',
    { style: card },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
      h('h3', { style: { ...sectionTitle, margin: 0 } }, '项目状态设置（state set）'),
      h('span', { style: muted }, '下一步 / 阻塞为追加语义，与 CLI 一致'),
    ),
    h(
      'div',
      { style: { ...row, marginBottom: 6 } },
      h(
        'label',
        { style: { ...row, gap: 4, ...muted } },
        '阶段',
        h(
          'select',
          {
            style: select,
            value: stateForm.phase || '',
            disabled: Boolean(busy),
            onChange: (event) => {
              const value = event && event.target ? event.target.value : ''
              call(options.setStateForm, { ...stateForm, phase: value })
            },
          },
          h('option', { value: '' }, '（保持不变）'),
          ...PHASES.map(([value, label]) => h('option', { key: value, value }, `${value} · ${label}`)),
        ),
      ),
      h(
        'label',
        { style: { ...row, gap: 4, ...muted, flex: '1 1 220px' } },
        '下一步',
        h('input', {
          value: stateForm.next || '',
          placeholder: '追加一条 next_step',
          style: { ...input, flex: '1 1 180px', minWidth: 140 },
          disabled: Boolean(busy),
          onChange: (event) => {
            call(options.setStateForm, { ...stateForm, next: event && event.target ? event.target.value : '' })
          },
        }),
      ),
    ),
    h('input', {
      value: stateForm.blocker || '',
      placeholder: '追加一条阻塞（可选）',
      style: { ...input, width: '100%', boxSizing: 'border-box', flex: '1 1 auto' },
      disabled: Boolean(busy),
      onChange: (event) => {
        call(options.setStateForm, { ...stateForm, blocker: event && event.target ? event.target.value : '' })
      },
    }),
    h(
      'div',
      { style: { ...row, justifyContent: 'flex-end', marginTop: 8 } },
      h(
        'button',
        {
          type: 'button',
          style: canWriteState && hasStateInput ? primaryButton : { ...button, opacity: 0.5 },
          disabled: !canWriteState || !hasStateInput,
          onClick: () => call(options.onStateSet),
        },
        busy === 'state-set' ? '写入中…' : '写入状态',
      ),
    ),
  )

  const configCard = h(
    'div',
    { style: card },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
      h('h3', { style: { ...sectionTitle, margin: 0 } }, '项目路径与配置保存'),
      h(
        'span',
        { style: muted },
        health && health.configPath ? `配置文件：${health.configPath}` : '配置文件路径未知',
      ),
    ),
    h(
      'div',
      { style: row },
      h('input', {
        value: projectInput,
        placeholder: 'DAG 项目绝对路径',
        'aria-label': '配置项目路径',
        style: { ...input, flex: '1 1 280px' },
        disabled: Boolean(busy),
        onChange: (event) => {
          call(options.setProject, event && event.target ? event.target.value : '')
        },
      }),
      h(
        'button',
        {
          type: 'button',
          style: button,
          disabled: Boolean(busy) || !projectInput.trim(),
          onClick: () => call(options.onSaveConfig, projectInput),
        },
        '保存配置',
      ),
      config && config.projectRoot
        ? h('span', { style: muted }, `已保存：${config.projectRoot}`)
        : h('span', { style: muted }, '尚未保存配置'),
    ),
  )

  const verifyCard = h(
    'div',
    { style: card },
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', marginBottom: 6 } },
      h('h3', { style: { ...sectionTitle, margin: 0 } }, '全项目校验与报告'),
      verifyStatusChip,
    ),
    h(
      'div',
      { style: { ...row, marginBottom: 4 } },
      h(
        'button',
        {
          type: 'button',
          style: primaryButton,
          disabled: Boolean(busy),
          onClick: () => call(options.onVerify),
        },
        busy === 'verify' ? '校验中…' : '运行校验',
      ),
      h(
        'button',
        {
          type: 'button',
          style: button,
          disabled: Boolean(busy),
          onClick: () => call(options.onReport),
        },
        busy === 'report' ? '生成中…' : '重写报告',
      ),
      checkedChips.length > 0 ? h('span', { style: muted }, `检查范围：` ) : null,
      ...checkedChips,
    ),
    cliError ? h('div', { style: { ...errorBanner, marginTop: 6 } }, `CLI 错误：${cliError}`) : null,
    verified ? renderIssueList(h, { issues }) : h('div', { style: { ...muted, marginTop: 6 } }, '尚未运行校验。'),
  )

  const detailHint = project && project.root
    ? h(
        'div',
        { style: { ...muted, marginBottom: 8 } },
        `当前项目：${project.id || '—'} · ${project.title || ''} · ${project.root}`,
      )
    : null

  return h(
    'div',
    null,
    detailHint,
    verifyCard,
    stateSetCard,
    configCard,
    h(
      'div',
      { style: { ...row, justifyContent: 'space-between', margin: '2px 0 6px' } },
      h('span', { style: { ...sectionTitle, margin: 0 } }, `运行记录${actionLabel(busy) && busy ? `（执行中：${actionLabel(busy)}）` : ''}`),
      h('span', { style: muted }, '点选一条记录展开 stdout / stderr'),
    ),
    renderRunConsole(h, {
      runs: options.runs,
      run: options.run,
      busy: options.busy,
      selectedId: options.selectedRunId,
      onSelect: options.onSelectRun,
    }),
  )
}
