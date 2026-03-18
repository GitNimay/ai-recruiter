import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64 string
    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `Extract the candidate's core professional details from this resume document.
Return the result strictly as a JSON object with keys "skills" (array of strings), "experience" (a short 2-sequence summary of their work history), and "projects" (array of strings). 
Make it extremely concise and relevant.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "application/pdf"
        }
      }
    ]);

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({
      skills: parsedData.skills || [],
      experience: parsedData.experience || "Not listed",
      projects: parsedData.projects || [],
    });

  } catch (err) {
    console.error("Resume Analysis Error:", err);
    return NextResponse.json(
      { error: `Analysis error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
