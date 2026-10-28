/**
 * 研究项目 DAG 工作台 — 轻提示（Toast）。
 *
 * 做法参考 projectHub：居中底部胶囊 + 2.6s 自动消失 + role="status"。
 * 关键约束：pointer-events 永久 none（不挡点击）；position 用 absolute 相对
 * .rdw-shell（不越过宿主主内容区，不覆盖宿主侧栏与模式切换器）。
 */
import { RDW_TONE } from '../core/theme.js'

/**
 * @param {object} h React.createElement
 * @param {{message?: string, tone?: string, show?: boolean}} props
 */
export function renderToast(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const message = typeof options.message === 'string' ? options.message : ''
  const show = options.show !== false && Boolean(message)
  const theme = RDW_TONE[options.tone] || null
  return h(
    'div',
    {
      className: 'rdw-toast',
      role: 'status',
      'aria-live': 'polite',
      'data-show': show ? 'true' : 'false',
      style: {
        position: 'absolute',
        left: '50%',
        bottom: 22,
        transform: show ? 'translate(-50%,0)' : 'translate(-50%,8px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'min(480px,calc(100% - 32px))',
        padding: '9px 14px',
        borderRadius: 'var(--rdw-r-pill)',
        border: '1px solid var(--rdw-line-2)',
        background: theme ? theme.bg : 'var(--rdw-panel)',
        color: theme ? theme.color : 'var(--rdw-text)',
        boxShadow: 'var(--rdw-shadow-2)',
        fontSize: 12,
        lineHeight: 1.5,
        opacity: show ? 1 : 0,
        pointerEvents: 'none',
        overflowWrap: 'anywhere',
        transition: 'opacity .18s var(--rdw-ease),transform .18s var(--rdw-ease)',
      },
    },
    message,
  )
}
