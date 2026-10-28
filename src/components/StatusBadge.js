/**
 * 研究项目 DAG 工作台 — 交接状态徽标。
 *
 * v1.2：支持 plain 模式（结果/交接页用平实词：进行中/待确认/已出结果/已放弃/旧版本/卡住），
 * 同时用 title 保留原始状态码，工程页仍显示状态机细节。
 */
import { STYLES, plainStatusLabel, statusInfo } from '../core/constants.js'

/**
 * 渲染一个状态徽标。
 * @param {object} h React.createElement
 * @param {{status?: string, label?: string, title?: string, plain?: boolean}} props
 */
export function renderStatusBadge(h, props) {
  const options = props && typeof props === 'object' ? props : {}
  const info = statusInfo(options.status)
  const canonical = String(options.status === null || options.status === undefined ? '' : options.status).toUpperCase()
  const style = {
    ...STYLES.badgeBase,
    color: info.color,
    background: info.bg,
    borderColor: info.border,
  }
  const extra = {}
  const title = options.title || (options.plain && canonical ? canonical : '')
  if (title) extra.title = title
  const text =
    options.label ||
    (options.plain ? plainStatusLabel(options.status) : info.label) ||
    canonical ||
    '未知'
  return h('span', { style, ...extra }, text)
}
