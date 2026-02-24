import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "development" ? "local-dev-auth-secret-change-me" : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  events: {
    async signIn(message) {
      console.log('[NextAuth] signIn event:', JSON.stringify(message, null, 2));
    },
    async createUser(message) {
      console.log('[NextAuth] createUser event:', JSON.stringify(message, null, 2));
      // Auto-assign tenant for new users
      const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'doldadress' } });
      if (tenant && message.user?.id) {
        await prisma.user.update({
          where: { id: message.user.id },
          data: { tenantId: tenant.id },
        });
        console.log('[NextAuth] Assigned tenant', tenant.id, 'to user', message.user.id);
      }
    },
  },
  logger: {
    error(code, ...message) {
      console.error('[NextAuth ERROR]', code, ...message);
    },
    warn(code, ...message) {
      console.warn('[NextAuth WARN]', code, ...message);
    },
    debug(code, ...message) {
      console.log('[NextAuth DEBUG]', code, ...message);
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
});
