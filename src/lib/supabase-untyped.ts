import { supabase } from "@/integrations/supabase/client";

type SupabaseErrorLike = {
  message: string;
};

type QueryResult<T = unknown> = {
  data: T | null;
  count?: number | null;
  error: SupabaseErrorLike | null;
};

type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: (
    columns?: string,
    options?: {
      count?: "exact" | "planned" | "estimated";
      head?: boolean;
    },
  ) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  neq: (column: string, value: unknown) => QueryBuilder<T>;
  in: (column: string, values: readonly unknown[]) => QueryBuilder<T>;
  gte: (column: string, value: unknown) => QueryBuilder<T>;
  gt: (column: string, value: unknown) => QueryBuilder<T>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  lt: (column: string, value: unknown) => QueryBuilder<T>;
  ilike: (column: string, pattern: string) => QueryBuilder<T>;
  order: (
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
      foreignTable?: string;
    },
  ) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder<T>;
  update: (values: Record<string, unknown>) => QueryBuilder<T>;
  upsert: (
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ) => QueryBuilder<T>;
  delete: () => QueryBuilder<T>;
};

type SupabaseUntyped = {
  from: <T = unknown>(relation: string) => QueryBuilder<T>;
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<QueryResult<T>>;
};

export const db = supabase as unknown as SupabaseUntyped;
