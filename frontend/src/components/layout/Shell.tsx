import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { Tab } from '../../types'

export function Shell() {
  const [activeTab,     setActiveTab]     = useState<Tab>('overview')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(true)

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950
      text-slate-900 dark:text-slate-100 overflow-hidden">

      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMenuToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="flex flex-1 overflow-hidden pt-14">
        <Sidebar
          open={sidebarOpen}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />

        {/* Main content — shifts right when sidebar is open */}
        <main className={`
          flex-1 overflow-auto transition-[margin] duration-200 ease-in-out
          ${sidebarOpen ? 'ml-72' : 'ml-0'}
        `}>
          <TabContent activeTab={activeTab} selectedModel={selectedModel} />
        </main>
      </div>
    </div>
  )
}

/* ─── Tab placeholder content ─── */

const TAB_PLACEHOLDERS: Record<Tab, { icon: string; title: string; subtitle: string }> = {
  overview: {
    icon:     '📊',
    title:    'Overview',
    subtitle: 'Platform health summary — coming in Phase 2',
  },
  lineage: {
    icon:     '🕸️',
    title:    'Lineage Graph',
    subtitle: 'Interactive DAG visualization — coming in Phase 3',
  },
  findings: {
    icon:     '🔍',
    title:    'Findings',
    subtitle: 'Audit findings and risk analysis — coming in Phase 4',
  },
  models: {
    icon:     '🗂️',
    title:    'Model Catalog',
    subtitle: 'Full model browser — coming in Phase 5',
  },
}

function TabContent({
  activeTab,
  selectedModel,
}: {
  activeTab: Tab
  selectedModel: string | null
}) {
  const { icon, title, subtitle } = TAB_PLACEHOLDERS[activeTab]

  return (
    <div className="flex flex-col items-center justify-center h-full
      text-slate-400 dark:text-slate-600 select-none">
      <span className="text-5xl mb-4" role="img" aria-label={title}>{icon}</span>
      <h2 className="text-xl font-semibold mb-1 text-slate-600 dark:text-slate-400">{title}</h2>
      <p className="text-sm">{subtitle}</p>

      {selectedModel && (
        <div className="mt-6 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400">
          Selected model: <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{selectedModel}</span>
        </div>
      )}
    </div>
  )
}
