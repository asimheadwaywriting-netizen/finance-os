'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { CATEGORY_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'

export interface SpendingByCategoryProps {
  data?: { category: string; amount: number }[]
}

export default function SpendingByCategory({ data = [] }: SpendingByCategoryProps) {
  // Sort descending by amount
  const sortedData = [...data].sort((a, b) => b.amount - a.amount)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        layout="vertical"
        data={sortedData}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
          stroke="rgba(255,255,255,0.1)"
        />
        <YAxis
          type="category"
          dataKey="category"
          width={110}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          stroke="rgba(255,255,255,0.1)"
        />
        <Tooltip
          contentStyle={{
            background: '#0b0f17',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6
          }}
          labelStyle={{ color: '#ffffff', fontSize: 12, fontWeight: 'medium' }}
          itemStyle={{ fontSize: 12 }}
          formatter={(value: unknown) => [
            typeof value === 'number' ? formatCurrency(value) : String(value),
            'Spent'
          ]}
          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
          {sortedData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CATEGORY_COLORS[entry.category] ?? '#6b7280'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
