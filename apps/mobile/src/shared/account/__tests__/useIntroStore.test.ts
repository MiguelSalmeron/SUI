import { migrateIntroState } from '../useIntroStore';

describe('intro migration', () => {
  it('preserva usuarios del onboarding anterior sin repetir bienvenida', () => {
    expect(migrateIntroState({ onboardingComplete: true, syncPending: true })).toMatchObject({
      introComplete: true,
      step: 'complete',
      accountMode: 'local',
      firstRunGuideDismissed: true,
      technicalAuthPending: true,
    });
  });

  it('mantiene bienvenida para instalaciones nuevas', () => {
    expect(migrateIntroState(undefined)).toMatchObject({
      introComplete: false,
      step: 'welcome',
      accountMode: 'local',
      syncEnabled: false,
      userIntention: null,
    });
  });

  it('preserva userIntention cuando está presente', () => {
    expect(migrateIntroState({ userIntention: 'habit' })).toMatchObject({
      userIntention: 'habit',
    });
  });
});

