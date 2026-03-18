"use client";

import React, { useState } from "react";

interface CandidateResult {
  id: string;
  name?: string | null;
  email?: string | null;
  evaluation?: {
    overallScore: number;
    strengths: string[];
    areasForImprovement: string[];
    communicationSkills: string;
    technicalAlignment: string;
    finalRecommendation: string;
  };
  cvStats?: {
    eyeContactScore: number;
    confidenceScore: number;
    multipleFaces: boolean;
  };
  transcriptTexts?: string[];
  videoURLs?: string[];
  questions?: string[];
}

interface ResultReportModalProps {
  candidate: CandidateResult | null;
  isOpen: boolean;
  onClose: () => void;
  onAccept: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
}

export default function ResultReportModal({
  candidate,
  isOpen,
  onClose,
  onAccept,
  onReject,
}: ResultReportModalProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  if (!isOpen || !candidate) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getRecommendationBadgeClass = (rec: string) => {
    const lower = rec.toLowerCase();
    if (lower.includes("proceed") || lower.includes("accept") || lower.includes("strong") || lower.includes("recommended")) {
      return "badge badge-success";
    }
    if (lower.includes("hold") || lower.includes("review") || lower.includes("moderate")) {
      return "badge badge-warning";
    }
    return "badge badge-error";
  };

  const questions = candidate.questions || [];
  const transcriptTexts = candidate.transcriptTexts || [];
  const evaluation = candidate.evaluation || { overallScore: 0, strengths: [], areasForImprovement: [], communicationSkills: "", technicalAlignment: "", finalRecommendation: "Hold" };
  const cvStats = candidate.cvStats || { eyeContactScore: 0, confidenceScore: 0, multipleFaces: false };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            Interview Report: {candidate.name || "Unknown Candidate"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          <section className="section-video-scores">
            <div className="video-section">
              {candidate.videoURLs && candidate.videoURLs.length > 0 ? (
                <video
                  src={candidate.videoURLs[0]}
                  controls
                  className="video-player"
                />
              ) : (
                <div className="video-placeholder">No video available</div>
              )}
            </div>

            <div className="scores-section">
              <div className="overall-score-display">
                <span className="overall-score-label">Overall Score</span>
                <span className="overall-score-value">
                  {evaluation.overallScore}/10
                </span>
              </div>

              <div className="score-breakdown">
                <div className="score-item">
                  <div className="score-item-header">
                    <span className="score-item-label">Eye Contact</span>
                    <span className="score-item-value">
                      {cvStats.eyeContactScore}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${cvStats.eyeContactScore}%` }}
                    />
                  </div>
                </div>

                <div className="score-item">
                  <div className="score-item-header">
                    <span className="score-item-label">Confidence</span>
                    <span className="score-item-value">
                      {cvStats.confidenceScore}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${cvStats.confidenceScore}%` }}
                    />
                  </div>
                </div>

                <div className="score-item">
                  <div className="score-item-header">
                    <span className="score-item-label">Environment</span>
                    <span className="score-item-value">
                      {cvStats.multipleFaces ? (
                        <span className="status-flagged">Flagged ✗</span>
                      ) : (
                        <span className="status-secure">Secure ✓</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section-evaluation">
            <div className="evaluation-block">
              <h3 className="evaluation-header strengths-header">
                <span className="evaluation-icon">✓</span> Strengths
              </h3>
              {evaluation.strengths.length > 0 ? (
                <ul className="evaluation-list">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index} className="evaluation-item strength-item">
                      {strength}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="evaluation-empty">No strengths identified</p>
              )}
            </div>

            <div className="evaluation-block">
              <h3 className="evaluation-header improvement-header">
                <span className="evaluation-icon">⚠</span> Areas for Improvement
              </h3>
              {evaluation.areasForImprovement.length > 0 ? (
                <ul className="evaluation-list">
                  {evaluation.areasForImprovement.map((area, index) => (
                    <li key={index} className="evaluation-item improvement-item">
                      {area}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="evaluation-empty">No areas for improvement identified</p>
              )}
            </div>

            <div className="evaluation-row">
              <div className="evaluation-summary">
                <h4 className="summary-label">
                  <span className="summary-icon">💬</span> Communication Skills
                </h4>
                <p className="summary-text">
                  {evaluation.communicationSkills || "Not evaluated"}
                </p>
              </div>

              <div className="evaluation-summary">
                <h4 className="summary-label">
                  <span className="summary-icon">⚙</span> Technical Alignment
                </h4>
                <p className="summary-text">
                  {evaluation.technicalAlignment || "Not evaluated"}
                </p>
              </div>
            </div>

            <div className="recommendation-section">
              <span className={getRecommendationBadgeClass(evaluation.finalRecommendation)}>
                {evaluation.finalRecommendation || "No recommendation"}
              </span>
            </div>
          </section>

          <section className="section-transcript">
            <h3 className="section-subtitle">Q&A Transcript</h3>
            {questions.length > 0 ? (
              <div className="transcript-list">
                {questions.map((question, index) => (
                  <div key={index} className="transcript-item">
                    <button
                      className="transcript-question"
                      onClick={() =>
                        setExpandedQuestion(
                          expandedQuestion === index ? null : index
                        )
                      }
                    >
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-text">{question}</span>
                      <span className="expand-icon">
                        {expandedQuestion === index ? "−" : "+"}
                      </span>
                    </button>
                    {expandedQuestion === index && (
                      <div className="transcript-answer">
                        {transcriptTexts[index] ? (
                          transcriptTexts[index]
                        ) : (
                          <span className="no-response">No response provided</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="transcript-unavailable">Transcript not available</p>
            )}
          </section>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary btn-accept"
            onClick={() => onAccept(candidate.id)}
          >
            ✓ Accept for Next Round
          </button>
          <button
            className="btn btn-destructive btn-reject"
            onClick={() => onReject(candidate.id)}
          >
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}
