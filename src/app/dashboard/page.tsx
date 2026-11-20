"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2,
  ShieldAlert,
  MessageSquare,
  BarChart3,
  Users,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "loading") {
      setLoading(false);
    }
  }, [status]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Please sign in to access the dashboard.</p>
        <Link
          href="/auth/signin"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const role = (session.user as any).role as string;
  const isAdmin = role === "ADMIN";
  const isAuthority = role === "AUTHORITY" || isAdmin;

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader />

      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
          Student Services Feedback &amp; Analytics
        </h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          Anonymous, secure, and smart feedback platform for better campus life.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <DashboardCard
            href="/submit"
            title="Submit Feedback"
            description="Anonymous, classified, and prioritized automatically."
            icon={<MessageSquare className="w-10 h-10 text-accent" />}
          />
          <DashboardCard
            href="/track"
            title="Track Tickets"
            description="Check status of your reported issues using your ticket code."
            icon={<ShieldAlert className="w-10 h-10 text-amber-500" />}
          />
          <DashboardCard
            href="/dashboard/analytics"
            title="View Analytics"
            description="Real-time campus issue trends and department performance."
            icon={<BarChart3 className="w-10 h-10 text-indigo-500" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-6">
          <DashboardCard
            href="/resolutions"
            title="Public Resolutions"
            description="See how issues are being resolved across campus."
            icon={<Users className="w-10 h-10 text-emerald-500" />}
          />
          {isAuthority && (
            <DashboardCard
              href="/dashboard/authority"
              title="Authority Dashboard"
              description="Review sensitive cases and escalate issues."
              icon={<LayoutDashboard className="w-10 h-10 text-rose-500" />}
            />
          )}
          {isAdmin && (
            <DashboardCard
              href="/dashboard/admin"
              title="Admin Dashboard"
              description="View all feedback, analytics, and manage complaints."
              icon={<BarChart3 className="w-10 h-10 text-violet-500" />}
            />
          )}
        </div>

        <div className="motionsites-card p-5 mt-10 text-left">
          <p className="text-sm text-muted-foreground">
            Signed in as: <strong className="text-foreground">{session.user?.email}</strong>{" "}
            (Role: {role})
          </p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            ← Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}

function DashboardCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="motionsites-card p-8 block hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </Link>
  );
}
