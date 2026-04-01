require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mercadopago = require('mercadopago');

// --- 1. CONFIGURACIÓN ---
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const QR_ID_FILTRO = "128515446"; // ID Único de El Búho
const PORT = process.env.PORT || 3000;

if (!ACCESS_TOKEN) {
    console.error("❌ ERROR: No se encontró la variable MP_ACCESS_TOKEN. Revisa las variables de entorno en Render.");
}

const client = new mercadopago.MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new mercadopago.Payment(client);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// --- 2. ENDPOINT DE WEBHOOK ---
app.post('/webhook', async (req, res) => {
    console.log("-----------------------------------------");
    console.log("🔔 WEBHOOK RECIBIDO!");
    console.log("Query:", JSON.stringify(req.query));
    console.log("Body:", JSON.stringify(req.body));

    const paymentId = req.query.id || (req.body.data && req.body.data.id);

    if (paymentId) {
        try {
            console.log(`🔍 Buscando info del pago ID: ${paymentId}...`);
            const paymentDetails = await payment.get({ id: paymentId });
            
            console.log("Detalles del Pago recibidos de MP:");
            console.log("- Status:", paymentDetails.status);
            console.log("- Monto:", paymentDetails.transaction_amount);
            console.log("- POS ID:", paymentDetails.pos_id);
            console.log("- External Ref:", paymentDetails.external_reference);

            // FILTRO: Por ahora vamos a dejarlo que pase si es "approved"
            // aunque el ID no coincida perfectamente, para ver si llega algo.
            if (paymentDetails.status === 'approved') {
                const amount = paymentDetails.transaction_amount;
                console.log(`✅ ¡PAGO APROBADO detectado! Enviando alerta al Búho...`);
                io.emit('real_payment', { amount: amount });
            } else {
                console.log(`ℹ️ El pago no está aprobado (Status: ${paymentDetails.status})`);
            }
        } catch (error) {
            console.error('❌ Error al procesar pago:', error.message);
        }
    } else {
        console.log("⚠️ Webhook recibido pero no se encontró un Payment ID.");
    }
    
    res.sendStatus(200);
});

server.listen(PORT, () => {
    console.log(`🦉 Puente Búho Blindado activo en puerto ${PORT}`);
    console.log(`Configurado con Token: ${ACCESS_TOKEN ? 'SÍ' : 'NO'}`);
});

io.on('connection', (socket) => {
    console.log('📡 Dashboard Búho conectado vía Socket.io');
});
