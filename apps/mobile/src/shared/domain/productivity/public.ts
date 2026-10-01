/** Re-exporta la API pura (dominio sin I/O) para compatibilidad. */
export * from './pure';
export { useCelebrationStore } from './store/useCelebrationStore';
export { useProductivityStore, type ProductivityState } from './store/useProductivityStore';
export { STARTER_KITS } from './model/starterKits';
export type { StarterGoal, StarterHabit, StarterKit } from './model/starterKits';
export {
  clearLocalProductivity,
  hasMeaningfulProductivityData,
  migrateLocalGuestToUser,
} from './persistence/productivityRepository';
