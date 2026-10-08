/**
 * Mock de `expo-auth-session` y su provider de Google.
 *
 * El paquete se distribuye como ESM sin transpilar y no hay test que ejercite
 * el flujo OAuth real, así que se sustituye entero. `useAuthRequest` devuelve
 * una tupla vacía: los hooks de conexión lo usan sólo para pedir el
 * `codeVerifier` y el `promptAsync`, y sin `request` DEVUELVEN `false` con un
 * error de configuración, que es justo el camino que un test quiere verificar.
 */
const useAuthRequest = () => [null, null, jest.fn()];

module.exports = {
  ResponseType: { Code: 'code' },
  useAuthRequest,
  __esModule: true,
  providers: {
    google: { useAuthRequest },
  },
};
