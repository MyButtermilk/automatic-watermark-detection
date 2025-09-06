import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const intlMiddleware = createIntlMiddleware({
  locales: ['de'],
  defaultLocale: 'de',
  localePrefix: 'as-needed'
});

export default async function middleware(request: NextRequest) {
  // First, handle internationalization
  const response = intlMiddleware(request);

  // Then, handle authentication
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;

  const { pathname } = request.nextUrl;

  // Note: The pathname from nextUrl is the original one, without locale.
  // next-intl rewrites the request for the page, but the URL object is not mutated for the middleware chain.
  // We need to check the path *after* the intl middleware has potentially added a locale.
  // However, `next-intl` is designed to work with the original path in subsequent middlewares.

  const isTryingToAccessApp = pathname.startsWith('/dashboard') || pathname.startsWith('/events') || pathname.startsWith('/admin');

  if (isTryingToAccessApp && !isLoggedIn) {
    // We need to construct the URL for the login page, respecting the locale.
    const loginUrl = new URL('/login', request.url);
    // The locale is handled by next-intl automatically when redirecting.
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
