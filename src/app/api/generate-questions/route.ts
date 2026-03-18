import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { jobTitle, jobDescription, resumeText, language = "English" } = await req.json();

    if (!jobTitle || !jobDescription || !resumeText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an AI interviewer. Your task is to generate exactly 5 diverse interview questions for a candidate applying for the "${jobTitle}" role.
The job description is: "${jobDescription}"
The candidate's resume/profile details are: ${resumeText}.

Generate 5 interview questions that are relevant to the job and the candidate's resume.
These questions MUST be strictly translated into: ${language} language.

Instructions:
1. Provide EXACTLY 5 questions.
2. Each question must be on a NEW LINE.
3. DO NOT include numbering (e.g., 1., 2., - ), bullet points (* ), or any introductory/concluding text.
4. Just provide the plain question text, one per line.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/^\s*[\d\.\-\*\+]+\s*/gm, '').replace(/\*\*/g, '').trim();
    const questions = cleanText.split('\n').map(q => q.trim()).filter(q => q && q.length > 15).slice(0, 5);

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error("Gemini Generate Questions Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate questions" }, { status: 500 });
  }
}
