"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, MapPin, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { Card } from "@/components/ui/chart";

interface HeatmapPoint {
  locationId: string;
  locationName: string;
  category: string;
  lat: number;
  lng: number;
  count: number;
  severity: string;
  priorityScore: number;
}

export default function HeatmapPage() {
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<HeatmapPoint | null>(null);
  const [showClusters, setShowClusters] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    try {
      const res = await fetch("/api/heatmap");
      if (res.ok) {
        const data = await res.json();
        setHeatmapData(data);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (e) {
      setError("Failed to load heatmap data");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "#ef4444"; // red-500
      case "HIGH": return "#f97316"; // orange-500
      case "MEDIUM": return "#3b82f6"; // blue-500
      case "LOW": return "#22c55e"; // green-500
      default: return "#64748b"; // slate-500
    }
  };

  const getRadius = (count: number) => {
    return Math.min(10 + count * 3, 50);
  };

  // Simple canvas-based heatmap rendering
  const renderHeatmap = () => {
    if (!mapRef.current || heatmapData.length === 0) return;

    const canvas = document.createElement("canvas");
    const container = mapRef.current;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";

    // Clear previous canvas
    container.querySelectorAll("canvas").forEach(c => c.remove());
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simple campus bounds (in production, use actual campus map)
    // Using a simple coordinate system for demo
    const bounds = {
      minLat: 12.9716 - 0.01, // Bangalore area approx
      maxLat: 12.9716 + 0.01,
      minLng: 77.5946 - 0.01,
      maxLng: 77.5946 + 0.01,
    };

    // Normalize coordinates to canvas
    const normalize = (lat: number, lng: number) => {
      const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * canvas.width;
      const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * canvas.height;
      return { x, y };
    };

    // Draw heatmap circles
    heatmapData.forEach(point => {
      const { x, y } = normalize(point.lat, point.lng);
      const radius = getRadius(point.count);
      const color = getSeverityColor(point.severity);

      // Draw glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `${color}80`); // 50% opacity
      gradient.addColorStop(0.5, `${color}40`); // 25% opacity
      gradient.addColorStop(1, `${color}00`); // 0% opacity

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw center point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  // Render after data loads
  useEffect(() => {
    if (!loading && heatmapData.length > 0) {
      setTimeout(renderHeatmap, 100);
    }
  }, [heatmapData, loading]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => renderHeatmap();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [heatmapData]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Statistics
  const totalFeedback = heatmapData.reduce((sum, p) => sum + p.count, 0);
  const criticalCount = heatmapData.filter(p => p.severity === "CRITICAL").reduce((sum, p) => sum + p.count, 0);
  const highCount = heatmapData.filter(p => p.severity === "HIGH").reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Campus Heatmap</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time visualization of feedback hotspots across campus
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
              className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
            />
            Show Clusters
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Critical Issues</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{criticalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">High Priority</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{highCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Feedback</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalFeedback}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Map Container */}
      <Card className="relative overflow-hidden">
        <div
          ref={mapRef}
          className="relative h-[600px] bg-slate-50 dark:bg-slate-900 rounded-lg"
          style={{ backgroundImage: "url('/campus-map-placeholder.svg')" }}
        >
          {/* Campus map placeholder - in production, use Mapbox/Leaflet */}
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <div className="text-center p-8">
              <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Campus Heatmap Visualization</p>
              <p className="text-sm mt-2">
                {heatmapData.length} locations with feedback data
              </p>
              <p className="text-xs mt-4 opacity-70">
                In production, this would render an interactive map with Mapbox GL or Leaflet
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg border">
            <h4 className="font-medium mb-3">Severity Legend</h4>
            <div className="space-y-2">
              {[
                { label: "Critical", color: "#ef4444" },
                { label: "High", color: "#f97316" },
                { label: "Medium", color: "#3b82f6" },
                { label: "Low", color: "#22c55e" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Top Locations List */}
      <Card className="mt-6">
        <h3 className="text-lg font-semibold p-4 border-b">Top Feedback Locations</h3>
        <div className="divide-y">
          {heatmapData
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((point, index) => (
              <div
                key={point.locationId}
                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50"
                onClick={() => setSelectedPoint(point)}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full font-bold text-sm">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-medium">{point.locationName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {point.category.replace("_", " ")} • {point.count} feedback items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded-full ${
                      point.severity === "CRITICAL" ? "bg-red-100 text-red-800" :
                      point.severity === "HIGH" ? "bg-orange-100 text-orange-800" :
                      point.severity === "MEDIUM" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}
                  >
                    {point.severity}
                  </span>
                  <span className="text-sm text-slate-500">Priority: {point.priorityScore.toFixed(1)}</span>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Selected Point Detail */}
      {selectedPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">{selectedPoint.locationName}</h3>
              <button
                onClick={() => setSelectedPoint(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                  selectedPoint.severity === "CRITICAL" ? "bg-red-100 text-red-800" :
                  selectedPoint.severity === "HIGH" ? "bg-orange-100 text-orange-800" :
                  selectedPoint.severity === "MEDIUM" ? "bg-blue-100 text-blue-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {selectedPoint.severity}
                </span>
                <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded">
                  {selectedPoint.category.replace("_", " ")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Feedback Count</p>
                  <p className="font-bold">{selectedPoint.count}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Priority Score</p>
                  <p className="font-bold">{selectedPoint.priorityScore.toFixed(1)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                View Feedback Details
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}