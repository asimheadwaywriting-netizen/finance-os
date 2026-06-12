'use client'

import React, { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import MetricGrid from '@/components/dashboard/MetricGrid'
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard'
import ErrorBanner from '@/components/dashboard/ErrorBanner'
import type { DashboardData } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { MessageSquare, Sparkles } from 'lucide-react'

export default function Home() {
  const [activeView, setActiveView] = useState<string>('dashboard')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard')
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("503: Service Unavailable. The backend integration (n8n Webhook) is not connected.")
        }
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`)
      }
      const jsonData: DashboardData = await response.json()
      setData(jsonData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const renderDashboardView = () => {
    if (error) {
      return <ErrorBanner message={error} onRetry={fetchData} />
    }

    return (
      <div className="space-y-6">
        {/* Top Prominent Safe To Spend */}
        <SafeToSpendCard 
          safeToSpend={data?.metrics.safeToSpend} 
          daysLeft={data?.metrics.daysLeftInMonth} 
          loading={loading}
        />

        {/* 4-Column Grid of Metrics */}
        <MetricGrid 
          data={data?.metrics} 
          trend={data?.monthlyTrend} 
          accounts={data?.accountBalances}
          loading={loading}
        />

        {/* Structured Grid Placeholders for Next Milestones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts Placeholder Block */}
          <Card className="lg:col-span-2 bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-sans font-medium text-sm text-white">Monthly Cash Flow Trend</h4>
                  <span className="text-[10px] text-brand-income bg-brand-income/10 px-2 py-0.5 rounded font-mono border border-brand-income/20">Milestone 4</span>
                </div>
                <p className="text-xs text-gray-500">Visualization of monthly income vs expenses</p>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-[140px] w-full bg-white/5" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-6 border border-dashed border-white/5 rounded-lg bg-white/[0.01]">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-gray-400 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-brand-income" />
                  </div>
                  <h5 className="text-sm font-medium text-white mb-1">Visualizing Trends</h5>
                  <p className="text-xs text-gray-500 max-w-sm">Recharts component showing monthly trends will render here in Milestone 4.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accounts & Assets Sidebar Placeholder */}
          <Card className="bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-sans font-medium text-sm text-white">Accounts & Balances</h4>
                  <span className="text-[10px] text-brand-income bg-brand-income/10 px-2 py-0.5 rounded font-mono border border-brand-income/20">Milestone 8</span>
                </div>
                <p className="text-xs text-gray-500">Breakdown of current asset allocations</p>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full bg-white/5" />
                  <Skeleton className="h-10 w-full bg-white/5" />
                  <Skeleton className="h-10 w-full bg-white/5" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 mt-4">
                  {data?.accountBalances.map((acc, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded bg-white/5 border border-white/5">
                      <span className="text-xs font-medium text-gray-300">{acc.name}</span>
                      <span className="text-xs font-mono font-semibold text-brand-income">
                        {acc.balance >= 0 ? '+' : ''}৳{acc.balance.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderPlaceholderView = (title: string, description: string, milestone: string) => {
    return (
      <Card className="bg-card border-white/10 p-8 text-center max-w-2xl mx-auto my-12 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-brand-income/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 rounded-full bg-brand-income/10 flex items-center justify-center mb-4 border border-brand-income/20 text-brand-income">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-[10px] text-brand-income bg-brand-income/10 px-2.5 py-0.5 rounded-full font-mono border border-brand-income/20 mb-3">{milestone}</span>
          <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
          <p className="text-xs text-gray-500 max-w-md leading-relaxed">{description}</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <AppShell 
        activeView={activeView} 
        onViewChange={setActiveView}
        onOpenChat={() => setIsChatOpen(true)}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-tight text-white capitalize">{activeView}</h2>
            <div className="text-[10px] font-mono text-gray-500">
              Last Synced: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {activeView === 'dashboard' && renderDashboardView()}
          
          {activeView === 'transactions' && renderPlaceholderView(
            "Transactions Ledger",
            "A full ledger of recent transactions and an interactive form to log income/expenses directly to Google Sheets with optimistic state rollbacks will be implemented in Milestone 5.",
            "Milestone 5"
          )}

          {activeView === 'goals' && renderPlaceholderView(
            "Savings Goals Progress",
            "Aggregated savings goals tracking with visual progress gauges and priority alerts will be implemented in Milestone 8.",
            "Milestone 8"
          )}

          {activeView === 'assets' && renderPlaceholderView(
            "Assets Maturity Tracker",
            "Maturity tracker highlighting days left on fixed deposits and DPS investments with risk/warning notifications will be implemented in Milestone 8.",
            "Milestone 8"
          )}
        </div>
      </AppShell>

      {/* AI Assistant Sheet Drawer Shell */}
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent className="bg-card border-l border-white/10 text-gray-100 p-0 flex flex-col h-full w-full sm:max-w-md">
          <SheetHeader className="p-6 border-b border-white/10">
            <SheetTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-brand-income" />
              <span>AI Assistant</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              Ask questions about your budget or tell the AI to log transactions.
            </SheetDescription>
          </SheetHeader>

          {/* Mock Chat Panel Content */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              {/* Canned AI Welcome Message */}
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-brand-income/10 border border-brand-income/20 flex items-center justify-center flex-shrink-0 text-brand-income">
                  <span className="font-mono text-xs font-bold">AI</span>
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 text-xs text-gray-300 leading-relaxed">
                  {"Hi Asim! I'm your Finance OS Assistant. In Milestone 6, I'll be connected to OpenAI to answer budget queries and automatically log transactions."}
                </div>
              </div>
            </div>

            {/* Mock Chat Input */}
            <div className="mt-6">
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  disabled
                  placeholder="Chat with AI... (Coming in Milestone 6)" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-gray-400 focus:outline-none focus:border-brand-income/50 pr-10 cursor-not-allowed"
                />
                <button 
                  disabled
                  className="absolute right-2 p-1.5 rounded-lg bg-brand-income/25 text-white/50 cursor-not-allowed"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
