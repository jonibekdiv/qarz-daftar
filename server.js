require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DATA_DIR = process.env.VERCEL
    ? path.join('/tmp', 'qarz-daftari')
    : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'debtors.json');
const REMINDER_INTERVAL_MS = Number(process.env.REMINDER_INTERVAL_MS || 3600000);

let state = { debtors: [], sentReminders: {} };
let writeQueue = Promise.resolve();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

const stateReady = loadState().catch(error => {
    console.error('Ma\'lumotlar bazasini yuklashda xatolik:', error);
    throw error;
});

app.use(async (req, res, next) => {
    try {
        await stateReady;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server ma\'lumotlarini yuklay olmadi.' });
    }
});

async function loadState() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        state = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
        state.debtors = Array.isArray(state.debtors) ? state.debtors : [];
        state.sentReminders = state.sentReminders || {};
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await saveState();
    }
}

function saveState() {
    const snapshot = JSON.stringify(state, null, 2);
    writeQueue = writeQueue.then(() => fs.writeFile(DATA_FILE, snapshot, 'utf8'));
    return writeQueue;
}

function money(value) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(Number(value) || 0)) + " so'm";
}

function dateText(value) {
    if (!value) return 'ko\'rsatilmagan';
    return new Intl.DateTimeFormat('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
        .format(new Date(value + 'T12:00:00'));
}

function remaining(debtor) {
    return Math.max(Number(debtor.amount || 0) - Number(debtor.totalPaid || 0), 0);
}

function telegramReady() {
    return Boolean(BOT_TOKEN && ADMIN_ID);
}

async function sendTelegramMessage(text) {
    if (!telegramReady()) {
        throw new Error('Telegram sozlanmagan: BOT_TOKEN yoki ADMIN_ID yetishmayapti.');
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: 'HTML' }),
                signal: AbortSignal.timeout(10000)
            });

            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.description || `HTTP ${response.status}`);
            }
            return result.result;
        } catch (error) {
            lastError = error;
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    throw new Error(`Telegram API xatosi: ${lastError.message}`);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function debtorMessage(debtor, action) {
    const title = action === 'created' ? 'Yangi qarzdor qo\'shildi' :
        action === 'updated' ? 'Qarzdor ma\'lumotlari yangilandi' :
        action === 'payment' ? 'Yangi to\'lov qo\'shildi' : 'Qarzdor o\'chirildi';

    const payments = Array.isArray(debtor.payments) ? debtor.payments : [];
    const paymentLines = payments.length
        ? payments.slice(-5).map((payment, index) =>
            `${index + 1}. ${dateText(payment.date)} - ${money(payment.amount)} (${escapeHtml(payment.method || 'ko\'rsatilmagan')})`)
        : ['Hozircha to\'lov kiritilmagan'];

    return [
        `<b>${title}</b>`,
        `<b>Ism:</b> ${escapeHtml(debtor.fullName)}`,
        `<b>Telefon:</b> ${escapeHtml(debtor.phone)}`,
        `<b>Berilgan summa:</b> ${money(debtor.amount)}`,
        `<b>Jami to\'langan:</b> ${money(debtor.totalPaid)}`,
        `<b>Qolgan qarz:</b> ${money(remaining(debtor))}`,
        `<b>Berilgan sana:</b> ${dateText(debtor.loanDate)}`,
        `<b>To\'lash muddati:</b> ${dateText(debtor.dueDate)}`,
        `<b>To\'lovlar tarixi:</b>`,
        ...paymentLines
    ].join('\n');
}

function bulkUpdateMessage(action, count) {
    const title = action === 'imported' ? 'Ma\'lumotlar import qilindi' :
        action === 'demo' ? 'Demo ma\'lumotlar qo\'shildi' :
        action === 'cleared' ? 'Barcha qarzlar o\'chirildi' : 'Ma\'lumotlar yangilandi';

    return [
        `<b>${title}</b>`,
        `📊 Jami yozuvlar: <b>${count}</b>`,
        `🕒 Vaqt: ${new Date().toLocaleString('uz-UZ')}`
    ].join('\n');
}

async function notify(action, debtor) {
    return sendTelegramMessage(debtorMessage(debtor, action));
}

function normalizeDebtors(debtors) {
    return Array.isArray(debtors) ? debtors.filter(item => item && item.id && item.fullName) : [];
}

function validateDebtor(debtor) {
    const errors = [];
    if (!debtor.fullName || debtor.fullName.length < 3)
        errors.push('Ism kamida 3 ta harf bo\'lishi kerak');
    if (!debtor.phone || debtor.phone.replace(/\D/g, '').length < 9)
        errors.push('Telefon noto\'g\'ri');
    if (debtor.amount <= 0)
        errors.push('Summa 0 dan katta bo\'lishi kerak');
    if (debtor.loanDate && debtor.dueDate && new Date(debtor.loanDate) > new Date(debtor.dueDate))
        errors.push('Muddati qarz sanasidan keyin bo\'lsin');
    return errors.length === 0 ? null : errors;
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true, telegramConfigured: telegramReady(), debtors: state.debtors.length });
});

app.get('/api/reminders', async (req, res) => {
    try {
        await checkReminders();
        res.json({ ok: true });
    } catch (error) {
        console.error('Eslatmalar xatosi:', error.message);
        res.status(500).json({ error: 'Eslatmalarni yuborishda xatolik.' });
    }
});

app.get('/api/debtors', (req, res) => {
    res.json({ debtors: state.debtors });
});

