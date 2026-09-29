import type { Request } from 'express';

/**
 * IP del cliente para la dimensión secundaria del límite de peticiones.
 *
 * Se toma el **último** salto de `X-Forwarded-For`, y de la **última** cabecera
 * si hay varias. Es el único valor fiable: el orquestador de Cloud Run siempre
 * actúa como proxy delante del contenedor y añade la IP que él ve al final de
 * la lista. Todo lo que va por delante lo pudo escribir el propio solicitante.
 *
 * Leer el primer salto (lo intuitivo) regalaría el límite: bastaría con enviar
 * `X-Forwarded-For: <valor aleatorio>` para obtener un cubo nuevo en cada
 * petición, y un documento de Firestore nuevo con cada valor inventado.
 *
 * No se usa `request.ip` como respaldo: en Cloud Run es la dirección del proxy,
 * compartida por todo el tráfico, y un cubo compartido bloquearía a todos los
 * usuarios a la vez. Sin cabecera se omite la dimensión por IP — mejor sin
 * límite que con uno equivocado.
 *
 * Premisa: los clientes llaman a la URL de la función directamente. Si algún
 * día se interpone Firebase Hosting o un CDN, el último salto pasa a ser el del
 * CDN y esto hay que revisarlo.
 */
export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded[forwarded.length - 1] : forwarded;
  const entries = header
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries?.[entries.length - 1] || undefined;
}
