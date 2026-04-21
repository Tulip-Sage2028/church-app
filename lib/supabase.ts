import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lzakcytxxyocchikyukw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6YWtjeXR4eHlvY2NoaWt5dWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzg3NDIsImV4cCI6MjA5MTk1NDc0Mn0.PrgYWL9yHpTCzt0Gq7Ua_2Z5poRdsInINqYdNfB32MA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
