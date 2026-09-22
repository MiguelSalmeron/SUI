import { ConnectionApiError } from '../googleConnectionApi';
import {
  androidReverseRedirectUri,
  calendarPromptParams,
  connectionErrorReason,
  translateConnectionError,
} from '../calendarAuth';

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: { currentUser: null },
  getAppCheckToken: async () => null,
}));

const t = (key: string): string => key;

describe('androidReverseRedirectUri', () => {
  it('android con clientes configurados usa el esquema reverso del client ID', () => {
    expect(
      androidReverseRedirectUri(
        'android',
        '15366859281-hjaskugduu45p7cik2031t09a74gd5dk.apps.googleusercontent.com',
        '15366859281-nec6dkkoafaqtst8035mut3cebqe6s9t.apps.googleusercontent.com',
      ),
    ).toBe(
      'com.googleusercontent.apps.15366859281-nec6dkkoafaqtst8035mut3cebqe6s9t:/oauth2redirect',
    );
  });

  it('fuera de android no define redirect (Expo usa su default)', () => {
    expect(androidReverseRedirectUri('ios', 'web-id', 'android-id')).toBeUndefined();
    expect(androidReverseRedirectUri('web', 'web-id', 'android-id')).toBeUndefined();
  });

  it('sin clientes configurados no define redirect', () => {
    expect(androidReverseRedirectUri('android', undefined, 'android-id')).toBeUndefined();
    expect(androidReverseRedirectUri('android', 'web-id', undefined)).toBeUndefined();
  });
});

describe('calendarPromptParams', () => {
  it('pide offline y consent + select_account juntos', () => {
    const params = calendarPromptParams();
    expect(params.access_type).toBe('offline');
    expect(params.prompt).toContain('consent');
    expect(params.prompt).toContain('select_account');
  });

  it('no depende de selectAccount (que pisaría extraParams.prompt)', () => {
    // Regresión: expo-auth-session asigna prompt='select_account' cuando
    // selectAccount=true, sobrescribiendo 'consent' y perdiendo refresh_token.
    expect(calendarPromptParams().prompt.split(' ')).toEqual(
      expect.arrayContaining(['consent', 'select_account']),
    );
  });
});

describe('connectionErrorReason', () => {
  it('mapea ConnectionApiError a http_<status>', () => {
    expect(connectionErrorReason(new ConnectionApiError(400, 'x'))).toBe('http_400');
    expect(connectionErrorReason(new ConnectionApiError(502, 'x'))).toBe('http_502');
  });

  it('mapea fallo de red y desconocidos', () => {
    expect(connectionErrorReason(new TypeError('Network request failed'))).toBe('network');
    expect(connectionErrorReason(new Error('boom'))).toBe('unknown');
  });
});

describe('translateConnectionError', () => {
  it('traduce cada status a un mensaje accionable', () => {
    expect(translateConnectionError(new ConnectionApiError(400, 'x'), t)).toBe(
      'connections.errorConnectConfig',
    );
    expect(translateConnectionError(new ConnectionApiError(403, 'x'), t)).toBe(
      'connections.errorPermission',
    );
    expect(translateConnectionError(new ConnectionApiError(429, 'x'), t)).toBe(
      'connections.errorRateLimited',
    );
    expect(translateConnectionError(new ConnectionApiError(503, 'x'), t)).toBe(
      'connections.errorConfig',
    );
    expect(translateConnectionError(new ConnectionApiError(502, 'x'), t)).toBe(
      'connections.errorGoogle',
    );
  });

  it('red y desconocidos', () => {
    expect(translateConnectionError(new TypeError('fetch failed'), t)).toBe(
      'connections.errorNetwork',
    );
    expect(translateConnectionError(new Error('boom'), t)).toBe('connections.errorSync');
  });
});
