/**
 * 研究项目 DAG 工作台 — 鱼骨操作弹窗（分刺 / 回连）。
 *
 * - renderSproutDialog：从主骨任意节点长出一根新鱼刺（dag sprout）
 * - renderGraftDialog：把一根满意的鱼刺验收并回连主骨（dag graft）
 */
import { STYLES, FREE_ID_HINT, isValidNodeId } from '../core/constants.js'

/** 分刺弹窗：选择主骨节点 + 鱼刺 id / 显示名 / 任务意图 / 模式。 */
export function renderSproutDialog(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const { row, muted, button, primaryButton, input, select, textarea, errorBanner, dialog, overlay } = STYLES
  const dialogState = options.dialog
  if (!dialogState) return null
  const busy = Boolean(options.busy)
  const spine = Array.isArray(options.spine) ? options.spine : []
  const moduleId = String(dialogState.module || '')
  const branchId = String(dialogState.id || '')
  const name = String(dialogState.name || '')
  const prompt = String(dialogState.prompt || '')
  const mode = String(dialogState.mode || 'standard')
  // v3.2：从哪根刺分出（空 = 从主脊骨分）
  const parentRib = String(dialogState.from || '')
  // 可选父刺：同一主骨下的鱼刺
  const parentOptions = (Array.isArray(options.parents) ? options.parents : []).filter(
    (row) => row && row.module === moduleId,
  )
  const idOk = branchId.trim().length === 0 || isValidNodeId(branchId.trim())
  const canSubmit = Boolean(moduleId) && branchId.trim().length > 0 && idOk && !busy
  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }
  return h(
    'div',
    { style: overlay, role: 'presentation' },
    h(
      'div',
      { style: { ...dialog, width: 'min(560px, 94vw)' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': '分一根新刺' },
      h('strong', { style: { fontSize: 14 } }, '🌱 分一根新刺'),
      h(
        'div',
        { style: { ...muted, margin: '4px 0 10px', lineHeight: 1.6 } },
        '默认从**主脊骨**分出，自动带上主骨到此为止的完整上下文（决策 / 已接受输入 / 下一步）。',
        h('br'),
        '如果这个子问题是某根已有鱼刺的延续，也可以选择从那根刺分出（子刺会继承父刺的简报与产出摘要）。',
      ),
      dialogState.error ? h('div', { style: { ...errorBanner, marginBottom: 8 } }, dialogState.error) : null,
      // v3.2：从主脊骨分 / 从某根鱼刺分
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '从哪里分出来'),
        h(
          'select',
          {
            value: parentRib,
            style: { ...select, width: '100%' },
            disabled: busy,
            'aria-label': '选择父刺（留空 = 从主脊骨分）',
            onChange: (event) => call(options.onField, 'from', event && event.target ? event.target.value : ''),
          },
          h('option', { value: '' }, '🦴 从主脊骨分（默认，带主骨完整上下文）'),
          ...parentOptions.map((row) =>
            h('option', { key: row.id, value: row.id }, `🧠 从鱼刺 ${row.name || row.id} 分（继承父刺上下文）`),
          ),
        ),
        h(
          'div',
          { style: { ...muted, fontSize: 12, marginTop: 3, lineHeight: 1.6 } },
          parentRib ? '这根子刺的 CONTEXT.md 会包含父刺的简报与产出摘要。' : '这根刺的 CONTEXT.md 会打包主骨的完整快照。',
        ),
      ),
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '挂在主骨哪一段'),
        h(
          'select',
          {
            value: moduleId,
            style: { ...select, width: '100%' },
            disabled: busy,
            onChange: (event) => call(options.onField, 'module', event && event.target ? event.target.value : ''),
          },
          h('option', { value: '' }, '请选择模块…'),
          ...spine.map((node) =>
            h('option', { key: node.id, value: node.id }, `${node.name}（${node.id} · 已有 ${(node.ribs || []).length} 根）`),
          ),
        ),
      ),
      h(
        'div',
        { style: { ...row, gap: 8, marginBottom: 10, flexWrap: 'nowrap' } },
        h(
          'div',
          { style: { flex: '1 1 0', minWidth: 0 } },
          h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '鱼刺 id'),
          h('input', {
            value: branchId,
            placeholder: 'spline-opt',
            style: { ...input, width: '100%', flex: 'initial', minWidth: 0 },
            disabled: busy,
            onChange: (event) => call(options.onField, 'id', event && event.target ? event.target.value : ''),
          }),
          h(
            'div',
            { style: { ...muted, marginTop: 2, color: idOk ? undefined : 'var(--rdw-st-rejected)' } },
            idOk ? FREE_ID_HINT : '只能字母/数字/点/下划线/连字符，且不能以 . 或 - 结尾',
          ),
        ),
        h(
          'div',
          { style: { flex: '1 1 0', minWidth: 0 } },
          h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '显示名（可选）'),
          h('input', {
            value: name,
            placeholder: '乳酸样条拟合',
            style: { ...input, width: '100%', flex: 'initial', minWidth: 0 },
            disabled: busy,
            onChange: (event) => call(options.onField, 'name', event && event.target ? event.target.value : ''),
          }),
        ),
      ),
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '这根刺要解决什么'),
        h('textarea', {
          value: prompt,
          placeholder: '例如：测试 3 节点限制性三次样条能否把入科乳酸 SMD 压到 0.05 以下',
          style: { ...textarea, minHeight: 70 },
          disabled: busy,
          onChange: (event) => call(options.onField, 'prompt', event && event.target ? event.target.value : ''),
        }),
        h('div', { style: { ...muted, marginTop: 2 } }, '会写入该鱼刺的 BRIEF.md 顶部，作为智能体的任务意图。'),
      ),
      h(
        'div',
        { style: { marginBottom: 12 } },
        h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '工作模式'),
        h(
          'div',
          { style: { ...row, gap: 6 } },
          ...[
            ['standard', '标准', '完整 6 节简报，正式产出与文件交付'],
            ['spike', '探索', '轻量 2 节简报，允许空文件清单，适合先摸底'],
          ].map(([value, label, hint]) =>
            h(
              'button',
              {
                key: value,
                type: 'button',
                style: mode === value ? { ...primaryButton, flex: '1 1 0' } : { ...button, flex: '1 1 0', textAlign: 'left' },
                disabled: busy,
                title: hint,
                onClick: () => call(options.onField, 'mode', value),
              },
              `${mode === value ? '● ' : '○ '}${label}`,
            ),
          ),
        ),
        h('div', { style: { ...muted, marginTop: 3 } }, mode === 'spike' ? '探索模式：轻装上阵，先探明边界再决定是否正式立项。' : '标准模式：完整交付物与文件哈希清单。'),
      ),
      h(
        'div',
        { style: { marginBottom: 12 } },
        h(
          'button',
          {
            type: 'button',
            style: {
              ...row,
              gap: 6,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: 0,
              textAlign: 'left',
            },
            disabled: busy,
            title: '勾选后：本次只建分支目录、BRIEF 与主骨上下文档案，不创建交接骨架（handoff）——适合纯探索，有产出后再补',
            onClick: () => call(options.onField, 'noHandoff', !dialogState.noHandoff),
          },
          h('span', null, dialogState.noHandoff ? '☑' : '☐'),
          h('span', { style: { fontWeight: dialogState.noHandoff ? 600 : 400 } }, '暂不建交接（先探索，有产出再 handoff new）'),
        ),
        h(
          'div',
          { style: { ...muted, marginTop: 3 } },
          dialogState.noHandoff
            ? '已选：本次分刺只长刺不建交接；CONTEXT.md 仍会打包主骨完整上下文。'
            : '默认：分刺同时建好交接骨架（HANDOFF-v1），智能体可直接填报提交。',
        ),
      ),
      h(
        'div',
        { style: { ...row, justifyContent: 'flex-end', gap: 6 } },
        h('button', { type: 'button', style: button, disabled: busy, onClick: () => call(options.onCancel) }, '取消'),
        h(
          'button',
          {
            type: 'button',
            style: canSubmit ? primaryButton : { ...button, opacity: 0.5 },
            disabled: !canSubmit,
            onClick: () => {
              if (canSubmit) call(options.onConfirm)
            },
          },
          busy ? '分刺中…' : '长出这根刺',
        ),
      ),
    ),
  )
}

