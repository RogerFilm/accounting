"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import {
  type InvoicePDFData,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/pdf/invoice-template";

// Register Noto Sans JP if available, fallback to system font
// In production, place NotoSansJP-Regular.ttf in public/fonts/
try {
  Font.register({
    family: "NotoSansJP",
    src: "/fonts/NotoSansJP-Regular.ttf",
  });
} catch {
  // Font not available, will use fallback
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "NotoSansJP",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  docInfo: {
    alignItems: "flex-end",
  },
  docNumber: {
    fontSize: 10,
    marginBottom: 4,
  },
  clientSection: {
    marginBottom: 20,
    padding: 10,
    borderBottom: "1 solid #333",
  },
  clientName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  companySection: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  registrationNumber: {
    fontSize: 8,
    color: "#666",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: "1 solid #333",
    padding: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #ccc",
    padding: 6,
  },
  colDesc: { width: "40%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "15%", textAlign: "right" },
  colTax: { width: "10%", textAlign: "center" },
  colAmount: { width: "15%", textAlign: "right" },
  colTaxAmt: { width: "10%", textAlign: "right" },
  totalsSection: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 4,
    width: 250,
  },
  totalLabel: {
    width: 120,
  },
  totalValue: {
    width: 130,
    textAlign: "right",
    fontWeight: "bold",
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: "bold",
    borderTop: "2 solid #333",
    paddingTop: 6,
  },
  taxBreakdown: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f9f9f9",
  },
  taxBreakdownTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 6,
  },
  taxBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 2,
  },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f9f9f9",
    fontSize: 8,
  },
  legend: {
    marginTop: 10,
    fontSize: 7,
    color: "#666",
  },
});

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function InvoicePDF({ data }: { data: InvoicePDFData }) {
  const typeLabel = DOCUMENT_TYPE_LABELS[data.documentType];
  const hasReducedTax = data.lines.some((l) => l.isReducedTax);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>{typeLabel}</Text>
          <View style={styles.docInfo}>
            <Text style={styles.docNumber}>No. {data.documentNumber}</Text>
            <Text>発行日: {data.issueDate}</Text>
            {data.dueDate && <Text>お支払期限: {data.dueDate}</Text>}
          </View>
        </View>

        {/* Requirement 6: 宛先 */}
        <View style={styles.clientSection}>
          <Text style={styles.clientName}>{data.clientName} 御中</Text>
          {data.clientAddress && <Text>{data.clientAddress}</Text>}
        </View>

        {/* Requirement 1: 発行事業者名 + 登録番号 */}
        <View style={styles.companySection}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          {data.companyAddress && <Text>{data.companyAddress}</Text>}
          {data.registrationNumber && (
            <Text style={styles.registrationNumber}>
              登録番号: {data.registrationNumber}
            </Text>
          )}
        </View>

        {data.subject && (
          <Text style={{ marginBottom: 10, fontSize: 11 }}>
            件名: {data.subject}
          </Text>
        )}

        {/* Grand total at top */}
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: "#f0f0f0" }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}>
            合計金額: {formatYen(data.total)}（税込）
          </Text>
        </View>

        {/* Requirement 3: 取引内容 (table) */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>品名</Text>
            <Text style={styles.colQty}>数量</Text>
            <Text style={styles.colUnit}>単価</Text>
            <Text style={styles.colTax}>税率</Text>
            <Text style={styles.colAmount}>金額</Text>
            <Text style={styles.colTaxAmt}>消費税</Text>
          </View>
          {data.lines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>
                {line.description}
                {line.isReducedTax ? " ※" : ""}
              </Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colUnit}>{formatYen(line.unitPrice)}</Text>
              <Text style={styles.colTax}>{line.taxRate}%</Text>
              <Text style={styles.colAmount}>{formatYen(line.amount)}</Text>
              <Text style={styles.colTaxAmt}>{formatYen(line.taxAmount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>小計（税抜）</Text>
            <Text style={styles.totalValue}>{formatYen(data.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>消費税</Text>
            <Text style={styles.totalValue}>{formatYen(data.taxAmount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>合計（税込）</Text>
            <Text style={styles.totalValue}>{formatYen(data.total)}</Text>
          </View>
        </View>

        {/* Requirements 4 & 5: 税率ごとの合計額 + 消費税額 */}
        <View style={styles.taxBreakdown}>
          <Text style={styles.taxBreakdownTitle}>税率別内訳</Text>
          {data.taxBreakdown.map((tb, i) => (
            <View key={i} style={styles.taxBreakdownRow}>
              <Text>
                {tb.isReduced ? `${tb.rate}%（軽減税率）` : `${tb.rate}%`}
              </Text>
              <Text>対象額: {formatYen(tb.subtotal)}</Text>
              <Text>消費税: {formatYen(tb.taxAmount)}</Text>
            </View>
          ))}
        </View>

        {/* Legend for reduced tax */}
        {hasReducedTax && (
          <Text style={styles.legend}>
            ※ 軽減税率対象品目
          </Text>
        )}

        {/* VA payment info */}
        {data.vaNumber && (
          <View style={{ marginTop: 15, padding: 10, backgroundColor: "#e8f4f8", borderLeft: "3 solid #0b3a42" }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              お振込先（専用口座）
            </Text>
            <Text style={{ fontSize: 9 }}>
              GMOあおぞらネット銀行
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "bold", marginTop: 2 }}>
              口座番号: {data.vaNumber}
            </Text>
            {data.vaAccountName && (
              <Text style={{ fontSize: 9, marginTop: 2 }}>
                口座名義: {data.vaAccountName}
              </Text>
            )}
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.notes}>
            <Text>備考:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
