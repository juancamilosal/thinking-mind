import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';

export interface WompiTariff {
  id?: number;
  tarifa: number;
  comision: number;
  iva: number;
}

@Injectable({
  providedIn: 'root'
})
export class WompiTariffService {
  private apiUrl: string = environment.tarifa_wompo;

  constructor(private http: HttpClient) {}

  // Obtener las tarifas de Wompi
  getWompiTariffs(): Observable<ResponseAPI<WompiTariff[]>> {
    return this.http.get<ResponseAPI<WompiTariff[]>>(this.apiUrl);
  }

  // Obtener una tarifa específica por ID
  getWompiTariffById(id: number): Observable<ResponseAPI<WompiTariff>> {
    return this.http.get<ResponseAPI<WompiTariff>>(`${this.apiUrl}/${id}`);
  }

  // Actualizar una tarifa existente
  updateWompiTariff(id: number, tariff: Partial<WompiTariff>): Observable<ResponseAPI<WompiTariff>> {
    return this.http.patch<ResponseAPI<WompiTariff>>(`${this.apiUrl}/${id}`, tariff);
  }

  // Crear una nueva tarifa (si es necesario)
  createWompiTariff(tariff: Omit<WompiTariff, 'id'>): Observable<ResponseAPI<WompiTariff>> {
    return this.http.post<ResponseAPI<WompiTariff>>(this.apiUrl, tariff);
  }
}