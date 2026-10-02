export {
  DEFAULT_ENGAGEMENT_PROFILE,
  ENGAGEMENT_SCHEMA_VERSION,
  ENGAGEMENT_STORAGE_KEY,
} from './model/engagementTypes';
export type {
  EngagementCadence,
  EngagementEnvelopeV1,
  EngagementFact,
  EngagementProfile,
  EngagementSource,
  EngagementSlot,
} from './model/engagementTypes';
export { CADENCE_ORDER, CADENCE_SPECS } from './model/cadencePolicy';
export { buildAmbientCandidates } from './model/ambientCatalog';
export type { EngagementCandidate } from './model/ambientCatalog';
export {
  ENGAGEMENT_ID_PREFIX,
  engagementIdentifierFor,
  planEngagement,
  SCHEDULING_HORIZON_DAYS,
} from './model/slotPlanner';
export type { EngagementPlan, PlannedEngagementAlert } from './model/slotPlanner';
export {
  cancelAllEngagementNotifications,
  ENGAGEMENT_CHANNEL,
  ENGAGEMENT_PAYLOAD_TYPE,
  scheduleEngagementNotifications,
} from './services/engagementScheduler';
export {
  reconcileEngagement,
  type EngagementReconcileResult,
} from './services/engagementReconciler';
export {
  clearEngagement,
  getEngagementStorageKey,
  loadEngagement,
  migrateEngagementGuestToUser,
  writeEngagement,
} from './services/engagementRepository';
export { useEngagementStore } from './store/useEngagementStore';
export { useEngagementReconcile } from './hooks/useEngagementReconcile';
export { EngagementSettingsSection } from './components/EngagementSettingsSection';
