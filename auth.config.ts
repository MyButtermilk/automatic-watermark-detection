import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isTryingToAccessApp = nextUrl.pathname.startsWith('/dashboard') || nextUrl.pathname.startsWith('/events') || nextUrl.pathname.startsWith('/admin');

      if (isTryingToAccessApp) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup'))) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
  providers: [], // Add providers in the main auth.ts
} satisfies NextAuthConfig;
