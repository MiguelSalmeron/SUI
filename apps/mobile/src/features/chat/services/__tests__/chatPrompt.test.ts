import { buildEmotionalProfile, buildPayload, buildSystemPrompt } from '../chatPrompt';
import type { ChatMessage } from '../../types/chat';
import { buildReportPayload } from '../reportPrompt';

const profile = {
  name: 'Ana',
  goals: ['Dormir mejor', 'Estudiar con enfoque'],
  locale: 'es' as const,
};

describe('chatPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 30, 10, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('construye perfil emocional desde datos voluntarios', () => {
    expect(buildEmotionalProfile(profile)).toEqual({
      name: 'Ana',
      goals: ['Dormir mejor', 'Estudiar con enfoque'],
      locale: 'es',
      botPersonality: 'calm',
    });
  });

  it('incluye guardrails clínicos en el system prompt', () => {
    const system = buildSystemPrompt(buildEmotionalProfile(profile));
    expect(system).toContain('No eres un terapeuta');
    expect(system).toContain('diagnósticos clínicos');
    expect(system).toContain('Nombre: Ana');
  });

  it('arma payload filtrando errores, streaming y mensajes vacíos', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hola', createdAt: 1 },
      { id: '2', role: 'assistant', content: '', createdAt: 2 },
      { id: '3', role: 'assistant', content: 'Estoy aquí', createdAt: 3 },
      { id: '4', role: 'user', content: 'falló', createdAt: 4, error: true },
      { id: '5', role: 'assistant', content: 'typing', createdAt: 5, streaming: true },
    ];

    expect(buildPayload(buildEmotionalProfile(profile), history)).toEqual([
      expect.objectContaining({ role: 'system' }),
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Estoy aquí' },
    ]);
  });

  it('limita el historial a los últimos 10 turnos válidos', () => {
    const history: ChatMessage[] = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `mensaje-${index}`,
      createdAt: index,
    }));

    const payload = buildPayload(buildEmotionalProfile(profile), history);
    expect(payload).toHaveLength(11);
    expect(payload[1]).toEqual({ role: 'user', content: 'mensaje-2' });
    expect(payload[10]).toEqual({ role: 'assistant', content: 'mensaje-11' });
  });

  it('genera cierre nocturno en idioma del perfil', () => {
    const payload = buildReportPayload(buildEmotionalProfile({ ...profile, locale: 'en' }), {
      completed: ['Walk'],
      pending: ['Read'],
      streak: 2,
    });
    expect(payload[0].content).toContain('in English');
    expect(payload[1].content).toContain('Write a brief nightly summary in English');
    expect(payload[1].content).not.toContain('Escribe un resumen');
  });
});
