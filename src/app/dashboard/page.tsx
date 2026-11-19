"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Users, BarChart3, ShieldAlert, MessageSquarePlus, Search } from "lucide-react";
import Link from "next/link";

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
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to access the dashboard.</p>
        <Link href="/auth/signin" className="px-4 py-2 bg-primary text-white rounded-lg">Sign In</Link>
      </div>
    );
  }

  const role = (session.user as any).role;

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          href="/submit"
          title="Submit Feedback"
          description="Report a hostel, mess, academic or facility issue"
          icon={<MessageSquarePlus />}
          roles={["STUDENT", "ADMIN", "AUTHORITY"]}
          currentRole={role}
        />
        <DashboardCard
          href="/track"
          title="Track a Complaint"
          description="Follow the status of a ticket using its tracking code"
          icon={<Search />}
          roles={["STUDENT", "ADMIN", "AUTHORITY"]}
          currentRole={role}
        />
        <DashboardCard
          href="/dashboard/admin"
          title="Admin Dashboard"
          description="View all feedback, analytics, and manage complaints"
          icon={<BarChart3 />}
          roles={["ADMIN"]}
          currentRole={role}
        />
        <DashboardCard
          href="/dashboard/authority"
          title="Authority Dashboard"
          description="Review sensitive cases and escalate issues"
          icon={<ShieldAlert />}
          roles={["AUTHORITY", "ADMIN"]}
          currentRole={role}
        />
        <DashboardCard
          href="/resolutions"
          title="Public Resolutions"
          description="See how issues are being resolved"
          icon={<Users />}
          roles={["STUDENT", "ADMIN", "AUTHORITY"]}
          currentRole={role}
        />
      </div>

      <div className="motionsites-card p-4">
        <p className="text-sm text-muted-foreground">
          Signed in as: <strong>{session.user?.email}</strong> (Role: {role})
        </p>
        <Link href="/" className="text-sm text-muted-foreground">← Back to Home</Link>
      </div>
    </div>
  );
}

function DashboardCard({
  href,
  title,
  description,
  icon,
  roles,
  currentRole,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  roles: string[];
  currentRole: string;
}) {
  if (!roles.includes(currentRole)) {
    return null;
  }

  return (
    <Link href={href} className="motionsites-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">{icon}</div>
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}