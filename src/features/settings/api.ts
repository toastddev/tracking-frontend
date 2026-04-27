import { api } from '@/lib/api';

export interface ResetDataResult {
  ok: true;
  clicks: number;
  conversions: number;
  google_ads_uploads: number;
}

export const settingsApi = {
  resetData() {
    return api<ResetDataResult>('/api/settings/reset-data', {
      method: 'POST',
      body: { confirm: 'RESET' },
    });
  },
};
