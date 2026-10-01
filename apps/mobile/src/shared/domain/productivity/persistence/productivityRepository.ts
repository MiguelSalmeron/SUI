/**
 * Punto de entrada de la persistencia de productividad.
 *
 * Antes este archivo concentraba claves, validación, migraciones, outbox y
 * merge en 800+ líneas; ahora reexporta los módulos en que se partió para que
 * los consumidores sigan importando desde acá sin cambiar una línea.
 */

export {
  PRODUCTIVITY_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_V8_STORAGE_KEY,
  LEGACY_PRODUCTIVITY_STORAGE_KEY,
  getProductivityStorageKey,
  getDeviceId,
} from './storageKeys';

export {
  EMPTY_PRODUCTIVITY_DATA,
  combineProductivity,
  emptyPullState,
  fingerprintValue,
  hasMeaningfulProductivityData,
  metadataKey,
  migrateToLatest,
  migrateV6ToV7,
  migrateV7ToV8,
  migrateV8ToV9,
  parseProductivityEnvelopeV9,
  productivitySummary,
} from './envelope';

export {
  clearLocalProductivity,
  loadLocalProductivity,
  migrateLocalGuestToUser,
  replaceLocalProductivity,
  writeLocalProductivity,
} from './localStore';

export {
  applyPendingMutations,
  isDefaultSummary,
  persistLocalProductivity,
} from './mutationQueue';

export {
  applyCloudChanges,
  localMetadata,
  pendingMetadata,
  rebasePendingMutations,
} from './cloudMerge';
