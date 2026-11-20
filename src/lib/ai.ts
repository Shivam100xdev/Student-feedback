/**
 * AI Classification Module
 * Uses Claude API (Haiku for speed) with rule-based fallback
 * Single wrapper for all AI operations
 */

export interface AIClassificationResult {
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

// Language detection with better accuracy
export function detectLanguage(text: string): "EN" | "HI" | "KN" | "MAI" {
  // Check for Devanagari script (Hindi/Marathi/Maithili)
  if (/[ऀ-ॿ]/.test(text)) {
    // Maithili specific markers
    const maithiliMarkers = ["छै", "अहाँ", "हमर", "तोहर", "किंकर", "अछि", "अहाँ"];
    if (maithiliMarkers.some(m => text.includes(m))) return "MAI";
    return "HI";
  }
  // Check for Kannada script
  if (/[ಀ-೿]/.test(text)) return "KN";
  // Check for Hinglish (Latin script Hindi)
  const hinglishWords = ["hai", "hain", "kya", "nahi", "haan", "theek", "accha", "bura", "problem", "issue"];
  const hinglishCount = hinglishWords.filter(w => text.toLowerCase().includes(w)).length;
  if (hinglishCount >= 2) return "HI";
  return "EN";
}

// Rule-based fallback classifier (fast, no API calls)
export function classifyWithRules(text: string, category: string): AIClassificationResult {
  const normalizedText = text.toLowerCase();
  const language = detectLanguage(text);

  // Abuse detection - comprehensive wordlist
  const abusePatterns = {
    EN: [
      "fuck", "shit", "bastard", "asshole", "bitch", "cunt", "dick", "pussy", "whore",
      "motherfucker", "son of a bitch", "go to hell", "kill yourself", "die",
      "stupid idiot", "moron", "retard", "faggot", "nigger", "chink",
    ],
    HI: [
      "गाली", "बदतमीजी", "हरामी", "भोसड़ीके", "मादरचोद", "बहनचोद", "चूतिया",
      "गांडू", "लौड़े", "भेंचोद", "साले", "कुत्ते", "कमीने", "हरामजादे",
      "मार डालूंगा", "जान से मार", "आत्महत्या", "मार दूंगा",
    ],
    KN: [
      "ಗೆತ್ತು", "ಬೋಳಿ", "ಹೆಂತೆಯ ಮಗ", "ಕುत्रೆ", "ಲೋಡ", "ಕಸಿದು", "ಬೀ chamado",
      "ಹತ್ಯೆ ಮಾಡಿ", "ಸಾವು", "ಮೂರ�",
    ],
    MAI: [
      "गाली", "बदतमीजी", "मारब", "आतमहत्या", "जान मारब",
    ],
    HINGLISH: [
      "gaali", "badtaumeeji", "haraami", "bhosdike", "madarchod", "behenchod", "chutiya",
      "gaandu", "launde", "bhenchod", "saale", "kutta", "kamine", "haramjade",
      "maar dalunga", "jaan se maar", "aatmahatya", "maar dunga",
      "bakwaas", "bakwaas hai", "kya bakwaas hai",
    ],
  };

  const allAbuseWords = Object.values(abusePatterns).flat();
  let isAbusive = false;
  let abuseReason: string | null = null;

  for (const word of allAbuseWords) {
    if (normalizedText.includes(word.toLowerCase())) {
      isAbusive = true;
      abuseReason = `Detected abusive language: "${word}"`;
      break;
    }
  }

  // Check for personal attacks (not just profanity)
  const personalAttackPatterns = [
    /\byou\s+(are|r)\s+(stupid|idiot|dumb|useless|worthless)/i,
    /\b(warden|principal|hod|professor|teacher)\s+is\s+(useless|stupid|idiot|corrupt)/i,
    /\b(fuck|shit)\s+(you|off)/i,
  ];

  for (const pattern of personalAttackPatterns) {
    if (pattern.test(text)) {
      isAbusive = true;
      abuseReason = "Personal attack detected";
      break;
    }
  }

  // Allow harsh but valid complaints - negative sentiment about services is OK
  // Only block if it's a personal attack, slur, threat, or spam
  const validNegativePhrases = [
    "food is disgusting",
    "food is terrible",
    "warden is useless",
    "worst service",
    "pathetic",
    "horrible",
    "disgusting",
    "unacceptable",
    "very bad",
    "extremely poor",
  ];

  const isValidNegative = validNegativePhrases.some(p => normalizedText.includes(p));

  if (isAbusive && isValidNegative) {
    // If it's a valid negative complaint about services, don't flag as abusive
    // unless there's also a personal attack or slur
    const hasSlurOrThreat = allAbuseWords.some(w => normalizedText.includes(w.toLowerCase()));
    if (!hasSlurOrThreat) {
      isAbusive = false;
      abuseReason = null;
    }
  }

  // Category and sub-category
  const categoryKeywords: Record<string, { main: string; sub: string }[]> = {
    HOSTEL: [
      { main: "HOSTEL", sub: "ROOM" },
      { main: "HOSTEL", sub: "WARDEN" },
      { main: "HOSTEL", sub: "FACILITIES" },
      { main: "HOSTEL", sub: "CLEANLINESS" },
      { main: "HOSTEL", sub: "FOOD" },
    ],
    MESS: [
      { main: "MESS", sub: "FOOD_QUALITY" },
      { main: "MESS", sub: "HYGIENE" },
      { main: "MESS", sub: "TIMING" },
      { main: "MESS", sub: "MENU" },
      { main: "MESS", sub: "WATER" },
    ],
    ACADEMICS: [
      { main: "ACADEMICS", sub: "TEACHING" },
      { main: "ACADEMICS", sub: "EXAMS" },
      { main: "ACADEMICS", sub: "ATTENDANCE" },
      { main: "ACADEMICS", sub: "LIBRARY" },
      { main: "ACADEMICS", sub: "CURRICULUM" },
    ],
    INFRASTRUCTURE: [
      { main: "INFRASTRUCTURE", sub: "WIFI" },
      { main: "INFRASTRUCTURE", sub: "ELECTRICITY" },
      { main: "INFRASTRUCTURE", sub: "WATER_SUPPLY" },
      { main: "INFRASTRUCTURE", sub: "BUILDING" },
      { main: "INFRASTRUCTURE", sub: "LIFT" },
    ],
    SECURITY: [
      { main: "SECURITY", sub: "GATE" },
      { main: "SECURITY", sub: "THEFT" },
      { main: "SECURITY", sub: "UNSAFE_AREA" },
      { main: "SECURITY", sub: "HARASSMENT" },
    ],
    CONFIDENTIAL_SAFETY: [
      { main: "CONFIDENTIAL_SAFETY", sub: "RAGGING" },
      { main: "CONFIDENTIAL_SAFETY", sub: "HARASSMENT" },
      { main: "CONFIDENTIAL_SAFETY", sub: "ASSAULT" },
      { main: "CONFIDENTIAL_SAFETY", sub: "SELF_HARM" },
      { main: "CONFIDENTIAL_SAFETY", sub: "DOMESTIC_VIOLENCE" },
    ],
    SANITATION: [
      { main: "SANITATION", sub: "TOILETS" },
      { main: "SANITATION", sub: "WASTE" },
      { main: "SANITATION", sub: "DRAINAGE" },
      { main: "SANITATION", sub: "PEST_CONTROL" },
    ],
    SPORTS: [
      { main: "SPORTS", sub: "EQUIPMENT" },
      { main: "SPORTS", sub: "FACILITIES" },
      { main: "SPORTS", sub: "TIMING" },
    ],
    FINANCIAL: [
      { main: "FINANCIAL", sub: "FEES" },
      { main: "FINANCIAL", sub: "SCHOLARSHIP" },
      { main: "FINANCIAL", sub: "REFUND" },
      { main: "FINANCIAL", sub: "BILLING" },
    ],
  };

  // Sub-category detection
  let subCategory = "GENERAL";
  if (categoryKeywords[category]) {
    for (const { sub, main } of categoryKeywords[category]) {
      if (main === category) {
        // Check for sub-category keywords in text
        const subKeywords: Record<string, string[]> = {
          ROOM: ["room", "bed", "fan", "ac", "air conditioner", "window", "door"],
          WARDEN: ["warden", "caretaker", "supervisor", "अधीक्षक", "वार्डन"],
          FACILITIES: ["facility", "facilities", "amenities", "सुविधा"],
          CLEANLINESS: ["clean", "dirty", "hygiene", "सफाई", "गंदा"],
          FOOD: ["food", "meal", "mess", "canteen", "खाना", "भोजन"],
          FOOD_QUALITY: ["quality", "taste", "tasty", "bland", "spicy", "स्वाद", "क्वालिटी"],
          HYGIENE: ["hygiene", "sanitation", "clean", "सफाई"],
          TIMING: ["time", "timing", "schedule", "late", "early", "समय"],
          MENU: ["menu", "variety", "options", "मेनू"],
          WATER: ["water", "drinking water", "पानी"],
          TEACHING: ["teach", "teacher", "professor", "lecture", "class", "पढ़ाई", "शिक्षक"],
          EXAMS: ["exam", "test", "assessment", "grade", "marks", "परीक्षा"],
          ATTENDANCE: ["attendance", "present", "absent", "हाजिरी"],
          LIBRARY: ["library", "book", "study", "reading", "लाइब्रेरी"],
          CURRICULUM: ["syllabus", "curriculum", "course", "subject", "पाठ्यक्रम"],
          WIFI: ["wifi", "internet", "network", "connectivity", "वाईफाई", "नेटवर्क"],
          ELECTRICITY: ["electricity", "power", "light", "outage", "बिजली", "पावर"],
          WATER_SUPPLY: ["water supply", "tap", "pump", "पानी की सप्लाई"],
          BUILDING: ["building", "wall", "ceiling", "floor", "structure", "इमारत"],
          LIFT: ["lift", "elevator", "लिफ्ट"],
          GATE: ["gate", "entry", "exit", "guard", "security guard", "गेट", "प्रवेश"],
          THEFT: ["theft", "stolen", "steal", "robbery", "चोरी"],
          UNSAFE_AREA: ["unsafe", "dangerous", "dark", "isolated", "असुरक्षित"],
          HARASSMENT: ["harass", "harassment", "tease", "bully", "उत्पीड़न", "परेशान"],
          RAGGING: ["ragging", "ragging", "senior", "junior", "रैगिंग"],
          ASSAULT: ["assault", "attack", "hit", "beat", "violence", "हमला"],
          SELF_HARM: ["suicide", "kill myself", "self harm", "cut myself", "आत्महत्या"],
          DOMESTIC_VIOLENCE: ["domestic violence", "abuse", "partner", "spouse", "घरेलू हिंसा"],
          TOILETS: ["toilet", "washroom", "bathroom", "lavatory", "शौचालय"],
          WASTE: ["waste", "garbage", "trash", "dump", "कचरा"],
          DRAINAGE: ["drain", "drainage", "sewer", "blocked", "नाली"],
          PEST_CONTROL: ["pest", "insect", "mosquito", "rat", "cockroach", "कीट"],
          EQUIPMENT: ["equipment", "gear", "machine", "उपकरण"],
          FEES: ["fee", "fees", "tuition", "शुल्क", "फीस"],
          SCHOLARSHIP: ["scholarship", "grant", "financial aid", "छात्रवृत्ति"],
          REFUND: ["refund", "reimburse", "return money", "वापसी"],
          BILLING: ["bill", "invoice", "charge", "बिल"],
        };

        if (subKeywords[sub]) {
          const matches = subKeywords[sub].filter(k => normalizedText.includes(k.toLowerCase()));
          if (matches.length > 0) {
            subCategory = sub;
            break;
          }
        }
      }
    }
  }

  // Sentiment analysis
  const positiveWords = [
    "good", "great", "excellent", "amazing", "wonderful", "fantastic", "awesome",
    "solved", "fixed", "resolved", "happy", "satisfied", "thank", "thanks",
    "appreciate", "love", "best", "perfect", "improved", "better",
    "अच्छा", "बहुत अच्छा", "शानदार", "धन्यवाद", "शुक्रिया", "संतुष्ट", "खुश",
  ];
  const negativeWords = [
    "bad", "worst", "terrible", "awful", "horrible", "disgusting", "pathetic",
    "broken", "dirty", "slow", "fail", "poor", "useless", "waste", "rubbish",
    "unacceptable", "disappointed", "angry", "frustrated", "annoyed",
    "खराब", "बहुत खराब", "गंदा", "धीमा", "विफल", "खराब", "निराश", "गुस्सा",
  ];

  let sentimentScore = 0;
  positiveWords.forEach(w => { if (normalizedText.includes(w.toLowerCase())) sentimentScore += 0.15; });
  negativeWords.forEach(w => { if (normalizedText.includes(w.toLowerCase())) sentimentScore -= 0.2; });

  let sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" = "NEUTRAL";
  if (sentimentScore > 0.1) sentiment = "POSITIVE";
  if (sentimentScore < -0.1) sentiment = "NEGATIVE";

  // Severity scoring
  let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";

  if (isAbusive) {
    severity = "CRITICAL";
  } else if (category === "CONFIDENTIAL_SAFETY" || category === "SECURITY") {
    severity = "HIGH";
  } else if (normalizedText.includes("urgent") || normalizedText.includes("emergency")) {
    severity = "HIGH";
  } else if (normalizedText.includes("broken") || normalizedText.includes("not working")) {
    severity = "MEDIUM";
  } else if (sentiment === "NEGATIVE") {
    severity = "MEDIUM";
  }

  // English translation (placeholder - would use translation API in production)
  let englishTranslation = text;
  if (language !== "EN") {
    // In production, call translation API
    englishTranslation = `[Translated from ${language}] ${text}`;
  }

  // Summary generation (simple extractive)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const summary = sentences.slice(0, 2).join(". ").trim() + (sentences.length > 2 ? "..." : "");

  // PII check
  const { wasRedacted: containsPii } = redactPii(text);

  return {
    category,
    subCategory,
    sentiment,
    sentimentScore: Math.max(-1, Math.min(1, sentimentScore)),
    severity,
    isAbusive,
    abuseReason,
    language,
    englishTranslation,
    summary: summary || text.substring(0, 200),
    containsPii,
    confidence: 0.85, // Rule-based confidence
  };
}

// Helper function (imported from crypto to avoid circular deps)
function redactPii(text: string): { redacted: string; wasRedacted: boolean } {
  let redacted = text;
  let wasRedacted = false;

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(redacted)) {
    redacted = redacted.replace(emailRegex, "[EMAIL REDACTED]");
    wasRedacted = true;
  }

