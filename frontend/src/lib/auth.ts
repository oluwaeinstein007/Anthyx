import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = (await res.json()) as {
            user: { id: string; email: string; name?: string; orgId: string; role: string };
            token: string;
          };

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? data.user.email,
            orgId: data.user.orgId,
            role: data.user.role,
            token: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token["orgId"] = (user as typeof user & { orgId: string }).orgId;
        token["role"] = (user as typeof user & { role: string }).role;
        token["apiToken"] = (user as typeof user & { token: string }).token;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        // @ts-expect-error — extending next-auth session type
        orgId: token["orgId"] as string,
        role: token["role"] as string,
        apiToken: token["apiToken"] as string,
      };
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
