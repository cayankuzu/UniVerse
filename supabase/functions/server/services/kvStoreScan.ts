import type { SupabaseClient } from "npm:@supabase/supabase-js";
import type { JsonValue } from "../types.ts";

export type KvRow<T extends JsonValue = JsonValue> = { key: string; value: T };

export async function listKvRowsByPrefix<T extends JsonValue>(params: {
  adminSupabase: SupabaseClient;
  kvTable: string;
  prefix: string;
}): Promise<Array<KvRow<T>>> {
  const pageSize = 1000;
  const rows: Array<KvRow<T>> = [];
  let from = 0;

  for (;;) {
    const { data, error } = await params.adminSupabase
      .from(params.kvTable)
      .select("key,value")
      .like("key", `${params.prefix}%`)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...(data as Array<KvRow<T>>));
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return rows;
}
