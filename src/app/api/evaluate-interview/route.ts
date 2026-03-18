import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { jobTitle, jobDescription, resumeText, questions, transcripts } = await req.json();

    if (!jobTitle || !jobDescription || !questions || !transcripts) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let evaluationPrompt = `*** CRITICAL INSTRUCTIONS ***
1. OBJECTIVITY: Base all scores and feedback STRICTLY on the provided transcript and resume. Do not assume any skills not explicitly demonstrated.
2. TONE: Maintain a professional, constructive, and HR-compliant tone. Avoid overly harsh criticism; frame weaknesses as "areas for growth".
3. NO HALLUCINATIONS: If the candidate did not answer a question, state "No response provided" rather than guessing.
4. BIAS ELIMINATION: Evaluate solely on technical merit, communication skills, and role alignment. Ignore any demographic indicators.
5. FORMATTING REQUIREMENT: You MUST return your analysis EXACTLY in the following JSON format. Do not wrap the JSON in markdown blocks, and do not include any conversational text before or after the JSON.

You are an expert AI hiring manager evaluating a candidate's interview performance for the "${jobTitle}" role.
Job Description: "${jobDescription}"
Candidate Resume Details: ${resumeText || "Not Provided"}

Interview Questions & Transcribed Answers:
---
`;

    questions.forEach((q: string, i: number) => {
      const transcript = transcripts[i] || '(Transcription Unavailable)';
      evaluationPrompt += `Question ${i + 1}: ${q}\nAnswer ${i + 1} Transcription: ${transcript}\n---\n`;
    });

    evaluationPrompt += `
Analyze the candidate's responses and provide your evaluation in the following JSON format:
{
  "overallScore": [integer 1-10],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areasForImprovement": ["area 1", "area 2", "area 3"],
  "communicationSkills": "[1-2 sentence summary of clarity and confidence]",
  "technicalAlignment": "[1-2 sentence summary of how answers match the job description]",
  "finalRecommendation": "[Proceed to Next Round | Hold | Reject]"
}

Scoring Guidelines:
- overallScore: Rate 1-10 based on overall interview performance (1-3: Reject, 4-6: Hold, 7-10: Proceed)
- strengths: List 2-4 items max, only include skills/qualities clearly demonstrated in the interview
- areasForImprovement: List 2-4 items max, phrased constructively as "areas for growth"
- communicationSkills: Brief summary of verbal clarity, confidence, and articulation
- technicalAlignment: Brief summary of how well the candidate's answers align with job requirements
- finalRecommendation: Choose based on overall score and role fit`;

    const result = await model.generateContent(evaluationPrompt);
    const rawResponse = result.response.text();

    let jsonStr = rawResponse.trim();
    jsonStr = jsonStr.replace(/^```json\s*/i, '');
    jsonStr = jsonStr.replace(/^```\s*/i, '');
    jsonStr = jsonStr.replace(/\s*```$/i, '');
    jsonStr = jsonStr.trim();

    let evaluation;
    try {
      evaluation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw response:", rawResponse);
      return NextResponse.json({ error: "Failed to parse evaluation response" }, { status: 500 });
    }

    const requiredFields = ['overallScore', 'strengths', 'areasForImprovement', 'communicationSkills', 'technicalAlignment', 'finalRecommendation'];
    const missingFields = requiredFields.filter(field => !(field in evaluation));
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: "Invalid evaluation format", 
        missingFields 
      }, { status: 400 });
    }

    if (typeof evaluation.overallScore !== 'number' || evaluation.overallScore < 1 || evaluation.overallScore > 10) {
      return NextResponse.json({ error: "overallScore must be a number between 1 and 10" }, { status: 400 });
    }

    if (!Array.isArray(evaluation.strengths) || evaluation.strengths.length < 2 || evaluation.strengths.length > 4) {
      return NextResponse.json({ error: "strengths must be an array with 2-4 items" }, { status: 400 });
    }

    if (!Array.isArray(evaluation.areasForImprovement) || evaluation.areasForImprovement.length < 2 || evaluation.areasForImprovement.length > 4) {
      return NextResponse.json({ error: "areasForImprovement must be an array with 2-4 items" }, { status: 400 });
    }

    const validRecommendations = ['Proceed to Next Round', 'Hold', 'Reject'];
    if (!validRecommendations.includes(evaluation.finalRecommendation)) {
      return NextResponse.json({ error: "finalRecommendation must be one of: Proceed to Next Round, Hold, Reject" }, { status: 400 });
    }

    return NextResponse.json(evaluation);
  } catch (error: any) {
    console.error("Gemini Evaluation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate evaluation" }, { status: 500 });
  }
}
