import { useState } from 'react'
import type { ChatMessage } from '@/lib/types'

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi Asim! I'm your Finance OS Assistant. Ask me about your budget, goals, or accounts — or tell me to log a transaction.",
  timestamp: Date.now(),
}

const FALLBACK_REPLY = 'AI temporarily unavailable. Please try again.'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() }
    const history = [...messages, userMessage].slice(-10)
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })
      const data = await res.json()
      const reply = typeof data.reply === 'string' ? data.reply : FALLBACK_REPLY
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: FALLBACK_REPLY, timestamp: Date.now() }])
    } finally {
      setIsLoading(false)
    }
  }

  return { messages, isLoading, sendMessage }
}
