/**
 * @sui/contracts — contratos compartidos entre cliente y backend.
 *
 * Este archivo es el único punto de entrada del paquete (ver `exports` en
 * `package.json`). Sólo re-exporta: los contratos viven en módulos por dominio
 * para que cada uno evolucione sin arrastrar al resto.
 *
 * - `productivity`: metas, hábitos y snapshots.
 * - `sync`: protocolo batch v9 y sus parsers.
 * - `billing`: entitlements de suscripción.
 * - `widgets`: datos para la pantalla de inicio del sistema.
 * - `notifications`: notificaciones accionables.
 * - `calendarMirror`: espejo selectivo hacia Google Calendar.
 */

export * from './productivity';
export * from './sync';
export * from './billing';
export * from './widgets';
export * from './notifications';
export * from './calendarMirror';
export { isPlannedTime } from './validation';

export * from './profile';
