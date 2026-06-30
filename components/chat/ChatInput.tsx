'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

// The Web Speech API isn't in lib.dom.d.ts; this covers just what we use.
interface SpeechRecognitionResultLike {
  resultIndex: number
  results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechRecognitionResultLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Text already in the box when voice started, plus the finalized (non-interim)
  // speech so far this session — interim words are appended on top live, not stored.
  const baseTextRef = useRef('')
  const finalTranscriptRef = useRef('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  const autoGrow = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Recognition) return

    baseTextRef.current = value ? `${value} ` : ''
    finalTranscriptRef.current = ''

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    // Live partial words as you talk (was waiting for a full silence-detected
    // phrase before showing anything — felt broken, made people re-tap mid-sentence).
    recognition.interimResults = true
    // Keep listening across natural pauses instead of stopping after one phrase.
    recognition.continuous = true
    // Fills the text box only — user still reviews and hits Send themselves,
    // so a misheard word can't silently submit a transaction or budget change.
    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalTranscriptRef.current += r[0].transcript
        else interim += r[0].transcript
      }
      setValue(baseTextRef.current + finalTranscriptRef.current + interim)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(autoGrow)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    // Shift+Enter falls through to the textarea's default newline behavior.
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          autoGrow()
        }}
        onKeyDown={handleKeyDown}
        placeholder={isListening ? 'Listening...' : 'Ask about your money... (Shift+Enter for a new line)'}
        disabled={isLoading}
        className={cn(
          'w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-income/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none overflow-y-auto',
          voiceSupported ? 'pr-20' : 'pr-12'
        )}
      />
      {voiceSupported && (
        <button
          type="button"
          onClick={toggleListening}
          disabled={isLoading}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          className={cn(
            'absolute right-11 bottom-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
            isListening
              ? 'bg-brand-expense text-white animate-pulse'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        aria-label="Send message"
        className={cn(
          'absolute right-2 bottom-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
          'bg-brand-income text-white hover:bg-brand-income/90',
          'disabled:bg-white/5 disabled:text-gray-500 disabled:cursor-not-allowed'
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
