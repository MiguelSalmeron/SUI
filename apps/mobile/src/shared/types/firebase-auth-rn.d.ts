/**
 * Aumento de módulo ambiental: `getReactNativePersistence` lo publica `@firebase/auth`
 * bajo la condición de exportación `react-native` (dist/rn/index.rn.d.ts),
 * pero la entrada `types` incondicional de nivel superior del paquete se lo
 * esconde a la resolución por defecto de TypeScript. Metro sí carga la
 * condición `react-native` en runtime, así que el símbolo existe en el bundle.
 *
 * Esta declaración devuelve la visibilidad de tipos sin apagar el chequeo. Si
 * algún día `@firebase/auth` arregla su mapa de exportaciones, el archivo se
 * borra.
 */
export {};
declare module 'firebase/auth' {
  import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
