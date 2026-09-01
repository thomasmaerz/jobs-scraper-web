import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
    public readonly code: "AUTH_NOT_CONFIGURED" | "AUTHENTICATION_REQUIRED" | "ADMIN_REQUIRED",
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function isAdminUser(user: Pick<User, "email" | "app_metadata">): boolean {
  const metadata = user.app_metadata ?? {};
  if (metadata.admin === true || metadata.role === "admin" || metadata.user_role === "admin") return true;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(user.email && allowed.includes(user.email.toLowerCase()));
}

export async function requireAdmin(): Promise<User> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new AuthenticationError("Authentication is not configured", 401, "AUTH_NOT_CONFIGURED");
  }
  const cookieStore = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    throw new AuthenticationError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }
  if (!isAdminUser(user)) {
    throw new AuthenticationError("Administrator access required", 403, "ADMIN_REQUIRED");
  }
  return user;
}
