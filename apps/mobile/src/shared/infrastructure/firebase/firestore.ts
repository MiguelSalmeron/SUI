/**
 * Lectura puntual de documentos de Firestore.
 *
 * `shared/infrastructure` es el único lugar que habla con el SDK: las features
 * piden datos por acá en vez de importar `firebase/firestore`. La
 * infraestructura no conoce los contratos, así que devuelve datos crudos y
 * cada consumidor valida su forma.
 */

import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Lee un documento por segmentos de ruta (`'app_config', 'crisis'`).
 * Devuelve `null` si no existe, para que el consumidor aplique su respaldo.
 */
export const readDocument = async (
  collectionPath: string,
  ...documentPath: string[]
): Promise<DocumentData | null> => {
  const snapshot = await getDoc(doc(db, collectionPath, ...documentPath));
  return snapshot.exists() ? snapshot.data() : null;
};