/** 回连弹窗：确认验收一根鱼刺并把成果并入主骨。 */
export function renderGraftDialog(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const { row, muted, button, primaryButton, textarea, errorBanner, dialog, overlay, chip } = STYLES
  const dialogState = options.dialog
  if (!dialogState || !dialogState.rib) return null
  const busy = Boolean(options.busy)
  const rib = dialogState.rib
  const reason = String(dialogState.reason || '')
  const status = String(rib.status || 'EMPTY')
  const call = (handler, ...args) => {
    if (typeof handler === 'function') handler(...args)
  }
  const hasStream = Boolean(rib.stream)
  return h(
    'div',
    { style: overlay, role: 'presentation' },
    h(
      'div',
      { style: { ...dialog, width: 'min(520px, 94vw)' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': '回连主骨' },
      h('strong', { style: { fontSize: 14 } }, '🔗 把这根鱼刺回连主骨'),
      h(
        'div',
        { style: { ...row, gap: 6, margin: '6px 0 10px' } },
        h('span', { style: { fontWeight: 600 } }, rib.name),
        h('span', { style: { ...chip, fontSize: 12 } }, rib.module),
        h('span', { style: { ...chip, fontSize: 12 } }, status === 'PROVISIONAL' ? '待回连' : status),
      ),
      h(
        'div',
        { style: { ...muted, marginBottom: 10, lineHeight: 1.65 } },
        hasStream
          ? '回连会校验正文与文件哈希、把状态提升为已接受、把产物投影到主骨稳定路径，并记录一条决策日志。'
          : '这根鱼刺还没有交接文件，无法回连。先让智能体产出成果并提交，再来验收。',
      ),
      dialogState.error ? h('div', { style: { ...errorBanner, marginBottom: 8 } }, dialogState.error) : null,
      hasStream
        ? h(
            'div',
            { style: { marginBottom: 12 } },
            h('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4 } }, '满意理由（会写进决策日志）'),
            h('textarea', {
              value: reason,
              placeholder: '例如：样条拟合把乳酸 SMD 压到 0.041，模型稳健，主分析采用',
              style: { ...textarea, minHeight: 64 },
              disabled: busy,
              onChange: (event) => call(options.onField, 'reason', event && event.target ? event.target.value : ''),
            }),
          )
        : null,
      h(
        'div',
        { style: { ...row, justifyContent: 'flex-end', gap: 6 } },
        h('button', { type: 'button', style: button, disabled: busy, onClick: () => call(options.onCancel) }, '取消'),
        h(
          'button',
          {
            type: 'button',
            style: hasStream && !busy ? primaryButton : { ...button, opacity: 0.5 },
            disabled: !hasStream || busy,
            onClick: () => {
              if (hasStream && !busy) call(options.onConfirm)
            },
          },
          busy ? '回连中…' : '确认回连主骨',
        ),
      ),
    ),
  )
}
