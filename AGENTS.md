# Reglas para agentes de IA

Este repo es **Sui**. Antes de tocar código, leé:

- [Guía del desarrollador](docs/reference/developer-guide.md): comandos, convenciones y criterios de PR.
- [Índice de documentación](docs/README.md): cuáles son las fuentes canónicas.

## Idioma (obligatorio)

Todo lo que escribís en este repo va en **español con vocabulario nica**
(nicaragüense), y **nada vulgar**:

- **Commits**: asunto y cuerpo en español. El prefijo y el scope siguen en
  inglés (`fix(chat): añade cupo por IP y corrige la lectura del cliente`).
  Mirá `git log` antes de escribir el tuyo y seguí el mismo tono.
- **Comentarios de código**: en español, incluyendo docblocks, comentarios de
  inline, TODO/FIXME y comentarios de tests. Explicá el _por qué_ y las
  premisas, no el _qué_ obvio.
- **Documentación y docs nuevos**: en español.

El registro es español neutro con voseo y giros nica suaves: _acá_, _fijate
que_, _en vez de_, _dale_, _ahorita_, _de choto_. Si un giro nica sólo funciona
siendo vulgar, no se usa: cero groserías, cero albures, cero insultos, incluso
citando a alguien.

Lo que **no** se traduce: identificadores (variables, funciones, tipos,
archivos), nombres de librerías y APIs, valores de configuración y los mensajes
de error que ve el usuario final — esos siguen el sistema de i18n ES/EN de la
app.

Regla completa y ejemplos: [convenciones de código](docs/reference/developer-guide.md#idioma).

## Antes de dar por cerrado un cambio

```bash
npm run check
```

Si tocás Cloud Functions, además `npm run functions:build`. Nunca commiteés
secretos ni artefactos generados; consultá
[seguridad](docs/explanation/seguridad.md) si dudás.
