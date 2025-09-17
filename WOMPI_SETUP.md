# Configuración de Wompi para Producción

## Resumen de Cambios Implementados

Se ha configurado la integración de Wompi para que funcione correctamente tanto en desarrollo como en producción, **con la capacidad de usar modo de prueba incluso en el servidor de producción**.

## Nueva Estructura de Configuración

### 1. `src/environments/environment.ts` (Desarrollo)
```typescript
wompi: {
  testMode: true, // Siempre en modo prueba para desarrollo
  test: {
    publicKey: 'pub_test_HDn6WhxEGVzryUl66FkUiPbXI2GsuDUB',
    integrityKey: 'test_integrity_7pRzKXXTFoawku4E8lAMTQmMg3iEhCOY'
  },
  prod: {
    publicKey: 'pub_prod_aDinMfCvarfkhNiAQKzdm7cFDy6Szeuy',
    integrityKey: 'prod_integrity_Uma95tilbzOeU81QAycPinIM4Vtova3V'
  },
  redirectUrl: 'http://localhost:4200/payment-status'
}
```

### 2. `src/environments/environment.prod.ts` (Producción)
```typescript
wompi: {
  testMode: true, // 🔄 CAMBIAR A false PARA PRODUCCIÓN REAL
  test: {
    publicKey: 'pub_test_HDn6WhxEGVzryUl66FkUiPbXI2GsuDUB',
    integrityKey: 'test_integrity_7pRzKXXTFoawku4E8lAMTQmMg3iEhCOY'
  },
  prod: {
    publicKey: 'pub_prod_aDinMfCvarfkhNiAQKzdm7cFDy6Szeuy',
    integrityKey: 'prod_integrity_Uma95tilbzOeU81QAycPinIM4Vtova3V'
  },
  redirectUrl: 'https://tu-dominio.com/payment-status'
}
```

## Cómo Funciona el Modo de Prueba en Producción

### ✅ **Modo de Prueba en Servidor (testMode: true)**
- Usa llaves de prueba: `pub_test_...` y `test_integrity_...`
- Los pagos son simulados (no se cobran realmente)
- Perfecto para testing en el servidor de producción

### 💰 **Modo de Producción Real (testMode: false)**
- Usa llaves de producción: `pub_prod_...` y `prod_integrity_...`
- Los pagos son reales (se cobran a las tarjetas)
- Solo activar cuando esté listo para cobros reales

## Método `confirmPayment()` Actualizado

```typescript
// Selecciona automáticamente las llaves según testMode
const wompiConfig = environment.wompi.testMode ? environment.wompi.test : environment.wompi.prod;

const checkout = new WidgetCheckout({
  publicKey: wompiConfig.publicKey, // Llaves dinámicas
  signature: { integrity: signature }, // Firma con la llave correcta
  // ...
});
```

## Escenarios de Uso

### 🧪 **Desarrollo Local**
- `testMode: true` (fijo)
- Llaves de prueba
- `redirectUrl: http://localhost:4200/payment-status`

### 🚀 **Servidor en Modo Prueba**
- `testMode: true` en `environment.prod.ts`
- Llaves de prueba en servidor
- `redirectUrl: https://tu-dominio.com/payment-status`

### 💸 **Servidor en Modo Producción**
- `testMode: false` en `environment.prod.ts`
- Llaves de producción reales
- `redirectUrl: https://tu-dominio.com/payment-status`

## Pasos para Cambiar de Modo

### Para Usar Modo de Prueba en Servidor:
1. En `environment.prod.ts` mantén: `testMode: true`
2. Actualiza la `redirectUrl` con tu dominio real
3. Compila: `ng build --configuration production`
4. Despliega

### Para Activar Producción Real:
1. En `environment.prod.ts` cambia a: `testMode: false`
2. Compila: `ng build --configuration production`
3. Despliega

## ⚠️ **Importante**

- **testMode: true** = Pagos simulados (seguro para testing)
- **testMode: false** = Pagos reales (cobros verdaderos)
- Puedes cambiar entre modos sin modificar código, solo la configuración
- Siempre prueba primero con `testMode: true` en tu servidor

Esta configuración te permite tener **máximo control** sobre cuándo usar pagos reales vs. simulados, incluso en el servidor de producción.
