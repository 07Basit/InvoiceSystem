import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { config } from '../config';
import { lastAtOrBefore } from '../utils/binarySearch';
import type { UpdateCurrencySettingsDto } from 'shared';

const DEFAULT_BASE = 'USD';
const FX_API = 'https://api.frankfurter.dev/v1';
const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 7; // weekends/holidays have no fixing: use the previous business day
const RETRY_AFTER_FAIL_MS = 60 * 60 * 1000;
// ExchangeRate-API's free plan only returns today's rate, so it is used only for invoices this recent.
const RECENT_INVOICE_DAYS = 2;

export type RateProvider = 'ECB' | 'EXCHANGERATE_API';

const failedFetches = new Map<string, number>();

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (d: Date) => new Date(`${dayKey(d)}T00:00:00.000Z`);

export interface ConvertibleInvoice {
  total: unknown;
  currency: string;
  invoiceDate: Date;
  /** Rate typed in by the user (units of manualRateBase per 1 unit of currency); wins over automatic rates. */
  manualRate?: unknown;
  manualRateBase?: string | null;
}

export interface Conversion {
  value: number;
  /** units of the reporting currency per 1 unit of the invoice currency */
  rate: number;
  source: 'same' | 'auto' | 'manual';
  /** which service the automatic rate came from */
  provider?: RateProvider;
}

export type Converter = (inv: ConvertibleInvoice) => number | null;

interface DatedRate { time: number; rate: number; provider: RateProvider }

/** Today's rate for `from` -> `to` from ExchangeRate-API (free plan: latest rates only). */
async function fetchLatestRate(from: string, to: string): Promise<number> {
  const key = config.EXCHANGERATE_API_KEY;
  if (!key) throw new Error('EXCHANGERATE_API_KEY is not set');
  const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/${from}`, { signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => ({}))) as { result?: string; 'error-type'?: string; conversion_rates?: Record<string, number> };
  if (body.result !== 'success') throw new Error(`ExchangeRate-API: ${body['error-type'] ?? res.status}`);
  const rate = body.conversion_rates?.[to];
  if (typeof rate !== 'number' || rate <= 0) throw new Error(`ExchangeRate-API: no ${to} rate`);
  return rate;
}

async function fetchHistory(from: string, to: string, start: Date, end: Date): Promise<Array<{ date: string; rate: number }>> {
  const url = `${FX_API}/${dayKey(start)}..${dayKey(end)}?base=${from}&symbols=${to}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`rates API ${res.status}`);
  const body = (await res.json()) as { rates?: Record<string, Record<string, number>> };
  return Object.entries(body.rates ?? {})
    .map(([date, r]) => ({ date, rate: r[to] }))
    .filter((r): r is { date: string; rate: number } => typeof r.rate === 'number');
}

// Currencies the rate provider (ECB reference rates) publishes; used when its /currencies endpoint is unreachable.
const FALLBACK_CURRENCIES: Record<string, string> = {
  AUD: 'Australian Dollar', BRL: 'Brazilian Real', CAD: 'Canadian Dollar', CHF: 'Swiss Franc', CNY: 'Chinese Renminbi Yuan',
  CZK: 'Czech Koruna', DKK: 'Danish Krone', EUR: 'Euro', GBP: 'British Pound', HKD: 'Hong Kong Dollar',
  HUF: 'Hungarian Forint', IDR: 'Indonesian Rupiah', ILS: 'Israeli New Sheqel', INR: 'Indian Rupee', JPY: 'Japanese Yen',
  KRW: 'South Korean Won', MXN: 'Mexican Peso', MYR: 'Malaysian Ringgit', NOK: 'Norwegian Krone', NZD: 'New Zealand Dollar',
  PHP: 'Philippine Peso', PLN: 'Polish Zloty', SEK: 'Swedish Krona', SGD: 'Singapore Dollar', THB: 'Thai Baht',
  TRY: 'Turkish Lira', USD: 'United States Dollar', ZAR: 'South African Rand',
};

let currencyListCache: { at: number; list: Record<string, string> } | null = null;

async function getSupportedCurrencies(): Promise<Record<string, string>> {
  if (currencyListCache && Date.now() - currencyListCache.at < DAY_MS) return currencyListCache.list;
  try {
    const res = await fetch(`${FX_API}/currencies`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`rates API ${res.status}`);
    const list = (await res.json()) as Record<string, string>;
    currencyListCache = { at: Date.now(), list };
    return list;
  } catch {
    return currencyListCache?.list ?? FALLBACK_CURRENCIES;
  }
}

