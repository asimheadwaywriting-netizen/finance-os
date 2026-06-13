import { useState } from 'react'
import { mutate } from 'swr'
import type { DashboardData } from '@/lib/types'

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export interface AssetInput {
  asset_name: string
  type: string
  value: number
  institution: string
  start_date: string
  maturity_date: string
  interest_rate: number
  notes: string
}

type Asset = DashboardData['assets'][number]

function daysFromToday(iso: string): number {
  const day = 86_400_000
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const target = new Date(iso)
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.ceil((t1 - t0) / day)
}

export function useAssets() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (method: 'POST' | 'DELETE', body: unknown) => {
    const res = await fetch('/api/assets', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Request failed: ${res.statusText}`)
    }
  }

  const addAsset = async (asset: AssetInput) => {
    setIsSubmitting(true)
    setError(null)

    const optimistic: Asset = {
      name: asset.asset_name,
      type: asset.type,
      value: asset.value,
      institution: asset.institution,
      daysToMaturity: asset.maturity_date ? daysFromToday(asset.maturity_date) : null,
      interestRate: asset.interest_rate,
      maturityDate: asset.maturity_date || null,
    }

    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) => (d ? { ...d, assets: [...d.assets, optimistic] } : d),
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('POST', asset)
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add asset'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeAsset = async (assetName: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      if (isDemo()) {
        await mutate(
          '/api/dashboard',
          (d: DashboardData | undefined) =>
            d ? { ...d, assets: d.assets.filter((a) => a.name !== assetName) } : d,
          { revalidate: false, populateCache: true }
        )
        return true
      }
      await send('DELETE', { asset_name: assetName })
      await mutate('/api/dashboard')
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove asset'
      setError(msg)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return { addAsset, removeAsset, isSubmitting, error }
}
