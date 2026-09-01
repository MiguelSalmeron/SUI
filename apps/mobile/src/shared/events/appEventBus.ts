export interface AppEventMap {
  'productivity.goalCompleted': { goalId: string; occurredAt: string };
  'productivity.habitCompleted': { habitId: string; occurredAt: string };
  'productivity.milestoneCompleted': {
    goalId: string;
    milestoneId: string;
    occurredAt: string;
  };
  'productivity.perfectDayReached': { date: string; occurredAt: string };
}

type EventName = keyof AppEventMap;
type Listener<K extends EventName> = (payload: AppEventMap[K]) => void;

class AppEventBus {
  private readonly listeners = new Map<EventName, Set<(payload: never) => void>>();

  emit<K extends EventName>(event: K, payload: AppEventMap[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload as never);
      } catch {}
    }
  }

  on<K extends EventName>(event: K, listener: Listener<K>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(payload: never) => void>();
    listeners.add(listener as (payload: never) => void);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener as (payload: never) => void);
      if (listeners.size === 0) this.listeners.delete(event);
    };
  }
}

export const appEventBus = new AppEventBus();
