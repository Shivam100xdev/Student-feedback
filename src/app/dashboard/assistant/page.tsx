"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Send, Mic, MicOff, Bot, User, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  language?: string;
  isTyping?: boolean;
}

interface QuickAction {
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "How to file feedback", prompt: "How do I submit feedback about a campus issue?" },
  { label: "Track my ticket", prompt: "How can I check the status of my feedback?" },
  { label: "Anonymous submission", prompt: "Is my feedback truly anonymous?" },
  { label: "What happens after I submit", prompt: "What happens after I submit feedback?" },
  { label: "Emergency help", prompt: "What if I have an urgent safety concern?" },
  { label: "Language support", prompt: "Which languages are supported?" },
];

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "hi", name: "हिंदी", flag: "🇮🇳" },
  { code: "kn", name: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "mai", name: "मैथिली", flag: "🇮🇳" },
];

export default function AIAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [recording, setRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Initialize with welcome message
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm your campus feedback assistant. I can help you:

• Submit feedback about campus services
• Track your feedback status
• Explain how the system works
• Answer questions in English, Hindi, Kannada, or Maithili

How can I help you today?`,
        timestamp: new Date(),
      },
    ]);

    // Initialize speech recognition
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognitionConstructor();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = "en-IN";

      recog.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setInput(prev => prev + " " + transcript);
        }
      };

      recog.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setRecording(false);
          toast("Voice input error", "error");
        }
      };

      recog.onend = () => setRecording(false);
      setRecognition(recog);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleRecording = () => {
    if (!recognition) {
      toast("Voice input not supported in this browser", "error");
      return;
    }

    if (recording) {
      recognition.stop();
      setRecording(false);
    } else {
      const langMap: Record<string, string> = {
        "en": "en-IN",
        "hi": "hi-IN",
        "kn": "kn-IN",
        "mai": "hi-IN",
      };
      recognition.lang = langMap[selectedLanguage] || "en-IN";
      recognition.start();
      setRecording(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          language: selectedLanguage,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          language: data.language,
        }]);
      } else {
        throw new Error("Failed to get response");
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    handleSend();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-72 border-r bg-muted/30 hidden lg:block flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Assistant
          </h2>
        </div>

        {/* Language Selector */}
        <div className="p-4 border-b">
          <label className="block text-sm font-medium mb-2">Language / भाषा / ಭಾಷೆ / मैथिली</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b">
          <h3 className="font-medium mb-3">Quick Questions</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.prompt)}
                className="w-full text-left p-3 text-sm border border-input bg-background rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">Privacy First</h4>
              <p>Your conversations are not stored with your identity. Feedback submitted through the assistant follows the same anonymity rules.</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">Maithili Support</h4>
              <p>Maithili translation quality may vary. Reviewers can fix translations if needed.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">Emergency</h4>
              <p>For immediate safety concerns, use the Emergency button on the feedback form or contact campus security directly.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b p-4 bg-background sticky top-0 z-10">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">Campus Feedback Assistant</h1>
                <p className="text-xs text-muted-foreground">Ask me anything about campus feedback</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Secure & Anonymous</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`max-w-[70%] ${
                  message.role === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-2xl ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.language && message.language !== "en" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ({message.language.toUpperCase()})
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Type a message... (${LANGUAGES.find(l => l.code === selectedLanguage)?.name})`}
              rows={1}
              style={{ minHeight: "44px", maxHeight: "200px" }}
              className="flex-1 px-4 py-3 border border-input bg-background rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
              disabled={loading}
            />
            <button
              onClick={toggleRecording}
              disabled={!recognition || loading}
              className={`p-3 rounded-full transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "bg-muted text-muted-foreground hover:bg-muted-foreground/80"} disabled:opacity-50`}
              aria-label={recording ? "Stop voice input" : "Start voice input"}
            >
              {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </main>
    </div>
  );
}