"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardHeader() {
  const { profile, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="dashboard-header">
      <Link href="/workspaces" className="logo">
        AI Recruiter
      </Link>
      <div className="user-info">
        {profile && (
          <span>{profile.name} · {profile.companyName}</span>
        )}
        <button className="btn btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
