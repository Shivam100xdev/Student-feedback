"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle2, Shield, Paperclip, X, FileText, Image, AlertTriangle, CheckCircle, Mic, MicOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { classifyWithRules } from "@/lib/ai";

// Type for SpeechRecognition (browser API not in standard TS lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

interface AnalysisResult {
  category: string;
  subCategory: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  sentimentScore: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  isAbusive: boolean;
  abuseReason: string | null;
  language: "EN" | "HI" | "KN" | "MAI";
  englishTranslation: string;
  summary: string;
  containsPii: boolean;
  confidence: number;
}

interface Attachment {
  file: File;
  preview?: string;
  id: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const CATEGORIES = [
  { value: "HOSTEL", label: "Hostel / Accommodation" },
  { value: "MESS", label: "Mess / Canteen / Food" },
  { value: "ACADEMICS", label: "Academics / Library / Exams" },
  { value: "INFRASTRUCTURE", label: "Infrastructure / WiFi / Electricity" },
  { value: "SPORTS", label: "Sports / Recreation" },
  { value: "SANITATION", label: "Sanitation / Toilets / Cleanliness" },
  { value: "SECURITY", label: "Security / Safety" },
  { value: "FINANCIAL", label: "Financial / Fees / Scholarship" },
  { value: "CONFIDENTIAL_SAFETY", label: "Confidential: Harassment / Ragging / Assault" },
];

export default function SubmitFeedback() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ticketCode: string; trackingCode: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [locationBuilding, setLocationBuilding] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [recording, setRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognitionConstructor();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-IN";

      recog.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          }
        }
        if (finalTranscript) {
          setText(prev => prev + " " + finalTranscript);
        }
      };

      recog.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setRecording(false);
          toast("Voice input error. Please try again.", "error");
        }
      };

      recog.onend = () => setRecording(false);
      setRecognition(recog);
    }
  }, []);

  // Load Turnstile script
  useEffect(() => {
    if (!isAnonymous) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [isAnonymous]);

  const toggleRecording = () => {
    if (!recognition) {
      toast("Voice input not supported in this browser", "error");
      return;
    }

    if (recording) {
      recognition.stop();
      setRecording(false);
    } else {
      const lang = localStorage.getItem("preferredLanguage") || "en";
      const langMap: Record<string, string> = {
        "en": "en-IN",
        "hi": "hi-IN",
        "kn": "kn-IN",
        "mai": "hi-IN",
      };
      recognition.lang = langMap[lang] || "en-IN";
      recognition.start();
      setRecording(true);
    }
  };

  const handleAnalyze = () => {
    setLoading(true);
    // Use rule-based classifier for instant preview
    setTimeout(() => {
      const result = classifyWithRules(text, category || "INFRASTRUCTURE");
      setAnalysis(result);
      setLoading(false);
    }, 300);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast(`${file.name} exceeds 5MB limit`, "error");
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast(`${file.name} has an unsupported file type`, "error");
        continue;
      }
      if (attachments.length + newAttachments.length >= 3) {
        toast("Maximum 3 attachments allowed", "error");
        break;
      }

      const id = Math.random().toString(36).substring(2, 9);
      const preview = URL.createObjectURL(file);
      newAttachments.push({ file, preview, id });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    if (e.target) e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
      return prev.filter(a => a.id !== id);
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    else if (title.length > 200) newErrors.title = "Title must be 200 characters or less";

    if (!text.trim()) newErrors.text = "Description is required";
    else if (text.length > 10000) newErrors.text = "Description must be 10000 characters or less";

    if (!category) newErrors.category = "Please select a category";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", text);
      formData.append("category", category);
      formData.append("isAnonymous", isAnonymous.toString());
      if (locationBuilding) formData.append("locationBuilding", locationBuilding);
      if (locationDetail) formData.append("locationDetail", locationDetail);
      if (turnstileToken) formData.append("turnstileToken", turnstileToken);
      attachments.forEach(a => formData.append("attachments", a.file));

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ ticketCode: data.ticketCode, trackingCode: data.trackingCode });
        toast("Feedback submitted successfully!", "success");
      } else {
        if (res.status === 429) {
          toast(data.error || "Rate limit exceeded. Please try again later.", "error");
        } else {
          toast(data.error || "Failed to submit feedback", "error");
        }
      }
    } catch {
      toast("Failed to submit feedback. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Render success state
  if (result) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-lg text-center">
        <div className="motionsites-card p-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Feedback Submitted</h2>
          <div className="space-y-2 text-muted-foreground mb-6">
            <p>Ticket Code: <span className="font-mono font-bold">{result.ticketCode}</span></p>
            <p>Tracking Code: <span className="font-mono font-bold">{result.trackingCode}</span></p>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Save these codes to track your feedback status.
          </p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-primary text-white rounded-lg">
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        Submit Feedback
      </h1>

      <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
        {/* Category */}
        <div className="motionsites-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); if (errors.category) setErrors(prev => ({ ...prev, category: undefined })); }}
              className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${errors.category ? "border-red-500" : "border-input"}`}
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="motionsites-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors(prev => ({ ...prev, title: undefined })); }}
              placeholder="Brief summary of your issue"
              maxLength={200}
              className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${errors.title ? "border-red-500" : "border-input"}`}
              required
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
            <p className="mt-1 text-xs text-muted-foreground text-right">{title.length}/200</p>
          </div>
        </div>

        {/* Description with Voice Input */}
        <div className="motionsites-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); if (errors.text) setErrors(prev => ({ ...prev, text: undefined })); }}
                placeholder="Describe your issue in detail... You can write in English, Hindi, Kannada, or Maithili."
                maxLength={10000}
                rows={6}
                className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none ${errors.text ? "border-red-500" : "border-input"}`}
                required
              />
              <button
                type="button"
                ref={micRef}
                onClick={toggleRecording}
                disabled={!recognition}
                className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted-foreground/80"} disabled:opacity-50`}
                aria-label={recording ? "Stop voice input" : "Start voice input"}
              >
                {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            {errors.text && <p className="mt-1 text-sm text-red-500">{errors.text}</p>}
            <p className="mt-1 text-xs text-muted-foreground text-right">{text.length}/10000</p>
            {recording && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <span className="animate-pulse">●</span> Listening... Speak now
              </p>
            )}
          </div>
        </div>

        {/* Location Fields */}
        <div className="motionsites-card p-6">
          <h3 className="text-lg font-medium mb-4">Location Details (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={locationBuilding}
              onChange={(e) => setLocationBuilding(e.target.value)}
              placeholder="Building/Block"
              maxLength={100}
              className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="Room/Floor/Details"
              maxLength={200}
              className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Attachments */}
        <div className="motionsites-card p-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Attach Photos (Optional, max 3, 5MB each)
          </label>
          <div className="border-2 border-dashed border-input rounded-lg p-4">
            <input
              type="file"
              id="attachments"
              accept={ALLOWED_TYPES.join(",")}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={attachments.length >= 3}
            />
            <label htmlFor="attachments" className="flex flex-col items-center justify-center gap-2 cursor-pointer">
              <Paperclip className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {attachments.length >= 3 ? "Maximum 3 attachments reached" : "Click or drag to upload photos"}
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP • Up to 5MB each</p>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div key={attachment.id} className="relative group">
                  <img
                    src={attachment.preview}
                    alt={`Attachment ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anonymous Toggle */}
        <div className="motionsites-card p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
            />
            <span className="text-sm">
              <strong>Submit anonymously</strong> (recommended)
            </span>
          </label>
          <p className="text-xs text-muted-foreground mt-2 ml-7">
            Your identity will never be linked to this feedback. A tracking code will be provided to check status.
          </p>
        </div>

        {/* Turnstile for non-anonymous */}
        {!isAnonymous && (
          <div className="motionsites-card p-6">
            <p className="text-sm text-muted-foreground mb-2">
              Turnstile verification required for non-anonymous submissions
            </p>
            <div id="turnstile-container" className="w-full max-w-xs mx-auto" />
          </div>
        )}

        {/* Analysis Preview */}
        {analysis && (
          <div className="motionsites-card p-6 animate-in fade-in">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Preview Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div><p className="text-muted-foreground">Category</p><p className="font-bold">{analysis.category}</p></div>
              <div><p className="text-muted-foreground">Sub-category</p><p className="font-bold">{analysis.subCategory}</p></div>
              <div><p className="text-muted-foreground">Severity</p>
                <p className="font-bold">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    analysis.severity === "CRITICAL" ? "bg-red-100 text-red-800" :
                    analysis.severity === "HIGH" ? "bg-amber-100 text-amber-800" :
                    analysis.severity === "MEDIUM" ? "bg-blue-100 text-blue-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {analysis.severity}
                  </span>
                </p>
              </div>
              <div><p className="text-muted-foreground">Language</p><p className="font-bold">{analysis.language}</p></div>
              <div><p className="text-muted-foreground">Sentiment</p><p className="font-bold capitalize">{analysis.sentiment.toLowerCase()}</p></div>
              <div><p className="text-muted-foreground">Abusive</p><p className="font-bold">{analysis.isAbusive ? "Yes" : "No"}</p></div>
            </div>
            {(analysis.containsPii || analysis.isAbusive) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {analysis.containsPii && "PII detected and will be redacted."}
                  {analysis.isAbusive && ` Flagged: ${analysis.abuseReason}`}
                </p>
              </div>
            )}
            {analysis.englishTranslation !== text && (
              <details className="mb-4">
                <summary className="text-sm text-primary cursor-pointer">View English translation</summary>
                <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto max-h-32">
                  {analysis.englishTranslation}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Analyze & Submit Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !text || !title || !category}
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Analyze & Preview"}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-accent text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Submit
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="text-center text-xs text-muted-foreground border-t pt-4">
          <p>Your feedback is completely anonymous. We do not store your name, email, IP address, or any identifying information.</p>
          <p className="mt-1">A tracking code will be provided to check the status of your submission.</p>
          <p className="mt-1">Maithili translation quality may vary. Reviewers can fix translations if needed.</p>
        </div>
      </form>
    </div>
  );
}