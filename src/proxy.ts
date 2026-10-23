import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type StaffSession } from "@/lib/auth/session";

// Person A's admin login/logout must stay reachable without a staff
// session, otherwise their own login endpoint 401s itself.
// TODO: At the hour-14 integration, revisit the /api/admin/login|logout
// exemptions once Person A's desk uses the staff session.
const ADMIN_PUBLIC_PATHS = new Set(["/api/admin/login", "/api/admin/logout"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  const session = await getIronSession<StaffSession>(
    nextProxyCookies(req, res),
    sessionOptions
  );
  const authed = Boolean(session.username);

  // /api/admin/* -> 401 JSON when unauthenticated
  if (pathname.startsWith("/api/admin")) {
    if (authed || ADMIN_PUBLIC_PATHS.has(pathname)) return res;
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // /business/* -> redirect to login, except /business/login itself
  if (pathname.startsWith("/business")) {
    if (authed || pathname === "/business/login") return res;
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/business/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/business/:path*", "/api/admin/:path*"],
};
