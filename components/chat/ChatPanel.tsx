'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import ChatMessage from '@/components/chat/ChatMessage'
import ChatInput from '@/components/chat/ChatInput'
import { useChat } from '@/hooks/useChat'

export interface ChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const { messages, isLoading, sendMessage } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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

        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {messages.map((message, i) => (
            <ChatMessage key={`${message.timestamp}-${i}`} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-brand-income/10 border border-brand-income/20 flex items-center justify-center flex-shrink-0 text-brand-income">
                <span className="font-mono text-xs font-bold">AI</span>
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 animate-pulse">
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-white/10">
          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
