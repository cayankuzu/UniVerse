import { SUPABASE_FUNCTIONS_BASE_URL } from "../config/publicEnv";

export const BASE_URL = SUPABASE_FUNCTIONS_BASE_URL;
export const DEBUG_API_TRACE = process.env.EXPO_PUBLIC_DEBUG_API_TRACE === "true";
