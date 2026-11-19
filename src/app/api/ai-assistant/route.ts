import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a helpful campus feedback assistant for a university. You help students with:
- How to submit feedback about campus services (hostel, mess, academics, infrastructure, sports, sanitation, security, financial, confidential safety)
- How to track feedback status using tracking codes
- How the anonymous feedback system works
- What happens after feedback is submitted
- Emergency/safety concerns
- Language support (English, Hindi, Kannada, Maithili)

Key principles:
- Always emphasize privacy and anonymity
- Tracking codes are provided after submission
- Feedback is AI-classified and prioritized
- Critical issues (harassment, ragging, assault, self-harm) get immediate escalation
- Students can write in any language or mixed languages
- Maithili translation quality may vary

Keep responses concise, friendly, and helpful. Use the user's language when possible.`,
  hi: `आप एक सहायक कैंपस फीडबैक असिस्टेंट हैं। आप छात्रों की मदद करते हैं:
- कैंपस सेवाओं (हॉस्टल, मेस, अकादमिक, इन्फ्रास्ट्रक्चर, खेल, सफाई, सुरक्षा, वित्तीय, गोपनीय सुरक्षा) के बारे में फीडबैक कैसे दें
- ट्रैकिंग कोड का उपयोग करके फीडबैक स्थिति कैसे जांचें
- गुमनाम फीडबैक सिस्टम कैसे काम करता है
- फीडबैक जमा करने के बाद क्या होता है
- आपातकालीन/सुरक्षा चिंताएं
- भाषा समर्थन (अंग्रेजी, हिंदी, कन्नड़, मैथिली)

मुख्य सिद्धांत:
- हमेशा गोपनीयता और गुमनामी पर जोर दें
- जमा करने के बाद ट्रैकिंग कोड प्रदान किए जाते हैं
- फीडबैक को AI द्वारा वर्गीकृत और प्राथमिकता दी जाती है
- गंभीर मुद्दे (उत्पीड़न, रैगिंग, हमला, आत्महत्या) को तुरंत एस्केलेट किया जाता है
- छात्र किसी भी भाषा में या मिश्रित भाषाओं में लिख सकते हैं
- मैथिली अनुवाद की गुणवत्ता भिन्न हो सकती है

संक्षिप्त, मैत्रीपूर्ण और सहायक प्रतिक्रियाएं दें। संभव हो तो उपयोगकर्ता की भाषा का उपयोग करें।`,
  kn: `ನೀವು ಒಂದು ಸಹಾಯಕ ಕೆಂಪಸ್ ಪ್ರತಿಕ್ರಿಯಾ ಸಹಾಯಕರು. ನೀವು ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ಸಹಾಯ ಮಾಡುತ್ತೀರಿ:
- ಕ್ಯಾಂಪಸ್ ಸೇವೆಗಳ ಬಗ್ಗೆ (ಹಾಸ್ಟೆಲ್, ಮೆಸ್, ಶೈಕ್ಷಣಿಕ, ಮೂಲಭೂತ ಸೌಕ್ಯಗಳು, ಕ್ರೀಡಾ, ಸ್ವಚ್ಛತೆ, ಸುರಕ್ಷತೆ, ఆర್ಥಿಕ, ಗೌಪ್ಯ ಸುರಕ್ಷತೆ) ಪ್ರತಿಕ್ರಿಯೆ ಹೇಗೆ ಸಲ್ಲಿಸಬೇಕು
- ಟ್ರ್ಯಾಕಿಂಗ್ ಕೋಡ್ ಬಳಸಿ ಪ್ರತಿಕ್ರಿಯೆ ಸ್ಥಿತಿ ಹೇಗೆ ಪರಿಶೀಲಿಸಬೇಕು
- ಗೌಪ್ಯ ಪ್ರತಿಕ್ರಿಯೆ ವ್ಯವಸ್ಥೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ
- ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಿದ ನಂತರ ಏನು ಆಗುತ್ತದೆ
- അടಿಂಚಿನ ಸುರಕ್ಷತಾ చింతೆಗಳು
- ಭಾಷಾ ಬೆಂಬಲ (ಇಂಗ್ಲೀಷ್, ಹಿಂದಿ, ಕನ್ನಡ, ಮೈಥಿಲಿ)

ಮುಖ್ಯ ಸಿದ್ಧಾಂತಗಳು:
- ಗೌಪ್ಯತೆ ಮತ್ತು ಅನಾಮಿಕತೆಯ ಮೇಲೆ ಯಾವಾಗಲೂ ಜোর ನೀಡಿ
- ಸಲ್ಲಿಸಿದ ನಂತರ ಟ್ರ್ಯಾಕಿಂಗ್ ಕೋಡ್ வழங்கಲಾಗುತ್ತದೆ
- ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು AI ವಿಂಗಡಿಸುತ್ತದೆ ಮತ್ತು ಪ್ರাধಾನ್ಯਤਾ ನೀಡುತ್ತದೆ
- ಗಂಭೀರ Franti (ಉತ್ටටನ, ರ್ಯಾಗ್ಗಿಂಗ್, ದಾಳಿ, ಆತ್ಮಹತ್ಯೆ) ತಕ್ಷಣ ಏಸ್ಕಲೇಟ್ ಮಾಡಲಾಗುತ್ತದೆ
- ವಿದ್ಯಾರ್ಥಿಗಳು ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಅಥವಾ ಮಿಶ್ರಿತ ಭಾಷೆಗಳಲ್ಲಿ ಬರೆಯ можуть
- ಮೈಥಿಲಿ ಅನುವಾದ ಗುಣಮಟ್ಟ ಬದಲಾಗಬಹುದು

ಸಂಕ್ಷಿಪ್ತ, ಸ್ನೇಹಿತ ಮತ್ತು ಸಹಾಯಕ ಉತ್ತರಗಳನ್ನು ನೀಡুন. ಸಾಧ್ಯವಾದರೆ ಬಳಕೆದಾರದ ಭಾಷೆಯನ್ನು ಬಳಸಿ.`,
  mai: `अहाँ एक सहायक कॅम्पस फिडबॅक असिस्टेन्ट अछि। अहाँ छात्रक सहायता करैत छी:
- कॅम्पस सेवाक बॅरमे (हॉस्टल, मेस, अकॅडेमिक, इन्फ्रास्ट्रक्चर, स्पोर्ट्स, सेनिटेशन, सेक्युरिटी, फाइनॅन्शियल, कॉन्फिडेन्शियल सेफ्टी) फिडबॅक कइसन दैतै
- ट्रॅकिंग कोडक प्रयोग करि फिडबॅक स्थिति कइसन जाँचैतै
- अनाम फिडबॅक प्रणाली कइसन काम करैत
- फिडबॅक जमा करबक बाद कतक होइतै
- इमर्जेन्सी/सेफ्टी चिंता
- भाषा सपोर्ट (इंग्लिश, हिंदी, कन्नड, मैथिली)

मुख्य सिद्धांत:
- सभय गोपनीयता आउर अनामिकताक उपर जोर देब
- जमा करबक बाद ट्रॅकिंग कोड प्रदान कइल जाइतै
- फिडबॅक के AI द्वार वर्गीकृत आउर प्राथमिकता दइल जाइतै
- गंभीर मुद्दा (उत्पीड़न, रैगिंग, हमला, आत्महत्या) के तुरुन्त एस्केलेट कइल जाइतै
- छात्र कउनो भाषा मेँ आउर मिश्रित भाषामें लिख सकैत छी
- मैथिली अनुवादक गुणवत्ता भिन्न होइ सकैत छी

संक्षिप्त, मैत्रीपूर्ण आउर सहायक उत्तर देब। संभव होइतै त उपयोगकर्ताक भाषा क प्रयोग करैत।`,
};

