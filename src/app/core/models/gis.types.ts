export interface GisTokenResponse {
  access_token: string;
  expires_in: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GisClientConfigError {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
  message?: string;
}

export interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: GisClientConfigError) => void;
}

export interface GisTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: GisTokenClientConfig): GisTokenClient;
          revoke(token: string, done: () => void): void;
        };
      };
    };
  }
}
