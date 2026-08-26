/**
 * Ambient augmentation: `getReactNativePersistence` is shipped by `@firebase/auth`
 * under the `react-native` export condition (dist/rn/index.rn.d.ts), but the
 * package's top-level unconditional `types` entry hides it from TypeScript's
 * default resolution. Metro loads the `react-native` condition at runtime, so
 * the symbol exists in the bundle. This declaration restores type visibility
 * without disabling type-checking.
 *
 * If `@firebase/auth` fixes its exports map, this file can be deleted.
 */
export {};
declare module 'firebase/auth' {
  import type { Persistence } from '@firebase/auth';
  import type { ReactNativeAsyncStorage } from '@firebase/auth';
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence;
}
