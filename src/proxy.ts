import { NextResponse, type NextRequest } from "next/server";
import { getIronSession, nextProxyCookies } from "iron-session";
import { sessionOptions, type StaffSession } from "@/lib/auth/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();
  const session = await getIronSession<StaffSession>(
    nextProxyCookies(req, res),
    sessionOptions
  );
  const authed = Boolean(session.username);

  // Desk data uses the staff session from /api/auth/login. The old passcode
  // cookie is not a second door.
  if (pathname.startsWith("/api/admin")) {
    if (authed) return res;
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // /business/* -> redirect to login, except /business/login itself
  if (pathname.startsWith("/business")) {
    if (authed || pathname === "/business/login") return res;
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/business/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/business/:path*", "/api/admin/:path*"],
};
