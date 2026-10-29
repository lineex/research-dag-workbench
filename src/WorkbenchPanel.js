/**
 * 研究项目 DAG 工作台 — 侧栏面板根组件（v2.1 内容优先）。
 *
 * 数据流：
 *   fetchHealth → fetchState（自动加载配置项目）→（/results、/content、/runs）
 *   顶层页签：内容（默认）/ 网络 / 工程。
 *   旧宿主（/health.actions 无 content）：内容页黄色提示并回退旧 renderResultsView；
 *   网络页提示需重启；工程页照常（新客户端不得在旧宿主上崩溃）。
 *
 * 写操作：
 *   - /run 白名单动作：postAction → settleRun → 刷新 state/results/content/runs；
 *   - 内容/网络动作（publish/idea/review/pull）：postBridge → settleRun → 刷新 content/state/results/runs。
 *
 * 组件层是普通渲染函数；只有本文件与 index.js 使用 React.*。
 */
import {
  ACTION_LABELS,
  BRIDGE_LABELS,
  CONTENT_UPGRADE_NOTICE,
  CREATE_FIELD_SPECS,
  HOST_UPGRADE_NOTICE,
  NETWORK_UPGRADE_NOTICE,
  SHELL_CSS,
  STYLES,
  WELCOME_COPY,
  handoffName,
  hostSupportsAction,
  hostSupportsCreate,
  isAbsoluteProjectPath,
  isValidNodeId,
  isValidSlug,
  isValidStream,
} from './core/constants.js'
import { RDW_SKELETON_CSS, RDW_THEME_CSS } from './core/theme.js'
import {
  fetchBranchWork,
  fetchContent,
  fetchFile,
  fetchFishbone,
  fetchHandoff,
  fetchHealth,
  fetchLeaderLog,
  fetchResults,
  fetchRuns,
  fetchState,
  postAction,
  postBranchDirective,
  postBridge,
  postMountContext,
  postOpenExternal,
  postOpenSidebar,
  postRibOp,
  saveConfig,
  settleRun,
} from './core/api.js'
import { renderHeader } from './components/Header.js'
import { renderCommandBar } from './components/CommandBar.js'
import { renderContextMenu, renderHoverCard, renderInlineSprout, mi, sep, sub } from './components/ContextMenu.js'
import { renderToast } from './components/Toast.js'
import { renderProjectBar } from './components/ProjectBar.js'
import { renderCreateDialog, renderReasonDialog } from './components/ReasonDialog.js'
import { renderSproutDialog, renderGraftDialog } from './components/FishboneDialogs.js'
import { renderResultsView } from './views/ResultsView.js'
import { renderContentView, renderIdeaDialog, renderFileModal, renderBranchWorkModal } from './views/ContentView.js'
import { renderFishboneView } from './views/FishboneView.js'
import { renderLeaderLogView } from './views/LeaderLogView.js'
import { renderBranchSessionView } from './views/BranchSessionView.js'
import { renderNetworkView } from './views/NetworkView.js'
import { renderOverviewView } from './views/OverviewView.js'
import { renderDagView } from './views/DagView.js'
import { renderHandoffsView } from './views/HandoffsView.js'
import { renderControlView } from './views/ControlView.js'
import { renderEngineeringView } from './views/EngineeringView.js'
import { renderProjectsHubView } from './views/ProjectsHubView.js'

/** 从 /state 响应里取出项目快照；缺字段时用 statusRaw 兜底。 */
function extractProjectState(server) {
  if (!server || typeof server !== 'object') return null
  const base = server.project && typeof server.project === 'object' ? server.project : null
  const raw = server.statusRaw && typeof server.statusRaw === 'object' ? server.statusRaw : null
  if (!base && !raw) return null

  const project = Object.assign({}, raw || {}, base || {})
  const rawProject = raw && raw.project && typeof raw.project === 'object' ? raw.project : null

  if (!Array.isArray(project.pending_decisions)) {
    project.pending_decisions = raw && Array.isArray(raw.pending_decisions) ? raw.pending_decisions : []
  }
  if (!Array.isArray(project.accepted)) {
    project.accepted = raw && Array.isArray(raw.accepted) ? raw.accepted : []
  }
  if (!Array.isArray(project.modules)) {
    project.modules = raw && Array.isArray(raw.modules) ? raw.modules : []
  }
  if (!Array.isArray(project.handoffs)) project.handoffs = []
  if (!Array.isArray(project.branches)) {
    project.branches = raw && Array.isArray(raw.branches) ? raw.branches : []
  }
  if (!Array.isArray(project.next_steps)) {
    project.next_steps = raw && Array.isArray(raw.next_steps) ? raw.next_steps : []
  }
  if (!Array.isArray(project.blockers)) {
    project.blockers = raw && Array.isArray(raw.blockers) ? raw.blockers : []
  }
  if (!project.id && rawProject && rawProject.id) project.id = rawProject.id
  if (!project.title && rawProject && rawProject.title) project.title = rawProject.title
  if (!project.phase && raw && raw.phase) project.phase = raw.phase
  if (!project.counts || typeof project.counts !== 'object') project.counts = {}
  return project
}

/** 错误对象 → 可展示文本。 */
function networkMessage(problem) {
  if (problem && problem.message) return String(problem.message)
  return String(problem)
}

/** 宿主 {ok:false, code, message} → 可展示文本。 */
function hostMessage(payload) {
  if (!payload || typeof payload !== 'object') return ''
  const parts = []
  if (payload.code) parts.push(String(payload.code))
  if (payload.message) parts.push(String(payload.message))
  if (payload.error) parts.push(String(payload.error))
  return parts.join('：')
}

/** 从 /state 响应里推项目根路径。 */
function rootFromPayload(payload, fallback) {
  const info = extractProjectState(payload)
  if (info && info.root) return info.root
  return typeof fallback === 'string' ? fallback.trim() : ''
}

