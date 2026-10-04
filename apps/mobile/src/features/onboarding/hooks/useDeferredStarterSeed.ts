import { useEffect, useRef } from 'react';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { useI18n } from '@/shared/i18n/i18n';
import { useIntroStore } from '../store/useIntroStore';

export const useDeferredStarterSeed = (uid: string | null) => {
  const { t } = useI18n();
  const attempted = useRef(false);
  const stateLoaded = useProductivityStore((state) => state.stateLoaded);
  const introComplete = useIntroStore((state) => state.introComplete);
  const userIntention = useIntroStore((state) => state.userIntention);
  const starterSeededAt = useIntroStore((state) => state.starterSeededAt);

  useEffect(() => {
    const intro = useIntroStore.getState();
    const productivity = useProductivityStore.getState();
    // Esperamos uid: el alta anónima cambia la clave de almacenamiento y
    // dispara una recarga que podría pisar una siembra previa.
    if (
      attempted.current ||
      uid === null ||
      !intro.introComplete ||
      intro.userIntention === null ||
      intro.starterSeededAt !== null ||
      !productivity.stateLoaded ||
      productivity.goals.length > 0 ||
      productivity.habits.length > 0
    ) {
      return;
    }

    attempted.current = true;
    productivity.seedStarterData(intro.userIntention, t);
    // Con un guardado en curso, saveState encola otro y retorna de inmediato:
    // usamos void porque await tampoco garantiza que ya esté persistido.
    void productivity.saveState();
  }, [uid, stateLoaded, introComplete, userIntention, starterSeededAt, t]);
};