  const phoneRegex = /(\+91[\-\s]?)?[0-9]{10}/g;
  if (phoneRegex.test(redacted)) {
    redacted = redacted.replace(phoneRegex, "[PHONE REDACTED]");
    wasRedacted = true;
  }

  const idRegex = /[0-9]{2}[A-Za-z]{3}[0-9]{3,4}/g;
  if (idRegex.test(redacted)) {
    redacted = redacted.replace(idRegex, "[ID REDACTED]");
    wasRedacted = true;
  }

  return { redacted, wasRedacted };
}

/**
 * Main AI Classification Function
 * Tries Claude API first, falls back to rule-based
 */
export async function classifyWithAI(text: string, category: string): Promise<AIClassificationResult> {
  // Redact PII before sending to AI
  const { redacted: cleanText } = redactPii(text);

  // Try Claude API if available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await callClaudeAPI(cleanText, category);
      return result;
    } catch (error) {
      console.warn("Claude API failed, falling back to rules:", error);
    }
  }

  // Fallback to rule-based
  return classifyWithRules(cleanText, category);
}

async function callClaudeAPI(text: string, category: string): Promise<AIClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307";

  const prompt = buildClassificationPrompt(text, category);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      temperature: 0.1,
      system: "You are an expert feedback classifier for a university. Return ONLY valid JSON matching the specified schema. Be precise and consistent.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "{}";

  try {
    const parsed = JSON.parse(content);
    return validateAndNormalizeResult(parsed, category, text);
  } catch {
    throw new Error("Invalid JSON from Claude");
  }
}

