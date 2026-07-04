import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '../PomodoroPanel.tsx'), 'utf8');

describe('PomodoroPanel', () => {
  it('declara etiquetas accesibles para acciones críticas', () => {
    expect(source).toContain('Abrir pomodoro en pantalla completa');
    expect(source).toContain('Configurar duración del pomodoro');
    expect(source).toContain('Pausar pomodoro');
    expect(source).toContain('Reanudar pomodoro');
    expect(source).toContain('Reiniciar pomodoro');
  });

  it('usa tema dinámico en vez de colores legacy', () => {
    expect(source).toContain('useAppTheme');
    expect(source).toContain('createStyles(colors)');
    expect(source).not.toContain('MD3_COLORS');
  });
});
