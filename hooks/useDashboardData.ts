import useSWR from 'swr'
import type { DashboardData } from '@/lib/types'

const fetcher = async (url: string): Promise<DashboardData> => {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 503) {
      throw new Error("503: Service Unavailable. The backend integration (n8n Webhook) is not connected.")
    }
    throw new Error(`Failed to fetch dashboard data: ${res.statusText}`)
  }
  return res.json()
}

export function useDashboardData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardData, Error>(
    '/api/dashboard',
    fetcher,
    {
      refreshInterval: 60000,
      keepPreviousData: true,
      dedupingInterval: 2000,
    }
  )

  return {
    data,
    error,
    isLoading, // true on initial load when there is no cache/data yet
    isValidating, // true whenever a background fetch/refresh is running
    mutate
  }
}
