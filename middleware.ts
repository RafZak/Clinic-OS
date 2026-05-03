import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, INTERNAL_SECRET_HEADER } from "@/lib/auth-shared";

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/icon", "/robots", "/sitemap"];
const STATIC_FILE_RE = /\.(png|jpg|jpeg|svg|gif|ico|webp|woff2?|ttf|css|js|map)$/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STATIC_FILE_RE.test(pathname);

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);

  if (isPublic) {
    return NextResponse.next({ request: { headers } });
  }

  const expectedSecret = process.env.INTERNAL_API_SECRET;
  const presentedSecret = req.headers.get(INTERNAL_SECRET_HEADER);
  if (expectedSecret && presentedSecret && presentedSecret === expectedSecret) {
    return NextResponse.next({ request: { headers } });
  }

  const authed = req.cookies.get(AUTH_COOKIE)?.value;
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
