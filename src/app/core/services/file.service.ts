import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DirectusFile {
  id: string;
  storage: string;
  filename_disk: string;
  filename_download: string;
  title: string;
  type: string;
  folder: string | null;
  uploaded_on: string;
  modified_on: string;
  filesize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  description: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = environment.files;

  constructor(private http: HttpClient) { }

  getFiles(params?: any): Observable<{ data: DirectusFile[] }> {
    return this.http.get<{ data: DirectusFile[] }>(this.apiUrl, { params });
  }

  uploadFile(file: File, additionalData?: { [key: string]: any }): Observable<{ data: DirectusFile }> {
    const formData = new FormData();
    formData.append('file', file);
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }
    return this.http.post<{ data: DirectusFile }>(this.apiUrl, formData);
  }

  updateFile(id: string, data: any): Observable<{ data: DirectusFile }> {
    return this.http.patch<{ data: DirectusFile }>(`${this.apiUrl}/${id}`, data);
  }

  deleteFile(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
