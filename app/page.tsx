'use client'

import React, { useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import MetricGrid from '@/components/dashboard/MetricGrid'
import SafeToSpendCard from '@/components/dashboard/SafeToSpendCard'
import ErrorBanner from '@/components/dashboard/ErrorBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useTransactions } from '@/hooks/useTransactions'
import { useGoals } from '@/hooks/useGoals'
import { useAssets } from '@/hooks/useAssets'
import { useCategories } from '@/hooks/useCategories'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import SpendingByCategory from '@/components/charts/SpendingByCategory'
import MonthlyTrend from '@/components/charts/MonthlyTrend'
import GoalsProgress from '@/components/charts/GoalsProgress'
import TransactionForm from '@/components/transactions/TransactionForm'
import TransactionList from '@/components/transactions/TransactionList'
import GoalForm from '@/components/goals/GoalForm'
import AssetForm from '@/components/assets/AssetForm'
import CategoryForm from '@/components/categories/CategoryForm'
import { Skeleton } from '@/components/ui/skeleton'
import ChatPanel from '@/components/chat/ChatPanel'
import AccountBalances from '@/components/accounts/AccountBalances'
import AssetMaturityTracker from '@/components/assets/AssetMaturityTracker'
import { CATEGORY_COLORS } from '@/lib/constants'
import { cn, formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

export default function Home() {
  const [activeView, setActiveView] = useState<string>('dashboard')
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  const { data, error, isLoading, mutate } = useDashboardData()
  const { addTransaction, removeTransaction, isSubmitting: isTxSubmitting } = useTransactions()
  const { addGoal, removeGoal, isSubmitting: isGoalSubmitting } = useGoals()
  const { addAsset, removeAsset, isSubmitting: isAssetSubmitting } = useAssets()
  const { addCategory, isSubmitting: isCategorySubmitting } = useCategories()

  // Add-form toggles + pending goal deletion (asset/transaction deletes are local
  // to their list components).
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [pendingGoalDelete, setPendingGoalDelete] = useState<string | null>(null)
  const [removingGoal, setRemovingGoal] = useState(false)

  // Category → color map from live data, merged over the static palette fallback.
  const categoryColors = useMemo(() => {
    const map: Record<string, string> = { ...CATEGORY_COLORS }
    for (const c of data?.categories ?? []) map[c.name] = c.color
    return map
  }, [data?.categories])

  const confirmGoalDelete = async () => {
    if (!pendingGoalDelete) return
    setRemovingGoal(true)
    try {
      await removeGoal(pendingGoalDelete)
      setPendingGoalDelete(null)
    } catch {
      // error surfaced by the hook; keep the dialog open
    } finally {
      setRemovingGoal(false)
    }
  }

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
                  <h4 className="font-sans font-medium text-sm text-white mb-2">Daily Cash Flow Trend</h4>
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
                  <h4 className="font-sans font-medium text-sm text-white">Daily Cash Flow Trend</h4>
                  <span className="text-[10px] text-gray-500 font-mono">Live</span>
                </div>
                <p className="text-xs text-gray-500">Income vs expenses, day by day this month</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <MonthlyTrend data={data.dailyTrend} xKey="day" />
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

              <div className="flex-1 overflow-y-auto mt-4 pr-1">
                <AccountBalances accounts={data.accountBalances} />
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

        {/* Row 3: Assets & Maturities */}
        <AssetMaturityTracker assets={data.assets} />

        {/* Row 4: Recent Transactions Summary List */}
        <TransactionList
          transactions={data.recentTransactions}
          title="Recent Transactions"
          categoryColors={categoryColors}
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
          <div className="lg:col-span-1 space-y-4">
            <TransactionForm
              onSubmit={async (tx) => { await addTransaction(tx) }}
              isSubmitting={isTxSubmitting}
              accounts={data.accountBalances}
              categories={data.categories}
            />

            {showCategoryForm ? (
              <CategoryForm
                onSubmit={async (c) => { await addCategory(c) }}
                onCancel={() => setShowCategoryForm(false)}
                isSubmitting={isCategorySubmitting}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-white/10 text-gray-300"
                onClick={() => setShowCategoryForm(true)}
              >
                <Plus /> Add category
              </Button>
            )}
          </div>
          <div className="lg:col-span-2">
            <TransactionList
              transactions={data.recentTransactions}
              title="Transaction Ledger"
              onRemove={removeTransaction}
              categoryColors={categoryColors}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderGoalsView = () => {
    if (error && !data) {
      return <ErrorBanner message={error.message} onRetry={mutate} />
    }

    if (isLoading || !data) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="bg-card border-white/10 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-5 w-32 bg-white/5" />
                <Skeleton className="h-2 w-full bg-white/5" />
                <Skeleton className="h-4 w-40 bg-white/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    const priorityStyles: Record<string, string> = {
      High: 'text-brand-expense bg-brand-expense/10 border-brand-expense/20',
      Medium: 'text-brand-warning bg-brand-warning/10 border-brand-warning/20',
      Low: 'text-gray-400 bg-white/5 border-white/10'
    }

    return (
      <div className="space-y-6">
        {error && (
          <ErrorBanner message={error.message} onRetry={mutate} />
        )}

        <div className="flex justify-end">
          {!showGoalForm && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-gray-300"
              onClick={() => setShowGoalForm(true)}
            >
              <Plus /> Add Goal
            </Button>
          )}
        </div>

        {showGoalForm && (
          <GoalForm
            onSubmit={async (g) => { await addGoal(g) }}
            onCancel={() => setShowGoalForm(false)}
            isSubmitting={isGoalSubmitting}
          />
        )}

        {data.goals.length === 0 ? (
          <Card className="bg-card border-white/10">
            <CardContent className="p-8 text-center text-xs text-gray-500">
              No savings goals set up yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.goals.map((goal, idx) => {
              const pct = Math.round(Math.max(0, Math.min(100, goal.progressPct)))
              return (
                <Card key={idx} className="bg-card border-white/10 overflow-hidden">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-white">{goal.name}</h4>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full border font-mono whitespace-nowrap',
                          priorityStyles[goal.priority] || priorityStyles.Low
                        )}>
                          {goal.priority}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Remove goal"
                          className="text-gray-500 hover:text-brand-expense"
                          onClick={() => setPendingGoalDelete(goal.name)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-gray-100">{formatCurrency(goal.saved)}</span>
                        <span className="text-gray-500">of {formatCurrency(goal.target)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-brand-income rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-gray-500 font-mono">{pct}% saved</div>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-3 border-t border-white/5">
                      <span className="text-gray-500">Monthly contribution</span>
                      <span className="font-mono text-gray-300">{formatCurrency(goal.contribution)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <ConfirmDialog
          open={pendingGoalDelete !== null}
          title="Remove goal?"
          description={pendingGoalDelete ? `"${pendingGoalDelete}" will be deleted from your sheet.` : ''}
          loading={removingGoal}
          onConfirm={confirmGoalDelete}
          onCancel={() => setPendingGoalDelete(null)}
        />
      </div>
    )
  }

  const renderAssetsView = () => {
    if (error && !data) {
      return <ErrorBanner message={error.message} onRetry={mutate} />
    }

    if (isLoading || !data) {
      return (
        <Card className="bg-card border-white/10 overflow-hidden">
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-44 bg-white/5" />
            <Skeleton className="h-10 w-full bg-white/5" />
            <Skeleton className="h-10 w-full bg-white/5" />
            <Skeleton className="h-10 w-full bg-white/5" />
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        {error && (
          <ErrorBanner message={error.message} onRetry={mutate} />
        )}

        <div className="flex justify-end">
          {!showAssetForm && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-gray-300"
              onClick={() => setShowAssetForm(true)}
            >
              <Plus /> Add Asset
            </Button>
          )}
        </div>

        {showAssetForm && (
          <AssetForm
            onSubmit={async (a) => { await addAsset(a) }}
            onCancel={() => setShowAssetForm(false)}
            isSubmitting={isAssetSubmitting}
          />
        )}

        <AssetMaturityTracker assets={data.assets} title="Asset Maturity Tracker" onRemove={removeAsset} />
      </div>
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
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-medium tracking-tight text-white capitalize">{activeView}</h2>
              {isDemo && (
                <span className="text-[10px] font-mono text-brand-warning bg-brand-warning/10 border border-brand-warning/20 px-2 py-0.5 rounded-full">
                  Demo — sample data
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-gray-500">
              Last Synced: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {activeView === 'dashboard' && renderDashboardView()}
          
          {activeView === 'transactions' && renderTransactionsView()}

          {activeView === 'goals' && renderGoalsView()}

          {activeView === 'assets' && renderAssetsView()}
        </div>
      </AppShell>

      {/* AI Assistant chat drawer */}
      <ChatPanel open={isChatOpen} onOpenChange={setIsChatOpen} />
    </>
  )
}
