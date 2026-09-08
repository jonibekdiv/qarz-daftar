import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

type Debtor = {
  id: string;
  fullName: string;
  phone?: string;
  amount?: number;
  totalPaid?: number;
  loanDate?: string;
  dueDate?: string;
  status?: string;
  payments?: Array<{ date?: string; amount?: number; method?: string }>;
};

type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: { message_id: number };
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function requestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("So'rov ma'lumotlari JSON formatida bo'lishi kerak.");
  }
}

function telegramConfig() {
  return {
    token: process.env.BOT_TOKEN?.trim(),
    chatId: process.env.ADMIN_ID?.trim(),
  };
}

function telegramReady() {
  const { token, chatId } = telegramConfig();
  return Boolean(token && chatId);
}

async function sendTelegramMessage(text: string) {
  const { token, chatId } = telegramConfig();
  if (!token || !chatId) {
    throw new Error("Telegram sozlanmagan: BOT_TOKEN yoki ADMIN_ID yetishmayapti.");
  }

  let lastError = "Noma'lum xatolik";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(10000),
      });
      const result = (await response.json()) as TelegramResponse;
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.description || `HTTP ${response.status}`);
      }
      return result.result;
    } catch (error) {
      lastError = errorMessage(error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Telegram API xatosi: ${lastError}`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(Number(value) || 0))} so'm`;
}

function dateText(value?: string) {
  if (!value) return "ko'rsatilmagan";
  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(new Date(`${value}T12:00:00+05:00`));
}

function remaining(debtor: Debtor) {
  return Math.max(Number(debtor.amount || 0) - Number(debtor.totalPaid || 0), 0);
}

function debtorMessage(debtor: Debtor, action: string) {
  const title = action === "created" ? "Yangi qarzdor qo'shildi"
    : action === "updated" ? "Qarzdor ma'lumotlari yangilandi"
      : action === "payment" ? "Yangi to'lov qo'shildi"
        : "Qarzdor o'chirildi";
  const payments = Array.isArray(debtor.payments) ? debtor.payments : [];
  const paymentLines = payments.length
    ? payments.slice(-5).map((payment, index) =>
      `${index + 1}. ${dateText(payment.date)} - ${money(payment.amount)} (${escapeHtml(payment.method || "ko'rsatilmagan")})`)
    : ["Hozircha to'lov kiritilmagan"];

  return [
    `<b>${title}</b>`,
    `<b>Ism:</b> ${escapeHtml(debtor.fullName)}`,
    `<b>Telefon:</b> ${escapeHtml(debtor.phone)}`,
    `<b>Berilgan summa:</b> ${money(debtor.amount)}`,
    `<b>Jami to'langan:</b> ${money(debtor.totalPaid)}`,
    `<b>Qolgan qarz:</b> ${money(remaining(debtor))}`,
    `<b>Berilgan sana:</b> ${dateText(debtor.loanDate)}`,
    `<b>To'lash muddati:</b> ${dateText(debtor.dueDate)}`,
    "<b>To'lovlar tarixi:</b>",
    ...paymentLines,
  ].join("\n");
}

function bulkUpdateMessage(action: string, count: number) {
  const title = action === "imported" ? "Ma'lumotlar import qilindi"
    : action === "demo" ? "Demo ma'lumotlar qo'shildi"
      : action === "cleared" ? "Barcha qarzlar o'chirildi"
        : "Ma'lumotlar yangilandi";
  return [`<b>${title}</b>`, `📊 Jami yozuvlar: <b>${count}</b>`, `🕒 Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`].join("\n");
}

function normalizeDebtors(value: unknown): Debtor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Debtor => Boolean(item && typeof item === "object" && "id" in item && "fullName" in item));
}

function validateDebtor(debtor: Debtor) {
  const errors: string[] = [];
  if (!debtor.fullName || debtor.fullName.length < 3) errors.push("Ism kamida 3 ta harf bo'lishi kerak");
  if (!debtor.phone || debtor.phone.replace(/\D/g, "").length < 9) errors.push("Telefon noto'g'ri");
  if (Number(debtor.amount) <= 0) errors.push("Summa 0 dan katta bo'lishi kerak");
  if (debtor.loanDate && debtor.dueDate && new Date(debtor.loanDate) > new Date(debtor.dueDate)) {
    errors.push("Muddati qarz sanasidan keyin bo'lsin");
  }
  return errors;
}

async function listDebtors() {
  const db = getDatabase();
  const rows = await db.sql`SELECT data FROM debtors ORDER BY updated_at ASC`;
  return rows.map((row) => row.data as Debtor);
}

async function findDebtor(id: string) {
  const db = getDatabase();
  const rows = await db.sql`SELECT data FROM debtors WHERE id = ${id} LIMIT 1`;
  return rows[0]?.data as Debtor | undefined;
}

