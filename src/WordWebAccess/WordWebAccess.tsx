import React, { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import "./WordWebAccess.css";

type SignInConfiguration = { clientId: string; nonce: string };
type GoogleIdentity = {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
};
function identityApi(): GoogleIdentity | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}
let googleScript: Promise<void> | undefined;
function loadGoogle(): Promise<void> {
  if (identityApi()) return Promise.resolve();
  if (googleScript) return googleScript;
  googleScript = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing || document.createElement("script");
    const failed = () => { script.remove(); reject(new Error("Google sign-in could not load. Check your connection and retry.")); };
    const timeout = window.setTimeout(failed, 15000);
    const finish = () => { window.clearTimeout(timeout); identityApi() ? resolve() : reject(new Error("Google sign-in is unavailable.")); };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => { window.clearTimeout(timeout); failed(); }, { once: true });
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.id = "google-identity-services";
      document.head.appendChild(script);
    }
  }).catch(error => { googleScript = undefined; throw error; });
  return googleScript;
}

export default function WordWebAccess() {
  // CRA substitutes this at build time; the production bundle has no bypass.
  const development = process.env.NODE_ENV === "development";
  const [configuration, setConfiguration] = useState<SignInConfiguration | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const button = useRef<HTMLDivElement>(null);
  const cleanupPrivate = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  const openBundle = useCallback(async (data: { script?: unknown; css?: unknown }) => {
    if (!mounted.current) return;
    if (typeof data.script !== "string" || typeof data.css !== "string") throw new Error("Word Web could not load. Please retry.");
    const style = document.createElement("style");
    style.textContent = data.css;
    document.head.appendChild(style);
    const url = URL.createObjectURL(new Blob([data.script], { type: "text/javascript" }));
    const script = document.createElement("script");
    script.src = url;
    const cleanup = () => {
      window.dispatchEvent(new Event("word-web:lock"));
      style.remove(); script.remove(); URL.revokeObjectURL(url);
    };
    cleanupPrivate.current = cleanup;
    await new Promise<void>((resolve, reject) => {
      script.onload = () => { URL.revokeObjectURL(url); resolve(); };
      script.onerror = () => { cleanup(); cleanupPrivate.current = null; reject(new Error("Word Web could not load. Please retry.")); };
      document.body.appendChild(script);
    });
    if (!mounted.current) { cleanup(); return; }
    setPassword(""); setCredential(""); setUnlocked(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Pages restored from the browser's back/forward cache must sign in again too.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      mounted.current = false;
      window.removeEventListener("pageshow", onPageShow);
      cleanupPrivate.current?.();
      identityApi()?.cancel();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError(""); setCredential(""); setConfiguration(null);
    const start = async () => {
      try {
        const response = await fetch(development ? "/__word-web-development" : "/api/word-web/config", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(development
          ? "Restart the frontend development server, then retry."
          : "Word Web sign-in is unavailable. Start the app backend and retry.");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Word Web sign-in is unavailable.");
        if (development) {
          if (active) await openBundle(data);
          return;
        }
        if (typeof data.clientId !== "string" || typeof data.nonce !== "string") throw new Error("Word Web sign-in is unavailable.");
        await loadGoogle();
        if (!active) return;
        setConfiguration(data);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Sign-in could not load. Please retry.");
      } finally { if (active) setLoading(false); }
    };
    start();
    return () => { active = false; controller.abort(); };
  }, [attempt, development, openBundle]);

  useEffect(() => {
    if (!configuration || !button.current) return;
    let active = true;
    button.current.replaceChildren();
    const api = identityApi();
    api?.initialize({
      client_id: configuration.clientId,
      nonce: configuration.nonce,
      auto_select: false,
      ux_mode: "popup",
      callback: (result: { credential?: string }) => {
        if (active && result.credential) { setCredential(result.credential); setError(""); }
      },
    });
    api?.renderButton(button.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "pill", width: 300 });
    return () => { active = false; };
  }, [configuration]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !credential || !configuration) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/word-web/unlock", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, credential }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Access denied.");
      await openBundle(data);
    } catch (caught) {
      if (mounted.current) { setPassword(""); setError(caught instanceof Error ? caught.message : "Sign-in failed. Please retry."); }
    } finally { if (mounted.current) setBusy(false); }
  };

  return <>
    {!unlocked && <main className="ww-access">
      {development ? <section className="ww-access-card">
        <h1>Opening Word Web…</h1>
        {error ? <><p className="ww-access-error" role="alert">{error}</p><button className="ww-access-submit" type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></>
          : <p className="ww-access-status" role="status">Loading your web.</p>}
      </section> : <form className="ww-access-card" onSubmit={unlock}>
        <div className="ww-access-mark" aria-hidden="true">✳</div>
        <p className="ww-access-eyebrow">RABBIT HOLE · PRIVATE ACCESS</p>
        <h1>A world of words awaits.</h1>
        <p className="ww-access-intro">Enter your email and password, then verify your Google account to open your web.</p>
        <label htmlFor="ww-email">Email</label>
        <input id="ww-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setCredential(""); }} />
        <label htmlFor="ww-password">Password</label>
        <input id="ww-password" type="password" autoComplete="off" required maxLength={200} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
        <div className="ww-access-google" ref={button} aria-label="Verify with Google" />
        {loading && <p className="ww-access-status" role="status">Preparing secure sign-in…</p>}
        {credential && <p className="ww-access-status" role="status">Google account selected. Continue to check access.</p>}
        {error && <p className="ww-access-error" role="alert">{error}</p>}
        <button className="ww-access-submit" type="submit" disabled={busy || loading || !credential || !configuration}>{busy ? "Checking access…" : "Open Word Web"}</button>
        {!loading && <button className="ww-access-retry" type="button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Restart sign-in</button>}
        <p className="ww-access-note">Approved Google accounts only. Sign-in is required again on every visit or refresh.</p>
      </form>}
    </main>}
    <div id="word-web-private-root" hidden={!unlocked} />
  </>;
}
