"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardHeader from "@/components/DashboardHeader";
import ResumeUpload from "@/components/ResumeUpload";
import ResultReportModal from "@/components/interview/ResultReportModal";

interface WorkspaceData {
  jobTitle: string;
  jobDescription: string;
  companyDepartment: string;
  employmentType: string;
  workLocation: string;
  minSalary: number;
  maxSalary: number;
  requiredExperience: number;
  requiredSkills: string[];
  educationLevel: string;
  recruiterId: string;
  [key: string]: unknown;
}

interface Candidate {
  id: string;
  fileName: string;
  name?: string | null;
  email: string | null;
  phone: string | null;
  resumeUrl: string;
  uniqueLink: string;
  uniqueToken: string;
  interviewPassword?: string;
  emailStatus: "pending" | "sent" | "failed" | "sending";
  emailSentAt?: { seconds: number };
  createdAt?: { seconds: number };
  interviewStatus?: "pending" | "sent" | "completed" | "accepted" | "rejected";
  completedAt?: { seconds: number };
  feedback?: string;
  cvStats?: {
    eyeContactScore: number;
    confidenceScore: number;
    multipleFaces: boolean;
  };
  videoURLs?: string[];
  transcriptTexts?: string[];
  questions?: string[];
  decision?: "accepted" | "rejected" | null;
  decisionAt?: { seconds: number };
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const { user, profile } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "resumes" | "candidates" | "results">("resumes");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState<{id: string; type: 'success' | 'error'; message: string} | null>(null);