async function saveDebtor(debtor: Debtor) {
  const db = getDatabase();
  await db.sql`
    INSERT INTO debtors (id, data, updated_at)
    VALUES (${debtor.id}, ${JSON.stringify(debtor)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

async function replaceDebtors(debtors: Debtor[]) {
  const db = getDatabase();
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM debtors");
    for (const debtor of debtors) {
      await client.query(
        "INSERT INTO debtors (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())",
        [debtor.id, JSON.stringify(debtor)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteDebtor(id: string) {
  const db = getDatabase();
  await db.sql`DELETE FROM debtors WHERE id = ${id}`;
}

async function checkReminders() {
  if (!telegramReady()) return 0;
  const debtors = await listDebtors();
  const db = getDatabase();
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
  let sent = 0;

  for (const debtor of debtors) {
    if (!debtor.dueDate || debtor.status === "completed" || remaining(debtor) <= 0) continue;
    const due = new Date(`${debtor.dueDate}T00:00:00+05:00`);
    const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
    const type = daysLeft === 1 ? "tomorrow" : daysLeft === 0 ? "today" : daysLeft < 0 ? "overdue" : null;
    if (!type) continue;

    const reminderKey = `${debtor.id}:${type}:${debtor.dueDate}`;
    const existing = await db.sql`SELECT reminder_key FROM sent_reminders WHERE reminder_key = ${reminderKey}`;
    if (existing.length) continue;
    const label = type === "overdue" ? `${Math.abs(daysLeft)} kun muddati o'tgan`
      : type === "today" ? "bugun qaytarilishi kerak"
        : "ertaga qaytarilishi kerak";
    await sendTelegramMessage([
      "<b>Qarz eslatmasi</b>",
      `<b>Ism:</b> ${escapeHtml(debtor.fullName)}`,
      `<b>Telefon:</b> ${escapeHtml(debtor.phone)}`,
      `<b>Qolgan qarz:</b> ${money(remaining(debtor))}`,
      `<b>Muddat:</b> ${dateText(debtor.dueDate)}`,
      `<b>Holat:</b> ${label}`,
    ].join("\n"));
    await db.sql`INSERT INTO sent_reminders (reminder_key) VALUES (${reminderKey}) ON CONFLICT DO NOTHING`;
    sent += 1;
  }
  return sent;
}

async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && path === "/api/health") {
    const debtors = await listDebtors();
    return json({ ok: true, telegramConfigured: telegramReady(), debtors: debtors.length });
  }
  if (request.method === "GET" && path === "/api/reminders") {
    return json({ ok: true, sent: await checkReminders() });
  }
  if (request.method === "GET" && path === "/api/debtors") {
    return json({ debtors: await listDebtors() });
  }
  if (request.method === "POST" && path === "/api/sync") {
    const body = await requestBody(request);
    const debtors = normalizeDebtors(body.debtors);
    await replaceDebtors(debtors);
    let telegramMessageId: number | null = null;
    if (body.action) telegramMessageId = (await sendTelegramMessage(bulkUpdateMessage(body.action, debtors.length))).message_id;
    return json({ ok: true, telegramSent: Boolean(body.action), telegramMessageId, count: debtors.length });
  }
  if (request.method === "POST" && path === "/api/debtors") {
    const body = await requestBody(request);
    const debtor = body.debtor as Debtor;
    if (!debtor?.id || !debtor.fullName) return json({ error: "Qarzdor ma'lumotlari noto'g'ri." }, 400);
    const validationErrors = validateDebtor(debtor);
    if (validationErrors.length) return json({ error: validationErrors.join("; ") }, 400);
    await saveDebtor(debtor);
    const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, body.action || "created"));
    return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor }, 201);
  }
  if (request.method === "POST" && path === "/api/payments") {
    const body = await requestBody(request);
    const debtor = (body.debtor || await findDebtor(String(body.debtorId || ""))) as Debtor | undefined;
    if (!debtor?.id || !debtor.fullName) return json({ error: "To'lov uchun qarzdor ma'lumotlari topilmadi." }, 400);
    debtor.payments = Array.isArray(body.payments) ? body.payments : debtor.payments || [];
    debtor.totalPaid = Number(body.totalPaid || 0);
    debtor.status = body.status || debtor.status;
    await saveDebtor(debtor);
    const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, "payment"));
    return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor });
  }

  const deleteMatch = path.match(/^\/api\/debtors\/([^/]+)(?:\/delete)?$/);
  if (deleteMatch && (request.method === "DELETE" || request.method === "POST")) {
    const id = decodeURIComponent(deleteMatch[1]);
    const debtor = await findDebtor(id);
    if (!debtor) return json({ error: "Qarzdor topilmadi." }, 404);
    await deleteDebtor(id);
    const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, "deleted"));
    return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id });
  }

  return json({ error: "API manzili topilmadi." }, 404);
}

export default async function handler(request: Request) {
  try {
    return await handleRequest(request);
  } catch (error) {
    const message = errorMessage(error);
    console.error("API xatosi:", message);
    const telegramError = message.includes("Telegram") || message.includes("BOT_TOKEN") || message.includes("ADMIN_ID");
    return json(
      telegramError
        ? { error: "Telegramga xabar yuborilmadi.", details: message }
        : { error: "Server xatosi." },
      telegramError ? 502 : 500,
    );
  }
}

export const config: Config = {
  path: "/api/*",
};
