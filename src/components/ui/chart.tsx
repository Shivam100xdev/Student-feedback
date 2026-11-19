"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart as RechartsAreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  Legend,
} from "recharts";
import { useMemo, ReactNode } from "react";

export const Colors = {
  primary: "#3b82f6",
  secondary: "#64748b",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#0ea5e9",
  purple: "#a855f7",
  pink: "#ec4899",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  indigo: "#6366f1",
  green: "#22c55e",
  red: "#f43f5e",
};

interface ChartDataItem {
  name: string;
  value: number;
  [key: string]: string | number;
}

// Card Components
interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps): JSX.Element {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 pb-0 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 dark:text-slate-100 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <p className={`text-sm text-slate-500 dark:text-slate-400 mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}

// Chart Components
interface BarChartProps {
  data: ChartDataItem[];
  dataKey: string;
  xAxisKey?: string;
  showGrid?: boolean;
  barColor?: string;
  height?: number;
}

export function BarChart({ data, dataKey, xAxisKey = "name", showGrid = true, barColor = Colors.primary, height = 300 }: BarChartProps): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3x3" stroke="#e2e8f0" />}
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={dataKey} fill={barColor} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps {
  data: ChartDataItem[];
  dataKey?: string;
  nameKey?: string;
  height?: number;
}

export function PieChart({ data, dataKey = "value", nameKey = "name", height = 300 }: PieChartProps): JSX.Element {
  const colors = useMemo(() => {
    return data.map((_, i) => {
      const colorIndex = i % Object.keys(Colors).length;
      return Object.values(Colors)[colorIndex];
    });
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          dataKey={dataKey}
          nameKey={nameKey}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={colors[i]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

interface AreaChartProps {
  data: ChartDataItem[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}

export function AreaChart({ data, xKey, yKey, color = Colors.primary, height = 300 }: AreaChartProps): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        <CartesianGrid strokeDasharray="3x3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey={yKey} stroke={color} fill={`${color}40`} />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}

interface LineChartProps {
  data: ChartDataItem[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}

export function LineChart({ data, xKey, yKey, color = Colors.primary, height = 300 }: LineChartProps): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3x3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 4 }} />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}