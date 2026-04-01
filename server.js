require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mercadopago = require('mercadopago');

// --- 1. CONFIGURACION ---
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const QR_ID_FILTRO = process.env.MP_QR_ID || ""; // opcional: si esta vacio, no filtra por POS/QR
const PORT = process.env.PORT || 3000;
const MP_DEBUG = String(process.env.MP_DEBUG || "").toLowerCase() === "true";

if (!ACCESS_TOKEN) {
    console.error("ERROR: No se encontro la variable MP_ACCESS_TOKEN.");
    process.exit(1);
}

const client = new mercadopago.MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new mercadopago.Payment(client);
const merchantOrder = new mercadopago.MerchantOrder(client);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Evita notificaciones duplicadas cuando MP reintenta el webhook
const recentlyNotifiedPayments = new Map();
const DEDUPE_TTL_MS = 5 * 60 * 1000;

function cleanupOldNotifications() {
    const now = Date.now();
    for (const [paymentId, ts] of recentlyNotifiedPayments.entries()) {
        if (now - ts > DEDUPE_TTL_MS) {
            recentlyNotifiedPayments.delete(paymentId);
        }
    }
}

function isDuplicatePayment(paymentId) {
    if (!paymentId) return false;
    cleanupOldNotifications();
    return recentlyNotifiedPayments.has(String(paymentId));
}

function markPaymentNotified(paymentId) {
    if (!paymentId) return;
    recentlyNotifiedPayments.set(String(paymentId), Date.now());
}

function parseIdFromResource(resource) {
    if (!resource || typeof resource !== 'string') return null;
    const parts = resource.split('/');
    return parts[parts.length - 1] || null;
}

function unwrapMpResponse(result) {
    if (!result) return null;
    return result.response || result;
}

function extractIncomingIds(req) {
    const body = req.body || {};
    const query = req.query || {};

    const topic = String(query.topic || query.type || body.type || '').toLowerCase();
    const action = String(body.action || '').toLowerCase();
    const dataId = query['data.id'] || query.data_id || (query.data && query.data.id) || (body.data && body.data.id) || null;

    const paymentId =
        query.id ||
        dataId ||
        body.id ||
        parseIdFromResource(query.resource) ||
        parseIdFromResource(body.resource) ||
        null;

    const merchantOrderId =
        query.merchant_order_id ||
        ((topic === 'merchant_order' || action.includes('merchant_order')) && dataId ? dataId : null) ||
        parseIdFromResource(query.resource) ||
        parseIdFromResource(body.resource) ||
        null;

    return { topic, action, paymentId, merchantOrderId };
}

async function resolvePaymentFromWebhook(req) {
    const { topic, action, paymentId, merchantOrderId } = extractIncomingIds(req);

    // Caso comun: webhook de payment
    if (paymentId && (topic === 'payment' || action.includes('payment') || !topic)) {
        return { paymentId: String(paymentId), source: 'payment' };
    }

    // Caso QR/POS frecuente: webhook de merchant_order
    const shouldTryMerchantOrder = topic === 'merchant_order' || action.includes('merchant_order');
    if (shouldTryMerchantOrder && merchantOrderId) {
        let merchantOrderRaw;
        try {
            merchantOrderRaw = await merchantOrder.get({ merchantOrderId: String(merchantOrderId) });
        } catch (err) {
            // Compatibilidad por si la version espera "id" en lugar de "merchantOrderId".
            merchantOrderRaw = await merchantOrder.get({ id: String(merchantOrderId) });
        }
        const merchantOrderDetails = unwrapMpResponse(merchantOrderRaw) || {};
        const payments = Array.isArray(merchantOrderDetails.payments) ? merchantOrderDetails.payments : [];

        const approvedPayment = payments.find((p) => p && p.status === 'approved' && p.id);
        if (approvedPayment) {
            return { paymentId: String(approvedPayment.id), source: 'merchant_order' };
        }

        // Fallback: si todavia no aparece "approved" por latencia, tomamos el ultimo id y validamos estado luego en payment.get
        const latestPayment = payments.find((p) => p && p.id);
        if (latestPayment) {
            return { paymentId: String(latestPayment.id), source: 'merchant_order_fallback' };
        }
    }

    return { paymentId: null, source: topic || action || 'unknown' };
}

// Endpoint de webhook
app.post('/webhook', async (req, res) => {
    console.log('-----------------------------------------');
    console.log('WEBHOOK RECIBIDO');
    console.log('Query:', JSON.stringify(req.query));
    if (MP_DEBUG) {
        console.log('Body:', JSON.stringify(req.body));
    }

    try {
        const resolved = await resolvePaymentFromWebhook(req);
        const paymentId = resolved.paymentId;

        if (!paymentId) {
            console.log(`Webhook sin payment id resolvible. Source=${resolved.source}`);
            return res.sendStatus(200);
        }

        if (isDuplicatePayment(paymentId)) {
            console.log(`Webhook duplicado para payment ${paymentId}. Se ignora.`);
            return res.sendStatus(200);
        }

        console.log(`Buscando info del pago ID: ${paymentId}...`);
        const paymentRaw = await payment.get({ id: paymentId });
        const paymentDetails = unwrapMpResponse(paymentRaw) || {};

        console.log('Detalles del pago:');
        console.log('- Status:', paymentDetails.status);
        console.log('- Monto:', paymentDetails.transaction_amount);
        console.log('- POS ID:', paymentDetails.pos_id);
        console.log('- External Ref:', paymentDetails.external_reference);
        console.log('- Source:', resolved.source);

        const approved = paymentDetails.status === 'approved';
        const matchesQr = !QR_ID_FILTRO || String(paymentDetails.pos_id || '') === String(QR_ID_FILTRO);

        if (approved && matchesQr) {
            const amount = paymentDetails.transaction_amount;
            io.emit('real_payment', { amount });
            markPaymentNotified(paymentId);
            console.log('PAGO APROBADO detectado. Notificacion enviada al dashboard.');
        } else if (approved && !matchesQr) {
            console.log(`Pago aprobado pero no coincide con QR_ID_FILTRO (${QR_ID_FILTRO}). pos_id=${paymentDetails.pos_id}`);
        } else {
            console.log(`Pago no aprobado (status=${paymentDetails.status}).`);
        }
    } catch (error) {
        console.error('Error al procesar webhook:', error.message);
    }

    res.sendStatus(200);
});

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'buho-dashboard-bridge',
        qr_filter_enabled: Boolean(QR_ID_FILTRO),
        qr_filter_value: QR_ID_FILTRO || null
    });
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`ERROR: El puerto ${PORT} ya esta en uso. Cerra el otro proceso o cambia PORT.`);
        process.exit(1);
    }
    console.error('ERROR de servidor:', err.message);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`Puente Buho activo en puerto ${PORT}`);
    console.log(`Token configurado: ${ACCESS_TOKEN ? 'SI' : 'NO'}`);
    console.log(`Filtro QR activo: ${QR_ID_FILTRO ? `SI (${QR_ID_FILTRO})` : 'NO'}`);
});

io.on('connection', () => {
    console.log('Dashboard conectado via Socket.io');
});
