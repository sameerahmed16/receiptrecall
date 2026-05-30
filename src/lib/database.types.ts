/**
 * Hand-written types mirroring supabase/schema.sql.
 * (Can later be replaced by `supabase gen types typescript`.)
 */

export type Category =
  | "Groceries"
  | "Dining"
  | "Transport"
  | "Subscription"
  | "Shopping"
  | "Entertainment"
  | "Health"
  | "Bills"
  | "Other";

export const CATEGORIES: Category[] = [
  "Groceries",
  "Dining",
  "Transport",
  "Subscription",
  "Shopping",
  "Entertainment",
  "Health",
  "Bills",
  "Other",
];

export type SourceType = "photo" | "screenshot" | "pdf";

export type Receipt = {
  id: string;
  user_id: string;
  image_url: string | null;
  merchant: string | null;
  merchant_normalized: string | null;
  txn_date: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  payment_method: string | null;
  raw_text: string | null;
  source_type: SourceType | null;
  confidence: number | null;
  math_ok: boolean | null;
  created_at: string;
};

export type LineItem = {
  id: string;
  receipt_id: string;
  user_id: string;
  description: string | null;
  category: Category | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  embedding: number[] | null;
};

export type Subscription = {
  id: string;
  user_id: string;
  merchant: string | null;
  amount: number | null;
  cadence: "monthly" | "weekly" | "annual" | null;
  last_seen: string | null;
  next_expected: string | null;
  active: boolean;
  dismissed: boolean;
  source: "auto" | "manual";
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type CategoryCorrection = {
  id: string;
  user_id: string;
  description: string | null;
  corrected_category: string | null;
  embedding: number[] | null;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/** Shape the supabase-js client needs for typing (satisfies GenericSchema). */
export interface Database {
  public: {
    Tables: {
      receipts: Table<Receipt>;
      line_items: Table<LineItem>;
      subscriptions: Table<Subscription>;
      chat_messages: Table<ChatMessage>;
      category_corrections: Table<CategoryCorrection>;
    };
    Views: Record<string, never>;
    Functions: {
      match_category_correction: {
        Args: {
          query_embedding: string;
          match_user_id: string;
          similarity_threshold?: number;
        };
        Returns: { corrected_category: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