function buildClassificationPrompt(text: string, category: string): string {
  return `Classify this student feedback about campus services.

Feedback: "${text}"
Category hint: ${category}

Return ONLY this JSON schema (no extra text):
{
  "category": "${category}",
  "subCategory": "string (e.g., FOOD_QUALITY, WIFI, RAGGING, TOILETS)",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "sentimentScore": number (-1 to 1),
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "isAbusive": boolean,
  "abuseReason": "string or null",
  "language": "EN|HI|KN|MAI",
  "englishTranslation": "string (translate to English if not English)",
  "summary": "string (1-2 sentence summary)",
  "containsPii": boolean,
  "confidence": number (0-1)
}

Classification Rules:
- CRITICAL: harassment, ragging, assault, self-harm, suicide, fire, threat, personal attacks, slurs
- HIGH: security issues, theft, unsafe conditions, broken critical infrastructure
- MEDIUM: negative sentiment about services, broken non-critical items
- LOW: positive/neutral feedback, minor suggestions
- ABUSIVE: only personal attacks, slurs, threats, spam - NOT valid complaints about service quality
- Allow harsh but valid complaints: "food is disgusting", "warden is useless", "worst service ever"
- Language detection: Devanagari=HI/MAI, Kannada=KN, Hinglish=HI, else EN
- PII: emails, phones, IDs, Aadhaar

Few-shot examples:
1. "The food in mess is disgusting and tastes like garbage" -> NEGATIVE, MEDIUM, not abusive
2. "Warden is a stupid idiot who harasses students" -> ABUSIVE (personal attack)
3. "Ragging happening in hostel B block, seniors beating juniors" -> CRITICAL, CONFIDENTIAL_SAFETY
4. "WiFi not working in library since 3 days, very slow" -> NEGATIVE, MEDIUM, INFRASTRUCTURE
5. "Thank you for fixing the lift quickly!" -> POSITIVE, LOW
6. "I will kill myself if this continues" -> CRITICAL, SELF_HARM
7. "Chutiya warden madarchod hai" -> ABUSIVE (Hindi slurs)
`;
}

