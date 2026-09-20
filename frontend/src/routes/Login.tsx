import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage } from "../lib/api";
import { HEADINGS, PRODUCT_PROMISE } from "../lib/copy";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register({
          email,
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
      navigate("/find");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-main">
      <h1>{HEADINGS.app}</h1>
      <p>{PRODUCT_PROMISE}</p>
      <h2>{mode === "login" ? HEADINGS.login : HEADINGS.register}</h2>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {mode === "login" ? HEADINGS.login : HEADINGS.register}
        </button>
        {pending && <LoadingState label="Talking to StudySprint..." />}
      </form>
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
      </button>
    </main>
  );
}
