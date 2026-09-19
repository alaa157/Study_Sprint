import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register({ email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      }
      navigate("/find");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Request failed");
    }
  }

  return (
    <main>
      <h1>StudySprint</h1>
      <h2>{mode === "login" ? "Log in" : "Register"}</h2>
      <form onSubmit={submit}>
        <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{mode === "login" ? "Log in" : "Create account"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
      </button>
      <p>
        <Link to="/board">Scoreboard</Link>
      </p>
    </main>
  );
}
