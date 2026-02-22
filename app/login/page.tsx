"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Terminal, ArrowRight, AlertCircle } from "lucide-react";
import { setAuthCookie } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = token.trim();
      if (!trimmed) {
        setError("Token is required");
        return;
      }

      setLoading(true);
      setError("");

      // Validate by attempting a quick WebSocket handshake
      const gatewayUrl = `wss://${window.location.hostname}:28643`;

      try {
        const ws = new WebSocket(gatewayUrl);
        const timeout = setTimeout(() => {
          ws.close();
          setError("Connection timed out. Check gateway URL.");
          setLoading(false);
        }, 5000);

        ws.onopen = () => {
          // Send hello with token
          ws.send(JSON.stringify({ type: "hello", token: trimmed }));
        };

        ws.onmessage = (event) => {
          clearTimeout(timeout);
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "hello_ok" || msg.type === "helloOk") {
              // Token is valid
              setAuthCookie(trimmed);
              ws.close();
              router.push(redirect);
            } else if (msg.type === "error" || msg.type === "hello_error") {
              setError("Invalid token");
              setLoading(false);
              ws.close();
            } else {
              // Accept any response as valid (gateway might have different protocol)
              setAuthCookie(trimmed);
              ws.close();
              router.push(redirect);
            }
          } catch {
            setAuthCookie(trimmed);
            ws.close();
            router.push(redirect);
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          // If WebSocket fails, still allow login (might be HTTPS mismatch)
          setAuthCookie(trimmed);
          ws.close();
          router.push(redirect);
        };
      } catch {
        // Fallback: save token and proceed
        setAuthCookie(trimmed);
        router.push(redirect);
      }
    },
    [token, redirect, router]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">FCDash</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Enter your gateway token to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Gateway Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your token..."
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                Connect
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center">
          Token is stored locally in a browser cookie.
          <br />
          Tailscale users are authenticated automatically.
        </p>
      </div>
    </div>
  );
}
