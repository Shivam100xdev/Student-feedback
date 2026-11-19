import { describe, it, expect } from "vitest";
import { analyzeComplaint } from "@/lib/engine/classifier";

describe("Rule-Based Classification Engine", () => {
  it("should classify hostel issues correctly", () => {
    const text = "The fan in my room is broken";
    const result = analyzeComplaint(text);
    expect(result.category).toBe("HOSTEL");
  });

  it("should redact PII like email and phone numbers", () => {
    const text = "My email is test@example.com and phone is 9876543210";
    const result = analyzeComplaint(text);
    expect(result.piiRedacted).toBe(true);
    expect(result.redactedText).toContain("[EMAIL REDACTED]");
    expect(result.redactedText).toContain("[PHONE REDACTED]");
  });

  it("should assign max severity to safety/harassment complaints", () => {
    const text = "Report regarding ragging near the hostel block";
    const result = analyzeComplaint(text);
    expect(result.category).toBe("CONFIDENTIAL_SAFETY");
    expect(result.severity).toBe(5);
  });
});
