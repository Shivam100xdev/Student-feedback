"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Shield, TrendingUp, MessageSquare, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/chart";

interface PublicResolution {
  id: string;
  title: string;
  issue: string;
  resolution: string;
  category: string;
  locationName?: string;
  upvotes: number;
  publishedAt: string;
}

const CATEGORIES = [
  "HOSTEL", "MESS", "ACADEMICS", "INFRASTRUCTURE",
  "SPORTS", "SANITATION", "SECURITY", "FINANCIAL", "CONFIDENTIAL_SAFETY",
];

export default function ResolutionsWall() {
  const [loading, setLoading] = useState(true);
  const [resolutions, setResolutions] = useState<PublicResolution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ category: string; search: string }>({
    category: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchResolutions();
  }, [filter.category, filter.search, page]);

  const fetchResolutions = async () => {
    if (page === 1) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.category) params.set("category", filter.category);
      if (filter.search) params.set("search", filter.search);
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      const res = await fetch(`/api/public-resolutions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (page === 1) {
          setResolutions(data);
        } else {
          setResolutions(prev => [...prev, ...data]);
        }
        setHasMore(data.length === ITEMS_PER_PAGE);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (e) {
      setError("Failed to load resolutions");
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (id: string) => {
    try {
      const res = await fetch(`/api/public-resolutions/${id}/upvote`, { method: "POST" });
      if (res.ok) {
        setResolutions(prev => prev.map(r =>
          r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r
        ));
      }
    } catch {
      // Ignore upvote errors
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      HOSTEL: "bg-purple-100 text-purple-800",
      MESS: "bg-amber-100 text-amber-800",
      ACADEMICS: "bg-blue-100 text-blue-800",
      INFRASTRUCTURE: "bg-indigo-100 text-indigo-800",
      SPORTS: "bg-green-100 text-green-800",
      SANITATION: "bg-orange-100 text-orange-800",
      SECURITY: "bg-red-100 text-red-800",
      FINANCIAL: "bg-yellow-100 text-yellow-800",
      CONFIDENTIAL_SAFETY: "bg-pink-100 text-pink-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  if (loading && page === 1) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-10">
        <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">You Said, We Did</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A public wall of resolved issues showing how student feedback leads to real change.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search resolutions..."
              value={filter.search}
              onChange={(e) => { setFilter({ ...filter, search: e.target.value }); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filter.category}
            onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}
            className="px-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-center text-red-700">
          {error}
        </div>
      )}

      {/* Resolutions Wall */}
      {resolutions.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-muted-foreground mb-2">No resolutions yet</h3>
          <p className="text-muted-foreground">Resolved issues will appear here once published.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {resolutions.map((resolution) => (
            <Card
              key={resolution.id}
              className="overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-10 h-10 text-green-500 flex-shrink-0" />
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{resolution.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(resolution.category)}`}>
                          {resolution.category.replace("_", " ")}
                        </span>
                        {resolution.locationName && (
                          <span>• {resolution.locationName}</span>
                        )}
                        <span>• Published {new Date(resolution.publishedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {resolution.upvotes}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpvote(resolution.id)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <TrendingUp className="w-4 h-4 mr-1" />
                      Upvote
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Issue</h4>
                    <p className="text-foreground prose dark:prose-invert max-w-none">{resolution.issue}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Resolution</h4>
                    <p className="text-foreground prose dark:prose-invert max-w-none">{resolution.resolution}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setPage(p => p + 1)}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}