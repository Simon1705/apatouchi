import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnvironment } from "@/lib/env";

const protectedPrefixes = [
  "/hari-ini",
  "/tugas",
  "/belanja",
  "/rumah",
  "/profil",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";
  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

/** Refreshes Supabase sessions and guards all application routes. */
export async function proxy(request: NextRequest) {
  const environment = getPublicEnvironment();
  let response = NextResponse.next({ request });

  if (
    !environment.isSupabaseConfigured ||
    !environment.supabaseUrl ||
    !environment.supabasePublishableKey
  ) {
    return isProtectedPath(request.nextUrl.pathname)
      ? redirectWithCookies(request, response, "/login")
      : response;
  }

  const supabase = createServerClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedPath(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (user && pathname === "/login") {
    return redirectWithCookies(request, response, "/hari-ini");
  }

  return response;
}

export const config = {
  matcher: [
    // Manifest dan aset tidak perlu melewati validasi sesi: manifest diminta
    // saat pemasangan PWA, sering kali sebelum pengguna login.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
