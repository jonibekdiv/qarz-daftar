import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { debtors, sentReminders } from "../../db/schema.js";

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
  [key: string]: unknown;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function errorResponse(error: unknown, fallback: string, status = 500, exposeDetails = false) {
  const details = error instanceof Error ? error.message : String(error);
  console.error(fallback);
  return json(exposeDetails ? { error: fallback, details } : { error: fallback }, status);
}

async function readJson(req: Request) {
  try {
    return await req.json() as Record<string, any>;
  } catch {
    throw new Error("So'rov ma'lumoti JSON formatida emas.");
  }
}

function normalizeDebtors(items: unknown): Debtor[] {
  return Array.isArray(items)
    ? items.filter((item): item is Debtor => Boolean(item && typeof item === "object" && (item as Debtor).id && (item as Debtor).fullName))
    : [];
}

function validateDebtor(debtor: Debtor) {
  const errors: string[] = [];
  if (!debtor.fullName || debtor.fullName.length < 3) errors.push("Ism kamida 3 ta harf bo'lishi kerak");
  if (!debtor.phone || debtor.phone.replace(/\D/g, "").length < 9) errors.push("Telefon noto'g'ri");
  if (Number(debtor.amount || 0) <= 0) errors.push("Summa 0 dan katta bo'lishi kerak");
  if (debtor.loanDate && debtor.dueDate && new Date(debtor.loanDate) > new Date(debtor.dueDate)) {
    errors.push("Muddati qarz sanasidan keyin bo'lsin");
  }
  return errors;
}

function money(value: unknown) {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(Number(value) || 0))} so'm`;
}

function dateText(value: unknown) {
  if (!value) return "ko'rsatilmagan";
  return new Intl.DateTimeFormat("uz-UZ", { year: "numeric", month: "long", day: "numeric" })
    .format(new Date(`${String(value)}T12:00:00`));
}

function remaining(debtor: Debtor) {
  return Math.max(Number(debtor.amount || 0) - Number(debtor.totalPaid || 0), 0);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debtorMessage(debtor: Debtor, action: string) {
  const title = action === "created" ? "Yangi qarzdor qo'shildi"
    : action === "updated" ? "Qarzdor ma'lumotlari yangilandi"
      : action === "payment" ? "Yangi to'lov qo'shildi" : "Qarzdor o'chirildi";
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
    `<b>To'lovlar tarixi:</b>`,
    ...paymentLines,
  ].join("\n");
}

function bulkUpdateMessage(action: string, count: number) {
  const title = action === "imported" ? "Ma'lumotlar import qilindi"
    : action === "demo" ? "Demo ma'lumotlar qo'shildi"
      : action === "cleared" ? "Barcha qarzlar o'chirildi" : "Ma'lumotlar yangilandi";
  return [`<b>${title}</b>`, `📊 Jami yozuvlar: <b>${count}</b>`, `🕒 Vaqt: ${new Date().toLocaleString("uz-UZ")}`].join("\n");
}

