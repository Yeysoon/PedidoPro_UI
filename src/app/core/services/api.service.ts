import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getFullUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  get<T>(url: string): Observable<T>                   { return this.http.get<T>(this.getFullUrl(url)); }
  post<T>(url: string, body: any): Observable<T>       { return this.http.post<T>(this.getFullUrl(url), body); }
  put<T>(url: string, body: any): Observable<T>        { return this.http.put<T>(this.getFullUrl(url), body); }
  patch<T>(url: string, body: any = {}): Observable<T> { return this.http.patch<T>(this.getFullUrl(url), body); }
  delete<T>(url: string): Observable<T>                { return this.http.delete<T>(this.getFullUrl(url)); }
}
