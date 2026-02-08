"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice/invoice-pdf";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import type { InvoicePDFData } from "@/lib/pdf/invoice-template";

export default function PDFDownloadSection({
  data,
  fileName,
}: {
  data: InvoicePDFData;
  fileName: string;
}) {
  return (
    <PDFDownloadLink
      document={<InvoicePDF data={data} />}
      fileName={fileName}
    >
      {({ loading: pdfLoading }) => (
        <Button variant="outline" disabled={pdfLoading}>
          <FileDown className="mr-2 h-4 w-4" />
          {pdfLoading ? "生成中..." : "PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
