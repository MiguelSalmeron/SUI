import { useState, useCallback } from 'react';
import { HomeListItem } from '../components/home/HomeListSection';

const createItem = (title: string): HomeListItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title,
  completed: false,
});

export const useGoals = (initialGoals: HomeListItem[]) => {
  const [goals, setGoals] = useState<HomeListItem[]>(initialGoals);

  const addGoal = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;

    const newItem = createItem(trimmedTitle);
    setGoals((currentGoals) => [newItem, ...currentGoals]);
    return true;
  }, []);

  const toggleGoal = useCallback((itemId: string) => {
    setGoals((currentGoals) =>
      currentGoals.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  const removeGoal = useCallback((itemId: string) => {
    setGoals((currentGoals) => currentGoals.filter((item) => item.id !== itemId));
  }, []);

  return { goals, setGoals, addGoal, toggleGoal, removeGoal };
};
