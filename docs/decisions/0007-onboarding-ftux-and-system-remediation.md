# ADR-0007: Arquitectura de Primer Ingreso (FTUX) y Estabilidad de Sistema

- Estado: aceptado
- Fecha: 2026-09-06

## Contexto

El flujo inicial de la aplicación carecía de una experiencia guiada de primer uso (FTUX), presentando una bienvenida estática sin transiciones visuales ni captura de intención del estudiante. Además, la auditoría del sistema reveló:
1. Falsos errores de reautenticación en Google Calendar para usuarios en modo local.
2. Clasificación incorrecta de caídas de red en el sincronizador (TypeError sin propiedad `code`).
3. Falta de interceptación del botón hardware "Atrás" de Android en pantallas modulares de bienvenida.
4. Riesgo de saturación de memoria en la Cloud Function `syncProductivity` bajo ráfagas concurrentes.

## Decisión

1. **FTUX Orgánico y Sembrado de Intención**:
   - Desacoplar la bienvenida en componentes modulares (`AnimatedMosaic`, `ValuePulseSlide`, `AccountDecisionView`) orquestados por la máquina de estados [`useOnboardingFlow`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/features/onboarding/hooks/useOnboardingFlow.ts).
   - Optimización del embudo a 4 pasos directos (`welcome` -> `value_goals` -> `value_habits` -> `account`), eliminando fricción previa y asignando intención por defecto (`'habit'`) persistida en [`useIntroStore`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/shared/account/useIntroStore.ts) para el foco contextual en Home.
   - Rediseño de la pantalla de bienvenida con tarjeta `welcomeCard` (`surfaceContainerLowest`, `radius.xl`), tres chips de valor (`Metas claras`, `Hábitos`, `100% Privado`) y enlace conversacional bajo el CTA principal, suprimiendo atajos redundantes en la barra superior.
   - Animaciones a 60fps con motor nativo (`useNativeDriver: true`) respetando preferencias de accesibilidad (`isReduceMotionEnabled`).
   - Implementar un foco guiado de primer uso ([`FirstRunSpotlight`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/features/home/components/FirstRunSpotlight.tsx)) en la pantalla principal que conecta directamente con la intención declarada.

2. **Blindaje de Integraciones y Modo Local**:
   - En [`useGoogleCalendar`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/features/calendar/hooks/useGoogleCalendar.ts), verificar explícitamente `auth.currentUser && !currentUser.isAnonymous` antes de contactar endpoints remotos para evitar excepciones 401 automáticas en usuarios locales.
   - En [`useProductivityStore`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/shared/domain/productivity/store/useProductivityStore.ts), evaluar `error.message` y `error.code` para etiquetar fallos de red como `'offline'` en vez de `'error'`.
   - Manejar el evento `hardwareBackPress` de [`BackHandler`](file:///home/sma/Documentos/Proyectos_Desarrollo/SUI/apps/mobile/src/features/onboarding/screens/WelcomeScreen.tsx) para permitir navegación retrospectiva en Android.
   - Escalar la memoria de la Cloud Function `syncProductivity` a `512MiB`.

## Consecuencias

- Reducción del agobio cognitivo inicial con una bienvenida fluida de 60fps.
- Respeto total al principio local-first: los usuarios invitados operan sin advertencias espurias ni errores bloqueantes.
- Mayor confiabilidad en entornos móviles con conectividad inestable o nula.
