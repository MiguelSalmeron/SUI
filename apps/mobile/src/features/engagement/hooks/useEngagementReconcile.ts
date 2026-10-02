/**
 * Hook de ciclo de vida de Engagement.
 *
 * Hidrata con la sesión vigente, reconcilia la agenda al montar y al volver a
 * foreground, y enruta el toque de una alerta para registrar la apertura (que
 * alimenta la cadencia adaptativa). Nunca solicita permisos ni bloquea el
 * render: el reconciliador es best-effort.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import {
  addNotificationResponseListener,
  getLastNotificationResponseAsync,
} from '@/shared/infrastructure/notifications';
import { useEngagementStore } from '../store/useEngagementStore';
import {
  cancelAllEngagementNotifications,
  ENGAGEMENT_PAYLOAD_TYPE,
} from '../services/engagementScheduler';
import { reconcileEngagement } from '../services/engagementReconciler';

export const useEngagementReconcile = (uid: string | null, enabled: boolean): void => {
  const handleAuthUserChanged = useEngagementStore((state) => state.handleAuthUserChanged);
  // Los candidatos salen de metas/hábitos: sin productividad hidratada el plan
  // saldría vacío. Al pasar a cargada, este efecto se re-ejecuta y reconcilia.
  const productivityLoaded = useProductivityStore((state) => state.stateLoaded);

  useEffect(() => {
    let active = true;
    void (async () => {
      await handleAuthUserChanged(uid);
      if (!active) return;
      if (!enabled) {
        await cancelAllEngagementNotifications();
        return;
      }
      if (!productivityLoaded) return;
      await reconcileEngagement();
    })();
    return () => {
      active = false;
    };
  }, [uid, enabled, productivityLoaded, handleAuthUserChanged]);

  // Al volver a foreground, reparar la agenda rodante de franjas.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (
        enabled &&
        state === 'active' &&
        useEngagementStore.getState().stateLoaded &&
        useProductivityStore.getState().stateLoaded
      ) {
        void reconcileEngagement();
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  // Toque de una alerta de acompañamiento: registra la apertura para adaptar.
  useEffect(() => {
    if (!enabled) return undefined;
    const routeResponse = (
      response: {
        notification: { request: { content: { data?: Record<string, unknown> } } };
      } | null,
    ) => {
      const data = response?.notification.request.content.data;
      if (data?.type !== ENGAGEMENT_PAYLOAD_TYPE) return;
      const slotId = typeof data.slotId === 'string' ? data.slotId : '';
      if (slotId) void useEngagementStore.getState().markOpened(slotId);
    };
    void getLastNotificationResponseAsync().then(routeResponse);
    return addNotificationResponseListener(routeResponse);
  }, [enabled]);
};
