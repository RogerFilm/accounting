import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/**
 * POST /api/receipts/[id]/ocr — Run Claude API OCR on receipt image.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await requireAuth();
  const { id } = await params;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 501 },
    );
  }

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(
      and(eq(receipts.id, id), eq(receipts.companyId, user.companyId)),
    );

  if (!receipt) {
    return NextResponse.json({ error: "レシートが見つかりません" }, { status: 404 });
  }

  // Fetch image from Vercel Blob URL
  const imageResponse = await fetch(receipt.filePath);
  if (!imageResponse.ok) {
    return NextResponse.json({ error: "画像ファイルが見つかりません" }, { status: 404 });
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const base64Image = imageBuffer.toString("base64");
  const mediaType = receipt.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: `このレシート画像からテキストを読み取ってください。以下の情報をJSON形式で抽出してください:
{
  "text": "OCRで読み取った全テキスト",
  "storeName": "店舗名",
  "date": "YYYY-MM-DD形式の日付",
  "totalAmount": 合計金額(整数),
  "taxAmount": 消費税額(整数、不明なら null),
  "items": [{"name": "商品名", "amount": 金額}]
}
JSONのみを出力してください。`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `Claude API エラー: ${response.status}` },
        { status: 502 },
      );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Claude APIからの応答を解析できません" },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Update receipt with Claude OCR results
    await db.update(receipts)
      .set({
        ocrText: parsed.text || content,
        ocrConfidence: 0.9, // Claude is generally high confidence
        ocrProvider: "claude",
        storeName: parsed.storeName || null,
        date: parsed.date || null,
        totalAmount: parsed.totalAmount ? parseInt(String(parsed.totalAmount)) : null,
        taxAmount: parsed.taxAmount ? parseInt(String(parsed.taxAmount)) : null,
        items: parsed.items ? JSON.stringify(parsed.items) : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(receipts.id, id));

    return NextResponse.json({
      ocrText: parsed.text || content,
      ocrConfidence: 0.9,
      ocrProvider: "claude",
      storeName: parsed.storeName,
      date: parsed.date,
      totalAmount: parsed.totalAmount,
      taxAmount: parsed.taxAmount,
      items: parsed.items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `OCR処理中にエラーが発生しました: ${err}` },
      { status: 500 },
    );
  }
}