export async function POST(req: NextRequest) {
  try {
    const { message, language, history } = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const lang = language || "en";
    const systemPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.en;

    // Try Claude API if available
    let response = "";
    let responseLanguage = lang;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
            max_tokens: 500,
            temperature: 0.3,
            system: systemPrompt,
            messages: [
              ...(history || []).slice(-5).map((msg: any) => ({
                role: msg.role,
                content: msg.content,
              })),
              { role: "user", content: message },
            ],
          }),
        });

        if (anthropicRes.ok) {
          const data = await anthropicRes.json();
          response = data.content[0]?.text || "";
        }
      } catch (error) {
        console.warn("Claude API failed, using fallback:", error);
      }
    }

    // Fallback responses if AI fails
    if (!response) {
      response = getFallbackResponse(message, lang);
    }

    // Detect response language (simple heuristic)
    if (/[ऀ-ॿ]/.test(response)) {
      responseLanguage = "hi";
    } else if (/[ಀ-೿]/.test(response)) {
      responseLanguage = "kn";
    }

    return NextResponse.json({
      response,
      language: responseLanguage,
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

function getFallbackResponse(message: string, lang: string): string {
  const lowerMsg = message.toLowerCase();

  // English fallbacks
  const enResponses: Record<string, string> = {
    "how to submit": `To submit feedback:
1. Go to the Submit Feedback page or scan a QR code at a campus location
2. Select a category (Hostel, Mess, Academics, Infrastructure, etc.)
3. Write your title and description (you can use English, Hindi, Kannada, or Maithili)
4. Optionally attach photos
5. Choose anonymous submission (recommended)
6. Click Submit - you'll get a tracking code immediately

Your identity is never linked to your feedback.`,
    "track": `To track your feedback:
1. Go to the Track page
2. Enter your tracking code (format: TRK-...) or ticket code (format: FEED-...)
3. You'll see the current status, SLA deadline, and any resolution notes

You can also check status anonymously without logging in.`,
    "anonymous": `Yes, your feedback is completely anonymous:
- We compute a one-way anonymous ID (anon_id) from your user ID using HMAC-SHA256
- Your name, email, IP address, and device info are NEVER stored with feedback
- Admins CANNOT see who submitted any feedback
- Only the tracking code lets you check status without revealing identity`,
    "after submit": `After you submit:
1. Feedback is saved instantly with a tracking code
2. Rule-based AI classifies it immediately (category, severity, sentiment, language)
3. Background AI (Claude) does deeper analysis: translation, abuse check, PII detection
4. Critical issues (harassment, ragging, assault, self-harm) are escalated immediately
5. Feedback appears on admin dashboard in real-time
6. SLA clock starts based on severity (Critical: 4h, High: 12h, Medium: 24h, Low: 72h)`,
    "emergency": `For urgent safety concerns:
- Use the "Confidential Safety" category on the feedback form
- Mark as "Emergency" in the description
- Critical issues are auto-escalated to authorities within minutes
- You can also contact campus security directly at the emergency number
- Your anonymity is still protected even for emergency reports`,
    "language": `Supported languages:
- English (full support)
- Hindi / हिंदी (full support)
- Kannada / ಕನ್ನಡ (full support)
- Maithili / मैथिली (basic support - translation quality may vary)

You can write in any language or mix languages (Hinglish, etc.). The AI detects the language and translates to English for admins.`,
    "default": `I'm here to help with campus feedback! You can ask me about:
- How to submit feedback
- How to track your ticket
- How anonymity works
- What happens after submission
- Emergency procedures
- Language support

What would you like to know?`,
  };

  // Hindi fallbacks
  const hiResponses: Record<string, string> = {
    "कैसे": `फीडबैक सबमिट करने के लिए:
1. फीडबैक सबमिट पेज पर जाएं या कैंपस लोकेशन पर QR कोड स्कैन करें
2. श्रेणी चुनें (हॉस्टल, मेस, अकादमिक, इन्फ्रास्ट्रक्चर, आदि)
3. शीर्षक और विवरण लिखें (आप अंग्रेजी, हिंदी, कन्नड़, या मैथिली में लिख सकते हैं)
4. वैकल्पिक रूप से फोटो संलग्न करें
5. गुमनाम सबमिशन चुनें (अनुशंसित)
6. सबमिट पर क्लिक करें - आपको तुरंत ट्रैकिंग कोड मिलेगा

आपकी पहचान कभी भी आपके फीडबैक से जुड़ी नहीं होती।`,
    "ट्रैक": `फीडबैक ट्रैक करने के लिए:
1. ट्रैक पेज पर जाएं
2. अपना ट्रैकिंग कोड (फॉर्मेट: TRK-...) या टिकट कोड (फॉर्मेट: FEED-...) दर्ज करें
3. आपको वर्तमान स्थिति, SLA डेडलाइन, और समाधान नोट्स दिखाई देंगे

आप लॉगिन किए बिना भी गुमनाम रूप से स्थिति जांच सकते हैं।`,
    "गुमनाम": `हाँ, आपका फीडबैक पूरी तरह से गुमनाम है:
- हम आपके यूजर ID से HMAC-SHA256 का उपयोग करके एक वन-वे अनाम ID (anon_id) बनाते हैं
- आपका नाम, ईमेल, IP पता, और डिवाइस जानकारी फीडबैक के साथ कभी संग्रहीत नहीं होती
- एडमिन यह नहीं देख सकते कि किसने फीडबैक दिया
- केवल ट्रैकिंग कोड से आप बिना पहचान बताए स्थिति जांच सकते हैं`,
    "जमा": `जमा करने के बाद:
1. फीडबैक ट्रैकिंग कोड के साथ तुरंत सेव हो जाता है
2. नियम-आधारित AI तुरंत वर्गीकृत करता है (श्रेणी, गंभीरता, भावना, भाषा)
3. बैकग्राउंड AI (Claude) गहन विश्लेषण करता है: अनुवाद, दुरुपयोग जांच, PII पहचान
4. गंभीर मुद्दे (उत्पीड़न, रैगिंग, हमला, आत्महत्या) तुरंत एस्केलेट होते हैं
5. फीडबैक एडमिन डैशबोर्ड पर रियल-टाइम में दिखाई देता है
6. गंभीरता के आधार पर SLA घड़ी शुरू होती है (गंभीर: 4घं, उच्च: 12घं, मध्यम: 24घं, कम: 72घं)`,
    "आपातकाल": `तात्कालिक सुरक्षा चिंताओं के लिए:
- फीडबैक फॉर्म पर "गोपनीय सुरक्षा" श्रेणी का उपयोग करें
- विवरण में "आपातकाल" लिखें
- गंभीर मुद्दे मिनटों में अधिकारियों को ऑटो-एस्केलेट होते हैं
- आप सीधे कैंपस सुरक्षा से भी संपर्क कर सकते हैं
- आपातकालीन रिपोर्ट के लिए भी आपकी गुमनियत सुरक्षित रहती है`,
    "भाषा": `समर्थित भाषाएं:
- अंग्रेजी (पूर्ण समर्थन)
- हिंदी (पूर्ण समर्थन)
- कन्नड़ (पूर्ण समर्थन)
- मैथिली (बुनियादी समर्थन - अनुवाद गुणवत्ता भिन्न हो सकती है)

आप किसी भी भाषा में या मिश्रित भाषाओं (हिंग्लिश, आदि) में लिख सकते हैं। AI भाषा का पता लगाता है और एडमिन के लिए अंग्रेजी में अनुवाद करता है।`,
    "default": `मैं कैंपस फीडबैक में मदद के लिए यहाँ हूँ! आप मुझसे पूछ सकते हैं:
- फीडबैक कैसे सबमिट करें
- अपना टिकट कैसे ट्रैक करें
- गुमनियत कैसे काम करती है
- जमा करने के बाद क्या होता है
- आपातकालीन प्रक्रियाएं
- भाषा समर्थन

आप क्या जानना चाहेंगे?`,
  };

  const responses = lang === "hi" ? hiResponses : enResponses;

  // Simple keyword matching
  for (const [keyword, response] of Object.entries(responses)) {
    if (lowerMsg.includes(keyword.toLowerCase())) {
      return response;
    }
  }

  return responses.default;
}