export const currencyService = {
  async getBaseCurrency(): Promise<string> {
    const settings = await prisma.currencySettings.findFirst();
    return settings?.baseCurrency ?? DEFAULT_BASE;
  },

  /**
   * Returns a converter that values an amount in the base currency using the exchange rate
   * of the invoice's own date (cached after the first fetch). Returns null when the
   * provider has no rate for that currency/date (provider down and not cached, or currency unsupported).
   */
  async buildConverter(
    invoices: ConvertibleInvoice[],
  ): Promise<{ baseCurrency: string; convert: Converter; convertDetailed: (inv: ConvertibleInvoice) => Conversion | null }> {
    const base = await this.getBaseCurrency();
    const history = new Map<string, DatedRate[]>();
    const manualApplies = (inv: ConvertibleInvoice) =>
      inv.currency !== base && inv.manualRate != null && Number(inv.manualRate) > 0 && inv.manualRateBase === base;

    const currencies = [...new Set(invoices.map((i) => i.currency))].filter((c) => c !== base);
    const today = utcDay(new Date());

    for (const cur of currencies) {
      const mine = invoices.filter((i) => i.currency === cur && !manualApplies(i)).map((i) => utcDay(i.invoiceDate));
      const cached = await prisma.fxRate.findMany({
        where: { fromCurrency: cur, toCurrency: base },
        orderBy: { date: 'asc' },
      });
      let series: DatedRate[] = cached.map((r) => ({ time: r.date.getTime(), rate: Number(r.rate), provider: r.source as RateProvider }));

      const lookup = (t: number) => series[lastAtOrBefore(series, t, (r) => r.time)];
      const uncovered = mine.filter((d) => {
        const hit = lookup(d.getTime());
        return !hit || d.getTime() - hit.time > LOOKBACK_DAYS * DAY_MS;
      });

      const failKey = `${cur}>${base}`;
      const lastFail = failedFetches.get(failKey);
      if (uncovered.length && (!lastFail || Date.now() - lastFail > RETRY_AFTER_FAIL_MS)) {
        const start = new Date(Math.min(...uncovered.map((d) => d.getTime())) - LOOKBACK_DAYS * DAY_MS);
        try {
          const fetched = await fetchHistory(cur, base, start, today);
          const have = new Set(cached.map((r) => dayKey(r.date)));
          const fresh = fetched.filter((r) => !have.has(r.date));
          if (fresh.length) {
            await prisma.fxRate.createMany({
              data: fresh.map((r) => ({ date: new Date(`${r.date}T00:00:00.000Z`), fromCurrency: cur, toCurrency: base, rate: r.rate })),
            });
          }
          series = [...series, ...fresh.map((r) => ({ time: new Date(`${r.date}T00:00:00.000Z`).getTime(), rate: r.rate, provider: 'ECB' as const }))]
            .sort((a, b) => a.time - b.time);
          failedFetches.delete(failKey);
        } catch (err) {
          failedFetches.set(failKey, Date.now());
          logger.info('Frankfurter has no rates for this currency', { currency: cur, base, error: (err as Error).message });
        }
      }

      // Step 2: currencies the ECB doesn't cover. ExchangeRate-API only gives today's rate, so only for recent invoices;
      // the rate is saved against the invoice's date and never changes afterwards.
      const recentCutoff = today.getTime() - RECENT_INVOICE_DAYS * DAY_MS;
      const recentUncovered = [...new Set(
        mine.filter((d) => {
          const hit = lookup(d.getTime());
          return (!hit || d.getTime() - hit.time > LOOKBACK_DAYS * DAY_MS) && d.getTime() >= recentCutoff;
        }).map(dayKey),
      )];
      const latestKey = `latest:${cur}>${base}`;
      const latestFail = failedFetches.get(latestKey);
      if (recentUncovered.length && config.EXCHANGERATE_API_KEY && (!latestFail || Date.now() - latestFail > RETRY_AFTER_FAIL_MS)) {
        try {
          const rate = await fetchLatestRate(cur, base);
          for (const day of recentUncovered) {
            const date = new Date(`${day}T00:00:00.000Z`);
            await prisma.fxRate.create({ data: { date, fromCurrency: cur, toCurrency: base, rate, source: 'EXCHANGERATE_API' } }).catch(() => undefined);
            series.push({ time: date.getTime(), rate, provider: 'EXCHANGERATE_API' });
          }
          series = series.sort((a, b) => a.time - b.time);
          failedFetches.delete(latestKey);
        } catch (err) {
          failedFetches.set(latestKey, Date.now());
          logger.warn('ExchangeRate-API lookup failed; invoices in this currency are excluded from revenue until it succeeds or a rate is entered manually', { currency: cur, base, error: (err as Error).message });
        }
      }

      history.set(cur, series);
    }

    const convertDetailed = (inv: ConvertibleInvoice): Conversion | null => {
      const amount = Number(inv.total);
      if (inv.currency === base) return { value: amount, rate: 1, source: 'same' };
      if (manualApplies(inv)) {
        const rate = Number(inv.manualRate);
        return { value: amount * rate, rate, source: 'manual' };
      }
      const t = utcDay(inv.invoiceDate).getTime();
      const series = history.get(inv.currency) ?? [];
      const hit = series[lastAtOrBefore(series, t, (r) => r.time)];
      return hit && t - hit.time <= LOOKBACK_DAYS * DAY_MS ? { value: amount * hit.rate, rate: hit.rate, source: 'auto', provider: hit.provider } : null;
    };
    const convert: Converter = (inv) => convertDetailed(inv)?.value ?? null;

    return { baseCurrency: base, convert, convertDetailed };
  },

  async getSettingsView() {
    const [baseCurrency, supported] = await Promise.all([this.getBaseCurrency(), getSupportedCurrencies()]);
    const currencies = Object.entries(supported)
      .map(([code, name]) => ({ code, name }))
      .sort((x, y) => x.code.localeCompare(y.code));
    return { baseCurrency, currencies };
  },

  async update(dto: UpdateCurrencySettingsDto) {
    const supported = await getSupportedCurrencies();
    if (!supported[dto.baseCurrency]) {
      throw new AppError(`${dto.baseCurrency} is not a supported reporting currency`, 400, 'UNSUPPORTED_CURRENCY');
    }
    const existing = await prisma.currencySettings.findFirst();
    if (existing) await prisma.currencySettings.update({ where: { id: existing.id }, data: { baseCurrency: dto.baseCurrency } });
    else await prisma.currencySettings.create({ data: { baseCurrency: dto.baseCurrency } });
    return this.getSettingsView();
  },
};
