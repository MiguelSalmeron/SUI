import { appEventBus } from '../appEventBus';

describe('typed app event bus', () => {
  it('entrega payload y permite cancelar suscripción', () => {
    const listener = jest.fn();
    const off = appEventBus.on('productivity.goalCompleted', listener);
    const payload = { goalId: 'goal-1', occurredAt: '2026-09-01T00:00:00.000Z' };

    appEventBus.emit('productivity.goalCompleted', payload);
    off();
    appEventBus.emit('productivity.goalCompleted', payload);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('aísla error de listener', () => {
    const second = jest.fn();
    const offFirst = appEventBus.on('productivity.habitCompleted', () => {
      throw new Error('listener-failed');
    });
    const offSecond = appEventBus.on('productivity.habitCompleted', second);

    expect(() =>
      appEventBus.emit('productivity.habitCompleted', {
        habitId: 'habit-1',
        occurredAt: '2026-09-01T00:00:00.000Z',
      }),
    ).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });
});
