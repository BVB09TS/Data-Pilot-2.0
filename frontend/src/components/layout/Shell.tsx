import React, { useEffect, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { OverviewTab } from '../overview/OverviewTab'
import { IntegrationsTab } from '../integrations/IntegrationsTab'
import { LineageTab } from '../lineage/LineageTab'
import { FindingsTab } from '../findings/FindingsTab'
import type { ModelsData, Tab } from '../../types'

export function Shell() {
  const [activeTab,     setActiveTab]     = useState<Tab>('overview')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(true)
  const [totalModels,   setTotalModels]   = useState(0)

  // Single fetch for total model count — shared with OverviewTab stat card
  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then((data: ModelsData) => setTotalModels(Object.values(data).flat().length))
      .catch(() => {})
  }, [])

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
          onSelectModel={model => { setSelectedModel(model); setActiveTab('models') }}
        />

        <main className={`
          flex-1 overflow-hidden
          transition-[margin] duration-200 ease-in-out
          ${sidebarOpen ? 'ml-72' : 'ml-0'}
        `}>
          <TabContent
            activeTab={activeTab}
            totalModels={totalModels}
            selectedModel={selectedModel}
          />
        </main>
      </div>
    </div>
  )
}

/* ─── Tab content router ─── */

function TabContent({
  activeTab,
  totalModels,
  selectedModel,
}: {
  activeTab: Tab
  totalModels: number
  selectedModel: string | null
}) {
  switch (activeTab) {
    case 'overview':
      return <OverviewTab totalModels={totalModels} />

    case 'integrations':
      return <IntegrationsTab />

    case 'lineage':
      return <LineageTab />

    case 'findings':
      return <FindingsTab />

    case 'models':
      return (
        <Placeholder icon="🗂️" title="Model Catalog"
          sub="Full model browser with SQL viewer — Phase 5"
          detail={selectedModel
            ? <span>Selected: <code className="font-mono text-blue-600 dark:text-blue-400">{selectedModel}</code></span>
            : undefined}
        />
      )
  }
}

function Placeholder({
  icon, title, sub, detail,
}: {
  icon: string
  title: string
  sub: string
  detail?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full
      text-slate-400 dark:text-slate-600 select-none gap-2">
      <span className="text-5xl mb-2" role="img" aria-label={title}>{icon}</span>
      <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-400">{title}</h2>
      <p className="text-sm">{sub}</p>
      {detail && (
        <div className="mt-4 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400">
          {detail}
        </div>
      )}
    </div>
  )
}