app.post('/api/sync', async (req, res) => {
    const debtors = normalizeDebtors(req.body.debtors);
    state.debtors = debtors;
    await saveState();
    let telegramMessageId = null;
    if (req.body.action) {
        try {
            const telegramMessage = await sendTelegramMessage(bulkUpdateMessage(req.body.action, debtors.length));
            telegramMessageId = telegramMessage.message_id;
        } catch (error) {
            console.error(error.message);
            return res.status(502).json({ error: 'Telegramga xabar yuborilmadi.', details: error.message });
        }
    }
    res.json({ ok: true, telegramSent: Boolean(req.body.action), telegramMessageId, count: debtors.length });
});

app.post('/api/debtors', async (req, res) => {
    const debtor = req.body.debtor;
    if (!debtor || !debtor.id || !debtor.fullName) {
        return res.status(400).json({ error: 'Qarzdor ma\'lumotlari noto\'g\'ri.' });
    }

    const validationErrors = validateDebtor(debtor);
    if (validationErrors) {
        return res.status(400).json({ error: validationErrors });
    }

    state.debtors = state.debtors.filter(item => item.id !== debtor.id);
    state.debtors.push(debtor);
    let telegramMessage;
    await saveState();
    try {
        telegramMessage = await notify(req.body.action || 'created', debtor);
    } catch (error) {
        console.error('Telegram xabari yuborilmadi:', error.message);
        return res.status(502).json({ error: 'Telegramga xabar yuborilmadi.', details: error.message });
    }
    res.status(201).json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor });
});

app.post('/api/payments', async (req, res) => {
    const existingDebtor = state.debtors.find(item => item.id === req.body.debtorId);
    const debtor = req.body.debtor || existingDebtor;
    if (!debtor || !debtor.id || !debtor.fullName) {
        return res.status(400).json({ error: 'To\'lov uchun qarzdor ma\'lumotlari topilmadi.' });
    }

    debtor.payments = Array.isArray(req.body.payments) ? req.body.payments : debtor.payments || [];
    debtor.totalPaid = Number(req.body.totalPaid || 0);
    debtor.status = req.body.status || debtor.status;
    state.debtors = state.debtors.filter(item => item.id !== debtor.id);
    state.debtors.push(debtor);
    let telegramMessage;
    await saveState();
    try {
        telegramMessage = await notify('payment', debtor);
    } catch (error) {
        console.error('Telegram to\'lov xabari yuborilmadi:', error.message);
        return res.status(502).json({ error: 'Telegramga to\'lov xabari yuborilmadi.', details: error.message });
    }
    res.json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor });
});

app.delete('/api/debtors/:id', async (req, res) => {
    const debtor = state.debtors.find(item => item.id === req.params.id);
    if (!debtor) return res.status(404).json({ error: 'Qarzdor topilmadi.' });

    state.debtors = state.debtors.filter(item => item.id !== req.params.id);
    let telegramMessage;
    await saveState();
    try {
        telegramMessage = await notify('deleted', debtor);
    } catch (error) {
        console.error('Telegram o\'chirish xabari yuborilmadi:', error.message);
        return res.status(502).json({ error: 'Telegramga o\'chirish xabari yuborilmadi.', details: error.message });
    }
    res.json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id });
});

async function checkReminders() {
    if (!telegramReady()) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const debtor of state.debtors) {
        if (!debtor.dueDate || debtor.status === 'completed' || remaining(debtor) <= 0) continue;

        const due = new Date(`${debtor.dueDate}T12:00:00`);
        const daysLeft = Math.ceil((due - today) / 86400000);
        let type = null;
        if (daysLeft === 1) type = 'tomorrow';
        if (daysLeft === 0) type = 'today';
        if (daysLeft < 0) type = 'overdue';
        if (!type) continue;

        const reminderKey = `${debtor.id}:${type}:${debtor.dueDate}`;
        if (state.sentReminders[reminderKey]) continue;

        const label = type === 'overdue' ? `${Math.abs(daysLeft)} kun muddati o'tgan` :
            type === 'today' ? 'bugun qaytarilishi kerak' : 'ertaga qaytarilishi kerak';
        await sendTelegramMessage([
            '<b>Qarz eslatmasi</b>',
            `<b>Ism:</b> ${escapeHtml(debtor.fullName)}`,
            `<b>Telefon:</b> ${escapeHtml(debtor.phone)}`,
            `<b>Qolgan qarz:</b> ${money(remaining(debtor))}`,
            `<b>Muddat:</b> ${dateText(debtor.dueDate)}`,
            `<b>Holat:</b> ${label}`
        ].join('\n'));
        state.sentReminders[reminderKey] = new Date().toISOString();
        await saveState();
    }
}

if (require.main === module) {
    stateReady.then(() => {
        const server = app.listen(PORT, () => console.log(`Qarz Daftari serveri http://localhost:${PORT} da ishlayapti`));
        server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
                console.log(`Qarz Daftari serveri allaqachon http://localhost:${PORT} da ishlayapti.`);
                process.exit(0);
            }
            console.error('Serverni ishga tushirishda xatolik:', error.message);
            process.exit(1);
        });
        checkReminders().catch(error => console.error('Eslatmalar xatosi:', error.message));
        setInterval(() => checkReminders().catch(error => console.error('Eslatmalar xatosi:', error.message)), REMINDER_INTERVAL_MS);
    }).catch(() => process.exit(1));
}

module.exports = app;