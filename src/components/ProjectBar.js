/**
 * 研究项目 DAG 工作台 — 项目路径输入与配置/创建操作条。
 *
 * v1.1：新增「新建项目」入口（init 动作，成功后保存配置并加载新项目）。
 * v2.1：新增「记想法」入口（POST /bridge idea；内容页也可从模块卡进入）。
 * v3.4：按钮统一 30px 高度规格；「新建项目」为主按钮靠右；路径输入成为唯一的主控件。
 */
import { STYLES } from '../core/constants.js'

/**
 * @param {object} h React.createElement
 * @param {{project?: string, setProject?: Function, config?: object, health?: object,
 *          busy?: string, onLoad?: Function, onSave?: Function, onExample?: Function,
 *          onRefresh?: Function, onCreateProject?: Function, createEnabled?: boolean,
 *          onIdea?: Function}} props
 */
export function renderProjectBar(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const { row, button, primaryButton, input, muted } = STYLES
  const busy = options.busy || ''
  const health = options.health && typeof options.health === 'object' ? options.health : null
  const config = options.config && typeof options.config === 'object' ? options.config : null
  const project = typeof options.project === 'string' ? options.project : ''
  const example = health && typeof health.example === 'string' ? health.example : ''
  const configPath = health && typeof health.configPath === 'string' ? health.configPath : ''

  const call = (handler, value) => {
    if (typeof handler === 'function') handler(value)
  }

  const configHint = config && config.projectRoot
    ? `配置文件项目：${config.projectRoot}`
    : configPath
      ? `配置文件：${configPath}`
      : '尚未保存配置'

  /** 次级按钮：描边按钮，30px 高。 */
  const secondaryButton = (key, label, handler, options2) =>
    h(
      'button',
      {
        key,
        type: 'button',
        style: button,
        disabled: Boolean(busy),
        onClick: () => call(handler),
        ...(options2 || {}),
      },
      label,
    )

  const buttons = [
    secondaryButton('load', '加载', () => call(options.onLoad, project)),
    secondaryButton('save', '保存', () => call(options.onSave, project), {
      disabled: Boolean(busy) || !project.trim(),
    }),
    example
      ? secondaryButton('example', '加载示例项目', () => call(options.onExample, example), { title: example })
      : null,
    secondaryButton('refresh', '刷新', () => call(options.onRefresh)),
    typeof options.onIdea === 'function'
      ? secondaryButton('idea', '记想法', () => call(options.onIdea, { module: '', stream: '', version: '' }), {
          disabled: Boolean(busy) || !project.trim(),
          title: '记一条研究想法，同步到项目网络',
        })
      : null,
    options.createEnabled === false
      ? null
      : h(
          'button',
          {
            key: 'create-project',
            type: 'button',
            style: { ...primaryButton, marginLeft: 'auto' },
            disabled: Boolean(busy),
            onClick: () => call(options.onCreateProject),
          },
          '新建项目',
        ),
  ].filter(Boolean)

  return h(
    'div',
    { className: 'rdw-toolbar-row', 'data-dsh-no-drag': '' },
    h(
      'div',
      { style: { position: 'relative', flex: '1 1 280px', minWidth: 0, display: 'flex' } },
      h('input', {
        value: project,
        placeholder: 'DAG 项目绝对路径，例如 D:/…/early-phosphate',
        'aria-label': '项目根路径',
        onChange: (event) => {
          const value = event && event.target ? event.target.value : ''
          call(options.setProject, value)
        },
        style: {
          ...input,
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: 12,
          paddingLeft: 28,
        },
      }),
      h(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--rdw-text-4)',
            fontSize: 12,
            pointerEvents: 'none',
          },
        },
        '📁',
      ),
    ),
    ...buttons,
    h(
      'span',
      {
        style: {
          ...muted,
          flex: '0 1 auto',
          minWidth: 0,
          overflowWrap: 'anywhere',
          fontSize: 12.5,
          color: 'var(--rdw-text-4)',
        },
      },
      configHint,
    ),
  )
}
