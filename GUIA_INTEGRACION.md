# 🦉 El Búho 24hs: Guía de Integración Mercado Pago

Esta guía te explica cómo conectar el Dashboard de El Búho con tu cuenta real de Mercado Pago para que las alertas funcionen automáticamente.

---

## 1. Obtener tus Credenciales
1. Entrá a [Mercado Pago Developers - Dashboard](https://www.mercadopago.com.ar/developers/panel/app).
2. Creá una nueva aplicación (Nombre sugerido: `BuhoDashboard`).
3. En el menú de la izquierda, buscá **"Credenciales de producción"**.
4. Copiá tu **Access Token**. (Es una clave larga que empieza con `APP_USR-...`).

> [!IMPORTANT]
> **Seguridad:** Nunca compartas este Access Token con nadie. Solo guardalo para el paso del `server.js`.

---

## 2. Configurar el Webhook (Las Notificaciones)
Para que Mercado Pago avise al Dashboard, tenés que ir a la sección **"Webhooks"** en tu aplicación:
1. En **"Modo de notificación"**, elegí `HTTP`.
2. En **"URL de notificación"**, vas a tener que poner la dirección de tu servidor. 
   * *Si estás probando de forma local, podés usar una herramienta como **ngrok** para que Mercado Pago vea tu computadora.*
3. En **"Eventos"**, marcá la casilla de **`payment`** (esto es lo más importante).

---

## 3. El Servidor Puente (server.js)
Este archivo es el encargado de recibir los pagos y "avisarle" al Búho.

### Para ponerlo en marcha:
1. Abrí una terminal en la carpeta `/buho`.
2. Corré el comando: `npm install express socket.io mercadopago`
3. Editá el archivo `server.js` (que te voy a crear ahora) con tu `Access Token`.
4. Corré el servidor: `node server.js`

---

## 4. ¿Cómo mostrárselo al cliente?
1. Abrí el `index.html` en el navegador del cliente.
2. Si el servidor puente está prendido, el Dashboard estará "Escuchando".
3. Mostrale cómo funciona primero con el botón de **Simulación**.
4. Podés hacer un pago de prueba de $1 (un peso) desde otra cuenta a su QR para que vea cómo el Búho se activa **en vivo**.

¡Eso lo va a dejar loquísimo! 🚀🦉