  useEffect(() => {
    if (!workspaceId || !user) return;

    const fetchData = async () => {
      try {
        const wsDoc = await getDoc(doc(db, "workspaces", workspaceId));
        if (wsDoc.exists()) {
          setWorkspace(wsDoc.data() as WorkspaceData);
        }

        const candidatesSnap = await getDocs(collection(db, "workspaces", workspaceId, "candidates"));
        const candidatesData = candidatesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Candidate[];
        setCandidates(candidatesData);
      } catch (err) {
        console.error("Error fetching workspace:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId, user]);

  const handleUploadsComplete = useCallback(
    async (files: File[]) => {
      setParsing(true);

      try {
        const processFile = async (file: File) => {
          const formData = new FormData();
          formData.append("file", file);

          try {
            const response = await fetch("/api/parse-resumes", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              console.error(`Error parsing ${file.name}:`, response.statusText);
              return [{
                fileName: file.name,
                name: null,
                email: null,
                phone: null,
                error: response.status === 413 ? "File too large (limit ~4MB)" : "Failed to parse resume"
              }];
            }

            const data = await response.json();
            return data.results || [];
          } catch (err) {
            console.error(`Fetch error for ${file.name}:`, err);
            return [{
              fileName: file.name,
              name: null,
              email: null,
              phone: null,
              error: "Network error parsing resume"
            }];
          }
        };

        const promises = files.map(file => processFile(file));
        const allResultsArrays = await Promise.all(promises);
        const allResults = allResultsArrays.flat();

        if (allResults.length > 0) {
          const newCandidates: Candidate[] = [];

          for (const result of allResults) {
            const candidateDoc = await addDoc(
              collection(db, "workspaces", workspaceId, "candidates"),
              {
                fileName: result.fileName,
                name: result.name || null,
                email: result.email,
                phone: result.phone,
                resumeUrl: "",
                uniqueLink: "",
                uniqueToken: "",
                emailStatus: "pending",
                createdAt: serverTimestamp(),
              }
            );

            newCandidates.push({
              id: candidateDoc.id,
              fileName: result.fileName,
              name: result.name || null,
              email: result.email,
              phone: result.phone,
              resumeUrl: "",
              uniqueLink: "",
              uniqueToken: "",
              emailStatus: "pending",
            });
          }

          setCandidates((prev) => [...prev, ...newCandidates]);
          setActiveTab("candidates");
        }
      } catch (err) {
        console.error("Error parsing resumes:", err);
      } finally {
        setParsing(false);
      }
    },
    [workspaceId]
  );

  const handleSendEmails = async () => {
    if (!workspace || !profile) return;

    const pendingCandidates = candidates.filter(
      (c) => c.email && c.emailStatus === "pending"
    );

    if (pendingCandidates.length === 0) {
      setEmailProgress("No pending candidates with emails to send to.");
      return;
    }

    setSendingEmails(true);
    setEmailProgress(`Sending emails to ${pendingCandidates.length} candidates...`);

    try {
      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: pendingCandidates.map((c) => ({ id: c.id, email: c.email, name: c.name })),
          recruiterName: profile.name,
          recruiterEmail: user?.email || profile.email,
          companyName: profile.companyName,
          jobTitle: workspace.jobTitle,
          jobDescription: workspace.jobDescription,
          workspaceId,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to send emails");
      }

      if (data.results) {
        for (const result of data.results) {
          const candidateRef = doc(db, "workspaces", workspaceId, "candidates", result.candidateId);

          await updateDoc(candidateRef, {
            emailStatus: result.status === "sent" ? "sent" : result.status === "skipped" ? "pending" : "failed",
            uniqueLink: result.uniqueLink || "",
            uniqueToken: result.uniqueToken || "",
            interviewPassword: result.interviewPassword || "",
            emailSentAt: result.status === "sent" ? serverTimestamp() : null,
          });

          setCandidates((prev) =>
            prev.map((c) =>
              c.id === result.candidateId
                ? {
                    ...c,
                    emailStatus: result.status === "sent" ? "sent" : result.status === "skipped" ? "pending" : "failed",
                    uniqueLink: result.uniqueLink || "",
                    uniqueToken: result.uniqueToken || "",
                    interviewPassword: result.interviewPassword || "",
                  }
                : c
            )
          );
        }

        setEmailProgress(
          `Done! Sent: ${data.sent}, Failed: ${data.failed}, Skipped: ${data.skipped}`
        );
      }
    } catch (err) {
      console.error("Error sending emails:", err);
      setEmailProgress("Error sending emails. Please try again.");
    } finally {
      setSendingEmails(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!window.confirm("Are you sure you want to delete this candidate?")) return;
    
    try {
      await deleteDoc(doc(db, "workspaces", workspaceId, "candidates", candidateId));
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (err) {
      console.error("Error deleting candidate:", err);
      alert("Failed to delete candidate. Please try again.");
    }
  };

  const handleViewReport = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowReportModal(true);
  };

  const handleAccept = async (candidateId: string) => {
    if (!workspace || !profile) return;
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    
    if (!window.confirm(`Accept ${candidate.name || "this candidate"} for ${workspace.jobTitle}?`)) return;
    
    setDecisionLoading(candidateId);
    setDecisionMessage(null);
    try {
      // Send email first
      const res = await fetch("/api/send-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          recruiterName: profile.name,
          recruiterEmail: user?.email || profile.email,
          companyName: profile.companyName,
          jobTitle: workspace.jobTitle,
          evaluation: candidate.feedback,
          decisionType: "accept"
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Only update Firestore if email was sent successfully
        await updateDoc(doc(db, "workspaces", workspaceId, "candidates", candidateId), {
          decision: "accepted",
          decisionAt: serverTimestamp(),
          interviewStatus: "accepted"
        });
        
        setCandidates(prev => prev.map(c => 
          c.id === candidateId ? { ...c, decision: "accepted" as const, interviewStatus: "accepted" as const } : c
        ));
        
        setDecisionMessage({ id: candidateId, type: 'success', message: `Acceptance email sent to ${candidate.name || 'candidate'}` });
      } else {
        setDecisionMessage({ id: candidateId, type: 'error', message: data.error || "Failed to send acceptance email" });
      }
    } catch (err) {
      console.error("Error accepting candidate:", err);
      setDecisionMessage({ id: candidateId, type: 'error', message: "Failed to accept candidate" });
    }
    setDecisionLoading(null);
  };

  const handleReject = async (candidateId: string) => {
    if (!workspace || !profile) return;
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    
    if (!window.confirm(`Reject ${candidate.name || "this candidate"} for ${workspace.jobTitle}?`)) return;
    
    setDecisionLoading(candidateId);
    setDecisionMessage(null);
    try {
      // Send email first
      const res = await fetch("/api/send-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          recruiterName: profile.name,
          recruiterEmail: user?.email || profile.email,
          companyName: profile.companyName,
          jobTitle: workspace.jobTitle,
          evaluation: candidate.feedback,
          decisionType: "reject"
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Only update Firestore if email was sent successfully
        await updateDoc(doc(db, "workspaces", workspaceId, "candidates", candidateId), {
          decision: "rejected",
          decisionAt: serverTimestamp(),
          interviewStatus: "rejected"
        });
        
        setCandidates(prev => prev.map(c => 
          c.id === candidateId ? { ...c, decision: "rejected" as const, interviewStatus: "rejected" as const } : c
        ));
        
        setDecisionMessage({ id: candidateId, type: 'success', message: `Rejection email sent to ${candidate.name || 'candidate'}` });
      } else {
        setDecisionMessage({ id: candidateId, type: 'error', message: data.error || "Failed to send rejection email" });
      }
    } catch (err) {
      console.error("Error rejecting candidate:", err);
      setDecisionMessage({ id: candidateId, type: 'error', message: "Failed to reject candidate" });
    }
    setDecisionLoading(null);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="dashboard">
          <DashboardHeader />
          <div style={{ display: "flex", justifyContent: "center", padding: "64px" }}>
            <div className="spinner" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!workspace) {
    return (
      <ProtectedRoute>
        <div className="dashboard">
          <DashboardHeader />
          <div className="dashboard-content">
            <div className="empty-state">
              <h3>Workspace not found</h3>
              <p>This workspace may have been deleted or you don&apos;t have access to it.</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const sentCount = candidates.filter((c) => c.emailStatus === "sent").length;
  const pendingCount = candidates.filter((c) => c.emailStatus === "pending" && c.email).length;
  const failedCount = candidates.filter((c) => c.emailStatus === "failed").length;

  return (
    <ProtectedRoute>
      <div className="dashboard">
        <DashboardHeader />
        <div className="dashboard-content">
          <div className="animate-in">
            <div style={{ marginBottom: "16px" }}>
              <Link href="/workspaces" style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--muted-foreground)", textDecoration: "none" }}>
                ← Back to Workspaces
              </Link>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 600 }}>{workspace.jobTitle}</h1>
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", marginTop: "4px" }}>
                {workspace.companyDepartment} · {workspace.employmentType} · {workspace.workLocation}
              </p>
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
              <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{candidates.length}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Candidates
                </div>
              </div>
              <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{sentCount}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Emails Sent
                </div>
              </div>
              <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{pendingCount}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Pending
                </div>
              </div>
              <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700 }}>{failedCount}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Failed
                </div>
              </div>
            </div>

            <div className="tabs">
              <button
                className={`tab ${activeTab === "resumes" ? "active" : ""}`}
                onClick={() => setActiveTab("resumes")}
              >
                Upload Resumes
              </button>
              <button
                className={`tab ${activeTab === "candidates" ? "active" : ""}`}
                onClick={() => setActiveTab("candidates")}
              >
                Candidates ({candidates.length})
              </button>
              <button
                className={`tab ${activeTab === "details" ? "active" : ""}`}
                onClick={() => setActiveTab("details")}
              >
                Job Details
              </button>
              <button
                className={`tab ${activeTab === "results" ? "active" : ""}`}
                onClick={() => setActiveTab("results")}
              >
                Results ({candidates.filter(c => c.interviewStatus === "completed").length})
              </button>
            </div>

            {activeTab === "resumes" && (
              <div>
                <ResumeUpload
                  onUploadsComplete={handleUploadsComplete}
                />
                {parsing && (
                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--muted-foreground)" }}>
                    <div className="spinner" />
                    Extracting emails and phone numbers from resumes...
                  </div>
                )}
              </div>
            )}

            {activeTab === "candidates" && (
              <div>
                {pendingCount > 0 && (
                  <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSendEmails}
                      disabled={sendingEmails}
                    >
                      {sendingEmails ? (
                        <><div className="spinner" /> Sending...</>
                      ) : (
                        `Send Emails (${pendingCount})`
                      )}
                    </button>
                    {emailProgress && (
                      <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                        {emailProgress}
                      </span>
                    )}
                  </div>
                )}

                {candidates.length === 0 ? (
                  <div className="empty-state">
                    <h3>No candidates yet</h3>
                    <p>Upload resumes to extract candidate emails and phone numbers.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Resume</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Interview Link</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c, i) => (
                          <tr key={c.id}>
                            <td>{i + 1}</td>
                            <td title={c.fileName} style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.fileName}
                            </td>
                            <td>{c.name || <span style={{ color: "var(--muted-foreground)" }}>—</span>}</td>
                            <td>
                              {c.email ? (
                                <a href={`mailto:${c.email}`} style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>
                                  {c.email}
                                </a>
                              ) : (
                                <span style={{ color: "var(--muted-foreground)" }}>—</span>
                              )}
                            </td>
                            <td>{c.phone || <span style={{ color: "var(--muted-foreground)" }}>—</span>}</td>
                            <td>
                              <span className={`badge ${
                                c.emailStatus === "sent" ? "badge-success" :
                                c.emailStatus === "failed" ? "badge-error" :
                                c.emailStatus === "sending" ? "badge-warning" :
                                "badge-pending"
                              }`}>
                                {c.emailStatus}
                              </span>
                            </td>
                            <td>
                              {c.uniqueLink ? (
                                <a
                                  href={c.uniqueLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: "12px", textDecoration: "underline", textUnderlineOffset: "3px" }}
                                >
                                  View Link
                                </a>
                              ) : (
                                <span style={{ color: "var(--muted-foreground)", fontSize: "12px" }}>—</span>
                              )}
                            </td>
                            <td>
                              <button 
                                onClick={() => handleDeleteCandidate(c.id)}
                                style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", padding: 0 }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "details" && (
              <div className="card">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <label>Job Title</label>
                    <p style={{ fontSize: "14px" }}>{workspace.jobTitle}</p>
                  </div>
                  <div>
                    <label>Department</label>
                    <p style={{ fontSize: "14px" }}>{workspace.companyDepartment}</p>
                  </div>
                  <div>
                    <label>Employment Type</label>
                    <p style={{ fontSize: "14px" }}>{workspace.employmentType}</p>
                  </div>
                  <div>
                    <label>Work Location</label>
                    <p style={{ fontSize: "14px" }}>{workspace.workLocation}</p>
                  </div>
                  <div>
                    <label>Salary Range</label>
                    <p style={{ fontSize: "14px" }}>
                      ${workspace.minSalary?.toLocaleString()} — ${workspace.maxSalary?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label>Experience</label>
                    <p style={{ fontSize: "14px" }}>{workspace.requiredExperience} years</p>
                  </div>
                  <div>
                    <label>Education</label>
                    <p style={{ fontSize: "14px" }}>{workspace.educationLevel}</p>
                  </div>
                  <div>
                    <label>Skills</label>
                    <p style={{ fontSize: "14px" }}>
                      {Array.isArray(workspace.requiredSkills)
                        ? workspace.requiredSkills.join(", ")
                        : workspace.requiredSkills}
                    </p>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Job Description</label>
                    <p style={{ fontSize: "14px", whiteSpace: "pre-wrap" }}>{workspace.jobDescription}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "results" && (
              <div>
                <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
                  <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {candidates.filter(c => c.interviewStatus === "completed").length}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Completed
                    </div>
                  </div>
                  <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {candidates.filter(c => c.decision === "accepted").length}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Accepted
                    </div>
                  </div>
                  <div className="card" style={{ flex: 1, minWidth: "140px", padding: "16px" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      {candidates.filter(c => c.decision === "rejected").length}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Rejected
                    </div>
                  </div>
                </div>

                {candidates.filter(c => c.interviewStatus === "completed").length === 0 ? (
                  <div className="empty-state">
                    <h3>No interview results yet</h3>
                    <p>Completed interviews will appear here with their evaluation reports.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {candidates.filter(c => c.interviewStatus === "completed").map(candidate => {
                      let evaluation = { overallScore: 0, strengths: [] as string[], areasForImprovement: [] as string[], communicationSkills: "", technicalAlignment: "", finalRecommendation: "Hold" };
                      try {
                        if (candidate.feedback) {
                          evaluation = JSON.parse(candidate.feedback);
                        }
                      } catch (e) {}
                      
                      return (
                        <div key={candidate.id} className="card" style={{ padding: "20px", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                            <div>
                              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
                                {candidate.name || "Unknown Candidate"}
                              </h3>
                              <p style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                                {candidate.email || "No email"}
                              </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "28px", fontWeight: 700 }}>
                                {evaluation.overallScore}/10
                              </div>
                              <span className={`badge ${
                                evaluation.finalRecommendation === "Proceed to Next Round" ? "badge-success" :
                                evaluation.finalRecommendation === "Hold" ? "badge-warning" : "badge-error"
                              }`}>
                                {evaluation.finalRecommendation}
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "13px" }}>
                            {candidate.cvStats && (
                              <>
                                <span>Eye Contact: {candidate.cvStats.eyeContactScore}%</span>
                                <span>Confidence: {candidate.cvStats.confidenceScore}%</span>
                                <span style={{ color: candidate.cvStats.multipleFaces ? "var(--destructive)" : "var(--foreground)" }}>
                                  {candidate.cvStats.multipleFaces ? "⚠ Multiple Faces" : "✓ Secure"}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {candidate.decision ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className={`badge ${candidate.decision === "accepted" ? "badge-success" : "badge-error"}`}>
                                {candidate.decision === "accepted" ? "✓ Accepted" : "✗ Rejected"}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", gap: "12px" }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => { setSelectedCandidate(candidate); setShowReportModal(true); }}
                                >
                                  View Full Report
                                </button>
                                <button
                                  className="btn"
                                  style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}
                                  onClick={() => handleReject(candidate.id)}
                                  disabled={decisionLoading === candidate.id || !candidate.email}
                                  title={!candidate.email ? "No email address available" : ""}
                                >
                                  {decisionLoading === candidate.id ? "..." : "✗ Reject"}
                                </button>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => handleAccept(candidate.id)}
                                  disabled={decisionLoading === candidate.id || !candidate.email}
                                  title={!candidate.email ? "No email address available" : ""}
                                >
                                  {decisionLoading === candidate.id ? "..." : "✓ Accept"}
                                </button>
                              </div>
                              {!candidate.email && (
                                <div style={{ 
                                  marginTop: "8px", 
                                  fontSize: "11px",
                                  color: "var(--muted-foreground)"
                                }}>
                                  ⚠ No email address - cannot send notification
                                </div>
                              )}
                              {decisionMessage && decisionMessage.id === candidate.id && (
                                <div style={{ 
                                  marginTop: "12px", 
                                  padding: "8px 12px", 
                                  fontSize: "12px",
                                  background: decisionMessage.type === 'success' ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                  border: `1px solid ${decisionMessage.type === 'success' ? '#22c55e' : 'var(--destructive)'}`,
                                  color: decisionMessage.type === 'success' ? '#22c55e' : 'var(--destructive)'
                                }}>
                                  {decisionMessage.message}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <ResultReportModal
          candidate={selectedCandidate}
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setSelectedCandidate(null); }}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </div>
    </ProtectedRoute>
  );
}
