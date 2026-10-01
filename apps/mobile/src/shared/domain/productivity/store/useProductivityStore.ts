import { create } from 'zustand';
import { createGoalSlice } from './slices/goalSlice';
import { createHabitSlice } from './slices/habitSlice';
import { createHydrationSlice } from './slices/hydrationSlice';
import { createPersistenceSlice } from './slices/persistenceSlice';
import { createSeedSlice } from './slices/seedSlice';
import { createInitialProductivityState, type ProductivityState } from './productivityState';

export type { ProductivityState } from './productivityState';

/**
 * Store de productividad ensamblado a partir de slices.
 *
 * Se mantiene el path público (`store/useProductivityStore`) y la forma del
 * estado para no tocar a los consumidores; el corte es solo de organización
 * interna, que antes vivía en un único archivo de 700+ líneas.
 *
 * El orden de los slices define qué gana si dos exponen la misma clave, así
 * que los de datos van primero y las acciones después.
 */
export const useProductivityStore = create<ProductivityState>()((...args) => ({
  ...createInitialProductivityState(),
  ...createGoalSlice(...args),
  ...createHabitSlice(...args),
  ...createHydrationSlice(...args),
  ...createPersistenceSlice(...args),
  ...createSeedSlice(...args),
}));
