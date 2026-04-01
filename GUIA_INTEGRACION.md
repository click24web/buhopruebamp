# El Buho 24hs: Guia de Integracion Mercado Pago

Esta guia te explica como conectar el Dashboard de El Buho con tu cuenta real de Mercado Pago para que las alertas funcionen automaticamente.

---

## 1. Obtener tus Credenciales
1. Entra a [Mercado Pago Developers - Dashboard](https://www.mercadopago.com.ar/developers/panel/app).
2. Crea una nueva aplicacion (nombre sugerido: `BuhoDashboard`).
3. Busca **Credenciales de produccion**.
4. Copia tu **Access Token** (empieza con `APP_USR-...`).

> [!IMPORTANT]
> Seguridad: nunca compartas tu Access Token.

---

## 2. Configurar Variables de Entorno
Crea o edita `.env` en la carpeta del proyecto:

```env
MP_ACCESS_TOKEN=APP_USR-...
PORT=3000
MP_QR_ID=128515446
```

- `MP_QR_ID` filtra pagos solo para ese QR/POS.
- Si no pones `MP_QR_ID`, el backend acepta pagos aprobados de cualquier POS asociado.

---

## 3. Levantar el Servidor
1. Abre una terminal en `/buho`.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Verifica estado en `http://localhost:3000/health`.

---

## 4. Configurar Webhook en Mercado Pago (obligatorio)
1. En tu app de Mercado Pago, configura URL de notificacion:
   - `https://TU_DOMINIO/webhook`
2. Activa eventos:
   - `payment`
   - `merchant_order`
3. Guarda cambios.

> Si pruebas localmente, usa un tunel publico (por ejemplo `ngrok`) para exponer `localhost:3000`.

---

## 5. Abrir Dashboard Correctamente
Abre `http://localhost:3000`.

No abras `index.html` directo con `file://`, porque asi Socket.IO no conecta al backend.

---

## 6. Prueba End-to-End
1. Comprueba que el dashboard diga `MONITOREANDO COMPRAS...`.
2. Haz un pago de prueba en el QR con ID `128515446`.
3. Revisa logs del backend; debe aparecer `WEBHOOK RECIBIDO` y luego `PAGO APROBADO detectado...`.
