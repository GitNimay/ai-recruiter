import { NextRequest, NextResponse } from "next/server";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_TRANSCRIPT_ENDPOINT = 'https://api.assemblyai.com/v2/transcript';

export async function POST(req: NextRequest) {
  try {
    const { audio_url } = await req.json();

    if (!audio_url) {
      return NextResponse.json({ error: "No audio_url provided" }, { status: 400 });
    }

    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json({ error: "Assembly AI API key is missing" }, { status: 500 });
    }

    const response = await fetch(ASSEMBLYAI_TRANSCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ audio_url })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transcription request failed");

    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error("AssemblyAI Proxy Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const transcriptId = url.searchParams.get("transcriptId");

    if (!transcriptId) {
      return NextResponse.json({ error: "Missing transcriptId" }, { status: 400 });
    }

    if (!ASSEMBLYAI_API_KEY) {
      return NextResponse.json({ error: "Assembly AI API key is missing" }, { status: 500 });
    }

    const response = await fetch(`${ASSEMBLYAI_TRANSCRIPT_ENDPOINT}/${transcriptId}`, {
      method: 'GET',
      headers: { 'authorization': ASSEMBLYAI_API_KEY }
    });

    const data = await response.json();
    if (data.status === 'completed') {
      return NextResponse.json({ status: 'completed', text: data.text || '(No speech detected)' });
    }
    if (data.status === 'error') {
      return NextResponse.json({ status: 'error', text: `Error: ${data.error}` });
    }
    return NextResponse.json({ status: data.status, text: null }); // queued or processing
  } catch (error: any) {
    console.error("AssemblyAI Proxy Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
