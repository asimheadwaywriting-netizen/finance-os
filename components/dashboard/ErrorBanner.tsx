'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface ErrorBannerProps {
  message?: string
  onRetry?: () => void
}

export default function ErrorBanner({
  message = "We are unable to connect to the Google Sheets data source (n8n Webhook returned 503 Service Unavailable). Please verify your automation connection.",
  onRetry
}: ErrorBannerProps) {
  return (
    <Card className="border-brand-expense/30 bg-brand-expense/5 text-brand-expense overflow-hidden">
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 sm:mt-0 flex-shrink-0 text-brand-expense" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-white">Data Connection Issue</h4>
            <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">{message}</p>
          </div>
        </div>
        
        {onRetry && (
          <Button 
            onClick={onRetry}
            variant="outline" 
            size="sm" 
            className="border-brand-expense/30 text-white hover:bg-brand-expense/10 hover:text-brand-expense transition-all flex items-center gap-1.5 self-end sm:self-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
