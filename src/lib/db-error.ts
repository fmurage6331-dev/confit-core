/**
 * Global Postgres/Supabase error translator.
 * Converts raw DB errors into friendly, user-facing messages.
 */

type DbError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined;

type FriendlyContext = {
  duplicate?: Record<string, string>; // e.g. { national_id: "A patient with this National ID already exists." }
  foreignKey?: string;
  notFound?: string;
  fallback?: string;
};

export function dbError(error: DbError, context?: FriendlyContext): string {
  if (!error) return context?.fallback ?? "An unknown error occurred.";

  const msg = error.message ?? "";
  const code = error.code ?? "";

  // 23505 — Unique constraint violation
  if (code === "23505" || /duplicate key value/i.test(msg)) {
    if (context?.duplicate) {
      for (const [key, friendly] of Object.entries(context.duplicate)) {
        if (msg.includes(key)) return friendly;
      }
    }
    return "This record already exists.";
  }

  // 23503 — Foreign key violation
  if (code === "23503" || /foreign key/i.test(msg)) {
    return context?.foreignKey ?? "This record is linked to other data and cannot be modified or deleted.";
  }

  // 23514 — Check constraint violation
  if (code === "23514" || /check constraint/i.test(msg)) {
    return "One or more values are invalid. Please review your entries.";
  }

  // 42501 — Insufficient privilege
  if (code === "42501" || /permission denied|insufficient/i.test(msg)) {
    return "You do not have permission to perform this action.";
  }

  // PGRST116 — Not found
  if (code === "PGRST116" || /no rows/i.test(msg)) {
    return context?.notFound ?? "Record not found.";
  }

  // P0001 — Custom RAISE EXCEPTION (already friendly)
  if (code === "P0001") {
    return msg;
  }

  // Our custom triggers (already friendly)
  if (/no available beds|already admitted|insufficient stock/i.test(msg)) {
    return msg;
  }

  // Fallback: return raw message truncated
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg || (context?.fallback ?? "An unexpected error occurred.");
}