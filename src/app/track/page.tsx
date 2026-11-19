"use client";

import { useState } from "react";
import { Loader2, Search, AlertCircle, CheckCircle2, Clock, Shield, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface TicketStatus {
  ticketCode: string;
  trackingCode: string;
  title: string;
  category: string;
  subCategory?: string;
  severity: string;
  status: string;
  language: string;
  sentiment: string;
  locationDetail?: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  upvotes: number;
  isOverdue?: boolean;
}

export default function TrackTicket() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/track?code=${code.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
      } else if (res.status === 404) {
        setError("Ticket not found. Please check your tracking code.");
      } else {
        const err = await res.json();
        setError(err.error || "Failed to search. Please try again.");
      }
    } catch {
      setError("Failed to search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
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

  if (ticket) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Track Your Feedback</h1>

        <div className="motionsites-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Ticket Code</p>
              <p className="text-lg font-mono font-bold">{ticket.ticketCode}</p>
            </div>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${getStatusColor(ticket.status)}`}>
              {ticket.status.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium">{ticket.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{ticket.category}{ticket.subCategory && ` / ${ticket.subCategory}`}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Severity</p>
              <p className={`font-bold ${getSeverityColor(ticket.severity)}`}>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getSeverityBadge(ticket.severity)}`}>
                  {ticket.severity}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Language</p>
              <p className="font-medium">{ticket.language}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sentiment</p>
              <p className="font-medium capitalize">{ticket.sentiment.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {ticket.isOverdue && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-red-700">Overdue</span>
              <span className="text-sm text-red-600">SLA deadline has passed</span>
            </div>
          )}

          {ticket.slaDeadline && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="font-medium">SLA Deadline</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">{new Date(ticket.slaDeadline).toLocaleString()}</p>
            </div>
          )}

          {ticket.acknowledgedAt && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Acknowledged</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">{new Date(ticket.acknowledgedAt).toLocaleString()}</p>
            </div>
          )}

          {ticket.status === "RESOLVED" && ticket.resolutionNote && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-medium">Resolution</span>
              </div>
              <p className="text-sm text-green-700 mt-1">{ticket.resolutionNote}</p>
              {ticket.resolvedAt && (
                <p className="text-xs text-green-600 mt-1">Resolved on {new Date(ticket.resolvedAt).toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
            <span>Upvotes: {ticket.upvotes}</span>
            <span>Last updated: {new Date(ticket.updatedAt).toLocaleString()}</span>
          </div>
        </div>

        <button onClick={() => setTicket(null)} className="w-full py-2 text-muted-foreground hover:text-foreground">
          Track Another Ticket
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-lg">
      <h1 className="text-3xl font-bold mb-8">Track Your Feedback</h1>

      <div className="motionsites-card p-6">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter tracking code (e.g., TRK-ABC123-DEF)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            className="flex-1 p-3 rounded-lg bg-secondary border focus:outline-none focus:ring-2 focus:ring-accent"
            maxLength={40}
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={loading || !code}
            className="px-4 py-3 bg-primary text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center mt-4">
          Your tracking code was provided after submission (format: TRK-...).
          You can also use the ticket code (format: FEK-...).
        </p>
      </div>
    </div>
  );
}