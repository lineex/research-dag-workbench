/**
 * 研究项目 DAG 工作台 — 工程页（v2.1）。
 *
 * 内容优先后，工程细节退到第二层：子页签 DAG / 交接 / 校验与运行 / 概览，
 * 复用现有 renderDagView / renderHandoffsView / renderControlView / renderOverviewView 与全部旧回调。
 */
import { ENGINEERING_TABS, STYLES } from '../core/constants.js'

/**
 * @param {object} h React.createElement
 * @param {{tab?: string, setTab?: Function, nodes?: object, busy?: string}} props
 */
export function renderEngineeringView(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const tab = typeof options.tab === 'string' && options.tab ? options.tab : 'dag'
  const nodes = options.nodes && typeof options.nodes === 'object' ? options.nodes : {}
  const { row, tab: tabStyle, tabActive, muted } = STYLES
  const call = (handler, value) => {
    if (typeof handler === 'function') handler(value)
  }
  const currentNode = nodes[tab] || nodes.dag || null

  return h(
    'div',
    null,
    h(
      'div',
      {
        style: {
          ...row,
          gap: 6,
          borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
          paddingBottom: 8,
          marginBottom: 10,
        },
        role: 'tablist',
        'aria-label': '工程子页签',
      },
      ...ENGINEERING_TABS.map(([id, label]) =>
        h(
          'button',
          {
            key: id,
            type: 'button',
            role: 'tab',
            'aria-selected': tab === id ? 'true' : 'false',
            style: tab === id ? { ...tabStyle, ...tabActive } : tabStyle,
            onClick: () => call(options.setTab, id),
          },
          label,
        ),
      ),
      h('span', { style: { ...muted, marginLeft: 'auto' } }, '工程细节：DAG / 交接 / 校验 / 状态设置'),
    ),
    currentNode,
  )
}
