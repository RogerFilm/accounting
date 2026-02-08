/**
 * GMO Aozora Net Bank API client.
 * Docs: https://api.sunabar.gmo-aozora.com/corporation/v1
 */

const BASE_URL = process.env.GMO_AOZORA_BASE_URL!;
const ACCESS_TOKEN = process.env.GMO_AOZORA_ACCESS_TOKEN!;

export class GmoApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GmoApiError";
  }
}

async function gmoFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "x-access-token": ACCESS_TOKEN,
      Accept: "application/json;charset=UTF-8",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GmoApiError(
      res.status,
      body.errorCode ?? "UNKNOWN",
      body.errorMessage ?? `API error ${res.status}`,
    );
  }

  return res.json();
}

// --- Balance ---

export interface GmoBalance {
  accountId: string;
  accountTypeCode: string;
  accountTypeName: string;
  balance: string;
  baseDate: string;
  baseTime: string;
  withdrawableAmount: string;
}

export interface BalanceResponse {
  balances: GmoBalance[];
}

export async function fetchBalance(): Promise<BalanceResponse> {
  return gmoFetch("/accounts/balances");
}

// --- Transactions ---

export interface GmoTransaction {
  transactionDate: string; // "2024-12-15"
  valueDate: string;
  transactionType: string; // "1" = 入金, "2" = 出金
  amount: string; // "50000"
  remarks: string; // 摘要
  balance: string;
  itemKey: string;
}

export interface TransactionsResponse {
  accountId: string;
  transactions: GmoTransaction[];
  hasNext: boolean;
  nextItemKey?: string;
}

/**
 * Fetch transactions with automatic pagination.
 * GMO API returns max 500 per request.
 */
export async function fetchTransactions(
  dateFrom: string,
  dateTo: string,
): Promise<GmoTransaction[]> {
  const all: GmoTransaction[] = [];
  let nextItemKey: string | undefined;

  do {
    const params: Record<string, string> = { dateFrom, dateTo };
    if (nextItemKey) params.nextItemKey = nextItemKey;

    const data: TransactionsResponse = await gmoFetch(
      "/accounts/transactions",
      params,
    );

    all.push(...data.transactions);
    nextItemKey = data.hasNext ? data.nextItemKey : undefined;
  } while (nextItemKey);

  return all;
}
