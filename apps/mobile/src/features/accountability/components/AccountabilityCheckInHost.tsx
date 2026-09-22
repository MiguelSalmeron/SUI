import { useMemo } from 'react';
import type { Goal, Habit } from '@sui/contracts';
import { useAccountabilityStore } from '../store/useAccountabilityStore';
import {
  AccountabilityCheckInSheet,
  type CheckInResolution,
} from './AccountabilityCheckInSheet';
import { commitmentSubjectTitle } from '../model/notificationCopy';
import { reconcileAccountability } from '../services/accountabilityReconciler';

/**
 * Host del check-in: monta la sheet cuando hay un check-in activo (desde el
 * toque de una notificación o desde la app), resuelve la decisión del usuario
 * a eventos de ciclo + hechos de auditoría y reconcilia al cerrar.
 *
 * Regla del plan §11: una notificación nunca modifica datos sin confirmación —
 * toda mutación pasa por la decisión explícita de esta pantalla.
 */
export const AccountabilityCheckInHost = ({
  goals,
  habits,
}: {
  goals: Goal[];
  habits: Habit[];
}) => {
  const activeCheckIn = useAccountabilityStore((state) => state.activeCheckIn);
  const commitments = useAccountabilityStore((state) => state.commitments);
  const closeCheckIn = useAccountabilityStore((state) => state.closeCheckIn);

  const commitment = useMemo(
    () => commitments.find((item) => item.id === activeCheckIn?.commitmentId) ?? null,
    [activeCheckIn, commitments],
  );  const subjectTitle = commitment
    ? commitmentSubjectTitle(commitment.subjectType, commitment.subjectId, { goals, habits })
    : '';

  if (!activeCheckIn || !commitment) return null;
  const resolve = (resolution: CheckInResolution, note: string) => {
    const store = useAccountabilityStore.getState();
    void (async () => {
      const stamp = new Date().toISOString();
      switch (resolution.decision) {
        case 'completed':
          await store.applyCycleEvent(commitment.id, activeCheckIn.cycleId, {
            type: 'complete',
            at: stamp,
          });
          await store.recordFact(commitment.id, activeCheckIn.cycleId, {
            kind: 'completed',
            occurredAt: stamp,
            source: 'app',
            ...(note ? { value: note.slice(0, 64) } : {}),
          });
          break;
        case 'in_progress':
          await store.applyCycleEvent(commitment.id, activeCheckIn.cycleId, {
            type: 'acknowledge',
          });
          await store.recordFact(commitment.id, activeCheckIn.cycleId, {
            kind: 'check_in',
            occurredAt: stamp,
            source: 'app',
            value: 'in_progress',
          });
          break;
        case 'minimum':
          // La versión mínima cuenta como progreso honesto (plan §8.4).
          await store.applyCycleEvent(commitment.id, activeCheckIn.cycleId, {
            type: 'complete',
            at: stamp,
          });
          await store.recordFact(commitment.id, activeCheckIn.cycleId, {
            kind: 'completed',
            occurredAt: stamp,
            source: 'app',
            value: 'minimum',
          });
          break;
        case 'reschedule':
          // Fecha/hora ya validadas por la sheet; se reprograma el compromiso
          // y el ciclo se cierra como `rescheduled` (sin presionar por el viejo).
          await store.applyCycleEvent(commitment.id, activeCheckIn.cycleId, {
            type: 'reschedule',
          });
          await store.updateCommitment(commitment.subjectType, commitment.subjectId, {
            schedule:
              commitment.schedule.kind === 'once'
                ? { kind: 'once', date: resolution.date, time: resolution.time }
                : commitment.schedule.kind === 'daily'
                  ? { kind: 'daily', time: resolution.time }
                  : { ...commitment.schedule, time: resolution.time },
          });
          await store.recordFact(commitment.id, activeCheckIn.cycleId, {
            kind: 'rescheduled',
            occurredAt: stamp,
            source: 'app',
            value: `${resolution.date} ${resolution.time}`.slice(0, 64),
          });
          break;
        case 'pause':
          await store.applyCycleEvent(commitment.id, activeCheckIn.cycleId, { type: 'pause' });
          await store.disableCommitment(commitment.subjectType, commitment.subjectId);
          await store.recordFact(commitment.id, activeCheckIn.cycleId, {
            kind: 'paused',
            occurredAt: stamp,
            source: 'app',
          });
          break;
      }
      closeCheckIn();
      void reconcileAccountability();
    })();
  };

  return (
    <AccountabilityCheckInSheet
      visible
      subjectTitle={subjectTitle}
      nextAction={commitment.nextAction}
      minimumAction={commitment.minimumAction}
      onClose={closeCheckIn}
      onResolve={resolve}
    />
  );
};
