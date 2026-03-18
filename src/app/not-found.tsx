export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "48px", fontWeight: 700, marginBottom: "8px" }}>404</h1>
        <p style={{ marginBottom: "24px" }}>Page not found</p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </div>
  );
}
