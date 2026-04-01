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
    console.error("❌ ERROR: No se encontró la variable MP_ACCESS_TOKEN en Render.");
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
    const paymentId = req.query.id || (req.body.data && req.body.data.id);

    if (paymentId) {
        try {
            console.log(`Buscando info del pago: ${paymentId}`);
            const paymentDetails = await payment.get({ id: paymentId });
            
            // FILTRO DE SEGURIDAD: Solo pagos aprobados y de ESTE QR exacto
            const esAprobado = paymentDetails.status === 'approved';
            const esEsteQR = String(paymentDetails.pos_id) === QR_ID_FILTRO || 
                             String(paymentDetails.external_reference) === QR_ID_FILTRO;

            if (esAprobado) {
                if (esEsteQR) {
                    const amount = paymentDetails.transaction_amount;
                    console.log(`¡Pago filtrado para BÚHO OK! Monto: $${amount}`);
                    io.emit('real_payment', { amount: amount });
                } else {
                    console.log(`Pago de otro local ignorado (POS ID: ${paymentDetails.pos_id})`);
                }
            }
        } catch (error) {
            console.error('Error al procesar pago:', error.message);
        }
    }
    res.sendStatus(200);
});

server.listen(PORT, () => {
    console.log(`🦉 Puente Búho Blindado activo en puerto ${PORT}`);
    console.log(`Filtrando para Caja ID: ${QR_ID_FILTRO}`);
});

io.on('connection', (socket) => {
    console.log('Dashboard Búho conectado.');
});
