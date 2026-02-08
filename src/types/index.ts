/** Account category (勘定科目区分) */
export type AccountCategory =
  | "asset"       // 資産
  | "liability"   // 負債
  | "equity"      // 純資産
  | "revenue"     // 収益
  | "expense";    // 費用

/** Debit or Credit side */
export type Side = "debit" | "credit";

/** Journal entry status */
export type JournalEntryStatus = "draft" | "confirmed";

/** User role */
export type UserRole = "owner" | "accountant";

/** Tax method for the company */
export type TaxMethod = "standard" | "simplified"; // 本則 / 簡易

/** Account category display names */
export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  asset: "資産",
  liability: "負債",
  equity: "純資産",
  revenue: "収益",
  expense: "費用",
};

/** Normal balance side for each category */
export const NORMAL_BALANCE: Record<AccountCategory, Side> = {
  asset: "debit",
  liability: "credit",
  equity: "credit",
  revenue: "credit",
  expense: "debit",
};
