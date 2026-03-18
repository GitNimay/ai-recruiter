"use client";

interface CandidateResult {
  id: string;
  name?: string | null;
  email?: string | null;
  evaluation: {
    overallScore: number;
    strengths: string[];
    areasForImprovement: string[];
    communicationSkills: string;
    technicalAlignment: string;
    finalRecommendation: "Proceed to Next Round" | "Hold" | "Reject";
  };
  cvStats: {
    eyeContactScore: number;
    confidenceScore: number;
    multipleFaces: boolean;
  };
  transcriptTexts: string[];
  videoURLs: string[];
  decision?: "accepted" | "rejected" | null;
  completedAt?: { seconds: number };
}

interface InterviewResultCardProps {
  candidate: CandidateResult;
  onViewReport: (candidate: CandidateResult) => void;
  onAccept: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
}

export function InterviewResultCard({
  candidate,
  onViewReport,
  onAccept,
  onReject,
}: InterviewResultCardProps) {
  const { evaluation, cvStats } = candidate;
  const candidateName = candidate.name || "Unknown Candidate";
  const isDecided = candidate.decision !== null && candidate.decision !== undefined;

  const getRecommendationBadge = () => {
    switch (evaluation.finalRecommendation) {
      case "Proceed to Next Round":
        return <span className="badge badge-success">Proceed to Next Round</span>;
      case "Hold":
        return <span className="badge badge-warning">Hold</span>;
      case "Reject":
        return <span className="badge badge-error">Reject</span>;
      default:
        return null;
    }
  };

  const getDecisionBadge = () => {
    if (candidate.decision === "accepted") {
      return <span className="badge badge-success">Accepted ✓</span>;
    }
    if (candidate.decision === "rejected") {
      return <span className="badge badge-error">Rejected ✗</span>;
    }
    return null;
  };

  const displayedStrengths = evaluation.strengths.slice(0, 3);

  return (
    <div className="card">
      <div className="result-card-header">
        <div className="result-card-info">
          <h3 className="result-card-name">{candidateName}</h3>
          {candidate.email && (
            <span className="result-card-email">{candidate.email}</span>
          )}
        </div>
        <div className="result-card-score">
          <span className="score-number">{evaluation.overallScore}</span>
          <span className="score-max">/10</span>
        </div>
      </div>

      <div className="result-card-badge-row">
        {getRecommendationBadge()}
        {getDecisionBadge()}
      </div>

      <div className="result-card-stats">
        <div className="stat-item">
          <span className="stat-label">Eye Contact</span>
          <div className="stat-bar-container">
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{ width: `${cvStats.eyeContactScore}%` }}
              />
            </div>
            <span className="stat-value">{cvStats.eyeContactScore}%</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-label">Confidence</span>
          <div className="stat-bar-container">
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{ width: `${cvStats.confidenceScore}%` }}
              />
            </div>
            <span className="stat-value">{cvStats.confidenceScore}%</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-label">Environment</span>
          <span className={`stat-env ${cvStats.multipleFaces ? "flagged" : "secure"}`}>
            {cvStats.multipleFaces ? "Flagged ✗" : "Secure ✓"}
          </span>
        </div>
      </div>

      {displayedStrengths.length > 0 && (
        <div className="result-card-strengths">
          <span className="strengths-label">Key Strengths</span>
          <ul className="strengths-list">
            {displayedStrengths.map((strength, index) => (
              <li key={index} className="strength-item">
                {strength.length > 60 ? `${strength.substring(0, 60)}...` : strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="result-card-actions">
        <button
          className="btn btn-primary"
          onClick={() => onViewReport(candidate)}
        >
          View Full Report
        </button>
        <div className="action-buttons">
          <button
            className="btn btn-success"
            onClick={() => onAccept(candidate.id)}
            disabled={isDecided}
          >
            Accept ✓
          </button>
          <button
            className="btn btn-destructive"
            onClick={() => onReject(candidate.id)}
            disabled={isDecided}
          >
            Reject ✗
          </button>
        </div>
      </div>
    </div>
  );
}
