import { Injectable } from '@angular/core';

export interface RuntimeConfig {
  googleClientId: string;
}

const CONFIG_URL = '/config.json';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private _config: RuntimeConfig | null = null;
  private _loadPromise: Promise<RuntimeConfig> | null = null;

  load(): Promise<RuntimeConfig> {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
        return res.json() as Promise<Partial<RuntimeConfig>>;
      })
      .then((raw) => {
        const config: RuntimeConfig = { googleClientId: raw.googleClientId ?? '' };
        this._config = config;
        return config;
      })
      .catch((err) => {
        // Boot must not hard-fail on missing config — auth guard redirects to /auth
        // when googleClientId is empty, surfacing the misconfiguration to the user.
        this._config = { googleClientId: '' };
        console.error('[ConfigService]', err);
        return this._config;
      });
    return this._loadPromise;
  }

  get googleClientId(): string {
    if (!this._config) {
      throw new Error('ConfigService.load() must complete before config is read');
    }
    return this._config.googleClientId;
  }
}
