import { useEffect, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { HomePage } from '../home/HomePage'
import { OverviewTab } from '../overview/OverviewTab'
import { IntegrationsTab } from '../integrations/IntegrationsTab'
import { LineageTab } from '../lineage/LineageTab'
import { FindingsTab } from '../findings/FindingsTab'
import { ModelsTab } from '../models/ModelsTab'
import { SettingsPage } from '../settings/SettingsPage'
import type { ModelsData, Tab } from '../../types'

export function Shell() {
  const [activeTab,     setActiveTab]     = useState<Tab>('home')
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
            onNavigate={setActiveTab}
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
  onNavigate,
}: {
  activeTab:  Tab
  totalModels: number
  selectedModel: string | null
  onNavigate: (tab: Tab) => void
}) {
  switch (activeTab) {
    case 'home':
      return <HomePage totalModels={totalModels} onNavigate={onNavigate} />

    case 'overview':
      return <OverviewTab totalModels={totalModels} />

    case 'integrations':
      return <IntegrationsTab />

    case 'settings':
      return <SettingsPage />

    case 'lineage':
      return <LineageTab />

    case 'findings':
      return <FindingsTab />

    case 'models':
      return <ModelsTab initialModel={selectedModel} />
  }
}

