import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

// Initialize Gemini
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Generate personalized email using Gemini
async function generateEmail(params: {
  candidateEmail: string;
  recruiterName: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  interviewLink: string;
  interviewPassword: string;
  candidateName?: string;
}): Promise<{ subject: string; htmlBody: string }> {
  const model = getGeminiModel();

  const prompt = `You are a professional recruiter named ${params.recruiterName} from ${params.companyName}. 
Write a personalized, professional email inviting someone to interview for the position of ${params.jobTitle}.

Job Description: ${params.jobDescription}

The email MUST perfectly follow these severe constraints:
- Must be extremely short and concise (strictly maximum 10 lines of text total).
- Address the candidate naturally by their name: ${params.candidateName ? params.candidateName.split(" ")[0] : "Candidate"}. NEVER use bracket placeholders like [Candidate Name] in your response.
- Be warm but professional.
- Start by briefly mentioning why the candidate might be a good fit.
- Explicitly state their unique access password: "${params.interviewPassword}"
- Explicitly instruct them to use that password when clicking the provided interview link.
- End with the recruiter's name and company.

Interview Link: ${params.interviewLink}

Return the response in this exact JSON format:
{
  "subject": "Email subject line here",
  "body": "The email body in plain text with line breaks"
}

Return ONLY valid JSON, no markdown code blocks.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  
  // Parse the JSON response
  let parsed;
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      subject: `Interview Opportunity: ${params.jobTitle} at ${params.companyName}`,
      body: text,
    };
  }

  // Convert plain text body to HTML
  const htmlBody = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.8;">
      ${parsed.body
        .split("\n")
        .map((line: string) => (line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : ""))
        .join("")}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
        <a href="${params.interviewLink}" style="display: inline-block; padding: 12px 24px; background: #0a0a0a; color: #fafafa; text-decoration: none; font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase;">
          Start Interview →
        </a>
      </div>
    </div>
  `;

  return { subject: parsed.subject, htmlBody };
}

// Send email via Brevo
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
        "accept": "application/json",
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
    let appUrl = request.headers.get('origin') || 
                   (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || 
                   process.env.NEXT_PUBLIC_APP_URL || 
                   request.nextUrl.origin || 
                   "http://localhost:3000";

    if (appUrl.includes("localhost") && process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    }

    const body = await request.json();
    const {
      candidates,
      recruiterName,
      recruiterEmail,
      companyName,
      jobTitle,
      jobDescription,
      workspaceId,
    } = body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
    }

    if (!recruiterName || !companyName || !jobTitle || !recruiterEmail) {
      return NextResponse.json({ error: "Missing required fields (including auth email)" }, { status: 400 });
    }

    const results = [];

    for (const candidate of candidates) {
      if (!candidate.email) {
        results.push({
          candidateId: candidate.id,
          status: "skipped",
          error: "No email address",
        });
        continue;
      }

      try {
        // Generate unique interview link and password
        const uniqueToken = uuidv4();
        const interviewLink = `${appUrl}/interview/${workspaceId}/${uniqueToken}`;
        const interviewPassword = Math.random().toString(36).slice(-8); // 8-char random alphanumeric

        // Generate personalized email with Gemini
        const { subject, htmlBody } = await generateEmail({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          recruiterName,
          companyName,
          jobTitle,
          jobDescription: jobDescription || jobTitle,
          interviewLink,
          interviewPassword,
        });

        // Send via Brevo
        const emailResult = await sendBrevoEmail({
          to: candidate.email,
          subject,
          htmlContent: htmlBody,
          senderName: recruiterName,
          senderEmail: recruiterEmail,
        });

        results.push({
          candidateId: candidate.id,
          email: candidate.email,
          status: emailResult.success ? "sent" : "failed",
          uniqueLink: interviewLink,
          uniqueToken,
          interviewPassword,
          messageId: emailResult.messageId,
          error: emailResult.error,
        });

        // Small delay between emails to avoid rate limits
        if (candidates.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (err) {
        results.push({
          candidateId: candidate.id,
          email: candidate.email,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      total: candidates.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
