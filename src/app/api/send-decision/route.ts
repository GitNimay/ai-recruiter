"use server";

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

async function generateAcceptanceEmail(params: {
  candidateName: string;
  recruiterName: string;
  companyName: string;
  jobTitle: string;
  evaluation: string;
}): Promise<{ subject: string; body: string }> {
  const model = getGeminiModel();

  const prompt = `You are a professional recruiter named ${params.recruiterName} from ${params.companyName}. 
Write a personalized, warm acceptance email for a candidate who has been selected after an interview.

Candidate Name: ${params.candidateName}
Position: ${params.jobTitle}
Company: ${params.companyName}
Evaluation Feedback: ${params.evaluation}

The email MUST perfectly follow these severe constraints:
- Must be extremely short and concise (strictly maximum 10-15 lines of text total).
- Address the candidate by their first name naturally.
- Include congratulations on being selected.
- Include 1-2 specific positive feedback points based on their evaluation strengths.
- Mention the specific role name: "${params.jobTitle}".
- Include clear next steps (e.g., "We'll schedule the next round within 5-7 business days" or "Please expect an HR call within 3 business days").
- End warm and professional with recruiter's name and company signature.
- NEVER use bracket placeholders like [Candidate Name] - use the actual name provided.
- Be HR-compliant and professional.

Return the response in this exact JSON format:
{
  "subject": "Email subject line here",
  "body": "The email body in plain text with line breaks"
}

Return ONLY valid JSON, no markdown code blocks.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  let parsed;
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      subject: `Congratulations! You've Been Selected - ${params.jobTitle} at ${params.companyName}`,
      body: text,
    };
  }

  return { subject: parsed.subject, body: parsed.body };
}

async function generateRejectionEmail(params: {
  candidateName: string;
  recruiterName: string;
  companyName: string;
  jobTitle: string;
  evaluation: string;
}): Promise<{ subject: string; body: string }> {
  const model = getGeminiModel();

  const prompt = `You are a professional recruiter named ${params.recruiterName} from ${params.companyName}. 
Write an HR-compliant, appreciative rejection email for a candidate after an interview.

Candidate Name: ${params.candidateName}
Position: ${params.jobTitle}
Company: ${params.companyName}
Evaluation Feedback: ${params.evaluation}

The email MUST perfectly follow these severe constraints:
- Must be extremely short and concise (strictly maximum 10-15 lines of text total).
- Address the candidate by their first name naturally.
- Thank them genuinely for their time and interest in the position.
- Include the specific role name: "${params.jobTitle}".
- Provide 1-2 brief constructive feedback points based on areas for growth mentioned in their evaluation.
- Encourage them to apply again for future opportunities.
- Keep it warm but professional - they deserve respect for their effort.
- End with recruiter's name and company signature.
- NEVER use bracket placeholders like [Candidate Name] - use the actual name provided.
- Be HR-compliant, empathetic, and professional. Do not burn bridges.

Return the response in this exact JSON format:
{
  "subject": "Email subject line here",
  "body": "The email body in plain text with line breaks"
}

Return ONLY valid JSON, no markdown code blocks.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  let parsed;
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      subject: `Update on Your Application - ${params.jobTitle} at ${params.companyName}`,
      body: text,
    };
  }

  return { subject: parsed.subject, body: parsed.body };
}

function convertToHtmlEmail(body: string): string {
  return `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.8;">
      ${body
        .split("\n")
        .map((line: string) => (line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : ""))
        .join("")}
    </div>
  `;
}

async function sendBrevoEmail(params: {
  to: string;
  subject: string;
  htmlContent: string;
  senderName: string;
  senderEmail: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: params.senderName, email: params.senderEmail },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || "Failed to send email" };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      candidateEmail,
      candidateName,
      recruiterName,
      recruiterEmail,
      companyName,
      jobTitle,
      evaluation,
      decisionType,
    } = body;

    // Validate required fields
    if (!candidateEmail) {
      return NextResponse.json(
        { success: false, error: "Candidate email is required" },
        { status: 400 }
      );
    }

    if (!recruiterName || !recruiterEmail || !companyName || !jobTitle) {
      return NextResponse.json(
        { success: false, error: "Missing recruiter or job information" },
        { status: 400 }
      );
    }

    if (!decisionType || !["accept", "reject"].includes(decisionType)) {
      return NextResponse.json(
        { success: false, error: "Invalid decisionType. Must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    // Generate evaluation summary if not provided
    let evaluationSummary = evaluation;
    if (!evaluationSummary || evaluationSummary === 'undefined') {
      evaluationSummary = decisionType === "accept" 
        ? "Strong interview performance with good technical skills and communication."
        : "Interview completed with some areas identified for improvement.";
    }

    let emailContent;
    if (decisionType === "accept") {
      emailContent = await generateAcceptanceEmail({
        candidateName: candidateName || "Candidate",
        recruiterName,
        companyName,
        jobTitle,
        evaluation: evaluationSummary,
      });
    } else {
      emailContent = await generateRejectionEmail({
        candidateName: candidateName || "Candidate",
        recruiterName,
        companyName,
        jobTitle,
        evaluation: evaluationSummary,
      });
    }

    const htmlBody = convertToHtmlEmail(emailContent.body);

    const emailResult = await sendBrevoEmail({
      to: candidateEmail,
      subject: emailContent.subject,
      htmlContent: htmlBody,
      senderName: recruiterName,
      senderEmail: recruiterEmail,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, error: emailResult.error || "Failed to send email via Brevo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      emailSubject: emailContent.subject,
      messageId: emailResult.messageId,
    });
  } catch (err) {
    console.error("Send decision error:", err);
    return NextResponse.json(
      { success: false, error: `Server error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
