"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Script from "next/script";

type Step = "auth" | "resume" | "setup" | "interview" | "processing" | "report";

// Helper components COMPO
const TicTacToe = () => {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  };

  const handleClick = (i: number) => {
    if (winner || board[i] || !isXNext) return;
    const newBoard = [...board];
    newBoard[i] = "X";
    setBoard(newBoard);
    setIsXNext(false);
    const w = checkWinner(newBoard);
    if (w) setWinner(w);
  };

  useEffect(() => {
    if (!isXNext && !winner) {
      const timer = setTimeout(() => {
        const available = board.map((v, i) => (v === null ? i : null)).filter((v) => v !== null);
        if (available.length > 0) {
          const random = available[Math.floor(Math.random() * available.length)] as number;
          const newBoard = [...board];
          newBoard[random] = "O";
          setBoard(newBoard);
          setIsXNext(true);
          const w = checkWinner(newBoard);
          if (w) setWinner(w);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isXNext, winner, board]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#111]/90 backdrop-blur border border-[#333] rounded">
      <h3 className="text-xl font-mono text-[#ededed] mb-4">
        {winner ? (winner === "X" ? "You Won!" : "AI Won.") : isXNext ? "Your Turn (X)" : "AI Thinking..."}
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!cell || !!winner || !isXNext}
            className={`w-16 h-16 text-2xl font-mono flex items-center justify-center border transition-all ${
              cell === "X" ? "text-white border-[#ededed]" : cell === "O" ? "text-[#888] border-[#888]" : "border-[#333] hover:bg-[#222]"
            }`}
          >
            {cell}
          </button>
        ))}
      </div>
      {winner ? (
        <button onClick={() => { setBoard(Array(9).fill(null)); setIsXNext(true); setWinner(null); }} className="text-sm border border-[#333] px-4 py-2 hover:bg-[#333]">Play Again</button>
      ) : (
        <p className="text-xs text-[#888] animate-pulse uppercase tracking-widest">Processing Data...</p>
      )}
    </div>
  );
};

