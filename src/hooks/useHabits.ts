import { useState, useCallback } from 'react';
import { HomeListItem } from '../components/home/HomeListSection';

const createItem = (title: string): HomeListItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  completed: false,
});

export const useHabits = (initialHabits: HomeListItem[]) => {
  const [habits, setHabits] = useState<HomeListItem[]>(initialHabits);

  const addHabit = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;

    const newItem = createItem(trimmedTitle);
    setHabits((currentHabits) => [newItem, ...currentHabits]);
    return true;
  }, []);

  const toggleHabit = useCallback((itemId: string) => {
    setHabits((currentHabits) =>
      currentHabits.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  const removeHabit = useCallback((itemId: string) => {
    setHabits((currentHabits) => currentHabits.filter((item) => item.id !== itemId));
  }, []);

  return { habits, setHabits, addHabit, toggleHabit, removeHabit };
};
