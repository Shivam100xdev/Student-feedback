"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2, Clock, Shield, MessageSquare, Send, Paperclip, Download, User, UserCheck, MoreVertical, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getServerSession } from "next-auth";

interface ComplaintDetail {
  id: string;
  ticketCode: string;
  title: string;
  description: string;
  redactedDescription?: string;
  category: string;
  severity: number;
  sentiment: string;
  sentimentScore: number;
  language: string;
  status: string;
  isAnonymous: boolean;
  studentId?: string;
  locationBuilding?: string;
  locationDetail?: string;
  piiRedacted: boolean;
  abuseFlagged: boolean;
  assignedDept?: string;
  slaDeadline?: string;
  escalatedToRole?: string;
  upvotes: number;
  resolutionNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  comments: Comment[];
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
];

export default function ComplaintDetailPage() {
  const showToast = useToast().toast;
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetchComplaint();
    fetchSession();
  }, [id]);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (e) {
      console.error("Session fetch error:", e);
    }
  };

  const fetchComplaint = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (res.ok) {
        const data = await res.json();
        setComplaint(data);
      } else if (res.status === 404) {
        setError("Complaint not found");
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (e) {
      console.error("Error fetching complaint:", e);
      setError("Failed to load complaint");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/complaints/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (complaint) setComplaint({ ...complaint, comments: data });
      }
    } catch (e) {
      console.error("Error fetching comments:", e);
    }
  };

  const handleStatusChange = async (newStatus: string, resolutionNote?: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          complaintIds: [id],
          status: newStatus,
          resolutionNote,
        }),
      });

      if (res.ok) {
        showToast(`Status updated to ${newStatus.replace("_", " ")}`, "success");
        fetchComplaint();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update status", "error");
      }
    } catch (e) {
      showToast("Failed to update status", "error");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/complaints/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText, isInternal }),
      });

      if (res.ok) {
        showToast(isInternal ? "Internal note added" : "Comment added", "success");
        setCommentText("");
        fetchComments();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to add comment", "error");
      }
    } catch (e) {
      showToast("Failed to add comment", "error");
    } finally {
      setCommentLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "UNDER_REVIEW":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "IN_PROGRESS":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
      case "RESOLVED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "ESCALATED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return "text-red-600 dark:text-red-400";
    if (severity >= 3) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();
  const formatDateShort = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-2xl text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Unable to Load Complaint</h2>
        <p className="text-muted-foreground mb-6">{error || "Complaint not found"}</p>
        <Link href="/dashboard/admin" className="px-4 py-2 bg-primary text-white rounded-lg">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isAdmin = session?.user && ["ADMIN", "AUTHORITY"].includes(session.user.role);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/admin"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ${getStatusColor(complaint.status)}`}>
            {complaint.status.replace("_", " ")}
          </span>
          <span className={`px-2 py-1 text-xs font-bold rounded-full ${getSeverityColor(complaint.severity)} bg-red-100 dark:bg-red-900`}>
            Severity {complaint.severity}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Complaint Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Meta */}
          <div className="motionsites-card p-6">
            <h1 className="text-2xl font-bold mb-4">{complaint.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="font-mono">{complaint.ticketCode}</span>
              <span>•</span>
              <span>{formatDate(complaint.createdAt)}</span>
              {complaint.locationBuilding && (
                <>
                  <span>•</span>
                  <span>📍 {complaint.locationBuilding}{complaint.locationDetail ? `, ${complaint.locationDetail}` : ""}</span>
                </>
              )}
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Description</h3>
              <div className="prose dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                {complaint.redactedDescription || complaint.description}
              </div>
              {complaint.piiRedacted && (
                <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  PII was automatically redacted from this complaint
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium capitalize">{complaint.category.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="font-medium">{complaint.language}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <p className="font-medium capitalize">{complaint.sentiment.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sentiment Score</p>
                <p className="font-medium">{complaint.sentimentScore.toFixed(2)}</p>
              </div>
            </div>

            {/* SLA & Assignment */}
            {(complaint.slaDeadline || complaint.assignedDept || complaint.escalatedToRole) && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {complaint.assignedDept && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned Department</p>
                      <p className="font-medium">{complaint.assignedDept}</p>
                    </div>
                  )}
                  {complaint.slaDeadline && (
                    <div>
                      <p className="text-xs text-muted-foreground">SLA Deadline</p>
                      <p
                        className={`font-medium ${new Date(complaint.slaDeadline) < new Date() && complaint.status !== "RESOLVED" ? "text-red-600" : ""}`}
                      >
                        {formatDate(complaint.slaDeadline)}
                        {new Date(complaint.slaDeadline) < new Date() && complaint.status !== "RESOLVED" && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </p>
                    </div>
                  )}
                  {complaint.escalatedToRole && (
                    <div>
                      <p className="text-xs text-muted-foreground">Escalated To</p>
                      <p className="font-medium">{complaint.escalatedToRole}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attachments */}
            {complaint.attachments.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments ({complaint.attachments.length})
                </h3>
                <div className="space-y-2">
                  {complaint.attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Paperclip className="w-5 h-5 text-slate-500" />
                      <div className="flex-1">
                        <p className="font-medium">{att.fileName}</p>
                        <p className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                      <a
                        href={att.fileUrl}
                        download
                        className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Note */}
            {complaint.status === "RESOLVED" && complaint.resolutionNote && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Resolution
                </h3>
                <p className="text-green-800 dark:text-green-200">{complaint.resolutionNote}</p>
                {complaint.resolvedAt && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Resolved on {formatDate(complaint.resolvedAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="motionsites-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6" />
                Comments & Updates
              </h2>
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 text-primary border-slate-300 rounded"
                  />
                  Internal Note
                </label>
              )}
            </div>

            {/* Comments List */}
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {complaint.comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No comments yet</p>
              ) : (
                complaint.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`flex gap-3 p-4 rounded-lg ${
                      comment.isInternal
                        ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                        : "bg-slate-50 dark:bg-slate-800"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{comment.authorName || "Anonymous"}</span>
                        {comment.authorRole && (
                          <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                            {comment.authorRole}
                          </span>
                        )}
                        {comment.isInternal && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded">
                            Internal
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <div className="flex gap-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={isInternal ? "Add internal note (admins only)..." : "Add a comment..."}
                className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={commentLoading || !commentText.trim()}
                className="self-end"
              >
                {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Admin Actions */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Status Update */}
            <div className="motionsites-card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Update Status
              </h3>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status}
                    variant={complaint.status === status ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() =>
                      status === "RESOLVED"
                        ? handleStatusChange(status, "Resolved by admin")
                        : handleStatusChange(status)
                    }
                    disabled={statusLoading || complaint.status === status}
                  >
                    {statusLoading && complaint.status !== status ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <span>{status.replace("_", " ")}</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="motionsites-card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => handleStatusChange("ESCALATED", "Escalated to authority")}>
                  Escalate to Authority
                </Button>
                <Button variant="destructive" className="w-full justify-start" onClick={() => handleStatusChange("REJECTED")}>
                  Reject
                </Button>
              </div>
            </div>

            {/* Flags */}
            <div className="motionsites-card p-6">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Flags
              </h3>
              <div className="space-y-2">
                {complaint.abuseFlagged && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Abusive language detected
                    </p>
                  </div>
                )}
                {complaint.piiRedacted && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      PII automatically redacted
                    </p>
                  </div>
                )}
                {complaint.isAnonymous && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Anonymous submission
                    </p>
                  </div>
                )}
                {!complaint.abuseFlagged && !complaint.piiRedacted && !complaint.isAnonymous && (
                  <p className="text-sm text-muted-foreground">No flags</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}