import { api } from './client'

export type WangMaiDeepSeekOAuthStatus =
  | { loggedIn: false }
  | {
      loggedIn: true
      name: string | null
      /** Masked email or mobile number of the signed-in account. */
      contact: string | null
    }

export const wangmaiDeepSeekOAuthApi = {
  /** `locale` only picks the language of the DeepSeek login page. */
  start(locale?: string) {
    return api.post<{ authorizeUrl: string; state: string }>(
      '/api/wangmai-deepseek-oauth/start',
      locale ? { locale } : {},
    )
  },

  status() {
    return api.get<WangMaiDeepSeekOAuthStatus>('/api/wangmai-deepseek-oauth')
  },

  logout() {
    return api.delete<{ ok: true }>('/api/wangmai-deepseek-oauth')
  },
}
