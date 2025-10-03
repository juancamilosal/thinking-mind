import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly provider = environment.exchangeRates?.provider || 'exchangerate_host';
  private readonly alphaKey = environment.exchangeRates?.alphavantageApiKey || '';
  private readonly currencylayerKey = environment.exchangeRates?.currencylayerApiKey || '';

  constructor(private http: HttpClient) {}

  getUsdToCop(): Observable<number> {
    return this.getRate('USD', 'COP');
  }

  getEurToCop(): Observable<number> {
    return this.getRate('EUR', 'COP');
  }

  private getRate(base: string, symbol: string): Observable<number> {
    switch (this.provider) {
      case 'alphavantage':
        // Alpha Vantage: FX en tiempo (casi) real. Requiere API key.
        if (!this.alphaKey) {
          // Sin clave, hacer fallback a exchangerate.host
          return this.getFromExchangeRateHost(base, symbol);
        }
        return this.getFromAlphaVantage(base, symbol);

      case 'currencylayer':
        // Currencylayer por Apilayer (muy alineado con Google). Requiere access_key.
        return this.getFromCurrencylayer(base, symbol);

      case 'erapi':
        // API previa (open.er-api.com)
        return this.getFromERApi(base, symbol);

      case 'exchangerate_host':
      default:
        // Exchangerate.host (gratis, buena cobertura).
        return this.getFromExchangeRateHost(base, symbol);
    }
  }

  private getFromExchangeRateHost(base: string, symbol: string): Observable<number> {
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbol)}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const rate = res?.rates?.[symbol];
        return typeof rate === 'number' ? rate : 0;
      }),
      catchError(() => of(0))
    );
  }

  private getFromAlphaVantage(base: string, symbol: string): Observable<number> {
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(base)}&to_currency=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(this.alphaKey)}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const payload = res?.['Realtime Currency Exchange Rate'];
        const rateStr = payload?.['5. Exchange Rate'];
        const rate = rateStr ? parseFloat(rateStr) : 0;
        return isNaN(rate) ? 0 : rate;
      }),
      catchError(() => of(0))
    );
  }

  private getFromCurrencylayer(base: string, symbol: string): Observable<number> {
    // Currencylayer actualiza frecuentemente y suele coincidir con Google.
    // Nota: En plan gratuito, la base fija es USD; si base != USD, convertimos mediante USD.
    if (!this.currencylayerKey) {
      return of(0);
    }
    const url = `http://api.currencylayer.com/live?access_key=${encodeURIComponent(this.currencylayerKey)}&currencies=${encodeURIComponent(symbol)},${encodeURIComponent(base)}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const quotes = res?.quotes;
        if (!quotes) return 0;
        const usdToSymbol = quotes[`USD${symbol}`];
        if (base === 'USD') {
          return typeof usdToSymbol === 'number' ? usdToSymbol : 0;
        }
        const usdToBase = quotes[`USD${base}`];
        if (typeof usdToSymbol === 'number' && typeof usdToBase === 'number' && usdToBase > 0) {
          return usdToSymbol / usdToBase; // (USD->COP) / (USD->EUR) => EUR->COP
        }
        return 0;
      }),
      catchError(() => of(0))
    );
  }

  private getFromERApi(base: string, symbol: string): Observable<number> {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const rate = res?.rates?.[symbol];
        return typeof rate === 'number' ? rate : 0;
      }),
      catchError(() => of(0))
    );
  }
}