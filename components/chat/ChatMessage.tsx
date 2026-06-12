import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

export interface ChatMessageProps {
  message: ChatMessageType
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-start gap-3 max-w-[85%]', isUser && 'flex-row-reverse ml-auto')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border',
          isUser
            ? 'bg-white/5 border-white/10 text-gray-300'
            : 'bg-brand-income/10 border-brand-income/20 text-brand-income'
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <span className="font-mono text-xs font-bold">AI</span>
        )}
      </div>
      <div
        className={cn(
          'p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'rounded-tr-none bg-brand-income/10 border border-brand-income/20 text-gray-100'
            : 'rounded-tl-none bg-white/5 border border-white/5 text-gray-300'
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
