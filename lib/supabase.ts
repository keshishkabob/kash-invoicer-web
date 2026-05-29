import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost";
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY || "placeholder";

export const supabase = createClient(url, key);
