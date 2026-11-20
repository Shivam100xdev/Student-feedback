"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, BarChart3 } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

interface FeedbackRow {
  id: string;
  status: string;
  category: string;
  severity: string;
  createdAt: string;
}

interface FeedbackResponse {
  data: FeedbackRow[];
  total: number;
}

const OPEN_STATUSES = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS"];

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/feedback?limit=100");
        if (!res.ok) throw new Error("failed");
        const json: FeedbackResponse = await res.json();
        setRows(json.data ?? []);
      } catch {
        setError("Could not load your analytics right now.");
      } finally {
        setLoading(false);
      }
    }
    if (status === "authenticated") load();
    if (status === "unauthenticated") setLoading(false);
  }, [status]);

  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role === "ADMIN" || role === "AUTHORITY" || role === "SUPER_ADMIN";

  const open = rows.filter(r => OPEN_STATUSES.includes(r.status)).length;
  const resolved = rows.filter(r => r.status === "RESOLVED").length;

  const byCategory = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxCategory = byCategory[0]?.[1] ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader />

      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <BarChart3 className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">Analytics</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isStaff
              ? "Campus-wide trends and department performance."
              : "Your submitted feedback, status and category breakdown."}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="motionsites-card p-6 text-center text-red-600">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <StatCard label="Total submissions" value={rows.length} />
              <StatCard label="Open" value={open} />
              <StatCard label="Resolved" value={resolved} />
            </div>

            <div className="motionsites-card p-6">
              <h2 className="text-xl font-bold mb-4">By category</h2>
              {byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No feedback yet.{" "}
                  <Link href="/submit" className="text-primary hover:underline">
                    Submit your first item
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-3">
                  {byCategory.map(([category, count]) => (
                    <li key={category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{category.replace("_", " ")}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${maxCategory ? (count / maxCategory) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isStaff && (
              <div className="motionsites-card p-6 mt-6">
                <p className="text-sm text-muted-foreground">
                  Need the full campus report?{" "}
                  <Link href="/dashboard/admin" className="text-primary hover:underline">
                    Open the admin dashboard
                  </Link>
                  .
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="motionsites-card p-6 text-center">
      <p className="text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
