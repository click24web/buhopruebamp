// EL BÚHO 24HS - FRONTEND LOGIC (REAL-TIME) 🦉⚡

const clockElement = document.getElementById('clock');
const paymentAlert = document.getElementById('payment-alert');
const paymentAmount = document.getElementById('payment-amount');
const historyContainer = document.getElementById('history-container');
const btnSimulate = document.getElementById('btn-simulate');
const socketStatusText = document.getElementById('socket-status');

// 1. CLOCK (RELOJ)
function updateClock() {
    const now = new Date();
    clockElement.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}
setInterval(updateClock, 1000);
updateClock();

// 2. LOGICA DE ALERTA (ANIMACION)
let isAlerting = false;
function triggerPaymentNotification(amount) {
    if (isAlerting) return;
    isAlerting = true;

    paymentAmount.textContent = parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    paymentAlert.classList.remove('hidden');
    setTimeout(() => paymentAlert.classList.add('active'), 10);
    
    // Almacenar en historial
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const item = document.createElement('li');
    item.className = 'history-item';
    item.innerHTML = `<span class="history-time">${timeStr}</span><span class="history-amount">$${parseFloat(amount).toLocaleString('es-AR')}</span>`;
    historyContainer.prepend(item);
    if (historyContainer.children.length > 5) historyContainer.lastElementChild.remove();

    // Ocultar alerta después de 7 segundos
    setTimeout(() => {
        paymentAlert.classList.remove('active');
        setTimeout(() => {
            paymentAlert.classList.add('hidden');
            isAlerting = false;
        }, 600);
    }, 7000);
}

// 3. CONEXION REAL (SOCKET.IO)
// io() intentará conectarse automáticamente al mismo host que sirve el dashboard (Render).
const socket = io();

socket.on('connect', () => {
    console.log("🦉 El Búho 24hs está conectado con el servidor!");
    socketStatusText.textContent = "MONITOREANDO COMPRAS...";
    socketStatusText.classList.add("online");
});

socket.on('real_payment', (data) => {
    console.log("¡NUEVO PAGO DETECTADO!", data);
    triggerPaymentNotification(data.amount);
});

socket.on('disconnect', () => {
    console.log("❌ Conexión perdida con el Búho.");
    socketStatusText.textContent = "SIN CONEXION - INTENTANDO RECONECTAR...";
});

// 4. MOCK / SIMULACION
btnSimulate.addEventListener('click', () => {
    triggerPaymentNotification(Math.floor(Math.random() * 5000) + 100);
});

console.log("🦉 El Búho Dashboard Ready.");
