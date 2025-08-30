import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageServices {

  static saveInSessionStorage(name: string, item: string): void {
    sessionStorage.setItem(name, item)
  }

  static saveObjectInSessionStorage(name: string, item: any): void {
    sessionStorage.setItem(name, JSON.stringify(item));
  }

  static getItemFromSessionStorage(name: string): string | null {
    return sessionStorage.getItem(name);
  }

  static getItemObjectFromSessionStorage(name: string): any {
    const item: string | null = sessionStorage.getItem(name);
    return item != null ? JSON.parse(item) : null;
  }
}
