/**
 * 減価償却計算
 *
 * 対応方式:
 * - 定額法 (straight-line)
 * - 定率法 (200% declining balance, post-2012)
 * - 即時償却 (少額減価償却資産の特例)
 * - 一括償却 (3年均等)
 */

export interface DepreciationScheduleRow {
  year: number; // 何年目
  fiscalYear: string; // "2024" など
  startBookValue: number; // 期首帳簿価額
  depreciationAmount: number; // 当期償却額
  endBookValue: number; // 期末帳簿価額
  accumulatedDepreciation: number; // 累計償却額
}

export interface DepreciationInput {
  acquisitionCost: number;
  residualValue: number; // 通常1円
  usefulLife: number;
  depreciationMethod: "straight_line" | "declining_balance" | "immediate" | "bulk_3year";
  acquisitionDate: string; // ISO 8601
  fiscalYearStartMonth: number; // 事業年度開始月（通常4）
}

/**
 * 取得日から最初の事業年度の使用月数を計算。
 */
function getFirstYearMonths(acquisitionDate: string, fiscalYearStartMonth: number): number {
  const d = new Date(acquisitionDate);
  const acqMonth = d.getMonth() + 1; // 1-12

  // 事業年度終了月
  const fyEndMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;

  let months: number;
  if (acqMonth <= fyEndMonth) {
    months = fyEndMonth - acqMonth + 1;
  } else {
    months = 12 - acqMonth + fyEndMonth + 1;
  }

  return Math.min(12, Math.max(1, months));
}

/**
 * 定額法の年間償却額を計算。
 */
function straightLineAnnual(cost: number, residual: number, usefulLife: number): number {
  return Math.floor((cost - residual) / usefulLife);
}

/**
 * 定率法の償却率（200%定率法）。
 */
function decliningBalanceRate(usefulLife: number): number {
  return Math.min(1, (1 / usefulLife) * 2);
}

/**
 * 定率法の保証率（償却保証額計算用）。
 * 実際の保証率は耐用年数別に国税庁が定めているが、簡易計算を使用。
 */
function guaranteeRate(usefulLife: number): number {
  // 簡易的な保証率テーブル（主要な耐用年数のみ）
  const rates: Record<number, number> = {
    2: 0.500, 3: 0.11089, 4: 0.05274, 5: 0.06249,
    6: 0.05776, 7: 0.05496, 8: 0.05111, 10: 0.04448,
    15: 0.03217, 20: 0.02517,
  };
  return rates[usefulLife] || 1 / (usefulLife * usefulLife);
}

/**
 * 減価償却スケジュールを生成。
 */
export function generateDepreciationSchedule(input: DepreciationInput): DepreciationScheduleRow[] {
  const {
    acquisitionCost,
    residualValue,
    usefulLife,
    depreciationMethod,
    acquisitionDate,
    fiscalYearStartMonth,
  } = input;

  const schedule: DepreciationScheduleRow[] = [];
  const acqYear = parseInt(acquisitionDate.split("-")[0]);
  const acqMonth = parseInt(acquisitionDate.split("-")[1]);

  // 事業年度の年を計算
  const fyStartYear = acqMonth >= fiscalYearStartMonth
    ? acqYear
    : acqYear - 1;

  if (depreciationMethod === "immediate") {
    // 即時償却: 取得年度に全額償却
    schedule.push({
      year: 1,
      fiscalYear: String(fyStartYear),
      startBookValue: acquisitionCost,
      depreciationAmount: acquisitionCost - residualValue,
      endBookValue: residualValue,
      accumulatedDepreciation: acquisitionCost - residualValue,
    });
    return schedule;
  }

  if (depreciationMethod === "bulk_3year") {
    // 一括償却: 3年均等
    const annual = Math.floor(acquisitionCost / 3);
    let remaining = acquisitionCost;
    let accumulated = 0;

    for (let y = 0; y < 3; y++) {
      const amount = y === 2 ? remaining - residualValue : annual;
      accumulated += amount;
      schedule.push({
        year: y + 1,
        fiscalYear: String(fyStartYear + y),
        startBookValue: remaining,
        depreciationAmount: amount,
        endBookValue: remaining - amount,
        accumulatedDepreciation: accumulated,
      });
      remaining -= amount;
    }
    return schedule;
  }

  const firstYearMonths = getFirstYearMonths(acquisitionDate, fiscalYearStartMonth);

  if (depreciationMethod === "straight_line") {
    const annualAmount = straightLineAnnual(acquisitionCost, residualValue, usefulLife);
    let bookValue = acquisitionCost;
    let accumulated = 0;

    for (let y = 0; y < usefulLife + 1; y++) {
      if (bookValue <= residualValue) break;

      const months = y === 0 ? firstYearMonths : 12;
      let amount = Math.floor(annualAmount * months / 12);

      // 最終年: 残額を調整
      if (bookValue - amount < residualValue) {
        amount = bookValue - residualValue;
      }

      if (amount <= 0) break;

      accumulated += amount;
      schedule.push({
        year: y + 1,
        fiscalYear: String(fyStartYear + y),
        startBookValue: bookValue,
        depreciationAmount: amount,
        endBookValue: bookValue - amount,
        accumulatedDepreciation: accumulated,
      });
      bookValue -= amount;
    }
    return schedule;
  }

  // 定率法 (200% declining balance)
  const rate = decliningBalanceRate(usefulLife);
  const guarantee = acquisitionCost * guaranteeRate(usefulLife);
  const slAnnual = straightLineAnnual(acquisitionCost, residualValue, usefulLife);
  let bookValue = acquisitionCost;
  let accumulated = 0;
  let switchedToSL = false;

  for (let y = 0; y < usefulLife + 1; y++) {
    if (bookValue <= residualValue) break;

    const months = y === 0 ? firstYearMonths : 12;
    let amount: number;

    if (switchedToSL) {
      amount = Math.floor(slAnnual * months / 12);
    } else {
      amount = Math.floor(bookValue * rate * months / 12);
      // 償却保証額チェック
      if (amount < guarantee) {
        switchedToSL = true;
        amount = Math.floor(slAnnual * months / 12);
      }
    }

    if (bookValue - amount < residualValue) {
      amount = bookValue - residualValue;
    }

    if (amount <= 0) break;

    accumulated += amount;
    schedule.push({
      year: y + 1,
      fiscalYear: String(fyStartYear + y),
      startBookValue: bookValue,
      depreciationAmount: amount,
      endBookValue: bookValue - amount,
      accumulatedDepreciation: accumulated,
    });
    bookValue -= amount;
  }

  return schedule;
}

/**
 * 当期の減価償却額を計算。
 */
export function getCurrentYearDepreciation(
  input: DepreciationInput,
  currentFiscalYear: string,
): number {
  const schedule = generateDepreciationSchedule(input);
  const row = schedule.find((r) => r.fiscalYear === currentFiscalYear);
  return row?.depreciationAmount || 0;
}