async function sendTelegramMessage(text: string) {
  const token = process.env.BOT_TOKEN?.trim();
  const adminId = process.env.ADMIN_ID?.trim();
  if (!token || !adminId) throw new Error("Telegram sozlanmagan: BOT_TOKEN yoki ADMIN_ID yetishmayapti.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json() as { ok?: boolean; description?: string; result?: { message_id?: number } };
      if (!response.ok || !result.ok) throw new Error(result.description || `HTTP ${response.status}`);
      return result.result || {};
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Telegram API xatosi: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function listDebtors() {
  const rows = await db.select().from(debtors);
  return rows.map((row) => row.data as Debtor);
}

async function upsertDebtor(debtor: Debtor) {
  await db.insert(debtors).values({ id: debtor.id, data: debtor, updatedAt: new Date() })
    .onConflictDoUpdate({ target: debtors.id, set: { data: debtor, updatedAt: new Date() } });
}

async function handleReminders() {
  const items = await listDebtors();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const debtor of items) {
    if (!debtor.dueDate || debtor.status === "completed" || remaining(debtor) <= 0) continue;
    const due = new Date(`${debtor.dueDate}T12:00:00`);
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    const type = daysLeft === 1 ? "tomorrow" : daysLeft === 0 ? "today" : daysLeft < 0 ? "overdue" : null;
    if (!type) continue;

    const reminderKey = `${debtor.id}:${type}:${debtor.dueDate}`;
    const [alreadySent] = await db.select().from(sentReminders).where(eq(sentReminders.key, reminderKey)).limit(1);
    if (alreadySent) continue;
    const label = type === "overdue" ? `${Math.abs(daysLeft)} kun muddati o'tgan`
      : type === "today" ? "bugun qaytarilishi kerak" : "ertaga qaytarilishi kerak";
    await sendTelegramMessage([
      "<b>Qarz eslatmasi</b>",
      `<b>Ism:</b> ${escapeHtml(debtor.fullName)}`,
      `<b>Telefon:</b> ${escapeHtml(debtor.phone)}`,
      `<b>Qolgan qarz:</b> ${money(remaining(debtor))}`,
      `<b>Muddat:</b> ${dateText(debtor.dueDate)}`,
      `<b>Holat:</b> ${label}`,
    ].join("\n"));
    await db.insert(sentReminders).values({ key: reminderKey }).onConflictDoNothing();
  }
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const pathname = new URL(req.url).pathname.replace(/\/$/, "");
  try {
    if (pathname === "/api/health" && req.method === "GET") {
      const items = await listDebtors();
      return json({ ok: true, telegramConfigured: Boolean(process.env.BOT_TOKEN && process.env.ADMIN_ID), debtors: items.length });
    }

    if (pathname === "/api/reminders" && req.method === "GET") {
      await handleReminders();
      return json({ ok: true });
    }

    if (pathname === "/api/debtors" && req.method === "GET") return json({ debtors: await listDebtors() });

    if (pathname === "/api/sync" && req.method === "POST") {
      const body = await readJson(req);
      const items = normalizeDebtors(body.debtors);
      await db.delete(debtors);
      if (items.length) await db.insert(debtors).values(items.map((debtor) => ({ id: debtor.id, data: debtor })));
      let telegramMessageId: number | null = null;
      if (body.action) telegramMessageId = (await sendTelegramMessage(bulkUpdateMessage(body.action, items.length))).message_id || null;
      return json({ ok: true, telegramSent: Boolean(body.action), telegramMessageId, count: items.length });
    }

    if (pathname === "/api/debtors" && req.method === "POST") {
      const body = await readJson(req);
      const debtor = body.debtor as Debtor;
      if (!debtor?.id || !debtor.fullName) return json({ error: "Qarzdor ma'lumotlari noto'g'ri." }, 400);
      const validationErrors = validateDebtor(debtor);
      if (validationErrors.length) return json({ error: validationErrors }, 400);
      await upsertDebtor(debtor);
      const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, body.action || "created"));
      return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor }, 201);
    }

    if (pathname === "/api/payments" && req.method === "POST") {
      const body = await readJson(req);
      let debtor = body.debtor as Debtor | undefined;
      if (!debtor && body.debtorId) {
        const [row] = await db.select().from(debtors).where(eq(debtors.id, String(body.debtorId))).limit(1);
        debtor = row?.data as Debtor | undefined;
      }
      if (!debtor?.id || !debtor.fullName) return json({ error: "To'lov uchun qarzdor ma'lumotlari topilmadi." }, 400);
      debtor = { ...debtor, payments: Array.isArray(body.payments) ? body.payments : debtor.payments || [], totalPaid: Number(body.totalPaid || 0), status: body.status || debtor.status };
      await upsertDebtor(debtor);
      const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, "payment"));
      return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id, debtor });
    }

    const deleteMatch = pathname.match(/^\/api\/debtors\/([^/]+)(?:\/delete)?$/);
    if (deleteMatch && (req.method === "DELETE" || req.method === "POST")) {
      const debtorId = decodeURIComponent(deleteMatch[1]);
      const [row] = await db.select().from(debtors).where(eq(debtors.id, debtorId)).limit(1);
      if (!row) return json({ error: "Qarzdor topilmadi." }, 404);
      const debtor = row.data as Debtor;
      await db.delete(debtors).where(eq(debtors.id, debtorId));
      const telegramMessage = await sendTelegramMessage(debtorMessage(debtor, "deleted"));
      return json({ ok: true, telegramSent: true, telegramMessageId: telegramMessage.message_id });
    }

    return json({ error: "API yo'li yoki HTTP usuli topilmadi." }, 405);
  } catch (error) {
    if (error instanceof Error && error.message.includes("JSON formatida emas")) return errorResponse(error, "Noto'g'ri so'rov.", 400, true);
    if (error instanceof Error && error.message.includes("Telegram")) return errorResponse(error, "Telegramga xabar yuborilmadi.", 502, true);
    return errorResponse(error, "Server xatosi.");
  }
};

export const config: Config = {
  path: "/api/*",
};
