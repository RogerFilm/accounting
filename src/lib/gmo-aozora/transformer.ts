/**
 * Transform GMO Aozora API responses into BankTransaction[].
 * Reuses the same hash logic as CSV parser for consistent duplicate detection.
 */

import type { GmoTransaction } from "./client";
import type { BankTransaction } from "@/lib/import/bank-csv/parser";

async function generateHash(
  date: string,
  amount: number,
  description: string,
): Promise<string> {
  const data = `${date}|${amount}|${description}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function transformTransactions(
  gmoTxs: GmoTransaction[],
): Promise<BankTransaction[]> {
  return Promise.all(
    gmoTxs.map(async (tx) => {
      const isDeposit = tx.transactionType === "1";
      const amountNum = parseInt(tx.amount) || 0;
      const deposit = isDeposit ? amountNum : 0;
      const withdrawal = isDeposit ? 0 : amountNum;
      const balance = parseInt(tx.balance) || 0;
      const description = tx.remarks;
      const date = tx.transactionDate; // Already YYYY-MM-DD

      const signedAmount = deposit > 0 ? deposit : -withdrawal;
      const hash = await generateHash(date, signedAmount, description);

      return {
        date,
        description,
        withdrawal,
        deposit,
        balance,
        rawLine: JSON.stringify(tx),
        hash,
      };
    }),
  );
}
