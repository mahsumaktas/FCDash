import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "fcdash-token";
const TAILSCALE_HEADER = "Tailscale-User-Login";
const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Auto-auth for localhost connections
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  // Check Tailscale identity header (auto-auth on Tailscale network)
  const tailscaleUser = request.headers.get(TAILSCALE_HEADER);
  if (tailscaleUser) {
    const response = NextResponse.next();
    if (!request.cookies.has(AUTH_COOKIE)) {
      response.cookies.set(AUTH_COOKIE, `tailscale:${tailscaleUser}`, {
        path: "/",
        maxAge: 60 * 60 * 24,
        sameSite: "strict",
      });
    }
    return response;
  }

  // Check auth cookie
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
