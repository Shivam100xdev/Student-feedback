import Link from "next/link";
import { MessageSquare, BarChart3, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">University Feedback</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
          <Link href="/auth/signin" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Sign In</Link>
        </div>
      </nav>

      <section className="container mx-auto py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-6">
          Student Services Feedback & Analytics
        </h2>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          Anonymous, secure, and smart feedback platform for better campus life.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
          <Link href="/submit" className="motionsites-card p-8 text-left hover:shadow-md transition-shadow">
            <MessageSquare className="w-10 h-10 mb-4 text-accent" />
            <h3 className="text-xl font-bold mb-2">Submit Feedback</h3>
            <p className="text-muted-foreground text-sm">Anonymous, classified, and prioritized automatically.</p>
          </Link>

          <Link href="/track" className="motionsites-card p-8 text-left hover:shadow-md transition-shadow">
            <ShieldAlert className="w-10 h-10 mb-4 text-amber-500" />
            <h3 className="text-xl font-bold mb-2">Track Tickets</h3>
            <p className="text-muted-foreground text-sm">Check status of your reported issues using your ticket code.</p>
          </Link>

          <Link href="/dashboard" className="motionsites-card p-8 text-left hover:shadow-md transition-shadow">
            <BarChart3 className="w-10 h-10 mb-4 text-indigo-500" />
            <h3 className="text-xl font-bold mb-2">View Analytics</h3>
            <p className="text-muted-foreground text-sm">Real-time campus issue trends and department performance.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}