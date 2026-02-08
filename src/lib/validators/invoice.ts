import { z } from "zod";

const invoiceLineSchema = z.object({
  description: z.string().min(1, "品名を入力してください"),
  quantity: z.number().int().positive("数量は1以上で入力してください"),
  unitPrice: z.number().int().min(0, "単価は0以上で入力してください"),
  taxRate: z.number().int().min(0).max(100).default(10),
  isReducedTax: z.boolean().default(false),
});

export const invoiceSchema = z.object({
  documentType: z.enum(["invoice", "estimate", "delivery_note", "receipt"]),
  clientId: z.string().min(1, "取引先を選択してください"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が不正です"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subject: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "issued", "paid", "cancelled"]).default("draft"),
  lines: z.array(invoiceLineSchema).min(1, "明細を1行以上入力してください"),
});

export const clientSchema = z.object({
  name: z.string().min(1, "取引先名を入力してください"),
  nameKana: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("メールアドレスの形式が不正です").optional().or(z.literal("")),
  contactPerson: z.string().optional(),
  invoiceRegistrationNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
