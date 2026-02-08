import { z } from "zod";

const journalLineSchema = z.object({
  side: z.enum(["debit", "credit"]),
  accountId: z.string().min(1, "勘定科目を選択してください"),
  amount: z.number().int().positive("金額は1円以上で入力してください"),
  taxCategoryId: z.string().optional(),
  taxAmount: z.number().int().min(0).default(0),
  description: z.string().optional(),
});

export const journalEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が不正です"),
    description: z.string().optional(),
    clientName: z.string().optional(),
    status: z.enum(["draft", "confirmed"]).default("draft"),
    lines: z.array(journalLineSchema).min(2, "借方・貸方それぞれ1行以上必要です"),
  })
  .refine(
    (data) => {
      const debitTotal = data.lines
        .filter((l) => l.side === "debit")
        .reduce((sum, l) => sum + l.amount, 0);
      const creditTotal = data.lines
        .filter((l) => l.side === "credit")
        .reduce((sum, l) => sum + l.amount, 0);
      return debitTotal === creditTotal;
    },
    { message: "借方合計と貸方合計が一致しません", path: ["lines"] },
  )
  .refine(
    (data) => {
      const hasDebit = data.lines.some((l) => l.side === "debit");
      const hasCredit = data.lines.some((l) => l.side === "credit");
      return hasDebit && hasCredit;
    },
    { message: "借方・貸方それぞれ1行以上必要です", path: ["lines"] },
  );

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
export type JournalLineInput = z.infer<typeof journalLineSchema>;
