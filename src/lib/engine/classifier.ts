export type Language = "EN" | "HI" | "KN" | "MAI";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type Category = "HOSTEL" | "MESS" | "ACADEMICS" | "INFRASTRUCTURE" | "SPORTS" | "SANITATION" | "SECURITY" | "FINANCIAL" | "CONFIDENTIAL_SAFETY";

interface AnalysisResult {
  language: Language;
  sentiment: Sentiment;
  sentimentScore: number;
  category: Category;
  severity: number;
  piiRedacted: boolean;
  redactedText: string;
  abuseFlagged: boolean;
}

const PROFANITY_DICT = {
  EN: ["fuck", "shit", "bastard", "idiot", "asshole", "bitch"],
  HI: ["गाली", "बदतमीजी", "हरामी"], // Simplified for brevity
  KN: ["ಗೆತ್ತ", "ಬೋಳಿ"], // Simplified
  MAI: ["गड़बड़ी", "खराब"] // Example
};

const CATEGORY_KEYWORDS = {
  HOSTEL: ["room", "bed", "fan", "warden", "hostel", "accommodation", "कमरा", "हॉस्टल"],
  MESS: ["food", "mess", "canteen", "water", "breakfast", "lunch", "dinner", "खाना", "मेस"],
  ACADEMICS: ["class", "exam", "professor", "library", "course", "attendance", "कक्षा", "परीक्षा"],
  INFRASTRUCTURE: ["road", "light", "lift", "wifi", "internet", "building", "लिफ्ट", "वाईफाई"],
  SECURITY: ["gate", "guard", "theft", "safety", "security", "सुरक्षा", "चोरी"],
  CONFIDENTIAL_SAFETY: ["harassment", "ragging", "assault", "abuse", "bullying", "रैगिंग", "उत्पीड़न"],
};

const SENTIMENT_KEYWORDS = {
  POSITIVE: ["good", "great", "excellent", "solved", "happy", "thanks", "अच्छा", "धन्यवाद"],
  NEGATIVE: ["bad", "worst", "broken", "dirty", "slow", "fail", "poor", "खराब", "गंदा"],
};

export function analyzeComplaint(text: string): AnalysisResult {
  const normalizedText = text.toLowerCase();

  // 1. Language Detection (Simple script-based + keyword)
  let language: Language = "EN";
  if (/[ऀ-ॿ]/.test(text)) {
    // Check for Maithili specific keywords
    if (normalizedText.includes("छै") || normalizedText.includes("अहाँ")) language = "MAI";
    else language = "HI";
  } else if (/[ಀ-೿]/.test(text)) {
    language = "KN";
  }

  // 2. PII Redaction (Regex based)
  let redactedText = text;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+91[\-\s]?)?[0-9]{10}/g;
  const rollNumberRegex = /[0-9]{2}[a-zA-Z]{3}[0-9]{3,4}/g; // Common college format

  let piiRedacted = false;
  if (emailRegex.test(text)) {
    redactedText = redactedText.replace(emailRegex, "[EMAIL REDACTED]");
    piiRedacted = true;
  }
  if (phoneRegex.test(text)) {
    redactedText = redactedText.replace(phoneRegex, "[PHONE REDACTED]");
    piiRedacted = true;
  }
  if (rollNumberRegex.test(text)) {
    redactedText = redactedText.replace(rollNumberRegex, "[ID REDACTED]");
    piiRedacted = true;
  }

  // 3. Abuse Detection
  let abuseFlagged = false;
  const allProfanity = Object.values(PROFANITY_DICT).flat();
  for (const word of allProfanity) {
    if (normalizedText.includes(word)) {
      abuseFlagged = true;
      break;
    }
  }

  // 4. Category Classification
  let category: Category = "INFRASTRUCTURE"; // Default
  let maxMatch = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter(k => normalizedText.includes(k)).length;
    if (matches > maxMatch) {
      maxMatch = matches;
      category = cat as Category;
    }
  }

  // Safety reports (ragging, harassment, assault) must never be filed under the
  // place they mention just because that place also matched a keyword, e.g.
  // "ragging near the hostel block" must stay CONFIDENTIAL_SAFETY.
  if (CATEGORY_KEYWORDS.CONFIDENTIAL_SAFETY.some(k => normalizedText.includes(k))) {
    category = "CONFIDENTIAL_SAFETY";
  }

  // 5. Sentiment Analysis
  let sentimentScore = 0;
  SENTIMENT_KEYWORDS.POSITIVE.forEach(k => { if (normalizedText.includes(k)) sentimentScore += 0.2; });
  SENTIMENT_KEYWORDS.NEGATIVE.forEach(k => { if (normalizedText.includes(k)) sentimentScore -= 0.3; });

  let sentiment: Sentiment = "NEUTRAL";
  if (sentimentScore > 0.1) sentiment = "POSITIVE";
  if (sentimentScore < -0.1) sentiment = "NEGATIVE";

  // 6. Severity Scoring (1-5)
  let severity = 1;
  if (category === "CONFIDENTIAL_SAFETY") severity = 5;
  else if (category === "SECURITY") severity = 4;
  else if (sentiment === "NEGATIVE") severity += 1;

  if (normalizedText.includes("urgent") || normalizedText.includes("emergency") || normalizedText.includes("broken")) {
    severity += 1;
  }
  severity = Math.min(5, Math.max(1, severity));

  return {
    language,
    sentiment,
    sentimentScore,
    category,
    severity,
    piiRedacted,
    redactedText,
    abuseFlagged,
  };
}

export function calculateSla(severity: number): Date {
  const now = new Date();
  const slaHours: Record<number, number> = {
    5: 6,
    4: 12,
    3: 24,
    2: 48,
    1: 72,
  };

  const hours = slaHours[severity] ?? 72;

  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
