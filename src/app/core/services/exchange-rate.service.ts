import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  // API gratuita sin clave: https://open.er-api.com/
  private readonly apiBase = 'https://open.er-api.com/v6/latest';

  constructor(private http: HttpClient) {}

  getUsdToCop(): Observable<number> {
    return this.getRate('USD', 'COP');
  }

  getEurToCop(): Observable<number> {
    return this.getRate('EUR', 'COP');
  }

  private getRate(base: string, symbol: string): Observable<number> {
    const url = `${this.apiBase}/${encodeURIComponent(base)}`;
    return this.http.get<any>(url).pipe(
      map(res => {
        const rate = res?.rates?.[symbol];
        return typeof rate === 'number' ? rate : 0;
      })
    );
  }
}