import { ASSISTANT_INSERT_INDEX, MAIN_TAB_ITEMS, MAIN_TAB_ORDER } from '../mainTabs';

describe('navegación principal', () => {
  it('expone únicamente las cuatro rutas operativas', () => {
    expect(MAIN_TAB_ORDER).toEqual(['Overview', 'Goals', 'Habits', 'Calendar']);
    expect(MAIN_TAB_ORDER).toHaveLength(4);
    expect(MAIN_TAB_ORDER).not.toContain('Progress');
    expect(MAIN_TAB_ORDER).not.toContain('Chat');
  });

  it('conserva etiquetas visibles y separa Metas de Hábitos', () => {
    expect(MAIN_TAB_ORDER.map((route) => MAIN_TAB_ITEMS[route].label)).toEqual([
      'Inicio',
      'Metas',
      'Hábitos',
      'Agenda',
    ]);
    expect(MAIN_TAB_ORDER[ASSISTANT_INSERT_INDEX - 1]).toBe('Goals');
    expect(MAIN_TAB_ORDER[ASSISTANT_INSERT_INDEX]).toBe('Habits');
  });
});
