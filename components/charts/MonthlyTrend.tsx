'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface MonthlyTrendProps {
  data?: { month: string; income: number; expenses: number }[]
}

export default function MonthlyTrend({ data = [] }: MonthlyTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          stroke="rgba(255,255,255,0.1)"
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
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
          formatter={(value: unknown, name: unknown) => [
            typeof value === 'number' ? formatCurrency(value) : String(value),
            name === 'income' ? 'Income' : 'Expenses'
          ]}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
        />
        <Line
          type="monotone"
          dataKey="income"
          name="income"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          name="expenses"
          stroke="#f97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
