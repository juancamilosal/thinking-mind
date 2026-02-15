import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { AdvertisingItem } from '../models/Advertising';

@Injectable({
  providedIn: 'root'
})
export class AdvertisingService {
  private apiUrl = environment.advertising;
  private assetsUrl = environment.assets;

  constructor(private http: HttpClient) {}

  list(params?: any): Observable<ResponseAPI<AdvertisingItem[]>> {
    const baseParams: any = {
      fields: '*',
      sort: '-id'
    };
    const reqParams = { ...(params || {}), ...baseParams };
    return this.http.get<ResponseAPI<AdvertisingItem[]>>(this.apiUrl, { params: reqParams }).pipe(
      map((res) => {
        const items = Array.isArray((res as any).data) ? (res as any).data : (res as any);
        const data = (items || []).map((it: any) => ({
          ...it,
          img_url: it?.img ? `${this.assetsUrl}/${it.img}` : undefined
        }));
        return { ...(res as any), data };
      })
    );
  }

  create(item: AdvertisingItem): Observable<ResponseAPI<AdvertisingItem>> {
    return this.http.post<ResponseAPI<AdvertisingItem>>(this.apiUrl, item);
  }

  update(id: number | string, item: Partial<AdvertisingItem>): Observable<ResponseAPI<AdvertisingItem>> {
    return this.http.patch<ResponseAPI<AdvertisingItem>>(`${this.apiUrl}/${id}`, item);
  }

  delete(id: number | string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}

