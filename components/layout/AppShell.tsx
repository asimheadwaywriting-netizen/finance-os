'use client'

import React, { useState } from 'react'
import { Menu, MessageSquare } from 'lucide-react'
import Sidebar from './Sidebar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export interface AppShellProps {
  children: React.ReactNode
  activeView: string
  onViewChange: (view: string) => void
  onOpenChat: () => void
}

export default function AppShell({
  children,
  activeView,
  onViewChange,
  onOpenChat
}: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleMobileViewChange = (view: string) => {
    onViewChange(view)
    setIsMobileOpen(false)
  }

  return (
    <div className="flex h-screen w-screen bg-brand-bg overflow-hidden text-gray-100">
      {/* Desktop Sidebar (visible on md and up) */}
      <Sidebar 
        activeView={activeView} 
        onViewChange={onViewChange} 
        onOpenChat={onOpenChat}
        className="hidden md:flex flex-shrink-0"
      />

      {/* Main Container */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Mobile Header (visible on mobile only) */}
        <header className="flex md:hidden items-center justify-between px-4 h-16 border-b border-white/10 bg-brand-bg/95 backdrop-blur-md z-40">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5">
                    <Menu className="w-5 h-5" />
                  </Button>
                }
              />
              <SheetContent side="left" className="p-0 bg-brand-bg border-r border-white/10 w-64">
                <Sidebar 
                  activeView={activeView} 
                  onViewChange={handleMobileViewChange} 
                  onOpenChat={() => {
                    onOpenChat()
                    setIsMobileOpen(false)
                  }}
                  className="w-full h-full border-r-0"
                />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-brand-income/10 flex items-center justify-center border border-brand-income/30">
                <span className="font-mono text-brand-income font-bold text-sm">F</span>
              </div>
              <span className="font-sans font-medium text-white text-sm">Finance OS</span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onOpenChat}
            className="text-gray-400 hover:text-white hover:bg-white/5 relative"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-income opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-income"></span>
            </span>
          </Button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-brand-bg p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
