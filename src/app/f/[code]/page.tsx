"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Shield, AlertTriangle, CheckCircle2, Image, X, Paperclip } from "lucide-react";
import { useToast } from "@/components/ui/toast";

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

interface LocationData {
  id: string;
  name: string;
  code: string;
  category: string;
  building?: string;
  floor?: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  isAnonymous: boolean;
  attachments: File[];
}

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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export default function QRFeedbackForm() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const code = params.code as string;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    isAnonymous: true,
    attachments: [],
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const micRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchLocation();
    initSpeechRecognition();
  }, [code]);

  const fetchLocation = async () => {
    try {
      const res = await fetch(`/api/locations/${code}`);
      if (res.ok) {
        const data = await res.json();
        setLocation(data);
        // Pre-select category from location
        setFormData(prev => ({ ...prev, category: data.category }));
      } else {
        toast.toast("Invalid QR code or location not found", "error");
        router.push("/");
      }
    } catch {
      toast.toast("Failed to load location", "error");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const initSpeechRecognition = () => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognitionConstructor();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-IN"; // Default, will change based on user preference

      recog.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript + " ";
          }
        }

        if (finalTranscript) {
          setFormData(prev => ({
            ...prev,
            description: prev.description + " " + finalTranscript,
          }));
        }
      };

      recog.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setRecording(false);
          toast.toast("Voice input error. Please try again.", "error");
        }
      };

      recog.onend = () => {
        setRecording(false);
      };

      setRecognition(recog);
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      toast.toast("Voice input not supported in this browser", "error");
      return;
    }

    if (recording) {
      recognition.stop();
      setRecording(false);
    } else {
      // Set language based on user preference or default
      const lang = localStorage.getItem("preferredLanguage") || "en-IN";
      const langMap: Record<string, string> = {
        "en": "en-IN",
        "hi": "hi-IN",
        "kn": "kn-IN",
        "mai": "hi-IN", // Maithili uses Hindi recognition
      };
      recognition.lang = langMap[lang] || "en-IN";
      recognition.start();
      setRecording(true);
    }
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: File[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.toast(`${file.name} exceeds 5MB limit`, "error");
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.toast(`${file.name} has an unsupported file type`, "error");
        continue;
      }
      newAttachments.push(file);
    }

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }));
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be 200 characters or less";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length > 10000) {
      newErrors.description = "Description must be 10000 characters or less";
    }

    if (!formData.category) {
      newErrors.category = "Please select a category";
    }

    if (!formData.isAnonymous && !turnstileToken) {
      // For non-anonymous, we'd need auth - but this form is anonymous by default
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("locationId", location?.id || "");
      formDataToSend.append("isAnonymous", formData.isAnonymous.toString());
      if (turnstileToken) {
        formDataToSend.append("turnstileToken", turnstileToken);
      }
      formData.attachments.forEach(file => {
        formDataToSend.append("attachments", file);
      });

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formDataToSend,
      });

      const data = await res.json();

      if (res.ok) {
        toast.toast("Feedback submitted successfully!", "success");
        router.push(`/track?code=${data.trackingCode}`);
      } else {
        if (res.status === 429) {
          toast.toast(data.error || "Rate limit exceeded", "error");
        } else {
          toast.toast(data.error || "Failed to submit feedback", "error");
        }
      }
    } catch {
      toast.toast("Failed to submit feedback. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!location) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-foreground">Submit Feedback</h1>
          <p className="text-muted-foreground mt-1">
            {location.name} {location.building && `• ${location.building}`} {location.floor && `• Floor ${location.floor}`}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your feedback is anonymous and secure
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              required
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500">{errors.category}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={200}
              className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                errors.title ? "border-red-500" : "border-input"
              }`}
              required
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {formData.title.length}/200
            </p>
          </div>

          {/* Description with Voice Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe your issue in detail... You can write in English, Hindi, Kannada, or Maithili."
                maxLength={10000}
                rows={6}
                className={`w-full px-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-none ${
                  errors.description ? "border-red-500" : "border-input"
                }`}
                required
              />
              <button
                type="button"
                ref={micRef}
                onClick={toggleRecording}
                disabled={!recognition}
                className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
                  recording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/80"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={recording ? "Stop voice input" : "Start voice input"}
              >
                {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {formData.description.length}/10000
            </p>
            {recording && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <span className="animate-pulse">●</span> Listening... Speak now
              </p>
            )}
          </div>

          {/* Attachments */}
          <div>
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
                disabled={formData.attachments.length >= 3}
              />
              <label
                htmlFor="attachments"
                className="flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Paperclip className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {formData.attachments.length >= 3
                    ? "Maximum 3 attachments reached"
                    : "Click or drag to upload photos"}
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP • Up to 5MB each
                </p>
              </label>
            </div>

            {formData.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {formData.attachments.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Attachment ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
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
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={formData.isAnonymous}
              onChange={(e) => handleInputChange("isAnonymous", e.target.checked)}
              className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
            />
            <label htmlFor="isAnonymous" className="text-sm text-foreground cursor-pointer">
              <strong>Submit anonymously</strong> (recommended)
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Your identity will never be linked to this feedback. A tracking code will be provided to check status.
          </p>

          {/* Turnstile for anonymous */}
          {!formData.isAnonymous && (
            <div id="turnstile-container" className="mt-2" />
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>

          {/* Privacy Notice */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>Your feedback is completely anonymous. We do not store your name, email, IP address, or any identifying information.</p>
            <p className="mt-1">A tracking code will be provided to check the status of your submission.</p>
          </div>
        </form>
      </div>

      {/* Turnstile Script */}
      <script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
    </div>
  );
}