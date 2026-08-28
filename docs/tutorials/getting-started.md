# Primeros pasos

Este tutorial deja Sui ejecutándose localmente y explica dónde modificar código.

## 1. Instalar dependencias

```bash
git clone https://github.com/MiguelSalmeron/SUI.git
cd SUI
npm install
npm --prefix functions install
```

## 2. Configurar entorno móvil

```bash
cp .env.example .env
```

Completa las variables públicas de Firebase. Para probar el chat también necesitas `EXPO_PUBLIC_CHAT_PROXY_URL`.

No añadas claves privadas de Azure, cuentas de servicio ni client secrets al `.env` móvil.

## 3. Configurar Firebase

Habilita Anonymous, Email/Password y proveedores necesarios. Configura
Firestore/App Check según [configuración cloud](../how-to/complete-cloud-configuration.md).

## 4. Validar instalación

```bash
npm run check
```

Debes obtener:

- TypeScript móvil sin errores.
- Tests unitarios aprobados.
- Cloud Functions compiladas.
- Reglas Firestore aprobadas en Emulator Suite.

## 5. Iniciar aplicación

```bash
npm start
```

Opciones habituales:

```bash
npm run android
npm run ios
npm run web
```

Expo Go no reproduce todas las capacidades nativas. Para notificaciones, splash y builds finales, utiliza un development build o build de producción.

## 6. Recorrer flujo principal

1. Confirma 16+ en Bienvenida.
2. Entra con cuenta o continúa local.
3. Comprueba Inicio vacío, sin datos de ejemplo.
4. Crea una meta y un hábito desde CTA independientes.
5. Abre Agenda y revisa el calendario unificado.
6. Abre Chat y confirma streaming si proxy está configurado.

## 7. Localizar código

```text
src/application         bootstrap y navegación
src/features            funcionalidades de producto
src/shared              UI, infraestructura y dominio compartido
functions/src           backend Firebase
docs                    documentación
```

Ejemplos:

- Entrada/bienvenida: `src/features/onboarding`.
- Cambio de chat: `src/features/chat`.
- Regla de XP o persistencia: `src/shared/domain/productivity`.
- Componente reutilizable: `src/shared/ui`.
- Proxy de IA: `functions/src/chat`.

## 8. Realizar primer cambio seguro

1. Modifica el módulo propietario.
2. Añade o actualiza el test colocado junto al código.
3. Ejecuta la prueba específica.
4. Ejecuta `npm run check`.
5. Actualiza documentación si cambian contratos, configuración o arquitectura.

Continúa con la [guía del desarrollador](../reference/developer-guide.md).
Producto: [PRD](../product/PRD.md). UI: [sistema de diseño](../product/DESIGN_SYSTEM.md).
