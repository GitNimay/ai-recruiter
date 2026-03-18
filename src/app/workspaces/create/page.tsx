"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardHeader from "@/components/DashboardHeader";

const QUESTIONS = [
  { key: "jobTitle", label: "Job Title / Role", placeholder: "e.g. Senior Frontend Engineer", type: "text", required: true },
  { key: "jobDescription", label: "Job Description", placeholder: "Describe the role, responsibilities, and what you're looking for...", type: "textarea", required: true },
  { key: "companyDepartment", label: "Company Department", placeholder: "e.g. Engineering, Marketing, Sales", type: "text", required: true },
  { key: "employmentType", label: "Employment Type", placeholder: "", type: "select", options: ["Full-time", "Part-time", "Contract", "Internship", "Freelance"], required: true },
  { key: "workLocation", label: "Work Location", placeholder: "", type: "select", options: ["Remote", "Hybrid", "On-site"], required: true },
  { key: "officeLocation", label: "Office Location (if applicable)", placeholder: "e.g. San Francisco, CA", type: "text", required: false },
  { key: "minSalary", label: "Minimum Salary Expectation (Annual)", placeholder: "e.g. 80000", type: "number", required: true },
  { key: "maxSalary", label: "Maximum Salary Expectation (Annual)", placeholder: "e.g. 120000", type: "number", required: true },
  { key: "requiredExperience", label: "Required Experience (Years)", placeholder: "e.g. 3", type: "number", required: true },
  { key: "requiredSkills", label: "Required Skills", placeholder: "e.g. React, TypeScript, Node.js, AWS", type: "text", required: true },
  { key: "educationLevel", label: "Minimum Education Level", placeholder: "", type: "select", options: ["High School", "Associate's Degree", "Bachelor's Degree", "Master's Degree", "PhD", "No Requirement"], required: true },
  { key: "applicationDeadline", label: "Application Deadline", placeholder: "", type: "date", required: false },
  { key: "interviewProcess", label: "Interview Process Overview", placeholder: "e.g. Phone screen → Technical interview → Onsite → Offer", type: "text", required: false },
  { key: "additionalNotes", label: "Additional Notes or Requirements", placeholder: "Any other details about the role...", type: "textarea", required: false },
];

const ITEMS_PER_STEP = 4;
const TOTAL_STEPS = Math.ceil(QUESTIONS.length / ITEMS_PER_STEP);

export default function CreateWorkspacePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentQuestions = QUESTIONS.slice(step * ITEMS_PER_STEP, (step + 1) * ITEMS_PER_STEP);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = () => {
    for (const q of currentQuestions) {
      if (q.required && !formData[q.key]?.trim()) {
        setError(`${q.label} is required.`);
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep() || !user) return;
    setLoading(true);

    try {
      const docRef = await addDoc(collection(db, "workspaces"), {
        ...formData,
        minSalary: Number(formData.minSalary) || 0,
        maxSalary: Number(formData.maxSalary) || 0,
        requiredExperience: Number(formData.requiredExperience) || 0,
        requiredSkills: formData.requiredSkills
          ? formData.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        recruiterId: user.uid,
        createdAt: serverTimestamp(),
      });
      router.push(`/workspaces/${docRef.id}`);
    } catch (err) {
      console.error("Error creating workspace:", err);
      setError("Failed to create workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <ProtectedRoute>
      <div className="dashboard">
        <DashboardHeader />
        <div className="dashboard-content">
          <div className="onboarding animate-in">
            <div className="step-indicator">
              Step {step + 1} of {TOTAL_STEPS}
            </div>

            <div className="progress-bar" style={{ marginBottom: "32px" }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>

            <h1>Create Workspace</h1>
            <p className="subtitle">
              Tell us about the role you&apos;re hiring for. This information will be used to personalize emails to candidates.
            </p>

            <div>
              {currentQuestions.map((q) => (
                <div key={q.key} className="form-group">
                  <label htmlFor={q.key}>
                    {q.label}
                    {q.required && " *"}
                  </label>

                  {q.type === "textarea" ? (
                    <textarea
                      id={q.key}
                      rows={4}
                      placeholder={q.placeholder}
                      value={formData[q.key] || ""}
                      onChange={(e) => updateField(q.key, e.target.value)}
                    />
                  ) : q.type === "select" ? (
                    <select
                      id={q.key}
                      value={formData[q.key] || ""}
                      onChange={(e) => updateField(q.key, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {q.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={q.key}
                      type={q.type}
                      placeholder={q.placeholder}
                      value={formData[q.key] || ""}
                      onChange={(e) => updateField(q.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="form-actions">
              {step > 0 && (
                <button className="btn" onClick={handleBack}>
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {isLastStep ? (
                <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <><div className="spinner" /> Creating...</>
                  ) : (
                    "Create Workspace →"
                  )}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleNext}>
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
