"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, ShieldAlert } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="border-b px-6 py-4 flex justify-between items-center">
      <Link href="/dashboard" className="flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-primary" />
        <span className="text-2xl font-bold tracking-tight">University Feedback</span>
      </Link>
      <nav className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg transition-colors hover:bg-primary/90"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </nav>
    </header>
  );
}
