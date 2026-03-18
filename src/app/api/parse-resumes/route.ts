import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files } = body; // Array of { name, contentBase64 }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const processFile = async (file: any) => {
      if (!file.contentBase64) {
        return {
          fileName: file.name,
          name: null,
          email: null,
          phone: null,
          error: "No file content provided",
        };
      }

      try {
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
              data: file.contentBase64,
              mimeType: "application/pdf"
            }
          }
        ]);

        const responseText = result.response.text();
        const parsedData = JSON.parse(responseText);

        return {
          fileName: file.name,
          name: parsedData.name || null,
          email: parsedData.email || null,
          phone: parsedData.phone || null,
          error: (!parsedData.name && !parsedData.email && !parsedData.phone) ? "No information found in resume" : null,
        };
      } catch (err) {
        console.error("Extraction error:", err);
        return {
          fileName: file.name,
          name: null,
          email: null,
          phone: null,
          error: `Parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }
    };

    // Process all files concurrently
    const results = await Promise.all(files.map(processFile));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

