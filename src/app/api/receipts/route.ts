import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { ulid } from "ulid";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/receipts — list receipts */
export async function GET() {
  const { user } = await requireAuth();

  const rows = await db
    .select()
    .from(receipts)
    .where(eq(receipts.companyId, user.companyId))
    .orderBy(desc(receipts.createdAt));

  return NextResponse.json(rows);
}

/** POST /api/receipts — upload receipt image + OCR data */
export async function POST(request: Request) {
  const { user } = await requireAuth();

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return handleFormUpload(user, request);
  }

  // JSON body with base64 image
  return handleJsonUpload(user, request);
}

async function handleFormUpload(
  user: { id: string; companyId: string },
  request: Request,
) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return saveReceipt(user, file.name, file.type, buffer, formData);
}

async function handleJsonUpload(
  user: { id: string; companyId: string },
  request: Request,
) {
  const body = await request.json();
  if (!body.image) {
    return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
  }

  // base64 data URL: "data:image/jpeg;base64,/9j/4AAQ..."
  const match = body.image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "無効な画像フォーマット" }, { status: 400 });
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mimeType.split("/")[1] || "jpg";
  const fileName = body.fileName || `receipt.${ext}`;

  return saveReceipt(user, fileName, mimeType, buffer, null, body);
}

async function saveReceipt(
  user: { id: string; companyId: string },
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  formData: FormData | null,
  jsonBody?: Record<string, unknown>,
) {
  const id = ulid();
  const ext = fileName.match(/\.\w+$/)?.[0] || `.${mimeType.split("/")[1] || "jpg"}`;
  const storedName = `${id}${ext}`;

  // Upload to Vercel Blob
  const blob = await put(`receipts/${storedName}`, buffer, {
    access: "public",
    contentType: mimeType,
  });

  const now = new Date().toISOString();

  // Get OCR data from form or JSON body
  const ocrText = formData?.get("ocrText")?.toString() || (jsonBody?.ocrText as string) || null;
  const ocrConfidence = parseFloat(
    formData?.get("ocrConfidence")?.toString() || String(jsonBody?.ocrConfidence ?? ""),
  ) || null;
  const ocrProvider = formData?.get("ocrProvider")?.toString() || (jsonBody?.ocrProvider as string) || null;
  const storeName = formData?.get("storeName")?.toString() || (jsonBody?.storeName as string) || null;
  const date = formData?.get("date")?.toString() || (jsonBody?.date as string) || null;
  const totalAmount = parseInt(
    formData?.get("totalAmount")?.toString() || String(jsonBody?.totalAmount ?? ""),
  ) || null;
  const taxAmount = parseInt(
    formData?.get("taxAmount")?.toString() || String(jsonBody?.taxAmount ?? ""),
  ) || null;
  const items = formData?.get("items")?.toString() || (jsonBody?.items as string) || null;
  const suggestedAccountId = formData?.get("suggestedAccountId")?.toString()
    || (jsonBody?.suggestedAccountId as string) || null;
  const suggestedTaxCategoryId = formData?.get("suggestedTaxCategoryId")?.toString()
    || (jsonBody?.suggestedTaxCategoryId as string) || null;

  await db.insert(receipts)
    .values({
      id,
      companyId: user.companyId,
      fileName,
      filePath: blob.url,
      fileSize: buffer.length,
      mimeType,
      ocrText,
      ocrConfidence,
      ocrProvider,
      storeName,
      date,
      totalAmount,
      taxAmount,
      items,
      suggestedAccountId,
      suggestedTaxCategoryId,
      status: "pending",
      journalEntryId: null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

  return NextResponse.json({ id }, { status: 201 });
}
