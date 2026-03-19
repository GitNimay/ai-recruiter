import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const processFile = async (f: File) => {
      try {
        const bytes = await f.arrayBuffer();
        const base64Data = Buffer.from(bytes).toString("base64");

        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash", 
          generationConfig: { responseMimeType: "application/json" } 
        });

        const prompt = `Extract the candidate's name, primary email address, and primary phone number from this resume document.
Return the result strictly as a JSON object with keys "name", "email", and "phone". If any field is not found, set its value to null. Make sure to accurately identify the name.`;

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

        return {
          fileName: f.name,
          name: parsedData.name || null,
          email: parsedData.email || null,
          phone: parsedData.phone || null,
          error: (!parsedData.name && !parsedData.email && !parsedData.phone) ? "No information found in resume" : null,
        };
      } catch (err) {
        console.error("Extraction error:", err);
        return {
          fileName: f.name,
          name: null,
          email: null,
          phone: null,
          error: `Parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }
    };

    // Process the single file and return array to preserve compatibility with UI that expects data.results
    const result = await processFile(file);

    return NextResponse.json({ results: [result] });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

