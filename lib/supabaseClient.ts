import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OptionChoice = {
  label: string;
  price_diff: number;
};

export type OptionGroup = {
  name: string;
  type: "single" | "multi";
  required: boolean;
  choices: OptionChoice[];
};

export type MenuItem = {
  id: number;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  available: boolean;
  options: { groups: OptionGroup[] } | null;
};
