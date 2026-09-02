/**
 * CHART artifact renderer (FE §101) — recharts-driven, lazy-loaded chunk
 * (FE §201). Content contract: typed `{chart_type, x_key, series[], data[]}`
 * rows from the backend registry. Malformed content renders a readable
 * fallback table — never a crash (FE §291).
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { ChartContent } from '@/types';

const SERIES_COLORS = ['var(--md-primary)', 'var(--md-tertiary)', 'var(--md-secondary)', 'var(--md-success)', 'var(--md-warning)'];

function parseChartContent(raw: unknown): ChartContent | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const data = JSON.parse(raw) as Partial<ChartContent>;
    if (!Array.isArray(data.data) || !Array.isArray(data.series) || typeof data.x_key !== 'string') {
      return null;
    }
    const series = data.series.filter((s) => s && typeof s.key === 'string');
    if (series.length === 0) return null;
    return {
      chart_type:
        data.chart_type === 'line' || data.chart_type === 'area' || data.chart_type === 'pie'
          ? data.chart_type
          : 'bar',
      ...(data.title ? { title: data.title } : {}),
      x_key: data.x_key,
      series,
      data: data.data.filter((row) => row && typeof row === 'object'),
    };
  } catch {
    return null;
  }
}

export default function ChartViewer({ content }: { content: string }) {
  const chart = useMemo(() => parseChartContent(content), [content]);

  if (!chart) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 p-8 text-center bg-surface-container-low motion-reduce:transition-none">
        <BarChart3 className="h-8 w-8 text-on-surface-variant" aria-hidden="true" />
        <p className="max-w-xs text-xs leading-[16px] tracking-[0.4px] text-on-surface-variant">
          This chart version has no renderable data. View an earlier version or export the raw source.
        </p>
      </div>
    );
  }

  const colorOf = (index: number) => chart.series[index]?.color ?? SERIES_COLORS[index % SERIES_COLORS.length];

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" />
      <XAxis
        dataKey={chart.x_key}
        tick={{ fontSize: 10, fill: 'var(--md-on-surface-variant)' }}
        stroke="var(--md-outline)"
      />
      <YAxis tick={{ fontSize: 10, fill: 'var(--md-on-surface-variant)' }} stroke="var(--md-outline)" />
      <ReTooltip
        contentStyle={{
          background: 'var(--md-surface-container-high)',
          border: '1px solid var(--md-outline-variant)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--md-on-surface)',
        }}
      />
      <Legend wrapperStyle={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }} />
    </>
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-surface-container-low p-4 motion-reduce:transition-none [&_.recharts-attribution]:hidden" role="img" aria-label={chart.title ? `Chart: ${chart.title}` : 'Data chart'}>
      {chart.title && (
        <h3 className="mb-3 text-[14px] font-medium leading-[20px] tracking-[0.1px] text-on-surface">{chart.title}</h3>
      )}
      <div className="min-h-[220px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={220}>
          {chart.chart_type === 'line' ? (
            <LineChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              {axes}
              {chart.series.map((s, i) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key}
                  stroke={colorOf(i)} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          ) : chart.chart_type === 'area' ? (
            <AreaChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              {axes}
              {chart.series.map((s, i) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key}
                  stroke={colorOf(i)} fill={colorOf(i)} fillOpacity={0.25} isAnimationActive={false} />
              ))}
            </AreaChart>
          ) : chart.chart_type === 'pie' ? (
            <PieChart>
              <ReTooltip
                contentStyle={{
                  background: 'var(--md-surface-container-high)',
                  border: '1px solid var(--md-outline-variant)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--md-on-surface)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }} />
              <Pie data={chart.data} dataKey={chart.series[0]!.key} nameKey={chart.x_key}
                outerRadius="80%" isAnimationActive={false} fontSize={10}>
                {chart.data.map((_row, i) => (
                  <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              {axes}
              {chart.series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={colorOf(i)}
                  radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
