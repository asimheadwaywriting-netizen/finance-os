'use client'

import React from 'react'
import { 
  LayoutDashboard, 
  ReceiptText, 
  Target, 
  Briefcase, 
  MessageSquare,
  User,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  onOpenChat: () => void
  className?: string
}

export default function Sidebar({
  activeView,
  onViewChange,
  onOpenChat,
  className
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'assets', label: 'Assets', icon: Briefcase },
  ]

  return (
    <aside className={cn(
      "flex flex-col h-full bg-brand-bg border-r border-white/10 text-gray-400 w-64 select-none",
      className
    )}>
      {/* Header / Brand */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand-income/10 flex items-center justify-center border border-brand-income/30">
          <span className="font-mono text-brand-income font-bold text-lg">F</span>
        </div>
        <div>
          <h1 className="font-sans font-medium text-white text-sm tracking-wide leading-none">Finance OS</h1>
          <span className="text-[10px] text-gray-500 font-mono">v0.1-shell</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none",
                isActive 
                  ? "bg-white/5 text-white font-medium shadow-sm border border-white/5" 
                  : "hover:bg-white/5 hover:text-white border border-transparent"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-brand-income" : "text-gray-500 group-hover:text-white"
              )} />
              {item.label}
            </button>
          )
        })}

        {/* Chat Nav - Special Trigger */}
        <button
          onClick={onOpenChat}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-white/5 hover:text-white border border-transparent outline-none mt-4 group"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-gray-500 group-hover:text-white" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-income opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-income"></span>
            </span>
          </div>
          <span>AI Assistant</span>
        </button>
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
          <div className="w-9 h-9 rounded-full bg-brand-neutral/20 flex items-center justify-center border border-white/10 text-gray-300">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate leading-none mb-1">Asim</p>
            <p className="text-[10px] text-gray-500 truncate font-mono">asim.headwaywriting@gmail.com</p>
          </div>
          <button className="text-gray-500 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