function validateAndNormalizeResult(parsed: any, category: string, originalText: string): AIClassificationResult {
  // Ensure all required fields exist with valid values
  return {
    category: parsed.category || category,
    subCategory: parsed.subCategory || "GENERAL",
    sentiment: ["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(parsed.sentiment) ? parsed.sentiment : "NEUTRAL",
    sentimentScore: Math.max(-1, Math.min(1, parsed.sentimentScore || 0)),
    severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(parsed.severity) ? parsed.severity : "LOW",
    isAbusive: Boolean(parsed.isAbusive),
    abuseReason: parsed.isAbusive ? (parsed.abuseReason || "Abuse detected") : null,
    language: ["EN", "HI", "KN", "MAI"].includes(parsed.language) ? parsed.language : "EN",
    englishTranslation: parsed.englishTranslation || "",
    summary: parsed.summary || originalText.substring(0, 200),
    containsPii: Boolean(parsed.containsPii),
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
  };
}

// Weekly insight generation
export async function generateWeeklyInsights(feedbackData: any[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || feedbackData.length === 0) {
    return "Insufficient data for AI insights this week.";
  }

  const summary = feedbackData.slice(0, 50).map(f => ({
    category: f.category,
    severity: f.severity,
    sentiment: f.sentiment,
    summary: f.summary,
  }));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
        max_tokens: 1500,
        temperature: 0.3,
        system: "You are an analytics expert for a university. Generate a concise weekly insight report from feedback data.",
        messages: [{
          role: "user",
          content: `Generate a weekly insight report for university administration based on this feedback data:\n${JSON.stringify(summary, null, 2)}\n\nInclude:\n1. Top 3 trending issues\n2. Sentiment shift vs last week\n3. SLA compliance concerns\n4. Department-specific highlights\n5. Actionable recommendations\n\nKeep it under 500 words, professional tone.`
        }],
      }),
    });

    const data = await response.json();
    return data.content[0]?.text || "AI insight generation failed.";
  } catch {
    return "AI insight generation temporarily unavailable.";
  }
}