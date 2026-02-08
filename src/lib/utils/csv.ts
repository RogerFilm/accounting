/**
 * Convert a 2D array of strings to CSV format.
 * Handles quoting of fields containing commas, quotes, or newlines.
 */
export function toCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(","),
    )
    .join("\n");
}

/**
 * Create a CSV download response with BOM for Excel compatibility.
 */
export function csvResponse(csv: string, filename: string): Response {
  const bom = "\uFEFF";
  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
