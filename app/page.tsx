'use client'

import React, { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import MetricGrid from '@/components/dashboard/MetricGrid'
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard'
import ErrorBanner from '@/components/dashboard/ErrorBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useTransactions } from '@/hooks/useTransactions'
import { Card, CardContent } from '@/components/ui/card'
import SpendingByCategory from '@/components/charts/SpendingByCategory'
import MonthlyTrend from '@/components/charts/MonthlyTrend'
import GoalsProgress from '@/components/charts/GoalsProgress'
import TransactionForm from '@/components/transactions/TransactionForm'
import TransactionList from '@/components/transactions/TransactionList'
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
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)
  const { data, error, isLoading, mutate } = useDashboardData()
  const { addTransaction, isSubmitting: isTxSubmitting } = useTransactions()

  const renderDashboardView = () => {
    const hasError = !!error

    // State 3 (part A): error + NO data (first load failed) -> show ErrorBanner only
    if (hasError && !data) {
      return <ErrorBanner message={error.message} onRetry={mutate} />
    }

    // State 1: loading + no data -> show skeletons
    if (isLoading || !data) {
      return (
        <div className="space-y-6">
          <SafeToSpendCard loading={true} />
          <MetricGrid loading={true} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="font-sans font-medium text-sm text-white mb-2">Monthly Cash Flow Trend</h4>
                  <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-[140px] w-full bg-white/5" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="font-sans font-medium text-sm text-white mb-2">Accounts & Balances</h4>
                  <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full bg-white/5" />
                  <Skeleton className="h-10 w-full bg-white/5" />
                  <Skeleton className="h-10 w-full bg-white/5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="font-sans font-medium text-sm text-white mb-2">Spending by Category</h4>
                  <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-[180px] w-full bg-white/5" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 h-[320px] flex flex-col justify-between">
                <div>
                  <h4 className="font-sans font-medium text-sm text-white mb-2">Goals Progress</h4>
                  <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-[180px] w-full bg-white/5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table skeleton */}
          <Card className="bg-card border-white/10 overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-4 w-36 bg-white/5" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    // State 2: data + no error -> normal dashboard
    // State 3 (part B): error + stale data -> ErrorBanner on top + stale data visible below
    return (
      <div className="space-y-6">
        {hasError && (
          <ErrorBanner message={error.message} onRetry={mutate} />
        )}

        {/* Top Prominent Safe To Spend */}
        <SafeToSpendCard 
          safeToSpend={data.metrics.safeToSpend} 
          daysLeft={data.metrics.daysLeftInMonth} 
          loading={false}
        />

        {/* 4-Column Grid of Metrics */}
        <MetricGrid 
          data={data.metrics} 
          trend={data.monthlyTrend} 
          accounts={data.accountBalances}
          loading={false}
        />

        {/* Row 1: Trend Line Chart & Accounts balances */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow Line Chart */}
          <Card className="lg:col-span-2 bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-sans font-medium text-sm text-white">Monthly Cash Flow Trend</h4>
                  <span className="text-[10px] text-gray-500 font-mono">Live</span>
                </div>
                <p className="text-xs text-gray-500">Income vs expenses trend over time</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <MonthlyTrend data={data.monthlyTrend} />
              </div>
            </CardContent>
          </Card>

          {/* Accounts & Assets Sidebar */}
          <Card className="bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-sans font-medium text-sm text-white">Accounts & Balances</h4>
                  <span className="text-[10px] text-brand-income bg-brand-income/10 px-2 py-0.5 rounded font-mono border border-brand-income/20">Active</span>
                </div>
                <p className="text-xs text-gray-500">Breakdown of current asset allocations</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 mt-4 pr-1">
                {data.accountBalances.map((acc, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all">
                    <span className="text-xs font-medium text-gray-300">{acc.name}</span>
                    <span className="text-xs font-mono font-semibold text-brand-income">
                      {acc.balance >= 0 ? '+' : ''}৳{acc.balance.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Category Bar Chart & Savings Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending by Category Card */}
          <Card className="bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-sans font-medium text-sm text-white">Spending by Category</h4>
                  <span className="text-[10px] text-gray-500 font-mono">Current Month</span>
                </div>
                <p className="text-xs text-gray-500">Distribution of expenses across categories</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <SpendingByCategory data={data.spendingByCategory} />
              </div>
            </CardContent>
          </Card>

          {/* Goals Progress Card */}
          <Card className="bg-card border-white/10 overflow-hidden relative group">
            <CardContent className="p-6 h-[320px] flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-sans font-medium text-sm text-white">Goals Progress</h4>
                  <span className="text-[10px] text-gray-500 font-mono">Active Savings</span>
                </div>
                <p className="text-xs text-gray-500">Percent completion towards target milestones</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <GoalsProgress data={data.goals} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Recent Transactions Summary List */}
        <TransactionList 
          transactions={data.recentTransactions} 
          title="Recent Transactions"
        />
      </div>
    )
  }

  const renderTransactionsView = () => {
    const hasError = !!error
    const hasData = !!data

    if (isLoading || !data) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-24 bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-12 w-full bg-white/5" />
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-36 bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (hasError && !hasData) {
      return <ErrorBanner message={error.message} onRetry={mutate} />
    }

    return (
      <div className="space-y-6">
        {hasError && (
          <ErrorBanner message={error.message} onRetry={mutate} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TransactionForm 
              onSubmit={async (tx) => { await addTransaction(tx) }}
              isSubmitting={isTxSubmitting}
              accounts={data.accountBalances}
            />
          </div>
          <div className="lg:col-span-2">
            <TransactionList 
              transactions={data.recentTransactions} 
              title="Transaction Ledger"
            />
          </div>
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
          
          {activeView === 'transactions' && renderTransactionsView()}

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
