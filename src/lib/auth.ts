import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { findEnvAccountByEmail, upsertOAuthUser, verifyCollegeCredentials, type AppRole } from "./users";
import { computeAnonId } from "./crypto";

const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const hasMicrosoft = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);

/**
 * Auth for the AMS portal.
 *
 * 1. Google  - works with ANY Google account (personal Gmail included). The OAuth
 *              client itself belongs to a personal Google account; that is fine,
 *              Google does not restrict which accounts may sign in unless the
 *              consent screen only lists test users.
 * 2. College - student/faculty login id (e.g. 20231ST0024) + password.
 * 3. Microsoft - optional, only enabled when Azure AD credentials are present.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "College login",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = typeof credentials?.login === "string" ? credentials.login : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        const user = await verifyCollegeCredentials(login, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          collegeId: user.collegeId,
        } as any;
      },
    }),
    ...(hasMicrosoft
      ? [
          AzureADProvider({
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (!user?.email) return false;

      // Google / Microsoft: the account always belongs to a real person, allow it,
      // then sync a local profile (best effort, skipped when no DB is available).
      if (account?.provider === "google" || account?.provider === "azure-ad") {
        const localUser = await upsertOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
        });

        const envAccount = findEnvAccountByEmail(user.email);
        (user as any).role = localUser?.role ?? envAccount?.role ?? "STUDENT";
        (user as any).collegeId = localUser?.collegeId ?? envAccount?.login ?? null;
        if (localUser) user.id = localUser.id;
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = ((user as any).role ?? "STUDENT") as AppRole;
        token.collegeId = (user as any).collegeId ?? null;
        token.name = user.name ?? null;
        token.email = user.email ?? null;
        token.picture = user.image ?? null;
      }
      // anon_id is derived server-side from the account email (same one-way HMAC as
      // users.anon_id) so feedback stays unlinkable to the identity. The feedback API
      // needs it for rate limiting and the student "my feedback" filter.
      token.anonId =
        typeof token.email === "string" && token.email ? computeAnonId(token.email) : null;
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role ?? "STUDENT";
        (session.user as any).collegeId = token.collegeId ?? null;
        (session.user as any).anonId = token.anonId ?? null;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

};

export default NextAuth(authOptions);
