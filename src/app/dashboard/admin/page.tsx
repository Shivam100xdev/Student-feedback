"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  PieChart,
  AreaChart,
  Colors,
  Card as CardComp,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, Users, FileDown, Filter, X, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Globe } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface FeedbackData {
  id: string;
  ticketCode: string;
  trackingCode: string;
  title: string;
  category: string;
  subCategory?: string;
  severity: string;
  status: string;
  sentiment: string;
  sentimentScore: number;
  language: string;
  englishTranslation?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  assignedDept?: string | null;
  isAnonymous: boolean;
  anonId: string;
  locationId?: string | null;
  locationDetail?: string | null;
  abuseFlagged: boolean;
  piiRedacted: boolean;
  upvotes: number;
  aiStatus: string;
  isOverdue?: boolean;
}

interface AnalyticsData {
  dailyTrend: { date: string; count: number }[];
  categoryDist: { name: string; value: number }[];
  statusDist: { name: string; value: number }[];
  severityDist: { severity: string; count: number }[];
  deptPerformance: { department: string; total: number; resolved: number; resolutionRate: number; avgResolutionHours: number }[];
  sentimentTrend: { date: string; positive: number; neutral: number; negative: number }[];
  slaCompliance: { onTime: number; overdue: number; avgResolutionHours: number };
}

const STAT_OPTIONS = [
  { label: "Total", key: "total", icon: Users, color: "bg-blue-500" },
  { label: "Pending", key: "pending", icon: AlertCircle, color: "bg-gray-500" },
  { label: "In Progress", key: "inProgress", icon: Loader2, color: "bg-sky-500" },
  { label: "Resolved", key: "resolved", icon: CheckCircle2, color: "bg-green-500" },
  { label: "Overdue", key: "overdue", icon: AlertTriangle, color: "bg-red-500" },
  { label: "Critical", key: "critical", icon: AlertTriangle, color: "bg-red-600" },
];

const STATUS_OPTIONS = [
  "PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
  "QUARANTINED",
];

const CATEGORY_OPTIONS = [
  "HOSTEL",
  "MESS",
  "ACADEMICS",
  "INFRASTRUCTURE",
  "SPORTS",
  "SANITATION",
  "SECURITY",
  "FINANCIAL",
  "CONFIDENTIAL_SAFETY",
];

const SEVERITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AdminDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<FeedbackData[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    severity: "",
    department: "",
    search: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    fetchData();
    fetchAnalytics();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.department) params.set("department", filters.department);
      if (filters.search) params.set("search", filters.search);
      params.set("limit", "200");

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbackData(data.data || data);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      setError("Failed to load feedback data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const days = period === "week" ? 7 : period === "month" ? 30 : 90;
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateRange: days }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (e) {
      console.error("Analytics error:", e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const stats = {
    total: feedbackData.length,
    pending: feedbackData.filter(f => f.status === "PENDING").length,
    inProgress: feedbackData.filter(f => ["UNDER_REVIEW", "IN_PROGRESS"].includes(f.status)).length,
    resolved: feedbackData.filter(f => f.status === "RESOLVED").length,
    overdue: feedbackData.filter(f => f.isOverdue).length,
    critical: feedbackData.filter(f => f.severity === "CRITICAL").length,
  };

  const categoryData = feedbackData.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryData).map(([category, count]) => ({
    name: category,
    value: count,
  }));

  const statusData = feedbackData.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(statusData).map(([status, count]) => ({
    name: status.replace("_", " "),
    value: count,
  }));

  const severityData = feedbackData.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityChartData = SEVERITY_OPTIONS.map(s => ({
    name: s,
    value: severityData[s] || 0,
  }));

  const handlePublishToWall = async (feedbackItem: FeedbackData) => {
    setPublishingId(feedbackItem.id);
    try {
      const res = await fetch("/api/resolutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: feedbackItem.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setPublishedIds((prev) => (prev.includes(feedbackItem.id) ? prev : [...prev, feedbackItem.id]));
        toast(
          data.created
            ? "Published to the public wall"
            : "Public wall entry updated",
          "success",
        );
      } else {
        toast(data.error || "Failed to publish to the public wall", "error");
      }
    } catch (e) {
      toast("Failed to publish to the public wall", "error");
    } finally {
      setPublishingId(null);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.department) params.set("department", filters.department);
      params.set("type", "csv");

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const csv = await res.text();
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feedback-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Report exported successfully", "success");
      } else {
        toast("Failed to export report", "error");
      }
    } catch (e) {
      toast("Export failed", "error");
    }
  };

  const handleBulkAction = async (action: string, extraData: Record<string, unknown> = {}) => {
    if (selectedFeedback.length === 0) {
      toast("No feedback selected", "warning");
      return;
    }

    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedbackIds: selectedFeedback, ...extraData }),
      });

      if (res.ok) {
        const data = await res.json();
        toast(`${data.updated} feedback items updated`, "success");
        setSelectedFeedback([]);
        fetchData();
      } else {
        const err = await res.json();
        toast(err.error || "Action failed", "error");
      }
    } catch (e) {
      toast("Action failed", "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedFeedback(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFeedback.length === feedbackData.length) {
      setSelectedFeedback([]);
    } else {
      setSelectedFeedback(feedbackData.map(f => f.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      case "SUBMITTED": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "UNDER_REVIEW": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "IN_PROGRESS": return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
      case "RESOLVED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "REJECTED": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "ESCALATED": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "QUARANTINED": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-red-600 dark:text-red-400";
      case "HIGH": return "text-amber-600 dark:text-amber-400";
      case "MEDIUM": return "text-blue-600 dark:text-blue-400";
      case "LOW": return "text-green-600 dark:text-green-400";
      default: return "text-slate-600 dark:text-slate-400";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "HIGH": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "MEDIUM": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "LOW": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const departments = Array.from(
    new Set(feedbackData.map(f => f.assignedDept).filter(Boolean))
  ) as string[];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time feedback management & analytics
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
          </select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("table")}
              className={viewMode === "table" ? "bg-primary text-white" : ""}
            >
              Table
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("cards")}
              className={viewMode === "cards" ? "bg-primary text-white" : ""}
            >
              Cards
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <CardComp className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Filters</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm"
            >
              {showFilters ? <X className="w-4 h-4 mr-1" /> : <Filter className="w-4 h-4 mr-1" />}
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Search title, ticket code..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="">All Severities</option>
                {SEVERITY_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </CardComp>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {STAT_OPTIONS.map(({ label, key, icon: Icon, color }) => (
          <CardComp key={key}>
            <div className="p-4 flex items-center gap-3">
              <div className={`p-2 ${color} rounded-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats[key as keyof typeof stats]}
                </p>
              </div>
            </div>
          </CardComp>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Distribution */}
        <CardComp>
          <CardHeader>
            <CardTitle>Feedback by Category</CardTitle>
            <CardDescription>Distribution across service categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
              ) : analyticsData?.categoryDist && analyticsData.categoryDist.length > 0 ? (
                <PieChart data={analyticsData.categoryDist} />
              ) : (
                <PieChart data={chartData} />
              )}
            </div>
          </CardContent>
        </CardComp>

        {/* Status Distribution */}
        <CardComp>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current status of all feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
              ) : analyticsData?.statusDist && analyticsData.statusDist.length > 0 ? (
                <BarChart
                  data={analyticsData.statusDist}
                  dataKey="value"
                  xAxisKey="name"
                  barColor={Colors.purple}
                />
              ) : (
                <BarChart
                  data={statusChartData}
                  dataKey="value"
                  xAxisKey="name"
                  barColor={Colors.purple}
                />
              )}
            </div>
          </CardContent>
        </CardComp>
      </div>

      {/* Timeline & Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Timeline Chart */}
        <CardComp>
          <CardHeader>
            <CardTitle>Feedback Timeline</CardTitle>
            <CardDescription>Feedback submitted over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
              ) : analyticsData?.dailyTrend && analyticsData.dailyTrend.length > 0 ? (
                <AreaChart
                  data={analyticsData.dailyTrend.map(d => ({ name: d.date, value: d.count }))}
                  xKey="name"
                  yKey="value"
                  color={Colors.primary}
                />
              ) : (
                <AreaChart
                  data={Object.entries(
                    feedbackData.reduce((acc, f) => {
                      const date = new Date(f.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                      acc[date] = (acc[date] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([name, value]) => ({ name, value }))}
                  xKey="name"
                  yKey="value"
                  color={Colors.primary}
                />
              )}
            </div>
          </CardContent>
        </CardComp>

        {/* Severity Distribution */}
        <CardComp>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Breakdown by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin w-8 h-8 text-primary" />
                </div>
              ) : analyticsData?.severityDist && analyticsData.severityDist.length > 0 ? (
                <BarChart
                  data={analyticsData.severityDist.map(d => ({
                    name: d.severity,
                    value: d.count,
                  }))}
                  dataKey="value"
                  xAxisKey="name"
                  barColor={Colors.red}
                />
              ) : (
                <BarChart
                  data={severityChartData}
                  dataKey="value"
                  xAxisKey="name"
                  barColor={Colors.red}
                />
              )}
            </div>
          </CardContent>
        </CardComp>
      </div>

      {/* Department Performance */}
      {analyticsData?.deptPerformance && analyticsData.deptPerformance.length > 0 && (
        <CardComp className="mb-8">
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Resolution rates and average resolution time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-3 font-medium">Department</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-right p-3 font-medium">Resolved</th>
                    <th className="text-right p-3 font-medium">Resolution Rate</th>
                    <th className="text-right p-3 font-medium">Avg Resolution (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.deptPerformance.map((d) => (
                    <tr key={d.department} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-3">{d.department}</td>
                      <td className="p-3 text-right">{d.total}</td>
                      <td className="p-3 text-right">{d.resolved}</td>
                      <td className="p-3 text-right">{d.resolutionRate.toFixed(1)}%</td>
                      <td className="p-3 text-right">{d.avgResolutionHours.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </CardComp>
      )}

      {/* Feedback Table/List */}
      <CardComp>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Feedback</CardTitle>
              <CardDescription>
                {selectedFeedback.length > 0
                  ? `${selectedFeedback.length} selected • ${feedbackData.length} total`
                  : `${feedbackData.length} total feedback items`}
              </CardDescription>
            </div>
            {selectedFeedback.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("status", { status: "IN_PROGRESS" })}
                  disabled={bulkActionLoading}
                >
                  Mark In Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("status", { status: "UNDER_REVIEW" })}
                  disabled={bulkActionLoading}
                >
                  Mark Under Review
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkAction("resolve", { resolutionNote: "Bulk resolved" })}
                  disabled={bulkActionLoading}
                >
                  Resolve Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction("escalate", { escalatedToRole: "AUTHORITY" })}
                  disabled={bulkActionLoading}
                >
                  Escalate
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="p-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedFeedback.length === feedbackData.length && feedbackData.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="p-3 text-left">Ticket</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Severity</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Sentiment</th>
                    <th className="p-3 text-left">Assigned Dept</th>
                    <th className="p-3 text-left">Created</th>
                    <th className="p-3 text-left">SLA</th>
                    <th className="p-3 text-left">Flags</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackData.map((feedback) => (
                    <tr
                      key={feedback.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedFeedback.includes(feedback.id)}
                          onChange={() => toggleSelect(feedback.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-3 font-mono font-medium">{feedback.ticketCode}</td>
                      <td className="p-3 max-w-xs truncate" title={feedback.title}>
                        {feedback.title}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800">
                          {feedback.category.replace("_", " ")}
                          {feedback.subCategory && ` / ${feedback.subCategory}`}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${getSeverityBadge(feedback.severity)}`}
                        >
                          {feedback.severity}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusColor(feedback.status)}`}
                        >
                          {feedback.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="capitalize">{feedback.sentiment.toLowerCase()}</span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {feedback.assignedDept || "—"}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        {feedback.slaDeadline ? (
                          <span
                            className={
                              feedback.isOverdue
                                ? "text-red-600 font-medium"
                                : "text-slate-600 dark:text-slate-400"
                            }
                          >
                            {new Date(feedback.slaDeadline).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {feedback.abuseFlagged && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">⚠ Abuse</span>
                          )}
                          {feedback.piiRedacted && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">PII</span>
                          )}
                          {feedback.isAnonymous && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Anon</span>
                          )}
                          {feedback.aiStatus === "retry" && (
                            <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">AI Retry</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {feedback.status === "RESOLVED" ? (
                          <Button
                            variant={publishedIds.includes(feedback.id) ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => handlePublishToWall(feedback)}
                            disabled={publishingId === feedback.id}
                          >
                            {publishingId === feedback.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Globe className="w-3 h-3 mr-1" />
                            )}
                            {publishedIds.includes(feedback.id) ? "Published" : "Publish"}
                          </Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {feedbackData.map((feedback) => (
                <div
                  key={feedback.id}
                  className={`p-4 border rounded-lg ${selectedFeedback.includes(feedback.id) ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedFeedback.includes(feedback.id)}
                      onChange={() => toggleSelect(feedback.id)}
                      className="mt-1 rounded border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium truncate">{feedback.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getSeverityBadge(feedback.severity)}`}>
                            {feedback.severity}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusColor(feedback.status)}`}>
                            {feedback.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-mono">{feedback.ticketCode}</span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{feedback.category.replace("_", " ")}</span>
                        <span>Sentiment: {feedback.sentiment}</span>
                        <span>Lang: {feedback.language}</span>
                        {feedback.assignedDept && <span>Dept: {feedback.assignedDept}</span>}
                        <span>{new Date(feedback.createdAt).toLocaleDateString()}</span>
                        {feedback.isOverdue && (
                          <span className="text-red-600 font-medium">⚠ Overdue</span>
                        )}
                      </div>
                      {feedback.summary && (
                        <p className="mt-2 text-sm text-slate-500 line-clamp-2">{feedback.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {feedbackData.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No feedback found matching your filters</p>
            </div>
          )}
        </CardContent>
      </CardComp>
    </div>
  );
}