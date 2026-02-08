/** Standard tax categories for Japanese accounting */
export const seedTaxCategories = [
  // 課税売上
  {
    code: "sales_10",
    name: "課税売上10%",
    rate: 10,
    type: "taxable_sales" as const,
    isReduced: false,
    sortOrder: 1,
  },
  {
    code: "sales_8r",
    name: "課税売上8%（軽減）",
    rate: 8,
    type: "taxable_sales" as const,
    isReduced: true,
    sortOrder: 2,
  },

  // 課税仕入
  {
    code: "purchase_10",
    name: "課税仕入10%",
    rate: 10,
    type: "taxable_purchase" as const,
    isReduced: false,
    sortOrder: 10,
  },
  {
    code: "purchase_8r",
    name: "課税仕入8%（軽減）",
    rate: 8,
    type: "taxable_purchase" as const,
    isReduced: true,
    sortOrder: 11,
  },

  // 非課税
  {
    code: "exempt",
    name: "非課税",
    rate: 0,
    type: "exempt" as const,
    isReduced: false,
    sortOrder: 20,
  },

  // 不課税
  {
    code: "non_taxable",
    name: "不課税",
    rate: 0,
    type: "non_taxable" as const,
    isReduced: false,
    sortOrder: 21,
  },

  // 免税
  {
    code: "tax_free",
    name: "免税",
    rate: 0,
    type: "tax_free" as const,
    isReduced: false,
    sortOrder: 22,
  },
];
