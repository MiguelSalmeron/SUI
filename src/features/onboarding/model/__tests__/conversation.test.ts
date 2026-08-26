import { buildConversation } from '../conversation';
import type { OnboardingProfile } from '../../types/onboarding';

const profile: OnboardingProfile = {
  name: 'Ana',
  hasRoute: 'yes',
  career: 'Psicología',
  botPersonality: 'calm',
  chronotype: 'morning',
  birthYear: 2004,
};

describe('buildConversation', () => {
  it('builds the transcript through the current step', () => {
    const messages = buildConversation('career', profile, []);

    expect(messages.at(-1)).toEqual({
      id: 'bot-career',
      from: 'bot',
      text: 'Elige tu área de estudio o escribe el nombre exacto de tu carrera:',
    });
    expect(messages).toContainEqual({
      id: 'user-name',
      from: 'user',
      text: 'Ana',
    });
  });

  it('skips the career step when no academic route exists', () => {
    const messages = buildConversation('botPersonality', { ...profile, hasRoute: 'no' }, []);

    expect(messages.some((message) => message.id.includes('career'))).toBe(false);
  });

  it('renders selected goal labels', () => {
    const messages = buildConversation('submitting', profile, ['sleep', 'exercise', 'focus']);
    const goalAnswer = messages.find((message) => message.id === 'user-goals');

    expect(goalAnswer?.text).toBeTruthy();
  });
});
