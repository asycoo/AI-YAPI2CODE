import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getStorage, setStorage } from '../utils/storage';
import { StorageKey } from '../constants/config';

let cookie = '';
let baseURL = '';

const instance: AxiosInstance = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json;charset=UTF-8' },
});

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (cookie) {
    config.headers.set('Cookie', cookie);
  }
  return config;
});

instance.interceptors.response.use((response: AxiosResponse) => {
  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    cookie = setCookie.map((c: string) => c.split(';')[0]).join('; ');
    setStorage(StorageKey.COOKIE, cookie);
  }
  return response.data;
});

export function initRequest(serverUrl: string): void {
  baseURL = serverUrl.replace(/\/$/, '');
  const savedCookie = getStorage<string>(StorageKey.COOKIE);
  if (savedCookie) {
    cookie = savedCookie;
  }
}

export function setServerUrl(url: string): void {
  baseURL = url.replace(/\/$/, '');
  setStorage(StorageKey.SERVER_URL, baseURL);
}

export function getServerUrl(): string {
  return baseURL;
}

export function clearCookie(): void {
  cookie = '';
  setStorage(StorageKey.COOKIE, '');
}

export function yapiGet<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  return instance.get(`${baseURL}${url}`, { params }) as Promise<T>;
}

export function yapiPost<T = any>(url: string, data?: any): Promise<T> {
  return instance.post(`${baseURL}${url}`, data) as Promise<T>;
}
