/**
 * Configuration service to handle different environments
 */

class ConfigService {
  private apiBaseUrl: string;

  constructor() {
    // Check if running in Electron
    const isElectron = !!(window && window.process && window.process.type);

    // In development, use proxy; in production/Electron, use direct backend URL
    if (import.meta.env.DEV) {
      // Development mode - Vite proxy handles /api
      this.apiBaseUrl = '';
    } else {
      // Production mode - connect directly to backend
      this.apiBaseUrl = 'http://localhost:3000';
    }
  }

  getApiUrl(endpoint: string): string {
    // Ensure endpoint starts with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // In development, return just the endpoint (proxy will handle it)
    // In production, prepend the base URL
    return this.apiBaseUrl ? `${this.apiBaseUrl}${cleanEndpoint}` : cleanEndpoint;
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  isProduction(): boolean {
    return import.meta.env.PROD;
  }

  isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }
}

export const configService = new ConfigService();