"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardHeader from "@/components/DashboardHeader";

interface Workspace {
  id: string;
  jobTitle: string;
  companyDepartment: string;
  employmentType: string;
  workLocation: string;
  createdAt: { seconds: number };
  candidateCount?: number;
}

export default function WorkspacesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      try {
        const q = query(
          collection(db, "workspaces"),
          where("recruiterId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Workspace[];
        
        // Sort on the client side to avoid needing a Firebase Composite Index
        data.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA; // Descending order
        });
        
        setWorkspaces(data);
      } catch (err) {
        console.error("Error fetching workspaces:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="dashboard">
        <DashboardHeader />
        <div className="dashboard-content">
          <div className="section-header">
            <h2>Workspaces</h2>
            <button className="btn btn-primary" onClick={() => router.push("/workspaces/create")}>
              + Create Workspace
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "64px" }}>
              <div className="spinner" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="empty-state animate-in">
              <h3>No workspaces yet</h3>
              <p>Create your first workspace to start uploading resumes and sending interview invitations.</p>
              <button className="btn btn-primary" onClick={() => router.push("/workspaces/create")}>
                Create Workspace
              </button>
            </div>
          ) : (
            <div className="workspace-grid animate-in">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="workspace-card"
                  onClick={() => router.push(`/workspaces/${ws.id}`)}
                >
                  <h3>{ws.jobTitle}</h3>
                  <div className="meta">
                    <span>{ws.companyDepartment} · {ws.employmentType}</span>
                    <span>{ws.workLocation}</span>
                    {ws.createdAt && (
                      <span>Created {new Date(ws.createdAt.seconds * 1000).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