export default function CandidatePortal() {
  const { workspaceId, token } = useParams() as { workspaceId: string; token: string };

  const [step, setStep] = useState<Step>("auth");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [candidateRef, setCandidateRef] = useState<any>(null);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);

  const [passwordInput, setPasswordInput] = useState("");

  const [resumeText, setResumeText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState("English");
  const [questions, setQuestions] = useState<string[]>([]);

  // Interview States
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [processingVideo, setProcessingVideo] = useState(false);
  
  // Tracking
  const [faceApiReady, setFaceApiReady] = useState(false);
  const cvDataRef = useRef({ eyeContact: 0, total: 0, confidence: 0, multiple: false });
  const [videoURLs, setVideoURLs] = useState<string[]>([]);
  const [transcriptIds, setTranscriptIds] = useState<string[]>([]);
  const [transcriptTexts, setTranscriptTexts] = useState<string[]>([]);
  const [reportFeedback, setReportFeedback] = useState("");
  const [finalScore, setFinalScore] = useState<any>(null);

  // Auth Handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const wDoc = await getDoc(doc(db, "workspaces", workspaceId));
      if (!wDoc.exists()) throw new Error("Invalid Interview Link");
      setJobData({ id: workspaceId, ...wDoc.data() });

      const cRef = collection(db, "workspaces", workspaceId, "candidates");
      const q = query(cRef, where("uniqueToken", "==", token), where("interviewPassword", "==", passwordInput));
      const snap = await getDocs(q);

      if (snap.empty) throw new Error("Invalid password or expired link.");

      const match = snap.docs[0];
      const data = match.data();
      if (data.interviewStatus === "completed") throw new Error("This interview link has been used.");

      setCandidateRef(match.ref);
      setCandidateData({ id: match.id, ...data });
      setStep("resume");
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setLoading(false);
  };

  // Resume Parsing
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analyze-resume", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const parsedText = `Skills: ${data.skills?.join(", ") || "None"} | Experience: ${data.experience} | Projects: ${data.projects?.join(", ") || "None"}`;
      setResumeText(parsedText);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse resume");
    }
    setLoading(false);
  };

  // Start Setup Check
  const startSetup = async () => {
    setLoading(true);
    try {
      // Get Mic/Cam Permission early to be safe
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop()); // close immediately, reopen in interview

      setStep("setup");
    } catch (err) {
      setErrorMsg("Camera and Microphone permissions are absolutely required.");
    }
    setLoading(false);
  };

  // Generate Questions & Enter Room
  const enterInterviewRoom = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobData.jobTitle,
          jobDescription: jobData.jobDescription,
          resumeText,
          language
        })
      });
      const data = await res.json();
      if (data.error || !data.questions) throw new Error(data.error || "Failed finding questions");
      
      setQuestions(data.questions);
      setVideoURLs(Array(data.questions.length).fill(""));
      setTranscriptIds(Array(data.questions.length).fill(""));
      setTranscriptTexts(Array(data.questions.length).fill(""));
      
      setStep("interview");
      openCamera();
      setCountdown(5);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setLoading(false);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
    }
  };

  // OpenCV AI Tracking Loop
  useEffect(() => {
    if (step !== "interview" || !faceApiReady || !isRecording || !videoRef.current) return;
    
    const faceapi = (window as any).faceapi;
    const cw = 320, ch = 240;
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    let prevFrame: Uint8ClampedArray | null = null;
    
    const interval = setInterval(async () => {
      if (videoRef.current?.paused || !ctx) return;
      try {
        const video = videoRef.current;
        if (!video) return;
        
        const dets = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
        cvDataRef.current.total++;
        if (dets.length > 0) cvDataRef.current.eyeContact++;
        if (dets.length > 1) cvDataRef.current.multiple = true;

        ctx.drawImage(video, 0, 0, cw, ch);
        const frame = ctx.getImageData(0, 0, cw, ch).data;
        if (prevFrame) {
          let diff = 0;
          for (let i = 0; i < frame.length; i += 4) {
            if (Math.abs(frame[i] - prevFrame[i]) > 20) diff++;
          }
          const motion = diff / (cw * ch);
          const score = Math.max(0, 100 - motion * 500);
          cvDataRef.current.confidence += score;
        }
        prevFrame = new Uint8ClampedArray(frame);
      } catch (e) {}
    }, 500);
    return () => clearInterval(interval);
  }, [step, faceApiReady, isRecording]);

  // Read Question TTS
  useEffect(() => {
    if (step !== "interview" || countdown > 0 || isRecording || processingVideo) return;
    const synth = window.speechSynthesis;
    if (!synth || !questions[currentQIndex]) {
      startRecording();
      return;
    }

    synth.cancel();
    const u = new SpeechSynthesisUtterance(questions[currentQIndex]);
    if (language === "Hindi" || language === "Marathi") {
      u.lang = "hi-IN";
    } else {
      u.lang = "en-US";
    }
    u.onend = () => startRecording();
    u.onerror = () => startRecording();
    
    // Slight delay to let UI buffer
    setTimeout(() => synth.speak(u), 500);
  }, [currentQIndex, step, countdown, processingVideo]);

  // Timers
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (isRecording && timeLeft > 0) {
      const t = setTimeout(() => setTimeLeft(l => l - 1), 1000);
      return () => clearTimeout(t);
    } else if (isRecording && timeLeft === 0) {
      stopRecording();
    }
  }, [isRecording, timeLeft]);

  const startRecording = () => {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = processVideo;
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setTimeLeft(120);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const processVideo = async () => {
    setProcessingVideo(true);
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    
    let vidUrl = "";
    let tid = "";
    try {
      // 1. Upload Cloudinary
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
      const cRes = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`, { method: "POST", body: fd });
      const cData = await cRes.json();
      vidUrl = cData.secure_url;

      // 2. Request AssemblyAI via proxy
      const aRes = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio_url: vidUrl }) });
      const aData = await aRes.json();
      tid = aData.id;
    } catch (e) { console.error("Cloudinary/AssemblyAI Error", e); }

    const newVids = [...videoURLs]; newVids[currentQIndex] = vidUrl; setVideoURLs(newVids);
    const newTids = [...transcriptIds]; newTids[currentQIndex] = tid; setTranscriptIds(newTids);

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setCountdown(5);
    } else {
      await finalizeInterview(newTids);
    }
    setProcessingVideo(false);
  };

  const finalizeInterview = async (finalTids: string[]) => {
    setStep("processing");
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    let finalTexts = [...transcriptTexts];
    // Poll transcripts
    for (let i = 0; i < finalTids.length; i++) {
      let tText = "(Failed)";
      if (finalTids[i]) {
        for (let attempt = 0; attempt < 15; attempt++) {
          try {
            const pRes = await fetch(`/api/transcribe?transcriptId=${finalTids[i]}`);
            const pData = await pRes.json();
            if (pData.status === "completed") { tText = pData.text; break; }
            if (pData.status === "error") { break; }
          } catch(e) {}
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      finalTexts[i] = tText;
    }
    setTranscriptTexts(finalTexts);

    // Call Gemini Evaluation
    try {
      const eRes = await fetch("/api/evaluate-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobData.jobTitle,
          jobDescription: jobData.jobDescription,
          resumeText,
          questions,
          transcripts: finalTexts
        })
      });
      const eData = await eRes.json();
      setReportFeedback(eData.feedback || "Evaluation failed.");
    } catch(e) {}
    
    // Save CV Stats
    const total = cvDataRef.current.total || 1;
    const stats = {
      eyeContactScore: Math.round((cvDataRef.current.eyeContact / total) * 100),
      confidenceScore: Math.round(cvDataRef.current.confidence / total),
      multipleFaces: cvDataRef.current.multiple
    };
    setFinalScore(stats);

    // Save permanently to Firebase
    await updateDoc(candidateRef, {
      interviewStatus: "completed",
      completedAt: serverTimestamp(),
      feedback: reportFeedback,
      cvStats: stats,
      videoURLs,
      transcriptTexts: finalTexts
    });

    setStep("report");
  };

  // UI Renders
  if (step === "auth") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-md border border-[#333] bg-[#111] p-8">
          <h1 className="text-xl tracking-tight mb-2 uppercase">Secure Portal</h1>
          <p className="text-xs text-[#888] mb-8">Enter access password from email.</p>
          <form onSubmit={handleAuth}>
            <input
              type="password" required autoFocus
              className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 text-sm focus:border-white outline-none mb-6"
              value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
            />
            {errorMsg && <div className="text-red-500 text-xs mb-4">{errorMsg}</div>}
            <button type="submit" disabled={loading} className="w-full bg-white text-black py-3 text-sm font-bold uppercase disabled:opacity-50">Enter Room</button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "resume") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col items-center justify-center p-4 font-mono">
        <div className="w-full max-w-2xl border border-[#333] bg-[#111] p-8">
          <h1 className="text-xl uppercase mb-6 border-b border-[#333] pb-4">Candidate Profile Extract</h1>
          
          {!resumeText ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-[#444] bg-[#0a0a0a]">
              <p className="text-sm text-[#888] mb-4">Upload your PDF Resume to configure the AI</p>
              <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleResumeUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={loading}
                className="bg-[#ededed] text-[#0a0a0a] px-6 py-2 text-sm uppercase font-bold disabled:opacity-50"
              >
                {loading ? "Parsing PDF with Gemini..." : "Select PDF Document"}
              </button>
              {errorMsg && <p className="text-red-500 text-xs mt-4">{errorMsg}</p>}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs text-[#888] uppercase mb-2">AI Extracted Summary</h3>
                <div className="p-4 bg-[#0a0a0a] border border-[#333] text-sm leading-relaxed">{resumeText}</div>
              </div>
              <button onClick={startSetup} disabled={loading} className="w-full bg-white text-black py-3 text-sm font-bold uppercase transition-colors hover:bg-gray-200">
                 {loading ? "Checking Devices..." : "Verify & Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg border border-[#333] bg-[#111] p-8">
          <h1 className="text-xl uppercase mb-6 border-b border-[#333] pb-4">Room Configuration</h1>
          
          <div className="space-y-6">
             <div>
              <label className="text-xs text-[#888] uppercase mb-2 block">Interview Language</label>
              <select value={language} onChange={e=>setLanguage(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 text-sm focus:border-white outline-none">
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Marathi">Marathi</option>
              </select>
            </div>

            <div className="flex items-center gap-4 p-4 border border-[#333] bg-[#0a0a0a]">
              <i className="fas fa-video text-white"></i>
              <div className="text-sm">
                <span className="font-bold text-white block">Camera & Microhpone</span>
                <span className="text-[#888] text-xs">Required for Proctoring & Voice processing</span>
              </div>
            </div>

            {errorMsg && <div className="text-red-500 text-xs">{errorMsg}</div>}

            <button onClick={enterInterviewRoom} disabled={loading} className="w-full bg-white text-black py-3 text-sm font-bold uppercase hover:bg-gray-200">
               {loading ? "Generating Questions..." : "Commence Interview"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "interview") {
    return (
      <>
        <Script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js" onLoad={() => {
           const faceapi = (window as any).faceapi;
           faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/').then(()=> setFaceApiReady(true));
        }} />

        <div className="h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col md:flex-row p-4 gap-4 font-mono">
          <div className="w-full md:w-5/12 min-h-[40vh] border border-[#333] bg-[#111] flex flex-col relative overflow-hidden">
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className={`text-xs px-2 py-1 uppercase font-bold ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-black text-[#555] border border-[#333]"}`}>
                {isRecording ? "REC" : "STBY"}
              </span>
              <span className={`text-xs px-2 py-1 uppercase font-bold ${faceApiReady ? "bg-[#ededed] text-black" : "bg-black text-[#555] border border-[#333]"}`}>
                {faceApiReady ? "AI Tracking" : "Loading Model"}
              </span>
            </div>
            
            {countdown > 0 && !processingVideo && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <span className="text-8xl text-white opacity-80 animate-ping">{countdown}</span>
              </div>
            )}
            
            {processingVideo && <TicTacToe />}
          </div>

          <div className="w-full md:w-7/12 border border-[#333] bg-[#111] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <span className="text-xs text-[#888] font-bold uppercase">Question {currentQIndex + 1}/{questions.length}</span>
              <span className="text-sm font-bold border border-[#333] px-3 py-1 bg-[#0a0a0a]">
                 {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,"0")}
              </span>
            </div>
            <div className="p-8 flex-1 flex items-center text-xl md:text-3xl leading-snug">
              {questions[currentQIndex]}
            </div>
            <div className="p-4 border-t border-[#333] bg-[#0a0a0a] flex justify-end">
              {isRecording ? (
                <button onClick={stopRecording} className="border border-white hover:bg-white hover:text-black px-6 py-2 text-sm font-bold uppercase transition-colors">
                  Submit & Next
                </button>
              ) : (
                <button disabled className="border border-[#333] text-[#555] px-6 py-2 text-sm font-bold uppercase">
                  Reading Question...
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col items-center justify-center p-4 font-mono">
         <div className="w-24 h-24 border-t-2 border-l-2 border-white rounded-full animate-spin mb-8"></div>
         <h2 className="text-xl uppercase tracking-widest mb-2">Analyzing Results</h2>
         <p className="text-xs text-[#888] max-w-sm text-center">Transcribing audio, fetching text semantics, and mapping resume nodes over LLM parameters...</p>
      </div>
    );
  }

  if (step === "report") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex justify-center p-4 font-mono overflow-y-auto pt-16">
        <div className="w-full max-w-4xl border border-[#333] bg-[#111] p-8 md:p-12">
          
          <div className="border-b border-[#333] pb-6 mb-8 flex justify-between items-start">
             <div>
               <h1 className="text-2xl font-medium uppercase mb-2">Interview Concluded</h1>
               <div className="text-sm text-[#888]">Role: {jobData.jobTitle} | Candidate: {candidateData.name}</div>
             </div>
             <button onClick={() => window.print()} className="border border-[#ededed] hover:bg-[#ededed] hover:text-[#111] px-4 py-2 text-xs uppercase font-bold transition-colors">
               Export PDF
             </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
             <div className="border border-[#333] bg-[#0a0a0a] p-6 text-center">
               <div className="text-xs text-[#888] uppercase mb-4">Eye Contact</div>
               <div className="text-4xl">{finalScore?.eyeContactScore}%</div>
             </div>
             <div className="border border-[#333] bg-[#0a0a0a] p-6 text-center">
               <div className="text-xs text-[#888] uppercase mb-4">Confidence</div>
               <div className="text-4xl">{finalScore?.confidenceScore}%</div>
             </div>
             <div className="border border-[#333] bg-[#0a0a0a] p-6 text-center">
               <div className="text-xs text-[#888] uppercase mb-4">Env Security</div>
               <div className={`text-sm font-bold uppercase mt-4 ${finalScore?.multipleFaces ? "text-red-500" : "text-white"}`}>
                 {finalScore?.multipleFaces ? "Flagged (Faces)" : "Secure"}
               </div>
             </div>
          </div>

          <div className="border border-[#333] bg-[#0a0a0a] p-8">
            <h2 className="text-sm uppercase font-bold text-[#888] mb-6 border-b border-[#333] pb-2">AI Summary Output</h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {reportFeedback}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return null;
}
