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

interface GmoFetchOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

async function gmoFetch(path: string, params?: Record<string, string>, options?: GmoFetchOptions) {
  const method = options?.method ?? "GET";
  const url = new URL(`${BASE_URL}${path}`);
  if (method === "GET" && params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "x-access-token": ACCESS_TOKEN,
    Accept: "application/json;charset=UTF-8",
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/json;charset=UTF-8";
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(method === "POST" && options?.body != null
      ? { body: JSON.stringify(options.body) }
      : {}),
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
/**
 * Fetch transactions with automatic pagination.
 * If accountId is omitted, fetches it from the balance API automatically.
 */
export async function fetchTransactions(
  dateFrom: string,
  dateTo: string,
  accountId?: string,
): Promise<GmoTransaction[]> {
  // Auto-resolve accountId from balance API if not provided
  if (!accountId) {
    const balanceData = await fetchBalance();
    if (!balanceData.balances || balanceData.balances.length === 0) {
      throw new GmoApiError(404, "NO_ACCOUNT", "口座が見つかりません");
    }
    accountId = balanceData.balances[0].accountId;
  }

  const all: GmoTransaction[] = [];
  let nextItemKey: string | undefined;

  do {
    const params: Record<string, string> = { accountId, dateFrom, dateTo };
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

// --- Virtual Account (VA) ---

export interface VaIssueRequest {
  vaContractAuthKey: string;
  vaTypeCode: string; // "1" = 期限型, "2" = 継続型
  depositAmountExistCode: string; // "1" = 振込金額の指定あり, "2" = なし
  depositAmount?: string;
  vaTradeInformation?: string; // 取引情報 (自由入力)
  expiredDate?: string; // 期限型の場合 (YYYYMMDD)
}

export interface VirtualAccount {
  vaId: string;
  vaContractAuthKey: string;
  vaTypeCode: string;
  vaTypeName: string;
  vaAccountName: string;
  vaAccountNameKana: string;
  vaNumber: string; // バーチャル口座番号
  depositAmount: string;
  vaStatus: string; // "01" = 有効, "02" = 停止, "03" = 削除
  vaStatusName: string;
  expiredDate: string;
  latestDepositDate: string;
  latestDepositAmount: string;
  vaTradeInformation: string;
}

export interface VaIssueResponse {
  vaContractAuthKey: string;
  vaTypeCode: string;
  vaList: VirtualAccount[];
}

export interface VaListResponse {
  vaList: VirtualAccount[];
  baseDate: string;
  baseTime: string;
  count: string;
}

export interface VaDepositTransaction {
  vaNumber: string;
  depositDate: string;
  depositAmount: string;
  depositTime: string;
  remitterName: string;
  vaTradeInformation: string;
}

export interface VaDepositTransactionsResponse {
  vaDepositTransactionList: VaDepositTransaction[];
  count: string;
}

export interface VaStatusChangeRequest {
  vaId: string;
  vaContractAuthKey: string;
  vaStatusChangeCode: string; // "02" = 停止, "03" = 削除, "01" = 有効
}

export async function issueVirtualAccounts(
  accounts: VaIssueRequest[],
): Promise<VaIssueResponse> {
  return gmoFetch("/va/issue", undefined, {
    method: "POST",
    body: { vaList: accounts },
  });
}

export async function listVirtualAccounts(filters?: {
  vaContractAuthKey?: string;
  vaTypeCode?: string;
  vaStatus?: string;
  vaNumber?: string;
}): Promise<VaListResponse> {
  return gmoFetch("/va/list", undefined, {
    method: "POST",
    body: filters || {},
  });
}

export async function fetchVaDepositTransactions(params: {
  vaNumber?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<VaDepositTransaction[]> {
  const data: VaDepositTransactionsResponse = await gmoFetch(
    "/va/deposit-transactions",
    {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      ...(params.vaNumber ? { vaNumber: params.vaNumber } : {}),
    },
  );
  return data.vaDepositTransactionList || [];
}

export async function changeVaStatus(
  accounts: VaStatusChangeRequest[],
): Promise<{ vaList: VirtualAccount[] }> {
  return gmoFetch("/va/status-change", undefined, {
    method: "POST",
    body: { vaList: accounts },
  });
}
