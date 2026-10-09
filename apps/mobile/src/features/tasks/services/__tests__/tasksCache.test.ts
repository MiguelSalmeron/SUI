import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearGoogleTasksCache,
  loadGoogleTasksCache,
  resolveLoadedTasksCache,
  saveGoogleTasksCache,
  type GoogleTasksCache,
} from '../tasksCache';
import type { NormalizedTask } from '../tasksApi';

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const task = (id: string): NormalizedTask => ({
  id,
  taskListId: 'list-1',
  title: `Tarea ${id}`,
  completed: false,
});

const owned = (uid: string): GoogleTasksCache => ({
  tasks: [task(uid)],
  lastSyncedAt: 42,
  ownerUid: uid,
});

describe('caché de tareas por cuenta', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockResolvedValue(null);
    mockedStorage.setItem.mockResolvedValue(undefined);
    mockedStorage.removeItem.mockResolvedValue(undefined);
  });

  it('guarda ownerUid junto a las tareas', async () => {
    await saveGoogleTasksCache([task('a')], 123, 'uid-A');
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      '@sui/google-tasks-v1',
      JSON.stringify({ tasks: [task('a')], lastSyncedAt: 123, ownerUid: 'uid-A' }),
    );
  });

  it('descarta caché de otra cuenta', () => {
    expect(resolveLoadedTasksCache(owned('uid-A'), 'uid-B')).toEqual({
      tasks: [],
      lastSyncedAt: null,
    });
  });

  it('conserva caché del mismo dueño', () => {
    expect(resolveLoadedTasksCache(owned('uid-A'), 'uid-A')).toEqual(owned('uid-A'));
  });

  it('descarta caché sin ownerUid antes que mostrar tareas ajenas', () => {
    expect(resolveLoadedTasksCache({ tasks: [task('x')], lastSyncedAt: 1 }, 'uid-A')).toEqual({
      tasks: [],
      lastSyncedAt: null,
    });
  });

  it('sin sesión resuelta no descarta todavía', () => {
    expect(resolveLoadedTasksCache(owned('uid-A'), '')).toEqual(owned('uid-A'));
  });

  it('filtra tareas inservibles al cargar', async () => {
    mockedStorage.getItem.mockResolvedValue(
      JSON.stringify({
        tasks: [task('ok'), { id: 'rota' }, null],
        lastSyncedAt: 7,
        ownerUid: 'uid-A',
      }),
    );
    await expect(loadGoogleTasksCache()).resolves.toEqual({
      tasks: [task('ok')],
      lastSyncedAt: 7,
      ownerUid: 'uid-A',
    });
  });

  it('desconectar borra la caché local', async () => {
    await clearGoogleTasksCache();
    expect(mockedStorage.removeItem).toHaveBeenCalledWith('@sui/google-tasks-v1');
  });
});
