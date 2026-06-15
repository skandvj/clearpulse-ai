import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { ensureUserOrganization } from "@/lib/tenant";
import {
  ensureDemoAccessUser,
  getProvisionedRole,
  isDemoAccessEnabled,
  syncUserRoleIfNeeded,
} from "@/lib/auth-policy";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
    };
  }

  interface User {
    role?: Role;
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password || !user.isActive) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordValid) return null;

        const role = await syncUserRoleIfNeeded({
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        const organization = await ensureUserOrganization(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role,
          organizationId: organization.id,
          organizationName: organization.name,
          organizationSlug: organization.slug,
        };
      },
    }),
    CredentialsProvider({
      id: "demo",
      name: "demo",
      credentials: {},
      async authorize() {
        if (!isDemoAccessEnabled()) {
          return null;
        }

        const { user, organization } = await ensureDemoAccessUser();

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          organizationId: organization.id,
          organizationName: organization.name,
          organizationSlug: organization.slug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role as Role) ?? "CSM";
        token.organizationId = user.organizationId as string;
        token.organizationName = user.organizationName as string;
        token.organizationSlug = user.organizationSlug as string;
      }

      if (trigger === "update" && session?.role) {
        token.role = session.role as Role;
      }

      if (token.id && !token.organizationId) {
        const organization = await ensureUserOrganization(token.id);
        token.organizationId = organization.id;
        token.organizationName = organization.name;
        token.organizationSlug = organization.slug;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.organizationName = token.organizationName;
        session.user.organizationSlug = token.organizationSlug;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser && !existingUser.isActive) {
          return false;
        }

        if (!existingUser) {
          const role = getProvisionedRole(user.email!);
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              avatarUrl: user.image,
              role,
              isActive: true,
              lastLogin: new Date(),
            },
          });
          const organization = await ensureUserOrganization(newUser.id);
          user.id = newUser.id;
          user.role = newUser.role;
          user.organizationId = organization.id;
          user.organizationName = organization.name;
          user.organizationSlug = organization.slug;
        } else {
          const role = await syncUserRoleIfNeeded({
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
            isActive: existingUser.isActive,
          });

          await prisma.user.update({
            where: { email: user.email! },
            data: { lastLogin: new Date() },
          });
          const organization = await ensureUserOrganization(existingUser.id);
          user.id = existingUser.id;
          user.role = role;
          user.organizationId = organization.id;
          user.organizationName = organization.name;
          user.organizationSlug = organization.slug;
        }
      }
      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
