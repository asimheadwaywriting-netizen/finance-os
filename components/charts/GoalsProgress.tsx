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
  ReferenceLine
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface GoalDef {
  name: string
  target: number
  saved: number
  progressPct: number
}

export interface GoalsProgressProps {
  data?: GoalDef[]
}

export default function GoalsProgress({ data = [] }: GoalsProgressProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
          tickFormatter={(v) => `${v}%`}
          stroke="rgba(255,255,255,0.1)"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
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
          formatter={(value: unknown, name: unknown, item: { payload?: GoalDef }) => {
            const payload = item.payload
            if (payload && typeof value === 'number') {
              return [
                `${value}% (Saved: ${formatCurrency(payload.saved)} / Target: ${formatCurrency(payload.target)})`,
                'Progress'
              ]
            }
            return [`${String(value)}%`, 'Progress']
          }}
          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
        />
        <ReferenceLine
          x={80}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{
            value: '80% Target',
            fill: '#f59e0b',
            fontSize: 9,
            fontFamily: 'monospace',
            position: 'top'
          }}
        />
        <Bar
          dataKey="progressPct"
          fill="#3b82f6"
          radius={[0, 4, 4, 0]}
          barSize={16}
          background={{ fill: 'rgba(255,255,255,0.05)', radius: [0, 4, 4, 0] as unknown as number }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
