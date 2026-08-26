import {
  GOALS_REQUIRED,
  STEP_ORDER,
  getGoalById,
  type OnboardingProfile,
  type OnboardingStep,
} from '../types/onboarding';

export type OnboardingMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
};

const botCopy = (step: OnboardingStep, profile: OnboardingProfile): string => {
  switch (step) {
    case 'welcome':
      return '¡Hola! Soy SUI, tu copiloto preventivo. Te haré unas preguntas súper rápidas para adaptar tu experiencia. ¿Empezamos?';
    case 'name':
      return '¿Cómo te gustaría que te llame?';
    case 'hasRoute':
      return `¡Un gusto${profile.name ? ', ' + profile.name : ''}! ¿Estás en alguna ruta educativa o académica actualmente?`;
    case 'career':
      return 'Elige tu área de estudio o escribe el nombre exacto de tu carrera:';
    case 'botPersonality':
      return '¿Cómo prefieres que sea la personalidad de tu asistente SUI?';
    case 'chronotype':
      return '¿En qué momento del día sientes que rinde mejor tu mente?';
    case 'birthYear':
      return '¿En qué año naciste? (solo el año, ej. 2005)';
    case 'goals':
      return `Por último, elige ${GOALS_REQUIRED} objetivos de bienestar para tu día a día:`;
    case 'submitting':
      return 'Personalizando tu experiencia...';
    default:
      return '';
  }
};

const userAnswer = (
  step: OnboardingStep,
  profile: OnboardingProfile,
  selectedGoals: string[],
): string | null => {
  switch (step) {
    case 'welcome':
      return '¡Empecemos!';
    case 'name':
      return profile.name || null;
    case 'hasRoute':
      return profile.hasRoute === 'yes' ? 'Sí, estoy estudiando' : 'No por el momento';
    case 'career':
      return profile.career || null;
    case 'botPersonality':
      return profile.botPersonality === 'direct'
        ? '🚀 Enfocado y Directo'
        : profile.botPersonality === 'coach'
          ? '🔥 Coach Gamificado'
          : '🧘 Empático y Calmo';
    case 'chronotype':
      return profile.chronotype === 'night'
        ? '🌙 Noches (Búho)'
        : profile.chronotype === 'afternoon'
          ? '🌆 Tardes'
          : '🌅 Mañanas (Madrugador)';
    case 'birthYear':
      return profile.birthYear ? String(profile.birthYear) : null;
    case 'goals':
      return selectedGoals.length
        ? selectedGoals
            .map((id) => getGoalById(id)?.label)
            .filter(Boolean)
            .join(', ')
        : null;
    default:
      return null;
  }
};

export const buildConversation = (
  step: OnboardingStep,
  profile: OnboardingProfile,
  selectedGoals: string[],
): OnboardingMessage[] => {
  const messages: OnboardingMessage[] = [];
  const currentIndex = STEP_ORDER.indexOf(step);

  for (let index = 0; index <= currentIndex; index += 1) {
    const transcriptStep = STEP_ORDER[index];
    if (transcriptStep === 'done') continue;
    if (transcriptStep === 'career' && profile.hasRoute === 'no') continue;

    const bot = botCopy(transcriptStep, profile);
    if (bot) {
      messages.push({ id: `bot-${transcriptStep}`, from: 'bot', text: bot });
    }

    if (index < currentIndex) {
      const answer = userAnswer(transcriptStep, profile, selectedGoals);
      if (answer) {
        messages.push({ id: `user-${transcriptStep}`, from: 'user', text: answer });
      }
    }
  }

  return messages;
};