/** 创建面板组件（在 factory 作用域内可用 React）。 */
export function createWorkbenchPanel(React) {
  const h = React.createElement

  /**
   * 量业务容器的真实宽度（规范 4.1：按业务区自身宽度重排，而不是只看窗口）。
   * 宿主未挂载（单元测试的渲染桩）时 ref 为空，宽度保持 0，调用方按「宽」处理，
   * 这样测试断言的是完整宽屏结构，与真实首屏一致。
   */
  function useContainerWidth() {
    const ref = React.useRef(null)
    const [width, setWidth] = React.useState(0)
    React.useEffect(() => {
      const node = ref.current
      if (!node || typeof node.clientWidth !== 'number') return undefined
      const apply = () => setWidth(node.clientWidth || 0)
      apply()
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(apply)
        observer.observe(node)
        return () => observer.disconnect()
      }
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', apply)
        return () => window.removeEventListener('resize', apply)
      }
      return undefined
    }, [])
    return [ref, width]
  }

  /** 基于模块和现有鱼刺，自动计算下一个合规、递增的分支 ID（如 M40 下已有 B40-01~03 则生成 B40-04）。 */
  function generateNextBranchId(moduleId, parentId, existingBranches) {
    const list = Array.isArray(existingBranches) ? existingBranches : []
    const mMatch = String(moduleId || '').match(/^[A-Za-z]?(\d+)/)
    if (mMatch) {
      const numPart = mMatch[1]
      const prefix = `B${numPart}-`
      let maxSeq = 0
      for (const b of list) {
        if (b && typeof b.id === 'string' && b.id.startsWith(prefix)) {
          const seqMatch = b.id.slice(prefix.length).match(/^(\d+)/)
          if (seqMatch) {
            const val = parseInt(seqMatch[1], 10)
            if (val > maxSeq) maxSeq = val
          }
        }
      }
      const nextSeq = String(maxSeq + 1).padStart(2, '0')
      return `${prefix}${nextSeq}`
    }
    const modClean = String(moduleId || 'br').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const modBranches = list.filter((b) => b && b.module === moduleId)
    return `${modClean}-s${modBranches.length + 1}`
  }

  return function WorkbenchPanel(props) {
    const injected = props && typeof props === 'object' ? props : {}
    const initialServer = injected.server && typeof injected.server === 'object' ? injected.server : null
    const initialProject = extractProjectState(initialServer)
    // 宿主 desktopWorkbenches 服务（整页框架下由宿主注入）；旧槽位路径没有它。
    const hostService = injected.service && typeof injected.service === 'object' ? injected.service : null
    // 宿主传入的原生会话节点：整页框架下必须由业务页自己安置（规范 4.2）。
    const conversationNode = injected.conversation || null

    const [projectInput, setProjectInput] = React.useState(
      typeof injected.project === 'string' && injected.project ? injected.project : initialProject && initialProject.root ? initialProject.root : '',
    )
    const [server, setServer] = React.useState(initialServer)
    const [health, setHealth] = React.useState(null)
    const [config, setConfig] = React.useState(
      injected.config && typeof injected.config === 'object'
        ? injected.config
        : initialServer && initialServer.config && typeof initialServer.config === 'object'
          ? initialServer.config
          : null,
    )
    const [view, setView] = React.useState('fishbone')
    const [engTab, setEngTab] = React.useState('dag')
    const [busy, setBusy] = React.useState('')
    const [error, setError] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [run, setRun] = React.useState(null)
    const [runs, setRuns] = React.useState([])
    const [content, setContent] = React.useState(null)
    const [contentLoading, setContentLoading] = React.useState(false)
    const [contentError, setContentError] = React.useState('')
    const [results, setResults] = React.useState(null)
    const [resultsLoading, setResultsLoading] = React.useState(false)
    const [resultsError, setResultsError] = React.useState('')
    const [expandedResults, setExpandedResults] = React.useState({})
    const [expandedLimitations, setExpandedLimitations] = React.useState({})
    const [dialog, setDialog] = React.useState(null)
    const [reason, setReason] = React.useState('')
    const [createDialog, setCreateDialog] = React.useState(null)
    const [detail, setDetail] = React.useState(null)
    const [contentDetail, setContentDetail] = React.useState(null)
    const [fileModal, setFileModal] = React.useState(null)
    const [branchWorkModal, setBranchWorkModal] = React.useState(null)
    const [fishbone, setFishbone] = React.useState(null)
    const [fishboneLoading, setFishboneLoading] = React.useState(false)
    const [fishboneError, setFishboneError] = React.useState('')
    const [leaderLog, setLeaderLog] = React.useState(null)
    const [leaderLogLoading, setLeaderLogLoading] = React.useState(false)
    const [leaderLogError, setLeaderLogError] = React.useState('')
    const [leaderFilter, setLeaderFilter] = React.useState('all')
    const [selectedModule, setSelectedModule] = React.useState(null)
    const [selectedRib, setSelectedRib] = React.useState(null)
    const [sproutDialog, setSproutDialog] = React.useState(null)
    const [sessionView, setSessionView] = React.useState(null)
    const [sessionDraft, setSessionDraft] = React.useState('')
    const [sessionSending, setSessionSending] = React.useState(false)
    const [composerModel, setComposerModel] = React.useState('Gemini 3.8 Flash High')
    const [composerPermission, setComposerPermission] = React.useState('完全权限')
    const [activeDropdown, setActiveDropdown] = React.useState(null)
    const [openSections, setOpenSections] = React.useState({ brief: true })
    const [sidebarHint, setSidebarHint] = React.useState(null)
    const [ribMessage, setRibMessage] = React.useState(null)
    const [graftDialog, setGraftDialog] = React.useState(null)
    const [ideaDialog, setIdeaDialog] = React.useState(null)
    const [statusFilter, setStatusFilter] = React.useState('all')
    const [moduleFilter, setModuleFilter] = React.useState('all')
    const [stateForm, setStateForm] = React.useState({ phase: '', next: '', blocker: '' })
    const [selectedRunId, setSelectedRunId] = React.useState('')
    const [expandedProjects, setExpandedProjects] = React.useState({})
    const [toast, setToast] = React.useState('')
    // 对话区默认收起：业务优先，会话由用户按需打开（规范 4.2/4.3）。
    const [chatOpen, setChatOpen] = React.useState(false)
    const [projectsRegistry, setProjectsRegistry] = React.useState(() => {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('rdw_projects_registry')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((p) => {
                if ((!p.completion || p.completion === 0) && Number(p.ribsCount) > 0 && Number(p.acceptedCount) > 0) {
                  return Object.assign({}, p, { completion: Math.round((Number(p.acceptedCount) / Number(p.ribsCount)) * 100) })
                }
                return p
              })
            }
          }
        }
      } catch {}
      return []
    })
    const [hubSearch, setHubSearch] = React.useState('')
    const [hubPhaseFilter, setHubPhaseFilter] = React.useState('all')
    const [hubCategoryFilter, setHubCategoryFilter] = React.useState('all')
    const [importDialog, setImportDialog] = React.useState(null)
    const [fishboneDisplayMode, setFishboneDisplayMode] = React.useState('canvas')
    /* v4 交互层状态：全景抽屉 / 命令面板 / 侧滑管理面板（低频操作按需展开）。 */
    const [drawerOpen, setDrawerOpen] = React.useState(false)
    const [paletteOpen, setPaletteOpen] = React.useState(false)
    const [paletteQuery, setPaletteQuery] = React.useState('')
    const [slideTab, setSlideTab] = React.useState(null)
    const [recycleOpen, setRecycleOpen] = React.useState(false)
    const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
    const [msgSprout, setMsgSprout] = React.useState(null)   // { excerpt, x, y }
    const [middleTab, setMiddleTab] = React.useState('chat') // 'chat' | 'trace'
    const [middleMode, setMiddleMode] = React.useState('auto') // 'auto' | 'native'
    const [ribWorkData, setRibWorkData] = React.useState(null) // 当前激活鱼刺的工作区数据（指令/轨迹/产物）

    /* v3.5 交互系统 2.0：右键菜单 / 速览卡 / 内联分叉 / 回收站 / 撤销栈 */
    const [ctxMenu, setCtxMenu] = React.useState(null)          // { x, y, target }
    const [hoverCard, setHoverCard] = React.useState(null)      // { x, y, rib, module }
    const [inlineSprout, setInlineSprout] = React.useState(null) // { x, y, moduleId, moduleName, fromRib, name, error }
    const [undoStack, setUndoStack] = React.useState([])        // [{ label, inverse: {op,...} }]
    const [redoStack, setRedoStack] = React.useState([])
    const hoverTimerRef = React.useRef(null)
    const [shellRef, shellWidth] = useContainerWidth()
    const alive = React.useRef(true)
    const sessionRequestId = React.useRef(0)

    const project = extractProjectState(server)
    const rootPath = (project && project.root) || String(projectInput || '').trim()
    const createEnabled = hostSupportsCreate(health)
    const showHostUpgradeNotice = Boolean(health && Array.isArray(health.actions) && !createEnabled)
    const resultsAvailable = hostSupportsAction(health, 'results')
    const autoEnabled = hostSupportsAction(health, 'auto')
    const contentAvailable = hostSupportsAction(health, 'content')
    const fishboneAvailable = hostSupportsAction(health, 'fishbone') || fishbone !== null

    const busyLabel = busy.startsWith('bridge:')
      ? BRIDGE_LABELS[busy.slice('bridge:'.length)] || busy
      : busy === 'content'
        ? '刷新内容'
        : ACTION_LABELS[busy] || busy

    const applyState = React.useCallback((payload) => {
      if (!payload || typeof payload !== 'object' || payload.ok === false) return
      const info = extractProjectState(payload)
      setServer(payload)
      setConfig(payload.config && typeof payload.config === 'object' ? payload.config : null)
      if (info) {
        if (info.root) setProjectInput(info.root)
        if (info.phase) {
          setStateForm((previous) => {
            const current = previous && typeof previous === 'object' ? previous : {}
            return current.phase ? current : Object.assign({}, current, { phase: info.phase })
          })
        }
      }
    }, [])

    const refresh = React.useCallback(
      async (target) => {
        const requested = typeof target === 'string' ? target.trim() : ''
        if (alive.current) {
          setLoading(true)
          setError('')
        }
        try {
          const payload = await fetchState(requested)
          if (!alive.current) return payload
          if (!payload || payload.ok === false) {
            setError(hostMessage(payload) || '读取项目状态失败')
            return payload
          }
          applyState(payload)
          return payload
        } catch (problem) {
          if (alive.current) setError(networkMessage(problem))
          return null
        } finally {
          if (alive.current) setLoading(false)
        }
      },
      [applyState],
    )

    const loadRuns = React.useCallback(async () => {
      try {
        const payload = await fetchRuns()
        if (!alive.current) return
        if (payload && payload.ok && Array.isArray(payload.runs)) setRuns(payload.runs)
      } catch (problem) {
        /* 运行记录属于附属信息，读取失败不打断主流程 */
      }
    }, [])

    const loadResults = React.useCallback(async (target) => {
      const requested = typeof target === 'string' ? target.trim() : ''
      if (alive.current) setResultsLoading(true)
      try {
        const payload = await fetchResults(requested)
        if (!alive.current) return payload
        if (payload && payload.ok !== false) {
          setResults(payload)
          setResultsError('')
        } else {
          setResultsError(hostMessage(payload) || '读取结果失败')
        }
        return payload
      } catch (problem) {
        if (alive.current) setResultsError(networkMessage(problem))
        return null
      } finally {
        if (alive.current) setResultsLoading(false)
      }
    }, [])

    const loadContent = React.useCallback(async (target) => {
      const requested = typeof target === 'string' ? target.trim() : ''
      if (alive.current) setContentLoading(true)
      try {
        const payload = await fetchContent(requested)
        if (!alive.current) return payload
        if (payload && payload.ok !== false) {
          setContent(payload)
          setContentError('')
        } else {
          setContentError(hostMessage(payload) || '读取内容失败')
        }
        return payload
      } catch (problem) {
        if (alive.current) setContentError(networkMessage(problem))
        return null
      } finally {
        if (alive.current) setContentLoading(false)
      }
    }, [])

    const loadFishbone = React.useCallback(async (target) => {
      const requested = typeof target === 'string' ? target.trim() : ''
      if (alive.current) setFishboneLoading(true)
      try {
        const payload = await fetchFishbone(requested)
        if (!alive.current) return payload
        if (payload && payload.ok !== false) {
          setFishbone(payload)
          setFishboneError('')
        } else {
          setFishboneError(hostMessage(payload) || '读取鱼骨主线失败')
        }
        return payload
      } catch (problem) {
        if (alive.current) setFishboneError(networkMessage(problem))
        return null
      } finally {
        if (alive.current) setFishboneLoading(false)
      }
    }, [])

    const loadLeaderLog = React.useCallback(async (target) => {
      const requested = typeof target === 'string' ? target.trim() : ''
      if (alive.current) setLeaderLogLoading(true)
      try {
        const payload = await fetchLeaderLog(requested)
        if (!alive.current) return payload
        if (payload && payload.ok !== false) {
          setLeaderLog(payload)
          setLeaderLogError('')
        } else {
          setLeaderLogError(hostMessage(payload) || '读取主智能体记录失败')
        }
        return payload
      } catch (problem) {
        if (alive.current) setLeaderLogError(networkMessage(problem))
        return null
      } finally {
        if (alive.current) setLeaderLogLoading(false)
      }
    }, [])

    /** 刷新 /state，并按宿主能力顺带刷新 /results、/content、/fishbone、/leader-log。 */
    const refreshStateAndData = async (target) => {
      const payload = await refresh(target)
      const root = rootFromPayload(payload, target) || rootPath
      if (resultsAvailable) await loadResults(root)
      if (contentAvailable) await loadContent(root)
      await loadFishbone(root)
      await loadLeaderLog(root)
      return payload
    }

    React.useEffect(() => {
      alive.current = true
      return () => {
        alive.current = false
      }
    }, [])

    React.useEffect(() => {
      if (!toast) return undefined
      const timer = setTimeout(() => {
        if (alive.current) setToast('')
      }, 4000)
      return () => clearTimeout(timer)
    }, [toast])

    React.useEffect(() => {
      let disposed = false
      const boot = async () => {
        let meta = null
        try {
          meta = await fetchHealth()
          if (disposed || !alive.current) return
          if (meta && meta.ok !== false) setHealth(meta)
          else if (meta && (meta.message || meta.error)) setError(hostMessage(meta) || networkMessage(meta.message || meta.error))
        } catch (problem) {
          if (!disposed && alive.current) setError(networkMessage(problem))
        }
        if (disposed || !alive.current) return
        const statePayload = await refresh(injected.project || '')
        if (disposed || !alive.current) return
        await loadRuns()
        const actions = meta && Array.isArray(meta.actions) ? meta.actions : []
        const root = rootFromPayload(statePayload, injected.project || '')
        if (actions.includes('results')) await loadResults(root)
        if (actions.includes('content')) await loadContent(root)
        // /fishbone 是 v2.4 新增路由：health.actions 未声明也尝试一次（旧宿主返回 404 由降级处理）
        await loadFishbone(root)
        await loadLeaderLog(root)
      }
      boot()
      return () => {
        disposed = true
      }
    }, [refresh, loadRuns, loadResults, loadContent, loadFishbone, loadLeaderLog, injected.project])

    /* v4 快捷键：⌘/Ctrl+K 打开命令面板；Esc 逐层关闭（命令面板 → 侧滑面板 → 对话框）。 */
    React.useEffect(() => {
      const onKeyDown = (event) => {
        if (!event) return
        const isK = (event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'k'
        if (isK) {
          event.preventDefault()
          setPaletteOpen((prev) => {
            if (prev) return false
            setPaletteQuery('')
            return true
          })
          return
        }
        if (event.key !== 'Escape') return
        if (msgSprout) {
          setMsgSprout(null)
          return
        }
        if (ctxMenu) {
          setCtxMenu(null)
          return
        }
        if (inlineSprout) {
          setInlineSprout(null)
          return
        }
        if (recycleOpen) {
          setRecycleOpen(false)
          return
        }
        if (shortcutsOpen) {
          setShortcutsOpen(false)
          return
        }
        if (paletteOpen) {
          setPaletteOpen(false)
          return
        }
        if (slideTab) {
          setSlideTab(null)
          return
        }
        if (sproutDialog) {
          setSproutDialog(null)
          return
        }
        if (graftDialog) {
          setGraftDialog(null)
          return
        }
        if (fileModal) {
          setFileModal(null)
          return
        }
        if (sessionView) {
          closeSessionView()
          return
        }
        if (branchWorkModal) {
          setBranchWorkModal(null)
          return
        }
        if (ideaDialog) {
          setIdeaDialog(null)
          return
        }
        if (contentDetail) {
          setContentDetail(null)
          return
        }
        if (createDialog) {
          setCreateDialog(null)
          return
        }
        if (dialog) {
          setDialog(null)
          setReason('')
          return
        }
        if (detail) setDetail(null)
      }
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }
      return undefined
    }, [sproutDialog, graftDialog, fileModal, branchWorkModal, sessionView, ideaDialog, contentDetail, createDialog, dialog, detail, paletteOpen, slideTab, ctxMenu, inlineSprout, recycleOpen, shortcutsOpen, msgSprout])

    /* --------------------------------------------------- /run 动作执行 */

    const execute = async (body, executeOptions) => {
      const source = body && typeof body === 'object' ? body : {}
      const action = String(source.action || '')
      if (!action) return { ok: false, run: null }
      const options = executeOptions && typeof executeOptions === 'object' ? executeOptions : {}
      const target = typeof source.project === 'string' && source.project.trim() ? source.project.trim() : rootPath
      const outgoing = Object.assign({}, source)
      if (action === 'init') delete outgoing.project
      else outgoing.project = target || undefined
      setBusy(action)
      setError('')
      setRun({ id: '', action, status: 'running', exitCode: null, stdout: '', stderr: '' })
      try {
        const started = await postAction(outgoing)
        if (!alive.current) return { ok: false, run: null }
        if (!started || started.ok === false) {
          setError(hostMessage(started) || `执行「${ACTION_LABELS[action] || action}」失败`)
          setRun(null)
          return { ok: false, run: null }
        }
        setRun(started.run || null)
        let finished = started.run || null
        if (started.run && started.run.id) {
          finished = await settleRun(started.run.id, (tick) => {
            if (alive.current) setRun(tick)
          })
          if (alive.current && finished) setRun(finished)
        }
        if (options.skipRefresh !== true) await refreshStateAndData(target)
        await loadRuns()
        return { ok: true, run: finished }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
        return { ok: false, run: null }
      } finally {
        if (alive.current) setBusy('')
      }
    }

    /* ------------------------------------------------- /bridge 桥动作 */

    const runBridge = async (action, extra) => {
      const target = rootPath
      if (!target) {
        setError('请先加载项目，再执行网络操作')
        return { ok: false }
      }
      setBusy(`bridge:${action}`)
      setError('')
      try {
        const payload = await postBridge(Object.assign({ action, project: target }, extra && typeof extra === 'object' ? extra : {}))
        if (!alive.current) return { ok: false }
        if (!payload || payload.ok === false) {
          setError(hostMessage(payload) || payload.error || '网络操作失败')
          return { ok: false, payload }
        }
        let finished = payload.run || null
        if (payload.run && payload.run.id) {
          finished = await settleRun(payload.run.id, (tick) => {
            if (alive.current) setRun(tick)
          })
          if (alive.current && finished) setRun(finished)
        }
        await refreshStateAndData(target)
        await loadRuns()
        if (finished && finished.status === 'failed') {
          const detailText = finished.stderr || finished.stdout || ''
          setError(`网络操作失败：${String(detailText).slice(0, 300)}`)
          return { ok: false, run: finished }
        }
        return { ok: true, run: finished }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
        return { ok: false }
      } finally {
        if (alive.current) setBusy('')
      }
    }

    const publishProject = async () => {
      const result = await runBridge('publish')
      if (result && result.ok) setToast('已发布到项目网络')
    }

    const pullMessages = async () => {
      const result = await runBridge('pull')
      if (result && result.ok) setToast('已拉取网络消息')
    }

    const reviewStream = async (stream, version, moduleId, satisfied) => {
      let targetStream = stream
      let targetVersion = version
      if (!targetStream && moduleId) {
        /* 模块级「满意」：由 ContentView 传入最新结果，因此这里应有 stream；兜底为重载内容 */
        await loadContent(rootPath)
        return
      }
      const extra = { stream: targetStream, satisfied: satisfied !== false }
      if (version !== undefined && version !== null && String(version) !== '') extra.version = Number(version)
      if (moduleId) extra.module = moduleId
      const result = await runBridge('review', extra)
      if (result && result.ok) {
        setToast(satisfied === false ? '已标记待复核' : '已标记满意')
        setContentDetail(null)
      }
    }

    const reviewResult = async (result, satisfied) => {
      if (!result) return
      await reviewStream(result.stream, result.version, result.module, satisfied)
    }

    const reviewPendingItem = async (item, satisfied) => {
      if (!item) return
      await reviewStream(item.stream, item.version, item.module, satisfied)
    }

    /* ------------------------------------------------------------ 内容详情 */

    const openContentResult = (result) => {
      if (!result) return
      setContentDetail({ type: 'result', result })
    }

    const openContentHandoff = async (pathValue) => {
      const relative = String(pathValue === undefined || pathValue === null ? '' : pathValue).trim()
      if (!relative) return
      setContentDetail({ type: 'handoff', path: relative, loading: true, data: null, error: '' })
      try {
        const payload = await fetchHandoff(rootPath, relative)
        if (!alive.current) return
        if (payload && payload.ok !== false) {
          setContentDetail({ type: 'handoff', path: relative, loading: false, data: payload, error: '' })
        } else {
          setContentDetail({ type: 'handoff', path: relative, loading: false, data: null, error: hostMessage(payload) || '读取交接失败' })
        }
      } catch (problem) {
        if (alive.current) {
          setContentDetail({ type: 'handoff', path: relative, loading: false, data: null, error: networkMessage(problem) })
        }
      }
    }

    /* ------------------------------------------------------------ 记想法 */

    const openIdea = (context) => {
      const source = context && typeof context === 'object' ? context : {}
      const parts = []
      if (source.module) parts.push(String(source.module))
      if (source.stream) parts.push(`${source.stream}${source.version ? ` v${source.version}` : ''}`)
      setIdeaDialog({
        text: '',
        tag: '',
        error: '',
        module: source.module || '',
        stream: source.stream || '',
        version: source.version || '',
        context: parts.join(' · '),
      })
    }

    const submitIdea = async () => {
      const current = ideaDialog
      if (!current) return
      const text = String(current.text || '').trim()
      const tag = String(current.tag || '').trim()
      if (!text) {
        setIdeaDialog(Object.assign({}, current, { error: '想法内容不能为空' }))
        return
      }
      if (text.length > 2000) {
        setIdeaDialog(Object.assign({}, current, { error: '想法内容不能超过 2000 字' }))
        return
      }
      if (tag && !/^[A-Za-z0-9._-]{1,40}$/.test(tag)) {
        setIdeaDialog(Object.assign({}, current, { error: '标签只能包含字母、数字、点、下划线、连字符（≤40 字）' }))
        return
      }
      const payload = { text }
      if (tag) payload.tag = tag
      const result = await runBridge('idea', payload)
      if (result && result.ok) {
        setIdeaDialog(null)
        setToast('想法已记录到项目内容')
      }
    }

    /* ----------------------------------------------------- 文件与智能体工作区 */

    const openFileModal = async (relPath) => {
      const target = String(relPath || '').trim()
      if (!target) return
      setFileModal({ path: target, loading: true, data: null, error: '' })
      try {
        const payload = await fetchFile(rootPath, target)
        if (!alive.current) return
        if (payload && payload.ok) {
          setFileModal({ path: target, loading: false, data: payload, error: '' })
        } else {
          setFileModal({ path: target, loading: false, data: null, error: hostMessage(payload) || '读取文件失败' })
        }
      } catch (problem) {
        if (alive.current) setFileModal({ path: target, loading: false, data: null, error: networkMessage(problem) })
      }
    }

    const closeFileModal = () => setFileModal(null)

    const openModuleWorkspace = (moduleId) => {
      const id = String(moduleId || '').trim()
      if (!id) {
        setSelectedModule(null)
        return
      }
      const spine = (Array.isArray(fishbone && fishbone.spine) ? fishbone.spine : []).find((item) => item && item.id === id) || { id }
      const ribs = (Array.isArray(fishbone && fishbone.ribs) ? fishbone.ribs : []).filter((item) => item && item.module === id)
      setSelectedModule(id)
      if (view === 'fishbone' && conversationNode) {
        if (ribs.length > 0) {
          setSelectedRib(ribs[0].id)
          fetchBranchWork(rootPath, id, ribs[0].id).then((payload) => {
            if (alive.current && payload && payload.ok) {
              setRibWorkData(payload)
            }
          }).catch(() => {})
        } else {
          setSelectedRib(null)
          setRibWorkData(null)
        }
        return
      }
      setSelectedRib(null)
      setSessionDraft('')
      setOpenSections({ brief: true })
      setSessionView({ mode: 'module', module: id, branch: '', data: { module: { id, name: spine.name || id }, spine, ribs }, error: '' })
    }

    const closeSessionView = () => {
      setSessionView(null)
      setSessionDraft('')
      setSessionSending(false)
      setSelectedRib(null)
      setSelectedModule(null)
    }

    const openBranchWorkModal = async (args) => {
      const source = args && typeof args === 'object' ? args : {}
      const modId = String(source.module || '').trim()
      const brId = String(source.branch || '').trim()
      if (!modId || !brId) return
      // v2.7：整页会话视图取代弹窗；请求序号守卫：快速切换鱼刺时丢弃过期响应
      const requestId = ++sessionRequestId.current
      setSessionView({ module: modId, branch: brId, data: null, error: '' })
      setOpenSections({ brief: true })
      try {
        const payload = await fetchBranchWork(rootPath, modId, brId)
        if (!alive.current || requestId !== sessionRequestId.current) return
        if (payload && payload.ok) {
          setSessionView({ module: modId, branch: brId, data: payload, error: '' })
        } else {
          setSessionView({ module: modId, branch: brId, data: null, error: hostMessage(payload) || '读取工作区失败' })
        }
      } catch (problem) {
        if (alive.current && requestId === sessionRequestId.current) {
          setSessionView({ module: modId, branch: brId, data: null, error: networkMessage(problem) })
        }
      }
    }

    const closeBranchWorkModal = () => setBranchWorkModal(null)

    const onDirectiveChange = (text) => {
      setSessionDraft(text)
    }

    const sendBranchDirective = async (text) => {
      const spineList = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      const ribList = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const mod = (ribWorkData && ribWorkData.module && ribWorkData.module.id) || (sessionView && sessionView.module) || selectedModule || (spineList[0] && spineList[0].id) || 'M10'
      const br = (ribWorkData && ribWorkData.branch && ribWorkData.branch.id) || (sessionView && sessionView.branch) || selectedRib || (ribList[0] && ribList[0].id) || 'B10-01'
      if (!mod || !br || !text.trim()) return
      setSessionSending(true)
      try {
        const payload = await postBranchDirective(rootPath, mod, br, text.trim(), 'human')
        if (!alive.current) return
        if (payload && payload.ok) {
          setToast('指令已送达工作区 DIRECTIVES.md')
          setSessionDraft('')
          const updated = await fetchBranchWork(rootPath, mod, br)
          if (alive.current && updated && updated.ok) {
            setRibWorkData(updated)
            if (sessionView && sessionView.branch === br) {
              setSessionView({ module: mod, branch: br, data: updated, error: '' })
            }
          }
        } else {
          setToast(hostMessage(payload) || '发送指令失败')
        }
      } catch (err) {
        setToast(networkMessage(err))
      } finally {
        if (alive.current) setSessionSending(false)
      }
    }

    React.useEffect(() => {
      const ribs = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const ribId = selectedRib || (ribs[0] && ribs[0].id) || null
      if (!ribId) return
      const rib = ribs.find((r) => r.id === ribId)
      if (rib && rib.module && rootPath) {
        if (!ribWorkData || ribWorkData.branch?.id !== rib.id) {
          fetchBranchWork(rootPath, rib.module, rib.id)
            .then((payload) => {
              if (alive.current && payload && payload.ok) {
                setRibWorkData(payload)
              }
            })
            .catch(() => {})
        }
      }
    }, [selectedRib, fishbone, rootPath])

    /**
     * 将鱼刺上下文（意图、阶段主骨、已接受输入、CONTEXT.md 快照）挂载并同步到会话中。
     * 1. 调用 POST /mount-context 将 ACTIVE_CONTEXT.md 同步至项目根与工作区；
     * 2. 将包含上下文引导的提示词写入 DSH 会话输入框。
     */
    const mountContextToSession = React.useCallback(async (opts = {}) => {
      const ribs = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const spine = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      const ribId = opts.branch || selectedRib || (ribWorkData && ribWorkData.branch && ribWorkData.branch.id) || (ribs[0] && ribs[0].id) || ''
      const rib = ribs.find((r) => r.id === ribId)
      const moduleId = opts.module || (rib && rib.module) || selectedModule || (spine[0] && spine[0].id) || ''
      if (!moduleId || !ribId) return null

      const myId = (injected.entry && injected.entry.id) || 'lineex/research-dag-workbench'
      const activeSession = typeof hostService?.currentSession === 'function' ? hostService.currentSession() : null
      const myRecent = hostService?.state?.recentSessions?.[myId]
      const curSession =
        (activeSession && typeof hostService?.ownsSession === 'function' && hostService.ownsSession(activeSession))
          ? activeSession
          : (myRecent && typeof hostService?.ownsSession === 'function' && hostService.ownsSession(myRecent))
            ? myRecent
            : null

      // 快速前置构造 prompt（确保点击后 0ms 立即注入输入框）
      const modObj = spine.find((m) => m.id === moduleId) || {}
      const modName = modObj.name || moduleId
      const ribObj = rib || (ribWorkData && ribWorkData.branch) || {}
      const ribName = ribObj.name || ribId
      const brief = (ribWorkData && ribWorkData.brief) || ribObj.brief || ''
      const ctxText = (ribWorkData && ribWorkData.context) || ''
      const projTitle = (fishbone && fishbone.head && fishbone.head.title) || '科研项目'

      let fallbackPrompt = [
        `【科研鱼刺上下文已挂载】`,
        `项目：${projTitle}`,
        `当前阶段主骨：${modName} [${moduleId}]`,
        `当前探索鱼刺：${ribName} [${ribId}]`,
        brief ? `任务目标简报：\n${brief.slice(0, 300)}` : '',
        ctxText ? `\n--- 上下文档案核心快照 (CONTEXT.md) ---\n${ctxText.slice(0, 1500)}...` : '',
        `\n请依据上述已挂载的研究上下文与输入产物，开始推进该鱼刺的分析任务。`,
      ].filter(Boolean).join('\n')

      const applyToComposer = (text) => {
        let done = false
        // 1. 同步写入 localStorage 保证 DSH 的持久化 store 生效
        if (typeof localStorage !== 'undefined' && curSession) {
          try {
            const key = `dsh.conversation.${curSession}`
            const raw = localStorage.getItem(key)
            let stored = {}
            try { if (raw) stored = JSON.parse(raw) } catch {}
            stored.draft = text
            localStorage.setItem(key, JSON.stringify(stored))
          } catch {}
        }

        // 2. 尝试 Cordis 内部 Sessions -> conversation.input
        try {
          if (hostService && hostService.ctx) {
            const sessions = hostService.ctx.get('sessions')
            if (sessions && curSession) {
              const binding = typeof sessions.binding === 'function' ? sessions.binding(curSession) : null
              const actx = binding && binding.ctx
              if (actx) {
                const conv = actx.get('conversation')
                const shell = conv && conv.input && typeof conv.input.for === 'function' ? conv.input.for(actx) : null
                if (shell && typeof shell.setDraft === 'function') {
                  shell.setDraft(text)
                  done = true
                }
              }
            }
          }
        } catch {}

        // 3. 全局扫描原生会话中的 composer（支持 Lexical contenteditable 与 textarea）
        if (typeof document !== 'undefined') {
          const candidates = Array.from(document.querySelectorAll([
            '.rdw-native-slot [contenteditable="true"]',
            '.rdw-native-slot [role="textbox"]',
            '.rdw-native-slot textarea',
            '[data-composer-card] [contenteditable="true"]',
            '[data-input-scroll] [contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]',
            'textarea',
          ].join(', ')))

          const target = candidates.find((el) => el && (el.offsetWidth > 0 || el.offsetHeight > 0)) || candidates[0]
          if (target) {
            target.focus()
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
              target.value = text
              target.dispatchEvent(new Event('input', { bubbles: true }))
              target.dispatchEvent(new Event('change', { bubbles: true }))
              done = true
            } else {
              // Lexical / ContentEditable: 使用 Chromium 原生 execCommand('insertText') 驱动 Lexical beforeinput 监听
              try {
                const sel = window.getSelection()
                const range = document.createRange()
                range.selectNodeContents(target)
                sel.removeAllRanges()
                sel.addRange(range)
                done = document.execCommand('insertText', false, text)
              } catch {}

              if (!done) {
                try {
                  const inputEvent = new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: text,
                  })
                  target.dispatchEvent(inputEvent)
                  target.dispatchEvent(new Event('input', { bubbles: true }))
                  done = true
                } catch {}
              }

              if (!done && (!target.innerText || !target.innerText.trim())) {
                try {
                  target.innerText = text
                  target.dispatchEvent(new Event('input', { bubbles: true }))
                  done = true
                } catch {}
              }
            }
          }
        }

        // 4. 写入剪贴板作为 100% 兜底备份
        try {
          if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text).catch(() => {})
          }
        } catch {}

        return done
      }

      // 立即在前端注入预备 prompt
      applyToComposer(fallbackPrompt)

      // 后台异步请求后端生成更完整的上下文并同步工作区文件
      if (rootPath) {
        postMountContext(rootPath, moduleId, ribId)
          .then((res) => {
            if (res && res.ok && res.promptDraft) {
              applyToComposer(res.promptDraft)
            }
          })
          .catch(() => {})
      }

      if (!opts.auto) {
        setToast(`已将 [${ribId} · ${ribName}] 上下文注入会话框（已就绪并同步剪贴板）`)
      }
      return true
    }, [rootPath, selectedRib, selectedModule, fishbone, ribWorkData, hostService, injected.entry])

    /**
     * 对话选区或消息一键自动创建鱼刺（无需复杂弹窗，全自动推导模块、序号并创建）。
     */
    const autoSproutFromMessage = React.useCallback(async (rawText, opts = {}) => {
      const ribs = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const spineList = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      const excerpt = String(rawText || '').trim()
      if (!excerpt) return

      // 当前激活父刺与主骨
      const parentId = opts.fromRib || selectedRib || (ribs[0] && ribs[0].id) || ''
      const parentRib = ribs.find((r) => r.id === parentId)
      const moduleId = (parentRib && parentRib.module) || opts.module || selectedModule || (spineList[0] && spineList[0].id) || 'M10'
      const mod = spineList.find((m) => m.id === moduleId)
      const moduleName = mod ? (mod.name || mod.id) : moduleId

      // 自动提取名称（前24个字）
      let autoName = excerpt.replace(/^[#\s*`>-]+/, '').split(/[\n。！？!?]/)[0].trim().slice(0, 24)
      if (!autoName) autoName = '对话分叉探索'

      // 自动生成下一个合规分支 ID（如 B40-04）
      const newId = generateNextBranchId(moduleId, parentId, ribs)

      setBusy('sprout')
      setError('')
      setMsgSprout(null)
      try {
        const payload = await postAction({
          action: 'sprout',
          project: rootPath,
          module: moduleId,
          id: newId,
          name: autoName,
          prompt: `基于会话上下文自动分叉探索：\n"${excerpt}"`,
          from: parentId || undefined,
          mode: 'spike',
        })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '自动分刺失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (tick) => {
          if (alive.current) setRun(tick)
        })
        if (finished && finished.status === 'succeeded') {
          // 关联会话消息锚点
          await postRibOp({
            project: rootPath,
            op: 'anchor',
            ribId: newId,
            origin: {
              kind: 'message',
              anchor: {
                messageExcerpt: excerpt.slice(0, 300),
                createdAt: new Date().toISOString(),
              },
            },
          })
          pushUndo(`分刺 ${newId}`, { op: 'delete', ribId: newId })
          setToast(`🌱 已自动创建新鱼刺 [${newId} · ${autoName}]`)
          setSelectedRib(newId)
          setSelectedModule(moduleId)
          await loadFishbone(rootPath)
          const workPayload = await fetchBranchWork(rootPath, moduleId, newId)
          if (alive.current && workPayload && workPayload.ok) {
            setRibWorkData(workPayload)
          }
          // 自动挂载上下文到会话
          mountContextToSession({ module: moduleId, branch: newId, auto: false })
        } else {
          setError(hostMessage(finished) || '分刺未成功')
        }
      } catch (err) {
        if (alive.current) setError(networkMessage(err))
      } finally {
        if (alive.current) setBusy('')
      }
    }, [fishbone, selectedRib, selectedModule, rootPath, mountContextToSession])

    /**
     * 在 DSH 侧边栏编辑器里打开项目内文件/目录。
     *
     * 说明：DSH 的 `sidebar_open` 是面向模型的工具（要求发起方是 agent），
     * Web 面板没有直接调用它的入口。宿主若开放了面板直开能力，
     * POST /open-sidebar 会真的打开；否则返回 501 + 已解析的绝对路径，
     * 这里如实告诉用户「让模型用 sidebar_open 打开这个路径」，
     * 而不是弹个小窗假装成功。
     */
    /** 给同伴鱼刺投递消息（v3.2）：POST /run {action:'message'} → dag message。 */
    const sendRibMessage = async (target, text) => {
      const to = String((target && target.id) || '').trim()
      const from = String((sessionView && sessionView.branch) || '').trim()
      const body = String(text || '').trim()
      if (!to || !from || !body) return
      const result = await execute({ action: 'message', to, from, text: body })
      if (result && result.ok) {
        setRibMessage(null)
        setToast(`已投递消息到 ${to}`)
        const current = sessionView
        if (current && current.branch === from) {
          const updated = await fetchBranchWork(rootPath, current.module, current.branch)
          if (alive.current && updated && updated.ok) {
            setSessionView({ module: current.module, branch: current.branch, data: updated, error: '' })
          }
        }
      }
    }

    /** 打开同伴鱼刺的工作区（鱼刺之间互相查看）。 */
    const openSiblingRib = (row) => {
      if (!row || !row.id) return
      const siblings = sessionView && sessionView.data && Array.isArray(sessionView.data.siblings)
        ? sessionView.data.siblings
        : []
      const known = siblings.find((item) => item && item.id === row.id)
      if (!known) return
      openBranchWorkModal({ module: sessionView.module, branch: known.id })
    }

    /** 清除鱼刺上下文档案（v3.2）：POST /run {action:'context', clear:true}。 */
    const clearRibContext = async (branchId) => {
      const id = String(branchId || (sessionView && sessionView.branch) || '').trim()
      if (!id) return
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm(
          `确定清除鱼刺 ${id} 的上下文档案（CONTEXT.md）吗？\n\n` +
            '会保留一份 CONTEXT.md.bak 备份，随时可以用 `dag context` 重新补建。',
        )
        if (!ok) return
      }
      const result = await execute({ action: 'context', clear: true, branch: id })
      if (result && result.ok) {
        setToast(`已清除 ${id} 的上下文档案（留有 .bak 备份）`)
        const current = sessionView
        if (current && current.branch === id) {
          const updated = await fetchBranchWork(rootPath, current.module, current.branch)
          if (alive.current && updated && updated.ok) {
            setSessionView({ module: current.module, branch: current.branch, data: updated, error: '' })
          }
        }
      }
    }

    /**
     * 补建鱼刺的 CONTEXT.md（v3.1）。
     * 旧鱼刺创建于上下文档案机制之前，打开后智能体看不到主骨脉络；
     * 这里通过 POST /run {action:'context', branch} 触发 `dag context --branch`。
     */
    const buildContext = async (branchId) => {
      const id = String(branchId || '').trim()
      if (!id) return
      const result = await execute({ action: 'context', branch: id })
      if (result && result.ok) {
        setToast(`已补建 ${id} 的 CONTEXT.md`)
        const current = sessionView
        if (current && current.branch === id) {
          const updated = await fetchBranchWork(rootPath, current.module, current.branch)
          if (alive.current && updated && updated.ok) {
            setSessionView({ module: current.module, branch: current.branch, data: updated, error: '' })
          }
        }
        await loadFishbone(rootPath)
      }
    }

    const openSidebar = async (relPath) => {
      const target = String(relPath || '').trim()
      if (!target) return
      try {
        const payload = await postOpenSidebar(rootPath, target)
        if (payload && payload.ok) {
          setToast('已在 DSH 侧边栏打开')
          return
        }
        const code = payload && payload.code ? payload.code : ''
        if (code === 'E_SIDEBAR_UNAVAILABLE') {
          const abs = payload && payload.path ? payload.path : ''
          setToast(`当前宿主不支持面板直开侧边栏。可让模型执行：sidebar_open("${abs}")`)
          setSidebarHint({ path: abs, rel: target })
          return
        }
        setToast(hostMessage(payload) || '在侧边栏打开失败')
      } catch (problem) {
        setToast(networkMessage(problem))
      }
    }

    const openExternal = async (relPath) => {
      const target = String(relPath || '').trim()
      if (!target) return
      try {
        const payload = await postOpenExternal(rootPath, target)
        if (payload && payload.ok) {
          setToast('已在系统文件管理器中定位')
        } else {
          setToast(hostMessage(payload) || '定位文件失败')
        }
      } catch (err) {
        setToast(networkMessage(err))
      }
    }

    /* ----------------------------------------------------- 项目加载/配置 */

    const loadProject = async (target) => {
      const root = String(target === undefined || target === null ? projectInput : target).trim()
      if (!root) {
        setError('请先填写 DAG 项目的绝对路径')
        return
      }
      setProjectInput(root)
      setContentDetail(null)
      await refreshStateAndData(root)
    }

    const loadExample = async (example) => {
      const target = String(example || (health && health.example) || '').trim()
      if (!target) {
        setError('宿主未提供示例项目路径（research-dag/examples/early-phosphate 不存在）')
        return
      }
      setProjectInput(target)
      setContentDetail(null)
      await refreshStateAndData(target)
    }

    const saveProjectConfig = async (target) => {
      const root = String(target === undefined || target === null ? rootPath : target).trim()
      if (!root) {
        setError('请先填写项目绝对路径，再保存配置')
        return
      }
      setBusy('config')
      setError('')
      try {
        const payload = await saveConfig(root)
        if (!alive.current) return
        if (payload && payload.ok) {
          setConfig(payload.config && typeof payload.config === 'object' ? payload.config : { version: 1, projectRoot: root })
          await refreshStateAndData(root)
        } else {
          setError(hostMessage(payload) || '保存配置失败')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    // 同步项目登记簿
    React.useEffect(() => {
      if (project && project.root && project.exists !== false && project.isDag !== false) {
        setProjectsRegistry((prev) => {
          const norm = String(project.root).trim().toLowerCase()
          const existing = prev.filter((p) => p.root && String(p.root).trim().toLowerCase() !== norm)
          const totalRibsCount = (project.branches && project.branches.length) || (fishbone && fishbone.totals && fishbone.totals.ribs) || 13
          const acceptedRibsCount = (project.accepted && project.accepted.length) || (fishbone && fishbone.totals && fishbone.totals.accepted) || 8
          const completion = totalRibsCount > 0 ? Math.round((acceptedRibsCount / totalRibsCount) * 100) : 62
          const item = {
            id: project.id || 'dag-project',
            title: project.title || project.id || '未命名研究项目',
            goal: project.goal || '',
            root: project.root,
            phase: project.phase || 'analysis',
            modulesCount: (project.modules && project.modules.length) || 6,
            ribsCount: (project.branches && project.branches.length) || (fishbone && fishbone.ribs && fishbone.ribs.length) || 13,
            acceptedCount: (project.accepted && project.accepted.length) || (fishbone && fishbone.totals && fishbone.totals.accepted) || 8,
            attentionCount: (project.blockers && project.blockers.length) || 0,
            completion,
            lastOpenedAt: new Date().toISOString(),
          }
          const next = [item, ...existing]
          try {
            if (typeof localStorage !== 'undefined') localStorage.setItem('rdw_projects_registry', JSON.stringify(next))
          } catch {}
          return next
        })
      }
    }, [project, fishbone])

    React.useEffect(() => {
      if (health && health.example) {
        setProjectsRegistry((prev) => {
          if (prev.length > 0) return prev
          const exampleItem = {
            id: 'early-phosphate',
            title: '重症低磷血症患者早期补磷的 target trial emulation',
            goal: '在成人 ICU 低磷血症患者中评估入 ICU 24 小时内启动静脉补磷对 30 天全因死亡的影响',
            root: health.example,
            phase: 'analysis',
            modulesCount: 6,
            ribsCount: 13,
            acceptedCount: 8,
            attentionCount: 1,
            completion: 62,
            lastOpenedAt: new Date().toISOString(),
          }
          return [exampleItem]
        })
      }
    }, [health])

    const openProjectFromHub = async (targetRoot) => {
      const root = String(targetRoot || '').trim()
      if (!root) return
      setProjectInput(root)
      setContentDetail(null)
      setSessionView(null)
      await refreshStateAndData(root)
      setView('fishbone')
      setToast(`已加载项目：${root}`)
    }

    const removeProjectFromRegistry = (proj) => {
      setProjectsRegistry((prev) => {
        const next = prev.filter((p) => p.root !== proj.root && p.id !== proj.id)
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem('rdw_projects_registry', JSON.stringify(next))
        } catch {}
        return next
      })
      setToast(`已从总控台移除「${proj.title || proj.id}」（本地文件完整保留）`)
    }

    const importProjectSubmit = async (targetRoot) => {
      const root = String(targetRoot || '').trim()
      if (!root) return
      setImportDialog(null)
      await openProjectFromHub(root)
    }

    const crossProjectSharedItems = React.useMemo(() => {
      const list = []
      if (project && Array.isArray(project.accepted)) {
        for (const item of project.accepted) {
          list.push({
            project: project.id || '当前课题',
            title: item.stream || '已沉淀成果',
            summary: item.path || '',
            at: item.acceptedAt || '已沉淀',
          })
        }
      }
      if (content && content.network && Array.isArray(content.network.projects)) {
        for (const netP of content.network.projects) {
          if (Array.isArray(netP.results)) {
            for (const r of netP.results) {
              list.push({
                project: netP.projectId || '网络课题',
                title: r.stream,
                summary: r.summary || r.path,
                at: r.acceptedAt || '',
              })
            }
          }
          if (Array.isArray(netP.ideas)) {
            for (const idea of netP.ideas) {
              list.push({
                project: netP.projectId || '网络课题',
                title: `💡 想法 · ${idea.tag || '研究'}`,
                summary: idea.text,
                at: idea.at || '',
              })
            }
          }
        }
      }
      return list
    }, [project, content])

    /* ------------------------------------------------------- 旧视图动作 */

    const openActionDialog = (payload) => {
      const source = payload && typeof payload === 'object' ? payload : {}
      const action = source.action
      if (!action) return
      if (action === 'accept' || action === 'reject') {
        setReason('')
        setDialog({
          action,
          handoff: source.handoff,
          path: source.handoff,
          fileName: handoffName(source.handoff),
        })
        return
      }
      execute(source)
    }

    const cancelDialog = () => {
      setDialog(null)
      setReason('')
    }

    const confirmDialog = async () => {
      const pendingDialog = dialog
      const trimmed = String(reason || '').trim()
      if (!pendingDialog || !trimmed) return
      const payload = { action: pendingDialog.action, handoff: pendingDialog.handoff, reason: trimmed }
      payload.by = pendingDialog.action === 'accept' ? 'main' : 'main'
      setDialog(null)
      setReason('')
      await execute(payload)
    }

    const openDetail = async (pathValue) => {
      const relative = String(pathValue === undefined || pathValue === null ? '' : pathValue).trim()
      if (!relative) return
      setDetail({ path: relative, loading: true, data: null, error: '' })
      try {
        const payload = await fetchHandoff(rootPath, relative)
        if (!alive.current) return
        if (payload && payload.ok) {
          setDetail({ path: relative, loading: false, data: payload, error: '' })
        } else {
          setDetail({ path: relative, loading: false, data: null, error: hostMessage(payload) || '读取交接详情失败' })
        }
      } catch (problem) {
        if (alive.current) setDetail({ path: relative, loading: false, data: null, error: networkMessage(problem) })
      }
    }

    const closeDetail = () => setDetail(null)

    const submitStateForm = async () => {
      const form = stateForm && typeof stateForm === 'object' ? stateForm : {}
      const phase = String(form.phase || '').trim()
      const next = String(form.next || '').trim()
      const blocker = String(form.blocker || '').trim()
      if (!phase && !next && !blocker) {
        setError('项目状态设置至少需要一项：阶段 / 下一步 / 阻塞')
        return
      }
      const payload = { action: 'state-set' }
      if (phase) payload.phase = phase
      if (next) payload.next = next
      if (blocker) payload.blocker = blocker
      await execute(payload)
      if (alive.current) setStateForm({ phase: '', next: '', blocker: '' })
    }

    /* ------------------------------------------------------------ 创建流 */

    const openCreate = (payload) => {
      const source = payload && typeof payload === 'object' ? payload : {}
      const kind = source.kind
      if (!CREATE_FIELD_SPECS[kind]) return
      const values = {}
      if (kind === 'branch-add') values.module = source.module || ''
      if (kind === 'handoff-new') values.branch = source.branch || ''
      setCreateDialog({ kind, values, error: '' })
    }

    const changeCreateField = (name, value) => {
      setCreateDialog((previous) => {
        if (!previous) return previous
        const values = Object.assign({}, previous.values, { [name]: value })
        return Object.assign({}, previous, { values, error: '' })
      })
    }

    const buildCreatePayload = (create) => {
      const kind = create && create.kind
      const values = create && create.values && typeof create.values === 'object' ? create.values : {}
      const text = (key) => String(values[key] === undefined || values[key] === null ? '' : values[key]).trim()

      if (kind === 'init') {
        const root = text('root')
        const id = text('id')
        const title = text('title')
        const goal = text('goal')
        if (!root) return { error: '项目根路径不能为空（必须是绝对路径，例如 D:\\papers\\my-project）' }
        if (!isAbsoluteProjectPath(root)) return { error: '项目根路径必须是绝对路径（例如 D:\\papers\\my-project 或 /home/me/project）' }
        if (!id) return { error: '项目 id 不能为空（任意唯一名称即可，不需要编号）' }
        if (!isValidNodeId(id)) return { error: '项目 id 只能包含字母、数字、点、下划线、连字符，且以字母或数字开头（1–64 字）' }
        if (!title) return { error: '项目标题不能为空' }
        const body = { action: 'init', root, id, title }
        if (goal) body.goal = goal
        return { body }
      }

      if (kind === 'module-add') {
        const id = text('id')
        const name = text('name')
        const slug = text('slug')
        if (!id) return { error: '模块 id 不能为空（任意唯一名称即可，如 literature、pilot-a）' }
        if (!isValidNodeId(id)) return { error: '模块 id 只能包含字母、数字、点、下划线、连字符，且以字母或数字开头（1–64 字）' }
        if (!name) return { error: '模块显示名不能为空' }
        if (!isValidSlug(slug)) return { error: 'slug 只能包含字母、数字、点、下划线、连字符（≤40 字）' }
        const body = { action: 'module-add', id, name }
        if (slug) body.slug = slug
        return { body }
      }

      if (kind === 'branch-add') {
        const module = text('module')
        const id = text('id')
        const name = text('name')
        const slug = text('slug')
        if (!module) return { error: '缺少所属模块' }
        if (!id) return { error: '分支 id 不能为空（任意唯一名称即可，如 pilot-a）' }
        if (!isValidNodeId(id)) return { error: '分支 id 只能包含字母、数字、点、下划线、连字符，且以字母或数字开头（1–64 字）' }
        if (!name) return { error: '分支显示名不能为空' }
        if (!isValidSlug(slug)) return { error: 'slug 只能包含字母、数字、点、下划线、连字符（≤40 字）' }
        const body = { action: 'branch-add', module, id, name }
        if (slug) body.slug = slug
        return { body }
      }

      if (kind === 'handoff-new') {
        const branch = text('branch')
        const stream = text('stream')
        const slug = text('slug')
        if (!branch) return { error: '缺少所属分支' }
        if (!isValidStream(stream)) return { error: 'stream 只能包含小写字母、数字、连字符，且以字母或数字开头' }
        if (!isValidSlug(slug)) return { error: '文件名标签只能包含字母、数字、点、下划线、连字符（≤40 字）' }
        const body = { action: 'handoff-new', branch }
        if (stream) body.stream = stream
        if (slug) body.slug = slug
        return { body }
      }

      return { error: '未知的创建类型' }
    }

    const persistNewProject = async (root) => {
      try {
        const payload = await saveConfig(root)
        if (!alive.current) return
        if (payload && payload.ok) {
          setConfig(payload.config && typeof payload.config === 'object' ? payload.config : { version: 1, projectRoot: root })
          setProjectInput(root)
          await refreshStateAndData(root)
        } else {
          setError(hostMessage(payload) || '新项目已创建，但保存配置失败')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      }
    }

    const submitCreate = async () => {
      const current = createDialog
      if (!current) return
      const built = buildCreatePayload(current)
      if (built.error) {
        setCreateDialog(Object.assign({}, current, { error: built.error }))
        return
      }
      const kind = current.kind
      const body = built.body
      setCreateDialog(null)
      const result = await execute(body, kind === 'init' ? { skipRefresh: true } : undefined)
      if (!alive.current || !result || !result.ok) return
      if (kind === 'init') {
        await persistNewProject(String(body.root))
        if (alive.current) setView('content')
        return
      }
      if (kind === 'module-add' || kind === 'branch-add') {
        setEngTab('dag')
        setView('engineering')
        return
      }
      if (kind === 'handoff-new') {
        setEngTab('handoffs')
        setView('engineering')
      }
    }

    const toggleResultExpanded = (pathValue) => {
      const key = String(pathValue === undefined || pathValue === null ? '' : pathValue)
      if (!key) return
      setExpandedResults((previous) => Object.assign({}, previous, { [key]: !previous[key] }))
    }
    const toggleResultLimitations = (pathValue) => {
      const key = String(pathValue === undefined || pathValue === null ? '' : pathValue)
      if (!key) return
      setExpandedLimitations((previous) => Object.assign({}, previous, { [key]: !previous[key] }))
    }
    const toggleNetworkProject = (projectIdValue) => {
      const key = String(projectIdValue === undefined || projectIdValue === null ? '' : projectIdValue)
      if (!key) return
      setExpandedProjects((previous) => Object.assign({}, previous, { [key]: !previous[key] }))
    }

    const refreshContent = async () => {
      setBusy('content')
      setError('')
      try {
        await loadContent(rootPath)
        await loadRuns()
      } finally {
        if (alive.current) setBusy('')
      }
    }

    const unsubmitHandoff = async (pathValue) => {
      const target = String(pathValue || '').trim()
      if (!target) return
      setBusy('unsubmit')
      setError('')
      try {
        const payload = await postAction({ action: 'unsubmit', handoff: target, project: rootPath })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '撤回失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (r) => {
          if (alive.current) setRun(r)
        })
        if (finished && finished.status === 'succeeded') {
          setToast('已撤回至草稿状态（DRAFT），正文已解冻')
          await Promise.all([loadState(rootPath), loadContent(rootPath)])
        } else {
          setError(hostMessage(finished) || '撤回未成功')
        }
      } catch (err) {
        if (alive.current) setError(networkMessage(err))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    /* ------------------------------------------------------- 鱼骨主线动作 */

    const openSproutDialog = (moduleHint, fromRib) => {
      const modules = Array.isArray(fishbone && fishbone.spine) ? fishbone.spine : []
      const preferred = moduleHint || selectedModule || (modules[0] && modules[0].id) || ''
      setSproutDialog({
        module: preferred,
        id: '',
        name: '',
        prompt: '',
        mode: 'standard',
        noHandoff: false,
        // v3.2：空 = 从主脊骨分；指定父刺 id = 从那根鱼刺分
        from: fromRib ? String(fromRib) : '',
        error: '',
      })
    }

    const changeSproutField = (name, value) => {
      setSproutDialog((previous) => (previous ? Object.assign({}, previous, { [name]: value, error: '' }) : previous))
    }

    const submitSprout = async () => {
      const current = sproutDialog
      if (!current) return
      const moduleId = String(current.module || '').trim()
      const branchId = String(current.id || '').trim()
      const name = String(current.name || '').trim() || branchId
      const prompt = String(current.prompt || '').trim()
      if (!moduleId) {
        setSproutDialog(Object.assign({}, current, { error: '请选择要长刺的模块（主骨节点）' }))
        return
      }
      if (!branchId) {
        setSproutDialog(Object.assign({}, current, { error: '请填写鱼刺 id（如 spline-opt）' }))
        return
      }
      setSproutDialog(null)
      setBusy('sprout')
      setError('')
      try {
        const payload = await postAction({
          action: 'sprout',
          project: rootPath,
          module: moduleId,
          id: branchId,
          name,
          prompt,
          mode: current.mode === 'spike' ? 'spike' : 'standard',
          noHandoff: current.noHandoff === true,
          from: current.from ? String(current.from) : undefined,
        })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '分刺失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (tick) => {
          if (alive.current) setRun(tick)
        })
        if (finished && finished.status === 'succeeded') {
          const fromRib = current.from ? `（从鱼刺 ${current.from} 分出）` : '（从主脊骨分出）'
          setToast(`已长出鱼刺 ${branchId}${fromRib}，智能体可开工`)
          setSelectedRib(branchId)
          setSelectedModule(moduleId)
          await loadFishbone(rootPath)
          if (rootPath) {
            fetchBranchWork(rootPath, moduleId, branchId)
              .then((p) => {
                if (alive.current && p && p.ok) {
                  setRibWorkData(p)
                }
              })
              .catch(() => {})
          }
        } else {
          setError(hostMessage(finished) || '分刺未成功')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    const runAutoGraft = async () => {
      setBusy('auto')
      setError('')
      try {
        const payload = await postAction({ action: 'auto', project: rootPath })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '自动回连失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (tick) => {
          if (alive.current) setRun(tick)
        })
        if (finished && finished.status === 'succeeded') {
          const accepted = finished.json && Array.isArray(finished.json.accepted) ? finished.json.accepted.length : 0
          const held = finished.json && Array.isArray(finished.json.skipped)
            ? finished.json.skipped.filter((item) => item && item.code === 'HOLD_DECISION').length
            : 0
          setToast(
            accepted > 0 || held > 0
              ? `自动回连完成：回连 ${accepted} 根${held > 0 ? `，另有 ${held} 根等你拍板` : ''}`
              : '没有可自动回连的鱼刺',
          )
          await Promise.all([loadFishbone(rootPath), loadContent(rootPath)])
        } else {
          setError(hostMessage(finished) || '自动回连未成功')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    const openGraftDialog = (ribId) => {
      const rib = (Array.isArray(fishbone && fishbone.ribs) ? fishbone.ribs : []).find((item) => item && item.id === ribId)
      if (!rib) return
      setGraftDialog({ rib, reason: '', error: '' })
    }

    const submitGraft = async () => {
      const current = graftDialog
      if (!current || !current.rib) return
      const rib = current.rib
      const reason = String(current.reason || '').trim() || '成果满意，回连主骨'
      if (!rib.stream) {
        setGraftDialog(Object.assign({}, current, { error: '这根鱼刺还没有交接文件，先让智能体产出再回连' }))
        return
      }
      setGraftDialog(null)
      setBusy('graft')
      setError('')
      try {
        const handoffPath = rib.dir ? `${rib.dir}/handoffs/HANDOFF-${rib.id}-v${rib.version || 1}.md` : ''
        const payload = await postAction({
          action: 'graft',
          project: rootPath,
          handoff: handoffPath,
          reason,
        })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '回连失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (tick) => {
          if (alive.current) setRun(tick)
        })
        if (finished && finished.status === 'succeeded') {
          setToast(`鱼刺 ${rib.id} 已回连主骨`)
          await Promise.all([loadFishbone(rootPath), loadContent(rootPath)])
        } else {
          setError(hostMessage(finished) || '回连未成功')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    const selectRib = (rib) => {
      if (!rib) {
        setSelectedRib(null)
        return
      }
      setSelectedRib(rib.id)
      if (rib.module) setSelectedModule(rib.module)
      if (view === 'fishbone' && conversationNode) {
        if (rib.module && rib.id && rootPath) {
          fetchBranchWork(rootPath, rib.module, rib.id)
            .then((payload) => {
              if (alive.current && payload && payload.ok) {
                setRibWorkData(payload)
              }
            })
            .catch(() => {})
          mountContextToSession({ module: rib.module, branch: rib.id, auto: true })
        }
        try {
          if (hostService) {
            const myId = (injected.entry && injected.entry.id) || 'lineex/research-dag-workbench'
            const activeSession = typeof hostService.currentSession === 'function' ? hostService.currentSession() : null
            const myRecent = hostService.state?.recentSessions?.[myId]
            const target = (activeSession && typeof hostService.ownsSession === 'function' && hostService.ownsSession(activeSession))
              ? activeSession
              : (myRecent && typeof hostService.ownsSession === 'function' && hostService.ownsSession(myRecent))
                ? myRecent
                : null
            if (target) {
              if (typeof hostService.showSession === 'function') hostService.showSession(target)
              else if (typeof hostService.openSession === 'function') hostService.openSession(target)
            }
          }
        } catch {}
        return
      }
      openBranchWorkModal({ module: rib.module, branch: rib.id })
    }

    /* ------------------------------------------------------- v3.5 交互系统 */

    /** 所有 rib-op 的统一出口：乐观刷新鱼骨 + 失败提示。 */
    const ribOp = async (op, ribId, extra) => {
      const result = await postRibOp(Object.assign({ project: rootPath, op, ribId }, extra || {}))
      if (!result || result.ok === false) {
        setToast(`操作失败：${(result && result.message) || '未知错误'}`)
        return null
      }
      await loadFishbone(rootPath)
      return result
    }

    /** 记录一次可撤销操作。inverse 描述「怎么回去」。 */
    const pushUndo = (label, inverse) => {
      setUndoStack((prev) => [...prev.slice(-49), { label, inverse }])
      setRedoStack([])
    }
    const doUndo = async () => {
      const top = undoStack[undoStack.length - 1]
      if (!top) {
        setToast('没有可撤销的操作')
        return
      }
      const inv = top.inverse
      if (inv && inv.op) {
        await ribOp(inv.op, inv.ribId, inv.extra)
      }
      setUndoStack((prev) => prev.slice(0, -1))
      setRedoStack((prev) => [...prev, top])
      setToast(`已撤销：${top.label}`)
    }
    const doRedo = async () => {
      const top = redoStack[redoStack.length - 1]
      if (!top) {
        setToast('没有可重做的操作')
        return
      }
      // 重做 = 重新执行原操作的正向（用 inverse 里存的 forward 字段）
      if (top.forward && top.forward.op) {
        await ribOp(top.forward.op, top.forward.ribId, top.forward.extra)
      }
      setRedoStack((prev) => prev.slice(0, -1))
      setUndoStack((prev) => [...prev, top])
      setToast(`已重做：${top.label}`)
    }

    /** 删除鱼刺（软删进回收站）。 */
    const deleteRib = async (rib, options = {}) => {
      if (!rib || !rib.id) return
      const hasChildren = (fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []).some((r) => r && r.parent === rib.id)
      const fileCount = (rib.workFiles ? rib.workFiles.length : 0) + (rib.outputFiles ? rib.outputFiles.length : 0)
      let cascade = false
      if (hasChildren) {
        cascade = typeof window !== 'undefined' && window.confirm
          ? window.confirm(`「${rib.name}」还有下级分叉。\n\n确定 = 连同下级一起删\n取消 = 只删本刺（下级上移到主骨）`)
          : false
      }
      if (fileCount > 0 && !options.skipConfirm) {
        const ok = typeof window !== 'undefined' && window.confirm
          ? window.confirm(`「${rib.name}」含 ${fileCount} 项产物。\n\n删除后移入回收站，30 天内可还原。确定删除？`)
          : true
        if (!ok) return
      }
      const result = await ribOp('delete', rib.id, { cascade })
      if (result) {
        pushUndo(`删除 ${rib.id}`, { op: 'restore', ribId: rib.id })
        setToast(`已删除 ${rib.id} 到回收站（30 天可还原）`)
      }
    }

    /** 重命名鱼刺。 */
    const renameRib = async (rib) => {
      if (!rib || !rib.id) return
      const next = typeof window !== 'undefined' && window.prompt
        ? window.prompt(`重命名鱼刺 ${rib.id}：`, rib.name || rib.id)
        : null
      if (!next || !String(next).trim()) return
      const oldName = rib.name || rib.id
      const result = await ribOp('rename', rib.id, { name: String(next).trim() })
      if (result) {
        pushUndo(`重命名 ${rib.id}`, { op: 'rename', ribId: rib.id, extra: { name: oldName } })
        setToast(`已重命名为「${String(next).trim()}」`)
      }
    }

    /** 受阻标记切换。 */
    const toggleBlockRib = async (rib) => {
      if (!rib || !rib.id) return
      if (rib.status === 'BLOCKED') {
        const result = await ribOp('unblock', rib.id)
        if (result) {
          pushUndo(`解除受阻 ${rib.id}`, { op: 'block', ribId: rib.id })
          setToast(`已解除 ${rib.id} 的受阻标记`)
        }
      } else {
        const note = typeof window !== 'undefined' && window.prompt
          ? window.prompt(`标记 ${rib.id} 受阻的原因（可留空）：`, '')
          : ''
        const result = await ribOp('block', rib.id, { note: note || '' })
        if (result) {
          pushUndo(`标记受阻 ${rib.id}`, { op: 'unblock', ribId: rib.id })
          setToast(`已标记 ${rib.id} 受阻`)
        }
      }
    }

    /** 幻影刺单击 → 弹出内联闪电分叉气泡。 */
    const onPhantomSprout = (node, point) => {
      setInlineSprout({
        x: Math.min(point.x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 230),
        y: point.y,
        moduleId: node.id,
        moduleName: node.name || node.id,
        fromRib: '',
        name: '',
        error: '',
      })
    }

    /** 内联闪电分叉：回车即建。 */
    const submitInlineSprout = async () => {
      const form = inlineSprout
      if (!form) return
      const name = String(form.name || '').trim()
      if (!name) {
        setInlineSprout(Object.assign({}, form, { error: '请填写鱼刺名称' }))
        return
      }
      const id = generateNextBranchId(form.moduleId, form.fromRib, fishbone && fishbone.ribs)
      const msgExcerpt = form.messageExcerpt || ''
      setInlineSprout(null)
      setBusy('sprout')
      setError('')
      try {
        const payload = await postAction({
          action: 'sprout',
          project: rootPath,
          module: form.moduleId,
          id,
          name,
          prompt: msgExcerpt ? `基于会话上下文探索：\n"${msgExcerpt}"` : undefined,
          from: form.fromRib ? String(form.fromRib) : undefined,
          mode: 'spike',
        })
        if (!payload || payload.ok === false || !payload.run) {
          setError(hostMessage(payload) || '分刺失败')
          return
        }
        setRun(payload.run)
        const finished = await settleRun(payload.run.id, (tick) => {
          if (alive.current) setRun(tick)
        })
        if (finished && finished.status === 'succeeded') {
          if (msgExcerpt) {
            await postRibOp({
              project: rootPath,
              op: 'anchor',
              ribId: id,
              origin: {
                kind: 'message',
                anchor: {
                  messageExcerpt: msgExcerpt.slice(0, 300),
                  createdAt: new Date().toISOString(),
                },
              },
            })
          }
          pushUndo(`分刺 ${id}`, { op: 'delete', ribId: id })
          setToast(`已在「${form.moduleName}」长出鱼刺 ${id} · ${name}`)
          setSelectedRib(id)
          setSelectedModule(form.moduleId)
          await loadFishbone(rootPath)
          const workPayload = await fetchBranchWork(rootPath, form.moduleId, id)
          if (alive.current && workPayload && workPayload.ok) {
            setRibWorkData(workPayload)
          }
          mountContextToSession({ module: form.moduleId, branch: id, auto: false })
        } else {
          setError(hostMessage(finished) || '分刺未成功')
        }
      } catch (problem) {
        if (alive.current) setError(networkMessage(problem))
      } finally {
        if (alive.current) setBusy('')
      }
    }

    /** 悬停速览卡：400ms 延迟触发。 */
    const onHoverRib = (rib, point) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = setTimeout(() => {
        const module = (fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []).find((m) => m.id === rib.module)
        setHoverCard({
          x: point.x, y: point.y, rib, module,
          onOpen: (r) => { setHoverCard(null); selectRib(r) },
          onGraft: (r) => { setHoverCard(null); openGraftDialog(r.id) },
          onDelete: (r) => { setHoverCard(null); deleteRib(r) },
        })
      }, 400)
    }
    const onHoverRibLeave = () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      // 延迟关闭：让用户有机会把鼠标移进卡片（卡片有自己的 onMouseLeave）
      setTimeout(() => setHoverCard((prev) => prev), 180)
    }

    /* ------------------------------------------------------- v3.5 右键菜单构建 */

    /** 按对象类型构建菜单项列表。 */
    const buildMenuItems = (target) => {
      if (!target || !target.kind) return []
      const ribsList = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const spineList = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      const recycleCount = fishbone && Array.isArray(fishbone.recycleBin) ? fishbone.recycleBin.length : 0

      if (target.kind === 'rib') {
        const rib = target.rib
        const canGraft = Boolean(rib.stream && rib.status !== 'ACCEPTED' && rib.status !== 'REJECTED')
        const isBlocked = rib.status === 'BLOCKED'
        return [
          mi('🔍', '打开工作区', 'Enter', () => selectRib(rib)),
          mi('🌱', '在此刺下再分叉', '⌘N', () => openSproutDialog(rib.module, rib.id)),
          sep(),
          mi('✏️', '重命名…', 'F2', () => renameRib(rib)),
          mi('📝', '编辑目标…', '', () => openSproutDialog(rib.module, rib.id)),
          sep(),
          mi('✅', '回连主骨', '⌘↵', () => openGraftDialog(rib.id), canGraft ? {} : { disabled: true, reason: rib.stream ? '该刺已回连或已修剪' : '还没有交接产物，先让智能体产出再回连' }),
          mi(isBlocked ? '🔓' : '🔒', isBlocked ? '解除受阻' : '标记受阻…', 'B', () => toggleBlockRib(rib)),
          sep(),
          mi('🗑', '删除到回收站…', 'Del', () => deleteRib(rib), { danger: true }),
        ]
      }
      if (target.kind === 'module') {
        const mod = target.module
        return [
          mi('＋', '在此阶段下分新刺', 'N', () => openSproutDialog(mod.id, null)),
          mi('📋', `查看该阶段全部鱼刺 (${(mod.ribs || []).length})`, '', () => openModuleWorkspace(mod.id)),
          sep(),
          mi('🔍', '筛选中栏：只看本阶段', '', () => openModuleWorkspace(mod.id)),
        ]
      }
      if (target.kind === 'head') {
        return [
          mi('✏️', '编辑研究目标…', '', () => setSlideTab('agent')),
          mi('🧭', '查看主智能体决策记录', '', () => setSlideTab('agent')),
          sep(),
          mi('🗂', '导出项目摘要', '', () => setToast('导出摘要：走工程页「报告」')),
        ]
      }
      if (target.kind === 'artifact') {
        const file = target.file
        return [
          mi('👁', '预览', 'Space', () => openFileModal(file.title)),
          mi('📂', '在系统文件管理器中显示', '', () => openExternal(file.title)),
          sep(),
          mi('📋', '复制路径', '', () => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(file.title)
            setToast('已复制路径')
          }),
        ]
      }
      if (target.kind === 'marker') {
        const ms = target.marker
        return [
          mi('🔍', '查看该版本交接详情', '', () => openDetail(ms.path || '')),
          mi('📊', '与当前状态对比', '', () => setToast('对比功能走工程页「DAG」')),
        ]
      }
      if (target.kind === 'conversation-message') {
        return [
          mi('🌱', '从此消息分叉新探索分支', '⌥N', () => sproutFromMessage({ excerpt: target.excerpt })),
          sep(),
          mi('📋', '复制消息内容', '', () => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(target.excerpt)
              setToast('已复制消息内容')
            }
          }),
        ]
      }
      if (target.kind === 'gap' || target.kind === 'canvas') {
        const list = [
          mi('＋', '分一根新刺', 'N', () => openSproutDialog(selectedModule || (spineList[0] && spineList[0].id), selectedRib)),
          sep(),
          undoStack.length > 0
            ? mi('↩', `撤销：${undoStack[undoStack.length - 1].label}`, '⌘Z', doUndo)
            : mi('↩', '撤销', '⌘Z', null, { disabled: true, reason: '没有可撤销的操作' }),
          redoStack.length > 0
            ? mi('↪', `重做：${redoStack[redoStack.length - 1].label}`, '⇧⌘Z', doRedo)
            : mi('↪', '重做', '⇧⌘Z', null, { disabled: true, reason: '没有可重做的操作' }),
          sep(),
        ]
        if (recycleCount > 0) {
          list.push(mi('🗑', `回收站 (${recycleCount})`, '', () => setRecycleOpen(true)))
        } else {
          list.push(mi('🗑', '回收站（空）', '', null, { disabled: true, reason: '回收站是空的' }))
        }
        return list
      }
      return []
    }

    const onContextMenu = (payload) => {
      const items = buildMenuItems(payload.target)
      if (items.length === 0) return
      setCtxMenu({ x: payload.x, y: payload.y, items, title: payload.target.kind === 'rib' ? `${payload.target.rib.id} · ${payload.target.rib.name}` : undefined })
    }

    /* ------------------------------------------------------- v3.6 会话消息锚定分叉 */

    /**
     * 从会话消息分叉：打开内联闪电分叉气泡，预填从消息提取的主题与引用。
     * 回车即在当前阶段下创建鱼刺，并写入消息锚点。
     * @param {{excerpt: string, x?: number, y?: number, sessionId?: string, messageId?: string, moduleHint?: string}} anchor
     */
    const sproutFromMessage = async (anchor) => {
      const spineList = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      const ribList = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      const fromRibId = anchor.fromRib || selectedRib || (ribList[0] && ribList[0].id) || ''
      const fromRibObj = ribList.find((r) => r.id === fromRibId)
      // 主骨阶段严格优先遵循父刺自身所属主骨，杜绝跨模块校验失败
      const moduleId = (fromRibObj && fromRibObj.module) || anchor.moduleHint || selectedModule || (spineList[0] && spineList[0].id) || ''
      if (!moduleId) {
        setToast('请先选择或加载一个主骨阶段')
        return
      }
      const rawText = String(anchor.excerpt || '').trim()
      let defaultName = rawText.replace(/^[#\s*`>-]+/, '').split(/[\n。！？!?]/)[0].trim().slice(0, 24)
      if (!defaultName) defaultName = '消息分叉探索'
      const mod = spineList.find((m) => m.id === moduleId)
      const moduleName = mod ? (mod.name || mod.id) : moduleId

      setInlineSprout({
        x: Math.min(anchor.x || 360, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 260),
        y: Math.min(anchor.y || 240, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200),
        moduleId,
        moduleName,
        fromRib: fromRibId,
        name: defaultName,
        messageExcerpt: rawText,
        error: '',
      })
    }

    /* ------------------------------------------------- 对话（宿主原生会话） */

    /** 是否已有绑定到本工作台的会话（宿主 state.sessionBindings）。 */
    const sessionBound = (() => {
      if (!hostService) return false
      try {
        const current = typeof hostService.currentSession === 'function' ? hostService.currentSession() : null
        if (current === null || current === undefined) return false
        if (typeof hostService.ownsSession === 'function') return hostService.ownsSession(current)
        return false
      } catch (problem) {
        return false
      }
    })()

    /** 宿主是否提供「新建/连接会话」能力（不同版本方法名略有差异，逐个探测）。 */
    const canStartChat = Boolean(
      hostService &&
        (typeof hostService.ensureSession === 'function' ||
         typeof hostService.newWorkspaceSession === 'function' ||
         typeof hostService.newSession === 'function'),
    )

    /**
     * 开始一段关联到本工作台的对话。
     * 规范 4.2：不自动建会话——只有用户点了「开始对话」才建；
     * 会话本身交给宿主原生实现（不在这里另造聊天界面）。
     * v3.6 优化：优先使用 ensureSession 自动关联当前项目目录的工作区与原生会话。
     */
    const startChat = () => {
      if (!hostService) {
        setToast('当前宿主未提供会话能力，业务页仍可正常使用')
        return
      }
      setChatOpen(true)
      try {
        const run = typeof hostService.run === 'function' ? hostService.run.bind(hostService) : null
        if (typeof hostService.ensureSession === 'function' && rootPath) {
          const pending = hostService.ensureSession({ folder: rootPath })
          if (run) run(pending)
          return
        }
        if (typeof hostService.newWorkspaceSession === 'function') {
          const pending = hostService.newWorkspaceSession()
          if (run) run(pending)
          return
        }
        let workspaceId = ''
        if (typeof hostService.defaultWorkspace === 'function') {
          const workspace = hostService.defaultWorkspace()
          if (workspace && workspace.workspaceId) workspaceId = workspace.workspaceId
        }
        const pending = hostService.newSession(workspaceId)
        if (run) run(pending)
      } catch (problem) {
        setToast(`开始对话失败：${networkMessage(problem)}`)
      }
    }

    /** 把当前无归属的未绑定会话绑定到本工作台；若该会话已属于其他工作台则明确拒绝，严禁越权覆盖。 */
    const attachCurrentSession = React.useCallback(async () => {
      if (!hostService) return
      try {
        const myId = (injected.entry && injected.entry.id) || 'lineex/research-dag-workbench'
        const cur = typeof hostService.currentSession === 'function' ? hostService.currentSession() : null

        if (!cur) {
          // 当前没有任何激活会话，走宿主标准流程开启新会话
          startChat()
          return
        }

        // 1. 如果当前会话已确认属于本工作台，直接激活展示
        if (typeof hostService.ownsSession === 'function' && hostService.ownsSession(cur)) {
          if (typeof hostService.showSession === 'function') hostService.showSession(cur)
          else if (typeof hostService.openSession === 'function') hostService.openSession(cur)
          return
        }

        // 2. 严格校验会话所有权：若已绑定到其他工作台，坚决拒绝接管或改绑（符合《工作台开发规范》第4-7节）
        const bindings = hostService.state?.sessionBindings || {}
        const existingOwner = bindings[cur]
        if (existingOwner && existingOwner !== myId) {
          setToast('该会话已归属于其他工作台，不可跨工作台改绑。请新建属于本工作台的会话。')
          return
        }

        // 3. 当前会话属于未绑定会话（无 owner 或空白会话）：走宿主正式 API 进行关联
        if (typeof hostService.ensureSession === 'function') {
          await hostService.ensureSession({ sessionId: cur })
        } else if (typeof hostService.commit === 'function') {
          await hostService.commit((state) => {
            if (state && (!state.sessionBindings[cur] || state.sessionBindings[cur] === myId)) {
              state.sessionBindings[cur] = myId
              state.recentSessions[myId] = cur
            }
          })
        }

        if (typeof hostService.showSession === 'function') {
          hostService.showSession(cur)
        } else if (typeof hostService.openSession === 'function') {
          hostService.openSession(cur)
        }
      } catch (err) {
        setToast(`连接会话失败：${networkMessage(err)}`)
      }
    }, [hostService, injected.entry, startChat])

    const hasAttemptedAttach = React.useRef(false)

    // 首屏自动检测：仅恢复确认归属于本工作台的会话；未确认或属于其他工作台时坚决不接管、不改绑、不自动创建！
    React.useEffect(() => {
      if (!hostService || hasAttemptedAttach.current) return
      hasAttemptedAttach.current = true

      try {
        const myId = (injected.entry && injected.entry.id) || 'lineex/research-dag-workbench'
        // 仅检查确认归属于本工作台的历史最近会话
        const myRecent = hostService.state?.recentSessions?.[myId]
        if (!myRecent) return

        // 必须经由 hostService.ownsSession 严格确认属于本工作台
        const isOwned = typeof hostService.ownsSession === 'function' && hostService.ownsSession(myRecent)
        if (!isOwned) return

        const cur = typeof hostService.currentSession === 'function' ? hostService.currentSession() : null
        if (cur === myRecent) return

        if (typeof hostService.showSession === 'function') {
          hostService.showSession(myRecent)
        } else if (typeof hostService.openSession === 'function') {
          hostService.openSession(myRecent)
        }
      } catch (err) {
        /* ignore */
      }
    }, [hostService, injected.entry])

    /* --------------------------------------------------------------- 渲染 */

    const viewProps = {
      project,
      detail,
      onSelect: openDetail,
      onCloseDetail: closeDetail,
      onRetryDetail: openDetail,
      onAction: openActionDialog,
      onCreate: openCreate,
      createEnabled,
      busy,
    }

    const oldResultsViewProps = {
      project,
      results,
      resultsLoading,
      resultsError,
      autoEnabled,
      resultsAvailable,
      busy,
      onAuto: () => execute({ action: 'auto' }),
      onSelect: openDetail,
      detail,
      onCloseDetail: closeDetail,
      onRetryDetail: openDetail,
      expandedResults,
      expandedLimitations,
      onToggleKeyResults: toggleResultExpanded,
      onToggleLimitations: toggleResultLimitations,
    }

    const contentNode = h(
      'div',
      null,
      !contentAvailable
        ? h('div', { style: STYLES.noticeBanner }, CONTENT_UPGRADE_NOTICE)
        : null,
      !contentAvailable
        ? resultsAvailable
          ? renderResultsView(h, oldResultsViewProps)
          : h(
              'div',
              { style: { ...STYLES.muted, padding: '10px 0' } },
              '当前宿主没有提供 /results 与 /content，请重启 DSH 加载新版宿主后再使用内容页。',
            )
        : renderContentView(h, {
            content,
            contentLoading,
            contentError,
            busy,
            detail: contentDetail,
            networkError: content && typeof content.networkError === 'string' ? content.networkError : '',
            onRetry: () => loadContent(rootPath),
            onPublish: publishProject,
            onPull: pullMessages,
            onLoadExample: () => {
              const ex = (health && health.example) || ''
              if (ex) {
                setProjectInput(ex)
                saveProjectConfig(ex)
              }
            },
            onOpenDetail: openContentResult,
            onOpenHandoff: openContentHandoff,
            onUnsubmit: unsubmitHandoff,
            onReview: reviewResult,
            onReviewItem: reviewPendingItem,
            onIdea: openIdea,
            onCloseDetail: () => setContentDetail(null),
            onRetryHandoff: openContentHandoff,
            fileModal,
            onOpenFile: openFileModal,
            onCloseFileModal: closeFileModal,
            onOpenSidebar: openSidebar,
            onOpenBranchWork: openBranchWorkModal,
            onCloseBranchWorkModal: closeBranchWorkModal,
            onDirectiveChange,
            onSendDirective: sendBranchDirective,
            onOpenExternal: openExternal,
            onGoEngineering: () => {
              setContentDetail(null)
              setEngTab('handoffs')
              setView('engineering')
            },
          }),
    )

    const networkNode = !contentAvailable
      ? h(
          'div',
          null,
          h('div', { style: STYLES.noticeBanner }, NETWORK_UPGRADE_NOTICE),
          h(
            'div',
            { style: { ...STYLES.muted, padding: '6px 0' } },
            '项目网络需要新版宿主提供 /content（TeamMCP digest）。工程页与旧结果页仍可正常使用。',
          ),
        )
      : renderNetworkView(h, {
          content,
          contentLoading,
          contentError,
          busy,
          run,
          onRefresh: refreshContent,
          onPublish: publishProject,
          onPull: pullMessages,
          onReviewItem: reviewPendingItem,
          onOpenHandoff: openContentHandoff,
          expandedProjects,
          onToggleProject: toggleNetworkProject,
        })

    const engineeringNodes = {
      dag: renderDagView(h, viewProps),
      handoffs: renderHandoffsView(
        h,
        Object.assign({}, viewProps, {
          statusFilter,
          setStatusFilter,
          moduleFilter,
          setModuleFilter,
          plainStatus: true,
        }),
      ),
      control: renderControlView(
        h,
        Object.assign({}, viewProps, {
          health,
          config,
          verify: server && server.verify ? server.verify : null,
          cliError: server && typeof server.cliError === 'string' ? server.cliError : '',
          runs,
          run,
          selectedRunId,
          onSelectRun: setSelectedRunId,
          onVerify: () => execute({ action: 'verify' }),
          onReport: () => execute({ action: 'report' }),
          onStateSet: submitStateForm,
          stateForm,
          setStateForm,
          projectInput,
          setProject: setProjectInput,
          onSaveConfig: saveProjectConfig,
        }),
      ),
      overview: renderOverviewView(h, viewProps),
    }

    /* 鱼骨视图的公共 props（三栏舞台与底部抽屉共用，避免两处参数漂移）。 */
    const fishboneCommonProps = {
      fishbone,
      loading: fishboneLoading,
      error: fishboneError,
      selectedModule,
      selectedRib,
      session: sessionView,
      displayMode: fishboneDisplayMode,
      setDisplayMode: setFishboneDisplayMode,
      onSelectModule: (moduleId) => openModuleWorkspace(moduleId),
      onSelectRib: selectRib,
      onRefresh: () => loadFishbone(rootPath),
      onSprout: (moduleHint, fromRib) => openSproutDialog(moduleHint || selectedModule, fromRib),
      onSproutHere: (moduleId, fromRib) => openSproutDialog(moduleId, fromRib),
      onAuto: runAutoGraft,
      onGraft: openGraftDialog,
      busy,
      conversationNode,
      onOpenFile: openFileModal,
      onOpenSidebar: openSidebar,
      chatOpen,
      onToggleChat: () => {
        if (chatOpen) {
          setChatOpen(false)
          return
        }
        setChatOpen(true)
      },
      directiveDraft: sessionDraft,
      onDraftChange: onDirectiveChange,
      onSendDirective: sendBranchDirective,
      sending: sessionSending,
      composerModel,
      onSelectModel: setComposerModel,
      composerPermission,
      onSelectPermission: setComposerPermission,
      activeDropdown,
      onToggleDropdown: (name) => setActiveDropdown((prev) => (prev === name ? null : name)),
      /* v3.5 交互系统 2.0 回调 */
      onContextMenu,
      onHoverRib,
      onHoverRibLeave,
      onPhantomSprout,
      onDeleteRib: deleteRib,
      onUndo: doUndo,
      onRedo: doRedo,
      onShowShortcuts: () => setShortcutsOpen(true),
      inlineSprout: Boolean(inlineSprout),
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      recycleCount: fishbone && Array.isArray(fishbone.recycleBin) ? fishbone.recycleBin.length : 0,
      onOpenRecycle: () => setRecycleOpen(true),
      sessionBound,
      canStartChat,
      onStartChat: startChat,
      onAttachSession: attachCurrentSession,
      middleTab,
      onSelectMiddleTab: setMiddleTab,
      middleMode,
      onSelectMiddleMode: setMiddleMode,
      ribWork: ribWorkData || (injected && injected.ribWork) || null,
      onSproutFromMessage: sproutFromMessage,
      onShowMessageSprout: (payload) => setMsgSprout(payload),
      onMountContext: mountContextToSession,
      onAutoSprout: autoSproutFromMessage,
    }

    /* v4：三栏舞台只渲染三栏（外壳 .rdw-stage 承载网格）。 */
    const fishboneStageProps = Object.assign({}, fishboneCommonProps, { mode: 'stage' })
    /* v4：底部抽屉只渲染全景骨架 + 鱼刺表。 */
    const fishboneDrawerProps = Object.assign({}, fishboneCommonProps, { mode: 'drawer' })

    const fishboneNode = renderFishboneView(h, fishboneCommonProps)
    const fishboneStageNode = renderFishboneView(h, fishboneStageProps)
    const fishboneDrawerNode = renderFishboneView(h, fishboneDrawerProps)

    const leaderNode = renderLeaderLogView(h, {
      leaderLog,
      loading: leaderLogLoading,
      error: leaderLogError,
      filter: leaderFilter,
      onFilter: (next) => setLeaderFilter(next || 'all'),
      onRefresh: () => loadLeaderLog(rootPath),
      busy,
    })

    // v2.7：工作区会话视图 = 整页（取代弹窗）
    const sessionNode = renderBranchSessionView(h, {
      session: sessionView,
      loading: Boolean(sessionView && sessionView.data === null && !sessionView.error),
      error: sessionView ? sessionView.error : '',
      onBack: closeSessionView,
      onSend: sendBranchDirective,
      onOpenFile: openFileModal,
      onOpenSidebar: openSidebar,
      onBuildContext: buildContext,
      onClearContext: clearRibContext,
      onOpenSibling: openSiblingRib,
      onMessageSibling: (row) => setRibMessage({ target: row, text: '' }),
      onOpenBranch: (rib) => selectRib(rib),
      onSprout: (moduleHint, fromRib) => openSproutDialog(moduleHint || (sessionView && sessionView.module), fromRib),
      canGraft: Boolean(
        sessionView && sessionView.branch && Array.isArray(fishbone && fishbone.ribs) &&
        fishbone.ribs.some((item) => item && item.id === sessionView.branch && item.stream && item.status !== 'ACCEPTED' && item.status !== 'REJECTED'),
      ),
      onGraft: () => sessionView && sessionView.branch && openGraftDialog(sessionView.branch),
      busy,
      directiveDraft: sessionDraft,
      onDraftChange: onDirectiveChange,
      sending: sessionSending,
      openSections,
      onToggleSection: (key) => setOpenSections((prev) => Object.assign({}, prev, { [key]: !(prev && prev[key]) })),
    })

    const projectsHubNode = renderProjectsHubView(h, {
      projects: projectsRegistry,
      activeProjectRoot: rootPath,
      currentProject: project,
      busy: Boolean(busy),
      searchQuery: hubSearch,
      onSearchChange: setHubSearch,
      phaseFilter: hubPhaseFilter,
      onPhaseFilterChange: setHubPhaseFilter,
      categoryFilter: hubCategoryFilter,
      onCategoryFilterChange: setHubCategoryFilter,
      sharedItems: crossProjectSharedItems,
      onOpenProject: openProjectFromHub,
      onRemoveProject: removeProjectFromRegistry,
      onCreateProject: () => openCreate({ kind: 'init' }),
      onImportProject: () => setImportDialog({ path: '', error: '' }),
      onLoadExample: () => loadExample(health && health.example),
      onRefresh: () => refreshStateAndData(rootPath),
      onIdea: openIdea,
    })

    /**
     * 首用 / 无项目引导。
     * 规范 4.2：工作台必须自己设计首次进入与无会话状态，不依赖宿主的通用引导；
     * 也不得在首次进入时自动创建会话——这里只给三条可执行的路。
     */
    const welcomeNode = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      projectsHubNode,
      h(
        'div',
        { style: { ...STYLES.card, marginTop: 4 } },
        h('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 4 } }, WELCOME_COPY.title),
        h('div', { style: { ...STYLES.muted, lineHeight: 1.7 } }, WELCOME_COPY.subtitle),
        h(
          'div',
          { style: { ...STYLES.contentGrid, marginBottom: 12 } },
          ...WELCOME_COPY.points.map(([name, description], index) =>
            h(
              'div',
              { key: `welcome-${index}`, style: STYLES.contentCard },
              h('div', { style: { fontSize: 12, fontWeight: 700 } }, name),
              h('div', { style: { ...STYLES.muted, lineHeight: 1.65 } }, description),
            ),
          ),
        ),
        h('div', { style: STYLES.sectionTitle }, '从这里开始'),
        ...[WELCOME_COPY.stepLoad, WELCOME_COPY.stepExample, WELCOME_COPY.stepCreate, WELCOME_COPY.stepChat].map(
          (line, index) => h('div', { key: `step-${index}`, style: { ...STYLES.listItem } }, `· ${line}`),
        ),
        h(
          'div',
          { style: { ...STYLES.row, gap: 8, marginTop: 10 } },
          health && health.example
            ? h(
                'button',
                { type: 'button', style: STYLES.primaryButton, disabled: Boolean(busy), onClick: () => loadExample(health.example) },
                '加载示例项目',
              )
            : null,
          createEnabled
            ? h('button', { type: 'button', style: STYLES.button, disabled: Boolean(busy), onClick: () => openCreate({ kind: 'init' }) }, '新建项目')
            : null,
        ),
      ),
    )

    const viewNode = sessionView
      ? sessionNode
      : !project
      // 首用引导由 welcomeNode 承担（规范 4.2：不用宿主通用引导）。
      ? welcomeNode
      : view === 'hub'
        ? projectsHubNode
        : view === 'fishbone'
          ? fishboneNode
          : view === 'leader'
            ? leaderNode
            : view === 'content'
              ? contentNode
              : view === 'network'
                ? networkNode
                : renderEngineeringView(h, {
                    tab: engTab,
                    setTab: setEngTab,
                    nodes: engineeringNodes,
                    busy,
                  })

    /* ── v4 命令面板（⌘K）：把「低频但要知道在哪」的跳转与命令集中到一处 ──
     * 动因：原设计把这些动作散在 6 个页签里，用户必须先想「这功能在哪个页签」
     * 才能操作。命令面板把「我想做什么」直接映射到「怎么执行」。 */
    const paletteItems = (() => {
      const list = []
      if (!project) return list
      // 命令
      list.push({ section: '命令', icon: '🌱', name: '分一根新刺', desc: '从当前主骨或选中鱼刺派生新分支', kbd: 'N', run: () => openSproutDialog(selectedModule, selectedRib) })
      if (selectedRib) {
        list.push({ section: '命令', icon: '↩', name: '回连当前鱼刺', desc: '把成果接回主骨', kbd: 'G', run: () => openGraftDialog(selectedRib) })
      }
      list.push({ section: '命令', icon: '⟳', name: '刷新鱼骨主线', desc: '重新计算主骨与鱼刺状态', run: () => loadFishbone(rootPath) })
      list.push({ section: '命令', icon: '⚡', name: '查看待拍板项', desc: '查看需要你处理的决策', run: () => setSlideTab('agent') })
      list.push({ section: '命令', icon: '📊', name: '打开概览', desc: '统计与整体进度', run: () => setSlideTab('overview') })
      list.push({ section: '命令', icon: '⚙️', name: '打开工程（DAG/交接/校验）', desc: '工程建设视图', run: () => setSlideTab('engineering') })
      // 跳转：主骨
      const spineList = fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : []
      spineList.forEach((m) => {
        list.push({ section: '跳转 · 主骨', icon: '🦴', name: `${m.id} ${m.name}`, desc: `${m.completion || 0}% 已回连 · ${(m.ribs || []).length} 根鱼刺`, run: () => openModuleWorkspace(m.id) })
      })
      // 跳转：鱼刺
      const ribList = fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs : []
      ribList.forEach((r) => {
        list.push({ section: '跳转 · 鱼刺', icon: '🌱', name: `${r.id} ${r.name}`, desc: `状态 ${r.status || '—'}${r.parent ? ` · 父刺 ${r.parent}` : ''}`, run: () => selectRib(r) })
      })
      return list
    })()

    const paletteNode = paletteOpen && project
      ? h(
          'div',
          {
            className: 'rdw-palette-mask',
            role: 'presentation',
            onClick: (e) => {
              if (e && e.target === e.currentTarget) setPaletteOpen(false)
            },
          },
          h(
            'div',
            { className: 'rdw-palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': '命令面板' },
            h('input', {
              className: 'rdw-palette-input',
              type: 'text',
              value: paletteQuery,
              placeholder: '跳转到项目、鱼刺、文件，或执行命令…',
              autoFocus: true,
              'aria-label': '命令面板搜索',
              onChange: (e) => setPaletteQuery(e && e.target ? e.target.value : ''),
            }),
            h(
              'div',
              { className: 'rdw-palette-list' },
              ...(() => {
                const q = String(paletteQuery || '').trim().toLowerCase()
                const filtered = q === ''
                  ? paletteItems.slice(0, 12)
                  : paletteItems.filter((it) => `${it.name} ${it.desc} ${it.section}`.toLowerCase().includes(q)).slice(0, 16)
                if (filtered.length === 0) {
                  return [h('div', { key: 'none', className: 'rdw-pal-section', style: { padding: '14px 12px' } }, '没有匹配的项')]
                }
                let lastSection = ''
                const nodes = []
                filtered.forEach((it, idx) => {
                  if (it.section !== lastSection) {
                    lastSection = it.section
                    nodes.push(h('div', { key: `sec-${idx}`, className: 'rdw-pal-section' }, it.section))
                  }
                  nodes.push(
                    h(
                      'button',
                      {
                        key: `pal-${idx}`,
                        type: 'button',
                        className: 'rdw-pal-item',
                        onClick: () => {
                          setPaletteOpen(false)
                          setPaletteQuery('')
                          if (typeof it.run === 'function') it.run()
                        },
                      },
                      h('span', { className: 'rdw-pal-ico', 'aria-hidden': 'true' }, it.icon),
                      h(
                        'div',
                        { className: 'rdw-pal-main' },
                        h('div', { className: 'rdw-pal-name' }, it.name),
                        it.desc ? h('div', { className: 'rdw-pal-desc' }, it.desc) : null,
                      ),
                      it.kbd ? h('span', { className: 'rdw-kbd' }, it.kbd) : null,
                    ),
                  )
                })
                return nodes
              })(),
            ),
            h(
              'div',
              { className: 'rdw-palette-foot' },
              h('span', null, '↑↓ 选择'),
              h('span', null, '↵ 执行'),
              h('span', null, 'esc 关闭'),
            ),
          ),
        )
      : null

    /* ── v4 底部全景抽屉：把占首屏的 SVG 全景与鱼刺表收进可收起抽屉 ──
     * 动因：全景图信息密度低但占高，原设计把真正要读的会话区挤到折叠线下。
     *
     * v3.7 修复（浏览器自动闭合导致的换行 bug）：
     * 旧写法把 `.rdw-drawer-acts`（含两个 <button>）嵌在**另一个 <button>** 里。
     * HTML 规范禁止 button 嵌套 button，浏览器解析时会**强制闭合外层 button**，
     * 于是操作区被抛到外壳之外、掉到第二行，视觉上抽屉栏凭空多出一行。
     * 修法：外层换成 div[role=button]，键盘可达性用 tabIndex + onKeyDown 补齐。 */
    const drawerNode = project && view === 'fishbone' && !sessionView
      ? h(
          'div',
          { className: drawerOpen ? 'rdw-drawer open' : 'rdw-drawer' },
          h(
            'div',
            {
              className: 'rdw-drawer-bar',
              role: 'button',
              tabIndex: 0,
              'aria-expanded': drawerOpen ? 'true' : 'false',
              onClick: () => setDrawerOpen((prev) => !prev),
              onKeyDown: (e) => {
                if (!e) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setDrawerOpen((prev) => !prev)
                }
              },
            },
            h('span', { className: 'rdw-drawer-caret', 'aria-hidden': 'true' }, '▶'),
            h('span', { className: 'rdw-drawer-title' }, '鱼刺清单与全景骨架'),
            h(
              'span',
              { className: 'rdw-drawer-meta' },
              `${fishbone && Array.isArray(fishbone.ribs) ? fishbone.ribs.length : 0} 根鱼刺 · Ishikawa 全景`,
            ),
            h(
              'div',
              { className: 'rdw-drawer-acts', onClick: (e) => e.stopPropagation() },
              h(
                'button',
                { type: 'button', className: 'btn sm', disabled: Boolean(busy), onClick: runAutoGraft },
                '自动回连',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'btn sm solid',
                  disabled: Boolean(busy),
                  onClick: () => openSproutDialog(selectedModule, selectedRib),
                },
                '🌱 分一根新刺',
              ),
            ),
          ),
          h('div', { className: 'rdw-drawer-content' }, fishboneDrawerNode),
        )
      : null

    /* ── v4 侧滑管理面板：低频管理（主智能体/内容/网络/工程/概览）── */
    const slideNode = slideTab && project
      ? (() => {
          const tabs = [
            ['agent', '🧠 主智能体'],
            ['content', '📄 内容'],
            ['network', '🌐 网络'],
            ['engineering', '⚙️ 工程'],
            ['overview', '📊 概览'],
          ]
          const bodyMap = {
            agent: leaderNode,
            content: contentNode,
            network: networkNode,
            // 工程页必须走 renderEngineeringView，才会带出 DAG/交接/校验/概览 子页签栏。
            engineering: renderEngineeringView(h, {
              tab: engTab,
              setTab: setEngTab,
              nodes: engineeringNodes,
              busy,
            }),
            overview: renderOverviewView(h, viewProps),
          }
          return h(
            'div',
            { className: 'rdw-slide-mask', onClick: () => setSlideTab(null) },
            h(
              'div',
              {
                className: 'rdw-slide',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '项目管理面板',
                onClick: (e) => e.stopPropagation(),
              },
              h(
                'div',
                { className: 'rdw-slide-head' },
                h('span', { className: 'rdw-slide-title' }, '项目面板'),
                h(
                  'div',
                  { className: 'rdw-slide-tabs' },
                  ...tabs.map(([id, label]) =>
                    h(
                      'button',
                      {
                        key: id,
                        type: 'button',
                        className: slideTab === id ? 'rdw-slide-tab on' : 'rdw-slide-tab',
                        onClick: () => setSlideTab(id),
                      },
                      label,
                    ),
                  ),
                ),
                h('button', { type: 'button', className: 'rdw-slide-close', 'aria-label': '关闭面板', onClick: () => setSlideTab(null) }, '✕'),
              ),
              h('div', { className: 'rdw-slide-body' }, bodyMap[slideTab] || null),
            ),
          )
        })()
      : null

    /**
     * 对话区（右侧可收起栏）。
     *
     * v5 关键改动：宿主传入的原生会话节点（conversationNode）**不再在这里渲染**，
     * 而是交给中栏工作区（FishboneView 的 middlePane）内嵌。
     *
     * 原因：
     *   1. React 元素同一实例不能同时挂载到两个父节点——两处渲染会导致
     *      会话重复挂载、输入状态与滚动位置互相踩踏；
     *   2. 用户诉求是「把软件本身的会话窗口嵌入到项目中」，
     *      中栏才是项目的正文区；右侧抽屉只作为「分屏对照」的次要入口。
     *
     * 因此这里的 chatBody 只保留空态提示；真正会话节点由 middlePane 承载。
     * `rdw-chat-slot` 仍然存在，保证宿主结构约定（aside 常驻）不被破坏。
     */
    const chatBody = h(
      'div',
      { className: 'rdw-chat-slot' },
      h(
        'div',
        { style: { ...STYLES.muted, padding: '12px', lineHeight: 1.7 } },
        conversationNode
          ? WELCOME_COPY.chatInlineHint
          : hostService
            ? WELCOME_COPY.chatIdleBody
            : WELCOME_COPY.chatUnavailable,
        conversationNode
          ? null
          : hostService && !sessionBound
            ? h(
                'div',
                { style: { marginTop: 8 } },
                h('button', { type: 'button', style: STYLES.primaryButton, disabled: !canStartChat, onClick: startChat }, WELCOME_COPY.chatStart),
                h('div', { style: { ...STYLES.muted, marginTop: 4 } }, WELCOME_COPY.chatStartHint),
              )
            : null,
      ),
    )

    const chatNode = h(
      'aside',
      {
        className: chatOpen ? 'rdw-chat' : 'rdw-chat rdw-chat-collapsed',
        'data-dsh-no-drag': '',
        'aria-label': WELCOME_COPY.chatTitle,
      },
      h(
        'div',
        { className: 'rdw-chat-head' },
        h('span', null, `🧠 ${WELCOME_COPY.chatTitle}`),
        h('span', { style: { ...STYLES.muted, fontWeight: 400 } }, sessionBound ? '已关联本工作台' : '未关联'),
        h(
          'button',
          { type: 'button', style: { ...STYLES.button, marginLeft: 'auto' }, onClick: () => setChatOpen(false) },
          WELCOME_COPY.chatClose,
        ),
      ),
      chatBody,
    )

    const footer = h(
      'div',
      { style: STYLES.footer },
      h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        h('span', {
          style: {
            width: 7,
            height: 7,
            borderRadius: 'var(--rdw-r-pill)',
            flex: '0 0 auto',
            background: loading || contentLoading
              ? 'var(--rdw-st-provisional)'
              : busy
                ? 'var(--rdw-st-provisional)'
                : error
                  ? 'var(--rdw-st-rejected)'
                  : 'var(--rdw-st-accepted)',
          },
        }),
        loading || contentLoading ? '加载中…' : busy ? `执行中：${busyLabel}` : error ? '出错' : '空闲',
      ),
      h('span', null, `项目：${rootPath || '未选择'}`),
      run && run.status ? h('span', null, `最近运行：${run.action || '—'} · ${run.status}`) : null,
    )

    /**
     * 整页框架（业务优先）。
     * 规范 4.1/4.2/4.3：
     *   - 业务区占满整个工作台，会话区按需在右侧（窄容器改上下）；
     *   - 无会话时不创建会话，业务页本身完整可用；
     *   - 断点绑在业务容器宽度上（container query），不是窗口。
     */
    return h(
      'div',
      {
        ref: shellRef,
        className: 'rdw-shell',
        style: {
          fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          // 对话区宽度跟着业务容器宽度走（容器查询之外再兜一层，避免首帧跳变）。
          '--rdw-chat-width': shellWidth >= 1180 ? '440px' : shellWidth >= 900 ? '380px' : '320px',
        },
      },
      h('style', { key: 'rdw-theme-css' }, RDW_THEME_CSS),
      h('style', { key: 'rdw-skeleton-css' }, RDW_SKELETON_CSS),
      h('style', { key: 'rdw-shell-css' }, SHELL_CSS),
      /* v4 命令栏：品牌 + 面包屑 + 全局搜索 + 状态指示器。
       * 首用引导 / 无项目时不渲染（此时没有可导航的上下文）。 */
      project
        ? h(
            'header',
            { key: 'rdw-cmdbar-host', 'data-dsh-workbench-toolbar': '' },
            renderCommandBar(h, {
              project,
              fishbone,
              selectedModule,
              selectedRib,
              attention: fishbone && Array.isArray(fishbone.attention) ? fishbone.attention : [],
              totals: fishbone && fishbone.totals ? fishbone.totals : {},
              busy,
              onOpenPalette: () => {
                setPaletteQuery('')
                setPaletteOpen(true)
              },
              onOpenSlide: (tab) => setSlideTab(tab || 'agent'),
              onFocusAttn: () => setSlideTab('agent'),
              onSelectModule: (moduleId) => openModuleWorkspace(moduleId),
              onSelectRib: selectRib,
              onBackToHub: () => setView('hub'),
              // 对话入口：与旧工具栏同语义（按需打开，不自动建会话）。
              // 宿主没有会话能力时不显示——避免死按钮。
              chatOpen,
              chatAvailable: Boolean(hostService) || chatOpen,
              onToggleChat: () => {
                if (chatOpen) {
                  setChatOpen(false)
                  return
                }
                setChatOpen(true)
              },
            }),
          )
        : null,
      /* 首用 / 无项目时仍保留原紧凑工具栏（承载加载项目、新建等入口）。 */
      project
        ? null
        : h(
            'header',
            { className: 'rdw-toolbar', 'data-dsh-workbench-toolbar': '' },
            renderHeader(h, {
              health,
              project,
              view,
              setView,
              busy,
              busyLabel,
              contentAvailable,
              fishboneAvailable,
              chatOpen,
              canStartChat,
              scope: '',
              onToggleChat: () => {
                if (chatOpen) {
                  setChatOpen(false)
                  return
                }
                setChatOpen(true)
              },
            }),
          ),
      h(
        'div',
        { className: 'rdw-body' },
        h(
          'div',
          { className: 'rdw-business' },
          /* v4：有项目且处于鱼骨视图时，业务区改为「三栏舞台 + 底部全景抽屉」的
           * 单页结构——左导航/中工作区/右结果常驻同屏，全景图收进可收起抽屉。
           * 其他视图（hub / 会话 / 首用）沿用原滚动容器。 */
          project && view === 'fishbone' && !sessionView
            ? h(
                'div',
                {
                  /* 三栏舞台的包裹层。
                   * 必须显式 width:'100%' + minWidth:0：
                   * 列向 flex 容器里，子项默认按 max-content 计算交叉轴宽度，
                   * 若不锁死，stage 的 grid 会收缩成"内容宽度"，
                   * 右侧因此留出大片空白（实测 1680 视口只用了 1232）。 */
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '1 1 auto',
                    width: '100%',
                    minWidth: 0,
                    minHeight: 0,
                  },
                },
                h(
                  'div',
                  { className: 'rdw-stage', 'data-dsh-no-drag': '' },
                  fishboneStageNode,
                ),
                drawerNode,
              )
            : h(
                'div',
                { className: 'rdw-business-scroll' },
                showHostUpgradeNotice ? h('div', { style: STYLES.noticeBanner }, HOST_UPGRADE_NOTICE) : null,
                error ? h('div', { style: STYLES.errorBanner }, `错误：${error}`) : null,
                viewNode,
              ),
          /* 页脚曾经放在这里 —— 但 .rdw-body 是 row 容器，
           * 页脚会被横排到业务区右侧，吃掉 ~448px 宽度（实测 1680 视口只剩 1232）。
           * 现已移到 .rdw-body 之后，作为 .rdw-shell 的纵向子项。 */
        ),
        chatNode,
      ),
      /* 页脚：必须作为 .rdw-shell（纵向 flex）的子项，排在 .rdw-body 之后，
       * 才会横跨整个宽度贴在底部。放进 row 容器会被挤成右侧一列。 */
      h('div', { className: 'rdw-foot' }, footer),
      paletteNode,
      slideNode,
      renderReasonDialog(h, {
        dialog,
        reason,
        setReason,
        onConfirm: confirmDialog,
        onCancel: cancelDialog,
        busy,
      }),
      renderCreateDialog(h, {
        create: createDialog,
        busy,
        onField: changeCreateField,
        onConfirm: submitCreate,
        onCancel: () => setCreateDialog(null),
      }),
      renderIdeaDialog(h, {
        dialog: ideaDialog,
        busy: busy === 'bridge:idea',
        onChange: (name, value) => {
          setIdeaDialog((previous) => {
            if (!previous) return previous
            return Object.assign({}, previous, { [name]: value, error: '' })
          })
        },
        onConfirm: submitIdea,
        onCancel: () => setIdeaDialog(null),
      }),
      renderSproutDialog(h, {
        dialog: sproutDialog,
        spine: fishbone && Array.isArray(fishbone.spine) ? fishbone.spine : [],
        // v3.2：可选父刺（鱼刺之间也能分叉）
        parents:
          fishbone && Array.isArray(fishbone.ribs)
            ? fishbone.ribs.map((rib) => ({ id: rib.id, name: rib.name, module: rib.module, dir: rib.dir }))
            : [],
        busy: busy === 'sprout',
        onField: changeSproutField,
        onConfirm: submitSprout,
        onCancel: () => setSproutDialog(null),
      }),
      // 文件预览弹窗挂在面板级（鱼骨页与内容页共用；工作区会话已改为整页视图）
      fishboneAvailable || sessionView
        ? renderFileModal(h, fileModal, closeFileModal, openExternal, openSidebar)
        : null,
      // v3.2 鱼刺通讯输入弹窗
      ribMessage
        ? h(
            'div',
            { style: STYLES.overlay, role: 'presentation' },
            h(
              'div',
              { style: STYLES.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': '给其他鱼刺发消息' },
              h('strong', { style: { fontSize: 14 } }, `✉ 投递给 ${ribMessage.target.name || ribMessage.target.id}`),
              h(
                'div',
                { style: { ...STYLES.muted, margin: '4px 0 8px' } },
                `收信方 ${ribMessage.target.id} 的智能体开工时会读到这条消息（写入它的 work/INBOX.md）。`,
              ),
              h('textarea', {
                value: ribMessage.text,
                placeholder: '例如：你那边的截尾敏感性分析出结果了吗？我需要它来决定主分析的权重方案。',
                style: { ...STYLES.textarea, minHeight: 90 },
                'aria-label': '消息内容',
                onChange: (event) =>
                  setRibMessage((prev) => (prev ? Object.assign({}, prev, { text: event && event.target ? event.target.value : '' }) : prev)),
              }),
              h(
                'div',
                { style: { ...STYLES.row, justifyContent: 'flex-end', gap: 8, marginTop: 10 } },
                h('button', { type: 'button', style: STYLES.button, onClick: () => setRibMessage(null) }, '取消'),
                h(
                  'button',
                  {
                    type: 'button',
                    style: STYLES.primaryButton,
                    disabled: !String(ribMessage.text || '').trim() || busy === 'message',
                    onClick: () => sendRibMessage(ribMessage.target, ribMessage.text),
                  },
                  busy === 'message' ? '投递中…' : '投递消息',
                ),
              ),
            ),
          )
        : null,
      renderGraftDialog(h, {
        dialog: graftDialog,
        busy: busy === 'graft',
        onField: (name, value) => {
          setGraftDialog((previous) => (previous ? Object.assign({}, previous, { [name]: value, error: '' }) : previous))
        },
        onConfirm: submitGraft,
        onCancel: () => setGraftDialog(null),
      }),
      // 导入项目弹窗
      importDialog
        ? h(
            'div',
            { style: STYLES.overlay, role: 'presentation', onClick: () => setImportDialog(null) },
            h(
              'div',
              {
                style: STYLES.dialog,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '导入已有研究项目',
                onClick: (e) => e && e.stopPropagation && e.stopPropagation(),
              },
              h('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--rdw-text)' } }, '📁 导入已有本地研究项目'),
              h('div', { style: { ...STYLES.muted, lineHeight: 1.6, marginBottom: 12 } }, '输入本地已存在的 DAG 研究项目绝对路径（含 control/ledger.json），工作台会将其登记到总控看板并切换：'),
              h('input', {
                autoFocus: true,
                value: typeof importDialog.path === 'string' ? importDialog.path : '',
                placeholder: '输入绝对目录，如 D:/Research/MyTrial 或 /Users/...',
                'aria-label': '项目绝对路径',
                onChange: (e) => {
                  const val = e && e.target ? e.target.value : ''
                  setImportDialog((prev) => Object.assign({}, prev || {}, { path: val, error: '' }))
                },
                style: { ...STYLES.input, width: '100%', marginBottom: 10 },
              }),
              importDialog.error ? h('div', { style: { ...STYLES.errorBanner, marginBottom: 10 } }, importDialog.error) : null,
              h(
                'div',
                { style: { ...STYLES.row, justifyContent: 'flex-end', gap: 8 } },
                h('button', { type: 'button', style: STYLES.button, onClick: () => setImportDialog(null) }, '取消'),
                h(
                  'button',
                  {
                    type: 'button',
                    style: STYLES.primaryButton,
                    onClick: async () => {
                      const target = String(importDialog.path || '').trim()
                      if (!target) {
                        setImportDialog((prev) => Object.assign({}, prev || {}, { error: '请输入有效的绝对路径' }))
                        return
                      }
                      await importProjectSubmit(target)
                    },
                  },
                  '导入并进入项目',
                ),
              ),
            ),
          )
        : null,
      // 轻提示：居中底部胶囊，pointer-events:none 不挡点击
      renderToast(h, {
        message: toast,
        tone: error ? 'danger' : 'ok',
        show: Boolean(toast) || Boolean(error),
      }),
      error ? h('div', { style: STYLES.errorBanner }, `错误：${error}`) : null,
      /* v3.5 交互层：右键菜单 / 速览卡 / 内联分叉 / 回收站（挂在面板级，覆盖整个工作台） */
      renderContextMenu(h, ctxMenu, () => setCtxMenu(null)),
      renderHoverCard(h, hoverCard, () => setHoverCard(null)),
      renderInlineSprout(
        h,
        inlineSprout,
        (value) => setInlineSprout((prev) => (prev ? Object.assign({}, prev, { name: value, error: '' }) : prev)),
        submitInlineSprout,
        () => setInlineSprout(null),
      ),
      /* v3.6 会话选中文本 → 消息分叉浮动条 */
      msgSprout
        ? h(
            'div',
            {
              className: 'rdw-inline-sprout',
              style: {
                left: Math.min(msgSprout.x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 220),
                top: msgSprout.y,
              },
              role: 'dialog',
              'aria-label': '以选中内容分叉',
              'data-dsh-no-drag': '',
            },
            h('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--rdw-organic-ink)' } }, '🌱 对话选区自动分叉'),
            h('div', {
              style: {
                fontSize: 11.5, color: 'var(--rdw-organic-ink-2)', maxWidth: 220, maxHeight: 60, overflow: 'hidden',
                lineHeight: 1.4, marginBottom: 7, padding: '4px 7px', background: 'var(--rdw-fill-quat)', borderRadius: 'var(--rdw-r-pebble-sm)',
              },
            }, `"${String(msgSprout.excerpt).slice(0, 80)}${msgSprout.excerpt.length > 80 ? '…' : ''}"`),
            h('div', { className: 'row', style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
              h('button', {
                type: 'button',
                className: 'solid',
                style: { background: 'var(--rdw-soil)', color: '#faf6f1', fontWeight: 600 },
                title: '自动生成合规序号并直接创建新鱼刺',
                onClick: () => {
                  autoSproutFromMessage(msgSprout.excerpt)
                  setMsgSprout(null)
                },
              }, '⚡ 自动创建鱼刺'),
              h('button', {
                type: 'button',
                title: '打开命名弹窗自定义鱼刺名称',
                onClick: () => {
                  sproutFromMessage({ excerpt: msgSprout.excerpt, x: msgSprout.x, y: msgSprout.y })
                  setMsgSprout(null)
                },
              }, '自定义…'),
              h('button', { type: 'button', onClick: () => setMsgSprout(null) }, '取消'),
            ),
          )
        : null,
      /* 回收站弹层 */
      recycleOpen
        ? h(
            'div',
            { className: 'rdw-ctxmask', role: 'presentation', onClick: () => setRecycleOpen(false) },
            h(
              'div',
              {
                className: 'rdw-ctxmenu',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '回收站',
                style: { left: '50%', top: '18%', transform: 'translateX(-50%)', minWidth: 380, maxWidth: 480, padding: '12px 14px' },
                onClick: (e) => e.stopPropagation(),
              },
              h('div', { style: { fontSize: 14, fontWeight: 700, color: 'var(--rdw-organic-ink)', marginBottom: 4 } }, '🗑 回收站'),
              h('div', { style: { fontSize: 11.5, color: 'var(--rdw-organic-ink-3)', marginBottom: 10 } }, '软删的鱼刺保留 30 天，可还原；到期自动彻底清除。'),
              (fishbone && Array.isArray(fishbone.recycleBin) ? fishbone.recycleBin : []).length === 0
                ? h('div', { style: { fontSize: 12, color: 'var(--rdw-organic-ink-3)', padding: '14px 0', textAlign: 'center' } }, '回收站是空的')
                : h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 300, overflowY: 'auto' } },
                    ...(fishbone.recycleBin || []).map((entry) =>
                      h(
                        'div',
                        {
                          key: entry.rib.id,
                          style: {
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                            border: '1px solid var(--rdw-warm-line-2)', borderRadius: 'var(--rdw-r-pebble-sm)',
                            background: 'var(--rdw-organic-surface)',
                          },
                        },
                        h('span', { style: { fontFamily: 'var(--rdw-font-mono)', fontSize: 11, color: 'var(--rdw-organic-ink-3)' } }, entry.rib.id),
                        h('span', { style: { flex: 1, minWidth: 0, fontSize: 12, color: 'var(--rdw-organic-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, entry.rib.name),
                        h('span', { style: { fontSize: 11, color: 'var(--rdw-organic-ink-3)', flex: '0 0 auto' } }, entry.deletedAt ? new Date(entry.deletedAt).toLocaleDateString() : ''),
                        h('button', {
                          type: 'button',
                          style: { padding: '2px 9px', fontSize: 11, borderRadius: 'var(--rdw-r-pebble-sm)', border: '1px solid var(--rdw-warm-line)', background: 'var(--rdw-organic-input)', color: 'var(--rdw-sage)', cursor: 'pointer' },
                          onClick: async () => {
                            const r = await ribOp('restore', entry.rib.id)
                            if (r) { setToast(`已还原 ${entry.rib.id}`); pushUndo(`还原 ${entry.rib.id}`, { op: 'delete', ribId: entry.rib.id }) }
                          },
                        }, '还原'),
                        h('button', {
                          type: 'button',
                          style: { padding: '2px 9px', fontSize: 11, borderRadius: 'var(--rdw-r-pebble-sm)', border: 'none', background: 'color-mix(in srgb,var(--rdw-st-rejected) 14%,transparent)', color: 'var(--rdw-st-rejected)', cursor: 'pointer' },
                          onClick: async () => {
                            if (typeof window !== 'undefined' && window.confirm && !window.confirm(`彻底删除 ${entry.rib.id}？此操作不可撤销。`)) return
                            await ribOp('purge', entry.rib.id, { confirm: true })
                          },
                        }, '彻底删除'),
                      ),
                    ),
                  ),
            ),
          )
        : null,
      /* 快捷键速查卡 */
      shortcutsOpen
        ? h(
            'div',
            { className: 'rdw-ctxmask', role: 'presentation', onClick: () => setShortcutsOpen(false) },
            h(
              'div',
              {
                className: 'rdw-ctxmenu',
                role: 'dialog',
                'aria-label': '快捷键',
                style: { left: '50%', top: '16%', transform: 'translateX(-50%)', minWidth: 340, padding: '13px 16px' },
                onClick: (e) => e.stopPropagation(),
              },
              h('div', { style: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--rdw-organic-ink)' } }, '⌨ 鱼骨画布快捷键'),
              ...[
                ['N', '在选中阶段下分新刺'],
                ['Del', '删除选中鱼刺到回收站'],
                ['⌘/Ctrl + Z', '撤销'],
                ['⇧⌘/Ctrl + Z 或 ⌘Y', '重做'],
                ['?', '打开本速查卡'],
                ['右键任意对象', '打开该对象的完整操作菜单'],
                ['悬停鱼刺 0.4s', '速览卡（含回连/删除直操）'],
                ['悬停选中阶段的刺身', '出现幻影刺，单击 = 闪电分叉'],
                ['选中会话里的一段文字', '浮出「以选中内容分叉」'],
                ['Esc', '关闭本卡'],
              ].map(([kbd, desc]) =>
                h('div', { key: kbd, style: { display: 'flex', gap: 10, padding: '3px 0', fontSize: 12 } },
                  h('span', { style: { fontFamily: 'var(--rdw-font-mono)', color: 'var(--rdw-sage)', minWidth: 110, fontWeight: 600 } }, kbd),
                  h('span', { style: { color: 'var(--rdw-organic-ink-2)' } }, desc),
                ),
              ),
            ),
          )
        : null,
    )
  }
}
