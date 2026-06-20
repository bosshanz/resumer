import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { HttpsProxyAgent } from "https-proxy-agent";
import { custom as openidCustom } from "openid-client";
import { getDatabase, initDb } from "./db";
import crypto from "crypto";

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
if (proxyAgent) {
  console.log(`[auth] OAuth outbound traffic via proxy: ${proxyUrl}`);
  // Apply directly on openid-client to bypass next-auth's deep merge,
  // which would otherwise walk the agent's enumerable props and drop
  // non-enumerable methods like getName/createSocket.
  openidCustom.setHttpOptionsDefaults({ timeout: 10000, agent: proxyAgent });
}

interface GitHubProfile {
  id: number;
  login?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

initDb();

const db = getDatabase();

const githubConfigured = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

if (!process.env.NEXTAUTH_SECRET) {
  console.warn(
    "[auth] NEXTAUTH_SECRET is not set. Auth.js will fail with Configuration error. Generate one with: openssl rand -base64 32"
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(githubConfigured
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
          }),
        ]
      : [
          CredentialsProvider({
            name: "dev",
            credentials: {
              name: { label: "Name", type: "text", defaultValue: "Dev User" },
            },
            async authorize(credentials) {
              const name = (credentials?.name as string) || "Dev User";
              const githubId = `dev-${name.toLowerCase().replace(/\s+/g, "-")}`;

              const existing = db.prepare("SELECT id FROM users WHERE github_id = ?").get(githubId) as
                | { id: string }
                | undefined;

              let id: string;
              if (existing) {
                id = existing.id;
              } else {
                id = crypto.randomUUID();
                db.prepare(
                  `INSERT INTO users (id, github_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)`
                ).run(id, githubId, `${githubId}@example.com`, name, null);
              }

              return { id, name, email: `${githubId}@example.com`, image: null };
            },
          }),
        ]),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        return true;
      }
      if (account?.provider !== "github" || !profile) {
        return false;
      }

      const githubId = String((profile as unknown as GitHubProfile).id);
      const existing = db
        .prepare("SELECT id FROM users WHERE github_id = ?")
        .get(githubId) as { id: string } | undefined;

      if (existing) {
        db.prepare(
          `UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(user.email || null, user.name || null, user.image || null, existing.id);
      } else {
        const id = crypto.randomUUID();
        db.prepare(
          `INSERT INTO users (id, github_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)`
        ).run(id, githubId, user.email || null, user.name || null, user.image || null);
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubId = String((profile as unknown as GitHubProfile).id);
        const dbUser = db.prepare("SELECT id FROM users WHERE github_id = ?").get(githubId) as
          | { id: string }
          | undefined;
        if (dbUser) {
          token.sub = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        const user = db.prepare("SELECT id FROM users WHERE id = ?").get(token.sub) as
          | { id: string }
          | undefined;
        if (user) {
          (session.user as { id?: string }).id = user.id;
        }
      }
      return session as Session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
};

export default NextAuth(authOptions);
