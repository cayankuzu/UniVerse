global.URL = require("node:url").URL;

process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://abcdefghijklmnopqrst.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL ||=
  "https://abcdefghijklmnopqrst.supabase.co/functions/v1/server/make-server-e3557d40";
