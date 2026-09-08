// ============================================================
//  QARZ DAFTARI – BARCHA FUNKSIYALAR
// ============================================================

// ---------- O'ZGARUVCHILAR ----------
const STORAGE_KEY = 'qarz_daftari_data';
const THEME_KEY = 'qarz_daftari_theme';
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

let state = { debtors: [], currentEditId: null, currentDebtorId: null, searchTerm: '', filterType: 'all', sortBy: 'newest' };
let searchTimeout = null;
let chartStatus = null, chartMonthly = null;

const UZBEKISTAN_REGIONS = {
    'Qoraqalpog\'iston Respublikasi': ['Amudaryo', 'Beruniy', 'Bo\'zatov', 'Chimboy', 'Ellikqala', 'Kegeyli', 'Mo\'ynoq', 'Nukus', 'Qanliko\'l', 'Qo\'ng\'irot', 'Qorao\'zak', 'Shumanay', 'Taxtako\'pir', 'To\'rtko\'l', 'Xo\'jayli', 'Shumanay'],
    'Andijon viloyati': ['Andijon', 'Asaka', 'Baliqchi', 'Bo\'ston', 'Buloqboshi', 'Izboskan', 'Jalaquduq', 'Marhamat', 'Paxtaobod', ' Qo\'rg\'ontepa', 'Shahrixon', 'Ulug\'nor', 'Xo\'jaobod', 'Xonobod'],
    'Buxoro viloyati': ['Buxoro', 'G\'ijduvon', 'Jondor', 'Kogon', 'Olot', 'Peshku', 'Qorako\'l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent'],
    'Jizzax viloyati': ['Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish', 'G\'allaorol', 'Jizzax', 'Mirzacho\'l', 'Paxtakor', 'Sharof Rashidov', 'Yangiobod', 'Zarbdor', 'Zomin'],
    'Qashqadaryo viloyati': ['Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi', 'Kitob', 'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Qarshi', 'Shahrisabz', 'Yakkabog\''],
    'Navoiy viloyati': ['Karmana', 'Konimex', 'Navbahor', 'Navoiy', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi'],
    'Namangan viloyati': ['Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan', 'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi', 'Yangiqo\'rg\'on'],
    'Samarqand viloyati': ['Bulung\'ur', 'Ishtixon', 'Jomboy', 'Kattaqo\'rg\'on', 'Narpay', 'Nurobod', 'Oqdaryo', 'Pastdarg\'om', 'Payariq', 'Paxtachi', 'Samarqand', 'Toyloq', 'Urgut'],
    'Surxondaryo viloyati': ['Angor', 'Bandixon', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Qiziriq', 'Qumqo\'rg\'on', 'Sariosiyo', 'Sherobod', 'Sho\'rchi', 'Termiz', 'Uzun'],
    'Sirdaryo viloyati': ['Boyovut', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sayxunobod', 'Sardoba', 'Shirin', 'Sirdaryo', 'Xovos'],
    'Toshkent viloyati': ['Angren', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Quyi Chirchiq', 'Toshkent', 'Uchquduq', 'Yuqori Chirchiq', 'Zangiota', 'Yangiyo\'l'],
    'Farg\'ona viloyati': ['Bag\'dod', 'Beshariq', 'Buvayda', 'Dang\'ara', 'Farg\'ona', 'Furqat', 'Oltiariq', 'Qo\'qon', 'Quva', 'Quvasoy', 'Rishton', 'So\'x', 'Toshloq', 'Uchko\'prik', 'Yozyovon'],
    'Xorazm viloyati': ['Bog\'ot', 'Gurlan', 'Hazorasp', 'Xiva', 'Xonqa', 'Qo\'shko\'pir', 'Shovot', 'Tuproqqal\'a', 'Urganch', 'Yangiariq', 'Yangibozor'],
    'Toshkent shahri': ['Bektemir', 'Chilonzor', 'Mirobod', 'Mirzo Ulug\'bek', 'Olmazor', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 'Yunusobod'],
};

// ---------- BOSHLANG'ICH ----------
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadData();
    updateUI();
    renderDebtors();
    setDefaultDates();
    setupAddressFields();
    syncFromServer();
    if (window.lucide) window.lucide.createIcons();
});

// ---------- THEMA ----------
function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (!saved) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        localStorage.setItem(THEME_KEY, prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', saved);
    }
}
document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateCharts();
    showToast('Tema o\'zgartirildi 🌓', 'success');
});

// ---------- LOCALSTORAGE ----------
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            state.debtors = Array.isArray(parsed) ? parsed : [];
        }
    } catch (e) { console.warn('Yuklash xatosi:', e); }
}

function saveData() {
    try {
        const data = JSON.stringify(state.debtors);
        const sizeMB = new Blob([data]).size / (1024 * 1024);
        if (sizeMB > 4) {
            showToast('⚠️ Ma\'lumotlar juda katta! Qadimgilarini o\'chiring.', 'error');
            return false;
        }
        localStorage.setItem(STORAGE_KEY, data);
        return true;
    } catch (e) {
        showToast('Xotira to\'lib ketdi!', 'error');
        return false;
    }
}

// ---------- GENERATSIYA ----------
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- FORMATLASH ----------
function formatCurrency(amount) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(amount || 0)) + ' so\'m';
}
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return new Intl.DateTimeFormat('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}
function getDaysLeft(dueDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(dueDate + 'T12:00:00');
    return Math.ceil((due - today) / 86400000);
}
function formatPhone(raw) {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('998')) digits = digits.slice(3);
    digits = digits.slice(0, 9);
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0,2));
    if (digits.length > 2) parts.push(digits.slice(2,5));
    if (digits.length > 5) parts.push(digits.slice(5,7));
    if (digits.length > 7) parts.push(digits.slice(7,9));
    return '+998 ' + parts.join(' ');
}

// ---------- TOAST ----------
function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---------- DEFAULTS ----------
function setDefaultDates() {
    const now = new Date();
    const later = new Date(now); later.setDate(later.getDate() + 30);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('loanDate').value = fmt(now);
    document.getElementById('dueDate').value = fmt(later);
    document.getElementById('paymentDate').value = fmt(now);
}

function setupAddressFields() {
    const province = document.getElementById('province');
    const district = document.getElementById('district');
    Object.keys(UZBEKISTAN_REGIONS).forEach(region => province.add(new Option(region, region)));
    province.addEventListener('change', () => {
        const districts = UZBEKISTAN_REGIONS[province.value] || [];
        district.innerHTML = '<option value="">Tuman / shaharni tanlang</option>';
        districts.forEach(item => district.add(new Option(item.trim(), item.trim())));
        district.disabled = districts.length === 0;
    });
}

function setAddressFields(debtor) {
    const province = document.getElementById('province');
    const district = document.getElementById('district');
    const legacyAddress = String(debtor.address || '');
    province.value = debtor.province || '';
    province.dispatchEvent(new Event('change'));
    district.value = debtor.district || '';
    document.getElementById('mahalla').value = debtor.mahalla || (!debtor.district ? legacyAddress : '');
}

// ---------- MODALLAR ----------
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
}

// ---------- QARZDOR MODAL ----------
function openDebtorModal(editId = null) {
    state.currentEditId = editId;
    const form = document.getElementById('debtorForm');
    form.reset();
    document.getElementById('province').value = '';
    document.getElementById('district').innerHTML = '<option value="">Avval viloyatni tanlang</option>';
    document.getElementById('district').disabled = true;
    document.getElementById('mahalla').value = '';
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
    document.getElementById('modalTitle').textContent = editId ? '✏️ Qarzdorni tahrirlash' : '➕ Yangi qarzdor';
    setDefaultDates();

    if (editId) {
        const d = state.debtors.find(x => x.id === editId);
        if (d) {
            document.getElementById('fullName').value = d.fullName || '';
            document.getElementById('phone').value = d.phone || '';
            setAddressFields(d);
            document.getElementById('amount').value = d.amount || '';
            document.getElementById('loanDate').value = d.loanDate || '';
            document.getElementById('dueDate').value = d.dueDate || '';
            document.getElementById('status').value = d.status || 'active';
            document.getElementById('notes').value = d.notes || '';
        }
    }
    openModal('debtorModal');
}

document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal('debtorModal'));
document.getElementById('cancelBtn').addEventListener('click', () => closeModal('debtorModal'));

document.getElementById('debtorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const province = document.getElementById('province').value;
    const district = document.getElementById('district').value;
    const mahalla = document.getElementById('mahalla').value.trim();
    const address = [province, district, mahalla].filter(Boolean).join(', ');
    const amount = parseFloat(document.getElementById('amount').value);
    const loanDate = document.getElementById('loanDate').value;
    const dueDate = document.getElementById('dueDate').value;
    const status = document.getElementById('status').value;
    const notes = document.getElementById('notes').value.trim();

    let errors = [];
    if (!name || name.length < 2) errors.push('Ismni kiriting');
    if (!phone) errors.push('Telefonni kiriting');
    if (!amount || amount <= 0) errors.push('Summa noto\'g\'ri');
    if (!loanDate) errors.push('Sanani kiriting');
    if (!dueDate) errors.push('Muddatni kiriting');
    if (loanDate && dueDate && loanDate > dueDate) errors.push('Muddat sana oldin bo\'lmasin');

    if (errors.length) {
        showToast('⚠️ ' + errors.join(', '), 'error');
        return;
    }

    if (state.currentEditId) {
        const d = state.debtors.find(x => x.id === state.currentEditId);
        if (d) {
            d.fullName = name; d.phone = phone; d.address = address; d.province = province; d.district = district; d.mahalla = mahalla; d.amount = amount;
            d.loanDate = loanDate; d.dueDate = dueDate; d.status = status; d.notes = notes;
            d.updatedAt = new Date().toISOString();
        }
        showToast('✅ Yangilandi', 'success');
    } else {
        const newD = {
            id: generateId(), fullName: name, phone, address, province, district, mahalla, amount,
            loanDate, dueDate, status, notes,
            totalPaid: 0, payments: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        state.debtors.push(newD);
        showToast('✅ Qo\'shildi', 'success');
    }
    saveData();
    updateUI();
    renderDebtors();
    closeModal('debtorModal');
    syncDebtorToServer(state.debtors.find(item => item.id === (state.currentEditId || state.debtors[state.debtors.length - 1]?.id)), state.currentEditId ? 'updated' : 'created');
});

// ---------- PAYMENT MODAL ----------
function openPaymentModal(debtorId) {
    state.currentDebtorId = debtorId;
    const d = state.debtors.find(x => x.id === debtorId);
    if (!d) return;
    const remaining = Math.max(d.amount - d.totalPaid, 0);
    document.getElementById('paymentAmount').max = remaining;
    document.getElementById('paymentAmount').placeholder = '0';
    document.getElementById('paymentMaxHint').textContent = 'Maksimum: ' + formatCurrency(remaining);
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentError').classList.remove('show');
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    // Fayl preview tozalash
    document.getElementById('filePreviewList').innerHTML = '';
    document.getElementById('paymentFile').value = '';
    openModal('paymentModal');
}

document.getElementById('paymentCloseBtn').addEventListener('click', () => closeModal('paymentModal'));
document.getElementById('paymentCancelBtn').addEventListener('click', () => closeModal('paymentModal'));

// ---------- FAYL YUKLASH (RASM + PDF) ----------
document.getElementById('paymentFile').addEventListener('change', function(e) {
    const container = document.getElementById('filePreviewList');
    container.innerHTML = '';
    const files = Array.from(this.files);
    files.forEach((file, idx) => {
        const div = document.createElement('div');
        div.className = 'file-preview-item';
        const icon = file.type.startsWith('image/') ? '🖼️' : '📄';
        const size = (file.size / 1024).toFixed(0) + ' KB';
        div.innerHTML = `${icon} ${file.name} (${size}) <span class="remove-file" data-idx="${idx}">✕</span>`;
        container.appendChild(div);
    });
    // Remove handler
    container.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.idx);
            const dt = new DataTransfer();
            const input = document.getElementById('paymentFile');
            const files = Array.from(input.files);
            files.forEach((f, i) => { if (i !== idx) dt.items.add(f); });
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
        });
    });
});

// Drag & Drop qo'llab-quvvatlash
const dropArea = document.getElementById('fileDropArea');
['dragenter', 'dragover'].forEach(ev => dropArea.addEventListener(ev, e => { e.preventDefault(); dropArea.style.borderColor = 'var(--blue)'; }));
['dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, e => { e.preventDefault(); dropArea.style.borderColor = ''; }));
dropArea.addEventListener('drop', function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    const input = document.getElementById('paymentFile');
    const dt = new DataTransfer();
    Array.from(input.files).forEach(f => dt.items.add(f));
    Array.from(files).forEach(f => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
});

// ---------- TO'LOV QO'SHISH ----------
document.getElementById('paymentForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const debtorId = state.currentDebtorId;
    const d = state.debtors.find(x => x.id === debtorId);
    if (!d) return;

    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const errorEl = document.getElementById('paymentError');

    if (!amount || amount <= 0) {
        errorEl.textContent = 'Summani kiriting';
        errorEl.classList.add('show');
        return;
    }
    const remaining = d.amount - d.totalPaid;
    if (amount > remaining) {
        errorEl.textContent = `Qolgan qarz ${formatCurrency(remaining)} dan oshmasligi kerak`;
        errorEl.classList.add('show');
        return;
    }
    if (!date) {
        errorEl.textContent = 'Sanani tanlang';
        errorEl.classList.add('show');
        return;
    }

    // Fayllarni olish
    const fileInput = document.getElementById('paymentFile');
    const files = Array.from(fileInput.files);
    const fileData = files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        // Aslida faylni saqlash uchun backend kerak, lekin frontendda faqat metama'lumot saqlaymiz
        // Biz faylni base64 ga o'girib saqlashimiz mumkin (kichik fayllar uchun)
        // Lekin bu yerda soddalik uchun faqat nomini saqlaymiz
        // Haqiqiy fayl yuklash uchun server API kerak
        // Hozircha fayl ma'lumotlarini xotirada saqlaymiz
        dataURL: null // realda bu yerda base64 bo'ladi
    }));

    // To'lovni qo'shish
    d.payments.push({
        id: generateId(),
        amount,
        date,
        method,
        files: fileData,
        createdAt: new Date().toISOString()
    });
    d.totalPaid += amount;
    if (d.totalPaid >= d.amount) d.status = 'completed';
    else if (d.totalPaid > 0) d.status = 'partial';
    d.updatedAt = new Date().toISOString();

    saveData();
    updateUI();
    renderDebtors();
    closeModal('paymentModal');
    showToast('✅ To\'lov qo\'shildi!', 'success');
    syncPaymentToServer(d);
});

// ---------- DETALLAR ----------
function openDetailsModal(debtorId) {
    const d = state.debtors.find(x => x.id === debtorId);
    if (!d) return;
    state.currentDebtorId = debtorId;
    document.getElementById('detailsTitle').textContent = 'Qarzdor tafsilotlari';
    const container = document.getElementById('detailsContent');
    const remaining = Math.max(d.amount - d.totalPaid, 0);
    const daysLeft = getDaysLeft(d.dueDate);

    const statusText = d.status === 'completed' ? 'To\'liq to\'langan' : d.status === 'partial' ? 'Qisman to\'langan' : d.status === 'overdue' ? 'Muddati o\'tgan' : 'Faol';
    const methodNames = { cash: 'Naqd pul', card: 'Karta', transfer: 'O\'tkazma', check: 'Chek', other: 'Boshqa', completed: 'To\'liq to\'lov' };
    const daysLabel = daysLeft < 0 ? `${Math.abs(daysLeft)} kun o'tgan` : daysLeft === 0 ? 'Bugun' : `${daysLeft} kun qoldi`;
    let html = `
        <div class="details-hero"><div class="details-avatar"><i data-lucide="user-round"></i></div><div><strong>${d.fullName}</strong><span>${statusText}</span></div></div>
        <div class="details-section">
            <div class="section-title"><i data-lucide="contact"></i> Aloqa</div>
            <div class="detail-grid">
                <div class="detail-row"><span class="label"><i data-lucide="phone"></i> Telefon</span><span>${d.phone}</span></div>
                <div class="detail-row"><span class="label"><i data-lucide="map-pin"></i> Manzil</span><span>${d.address || 'Ko\'rsatilmagan'}</span></div>
                <div class="detail-row"><span class="label"><i data-lucide="activity"></i> Holat</span><span>${statusText}</span></div>
            </div>
        </div>
        <div class="details-section">
            <div class="section-title"><i data-lucide="wallet-cards"></i> Qarz ma'lumotlari</div>
            <div class="detail-grid detail-grid-finance">
                <div class="detail-row"><span class="label"><i data-lucide="banknote"></i> Berilgan</span><strong>${formatCurrency(d.amount)}</strong></div>
                <div class="detail-row"><span class="label"><i data-lucide="circle-check"></i> To'langan</span><strong class="amount-paid">${formatCurrency(d.totalPaid)}</strong></div>
                <div class="detail-row"><span class="label"><i data-lucide="scale"></i> Qolgan</span><strong class="amount-remaining">${formatCurrency(remaining)}</strong></div>
                <div class="detail-row"><span class="label"><i data-lucide="calendar-clock"></i> Muddat</span><span>${formatDate(d.dueDate)}</span></div>
                <div class="detail-row"><span class="label"><i data-lucide="timer"></i> Qolgan vaqt</span><span class="${daysLeft <= 0 ? 'days-warning' : ''}">${daysLabel}</span></div>
            </div>
        </div>
        ${d.notes ? `<div class="details-note"><i data-lucide="notebook-pen"></i><span>${d.notes}</span></div>` : ''}
        <div class="details-section payment-history">
            <div class="section-title"><i data-lucide="receipt-text"></i> To'lovlar <span class="count-badge">${d.payments ? d.payments.length : 0}</span></div>
    `;

    if (d.payments && d.payments.length) {
        d.payments.slice().reverse().forEach(p => {
            const fileIcons = (p.files && p.files.length) ? `<i data-lucide="paperclip" title="Ilova bor"></i>` : '';
            html += `
                <div class="payment-item">
                    <div><strong>${formatCurrency(p.amount)}</strong><span>${formatDate(p.date)} · ${methodNames[p.method] || p.method || 'Usul ko\'rsatilmagan'}</span></div>
                    ${fileIcons}
                </div>
            `;
        });
    } else {
        html += `<div class="no-payments"><i data-lucide="receipt"></i><span>Hozircha to'lov yo'q</span></div>`;
    }

    html += `
        <div class="details-actions">
            <button class="btn btn-primary" onclick="openPaymentModal('${d.id}')"><i data-lucide="credit-card"></i> To'lov qo'shish</button>
            <button class="btn btn-secondary" onclick="openDebtorModal('${d.id}')"><i data-lucide="pencil"></i> Tahrirlash</button>
            <button class="btn btn-danger" onclick="deleteDebtor('${d.id}')"><i data-lucide="trash-2"></i> O'chirish</button>
            ${d.status !== 'completed' ? `<button class="btn btn-success" onclick="markCompleted('${d.id}')"><i data-lucide="badge-check"></i> To'liq to'lash</button>` : ''}
        </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    openModal('detailsModal');
}
document.getElementById('detailsCloseBtn').addEventListener('click', () => closeModal('detailsModal'));

// ---------- TO'LIQ TO'LOV ----------
function markCompleted(debtorId) {
    const d = state.debtors.find(x => x.id === debtorId);
    if (!d) return;
    const remaining = d.amount - d.totalPaid;
    if (remaining > 0) {
        d.payments.push({
            id: generateId(),
            amount: remaining,
            date: new Date().toISOString().split('T')[0],
            method: 'completed',
            files: [],
            createdAt: new Date().toISOString()
        });
        d.totalPaid = d.amount;
    }
    d.status = 'completed';
    d.updatedAt = new Date().toISOString();
    saveData();
    updateUI();
    renderDebtors();
    if (document.getElementById('detailsModal').classList.contains('active')) openDetailsModal(debtorId);
    showToast('✅ Qarz to\'liq to\'landi!', 'success');
    syncPaymentToServer(d);
}

// ---------- O'CHIRISH ----------
function deleteDebtor(debtorId) {
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
    state.debtors = state.debtors.filter(x => x.id !== debtorId);
    saveData();
    updateUI();
    renderDebtors();
    closeModal('detailsModal');
    showToast('🗑️ O\'chirildi', 'success');
    syncDeleteToServer(debtorId);
}

// ---------- RENDER QARZDORLAR ----------
function renderDebtors() {
    const list = document.getElementById('debtorsList');
    let filtered = [...state.debtors];

    // Qidiruv
    const term = state.searchTerm.toLowerCase().trim();
    if (term) {
        filtered = filtered.filter(d => d.fullName.toLowerCase().includes(term) || d.phone.includes(term));
    }

    // Filtr
    if (state.filterType !== 'all') {
        if (state.filterType === 'overdue') {
            filtered = filtered.filter(d => {
                const days = getDaysLeft(d.dueDate);
                return days < 0 && d.status !== 'completed';
            });
        } else {
            filtered = filtered.filter(d => d.status === state.filterType);
        }
    }

    // Saralash
    if (state.sortBy === 'newest') filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (state.sortBy === 'amount') filtered.sort((a,b) => b.amount - a.amount);
    else if (state.sortBy === 'dueDate') filtered.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (!filtered.length) {
        list.innerHTML = `<div class="empty-state"><i data-lucide="search-x"></i><strong>Hech narsa topilmadi</strong><span>Qidiruv yoki filtrni o'zgartirib ko'ring.</span></div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    list.innerHTML = filtered.map(d => {
        const remaining = d.amount - d.totalPaid;
        const progress = d.amount > 0 ? (d.totalPaid / d.amount) * 100 : 0;
        const days = getDaysLeft(d.dueDate);
        let daysText = '';
        if (d.status !== 'completed') {
            if (days < 0) daysText = `<div class="days-left overdue"><i data-lucide="alert-circle"></i> ${Math.abs(days)} kun o'tgan</div>`;
            else if (days === 0) daysText = `<div class="days-left today"><i data-lucide="clock-3"></i> Bugun muddat</div>`;
            else daysText = `<div class="days-left">${days} kun qoldi</div>`;
        }

        const isOverdue = days < 0 && d.status !== 'completed';
        const statusClass = isOverdue ? 'overdue' : d.status;

        return `
            <div class="debtor-card">
                <div class="debtor-header">
                    <span class="debtor-name">${d.fullName}</span>
                    <span class="status-badge ${statusClass}">${isOverdue ? 'Muddati o\'tgan' : d.status === 'active' ? 'Faol' : d.status === 'partial' ? 'Qisman' : 'To\'liq'}</span>
                </div>
                <div class="debtor-info">
                    <div><span class="label"><i data-lucide="phone"></i></span> ${d.phone}</div>
                    <div><span class="label"><i data-lucide="banknote"></i></span> ${formatCurrency(d.amount)}</div>
                    <div><span class="label"><i data-lucide="calendar-plus"></i></span> ${formatDate(d.loanDate)}</div>
                    <div><span class="label"><i data-lucide="calendar-clock"></i></span> ${formatDate(d.dueDate)}</div>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(progress,100)}%"></div></div>
                <div style="font-size:13px;color:var(--text2);">To'langan: ${formatCurrency(d.totalPaid)} / ${formatCurrency(d.amount)}</div>
                ${daysText}
                <div class="debtor-actions">
                    <button onclick="openDetailsModal('${d.id}')"><i data-lucide="eye"></i> Detallar</button>
                    <button onclick="openPaymentModal('${d.id}')"><i data-lucide="credit-card"></i> To'lov</button>
                    ${d.status !== 'completed' ? `<button class="success" onclick="markCompleted('${d.id}')"><i data-lucide="check-circle-2"></i> To'liq</button>` : ''}
                    <button aria-label="Tahrirlash" title="Tahrirlash" onclick="openDebtorModal('${d.id}')"><i data-lucide="pencil"></i></button>
                    <button class="danger" aria-label="O'chirish" title="O'chirish" onclick="deleteDebtor('${d.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

// ---------- UI YANGILASH ----------
function updateUI() {
    const total = state.debtors.length;
    const totalDebt = state.debtors.reduce((s,d) => s + d.amount, 0);
    const totalPaid = state.debtors.reduce((s,d) => s + d.totalPaid, 0);
    const remaining = totalDebt - totalPaid;
    const overdue = state.debtors.filter(d => getDaysLeft(d.dueDate) < 0 && d.status !== 'completed').length;
    const completed = state.debtors.filter(d => d.status === 'completed').length;

    document.getElementById('totalDebtors').textContent = total;
    document.getElementById('totalDebt').textContent = formatCurrency(totalDebt);
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('totalRemaining').textContent = formatCurrency(remaining);
    document.getElementById('overdueCount').textContent = overdue;
    document.getElementById('completedCount').textContent = completed;

    updateCharts();
}

// ---------- GRAFIKLAR ----------
function updateCharts() {
    const statuses = { active: 0, partial: 0, completed: 0, overdue: 0 };
    state.debtors.forEach(d => {
        const days = getDaysLeft(d.dueDate);
        if (days < 0 && d.status !== 'completed') statuses.overdue++;
        else if (d.status === 'completed') statuses.completed++;
        else if (d.status === 'partial') statuses.partial++;
        else statuses.active++;
    });
    const statusTotal = document.getElementById('statusTotal');
    if (statusTotal) statusTotal.textContent = state.debtors.length;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text2').trim();
    const gridColor = styles.getPropertyValue('--border').trim();
    const cardColor = styles.getPropertyValue('--card').trim();
    const chartBlue = styles.getPropertyValue('--blue').trim();
    const chartOrange = styles.getPropertyValue('--orange').trim();
    const chartGreen = styles.getPropertyValue('--green').trim();
    const chartRed = styles.getPropertyValue('--red').trim();
    const chartFont = { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' };
    const ctx1 = document.getElementById('statusChart').getContext('2d');
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Faol', 'Qisman', 'To\'liq', 'Muddati o\'tgan'],
            datasets: [{ data: [statuses.active, statuses.partial, statuses.completed, statuses.overdue],
                backgroundColor: [chartBlue, chartOrange, chartGreen, chartRed],
                borderColor: cardColor,
                borderWidth: 3,
                hoverOffset: 8 }]
        },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                animation: { duration: 650, easing: 'easeOutQuart' },
                plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, boxHeight: 12, padding: 16, font: chartFont } } }
            }
    });

    // Oylik to'lovlar
    const monthly = {};
    state.debtors.forEach(d => {
        (d.payments || []).forEach(p => {
            const m = p.date ? p.date.slice(0,7) : 'unknown';
            monthly[m] = (monthly[m] || 0) + p.amount;
        });
    });
    const months = Object.keys(monthly).sort();
    const ctx2 = document.getElementById('monthlyChart').getContext('2d');
    if (chartMonthly) chartMonthly.destroy();
    chartMonthly = new Chart(ctx2, {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'To\'lov', data: months.map(m => monthly[m]), backgroundColor: chartBlue, borderRadius: 7, borderSkipped: false, maxBarThickness: 34 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 650, easing: 'easeOutQuart' },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ' ' + formatCurrency(context.raw) } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: chartFont } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: chartFont, callback: value => new Intl.NumberFormat('uz-UZ', { notation: 'compact' }).format(value) } }
            }
        }
    });
}

// ---------- QIDIRUV (DEBOUNCE) ----------
document.getElementById('searchInput').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    state.searchTerm = this.value;
    searchTimeout = setTimeout(() => renderDebtors(), 300);
});

// ---------- FILTR ----------
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.filterType = this.dataset.filter;
        renderDebtors();
    });
});

// ---------- SARALASH ----------
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.sortBy = this.dataset.sort;
        renderDebtors();
    });
});
// default sort
document.querySelector('.sort-btn[data-sort="newest"]')?.classList.add('active');

// ---------- NAVIGATSIYA ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const page = this.dataset.page;
        if (page === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (page === 'list') document.querySelector('.debtors-section')?.scrollIntoView({ behavior: 'smooth' });
        else if (page === 'add') openDebtorModal();
        else if (page === 'stats') document.querySelector('.stats-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
});

// ---------- FAB ----------
document.getElementById('fabBtn').addEventListener('click', () => openDebtorModal());

// ---------- SOZLAMALAR ----------
document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
document.getElementById('settingsCloseBtn').addEventListener('click', () => closeModal('settingsModal'));

// Eksport
document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.debtors, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qarzlar_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('📤 Eksport qilindi', 'success');
});

// Import
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (Array.isArray(data)) {
                state.debtors = data;
                saveData();
                updateUI();
                renderDebtors();
                showToast('📥 Import muvaffaqiyatli!', 'success');
                syncToServer();
            } else {
                showToast('Noto\'g\'ri format', 'error');
            }
        } catch(e) { showToast('Xatolik', 'error'); }
    };
    reader.readAsText(file);
    this.value = '';
});

// Demo ma'lumot
document.getElementById('addDemoBtn').addEventListener('click', () => {
    if (state.debtors.length && !confirm('Mavjud ma\'lumotlar o\'chib ketadi. Davom?')) return;
    state.debtors = [];
    const now = new Date();
    const d1 = new Date(now); d1.setDate(d1.getDate() - 5);
    const d2 = new Date(now); d2.setDate(d2.getDate() + 10);
    const d3 = new Date(now); d3.setDate(d3.getDate() - 2);
    const d4 = new Date(now); d4.setDate(d4.getDate() + 25);

    const demo = [
        { fullName: 'Ali Karimov', phone: '+998 90 123 45 67', address: 'Toshkent', amount: 5000000, loanDate: d1.toISOString().split('T')[0], dueDate: d3.toISOString().split('T')[0], status: 'overdue', notes: 'Muddati o\'tgan', totalPaid: 2000000, payments: [{ id: generateId(), amount: 2000000, date: new Date(now.getTime()-3*86400000).toISOString().split('T')[0], method: 'cash', files: [], createdAt: new Date().toISOString() }] },
        { fullName: 'Gulnora Akbarova', phone: '+998 91 234 56 78', address: 'Samarqand', amount: 3500000, loanDate: new Date(now.getTime()-15*86400000).toISOString().split('T')[0], dueDate: d2.toISOString().split('T')[0], status: 'partial', notes: '', totalPaid: 1500000, payments: [{ id: generateId(), amount: 1000000, date: new Date(now.getTime()-10*86400000).toISOString().split('T')[0], method: 'card', files: [], createdAt: new Date().toISOString() }, { id: generateId(), amount: 500000, date: new Date(now.getTime()-5*86400000).toISOString().split('T')[0], method: 'transfer', files: [], createdAt: new Date().toISOString() }] },
        { fullName: 'Jasur Maxmudov', phone: '+998 99 345 67 89', address: 'Farg\'ona', amount: 2000000, loanDate: new Date(now.getTime()-60*86400000).toISOString().split('T')[0], dueDate: new Date(now.getTime()-10*86400000).toISOString().split('T')[0], status: 'completed', notes: 'To\'liq to\'langan', totalPaid: 2000000, payments: [{ id: generateId(), amount: 2000000, date: new Date(now.getTime()-8*86400000).toISOString().split('T')[0], method: 'transfer', files: [], createdAt: new Date().toISOString() }] },
        { fullName: 'Sonya Uzbekova', phone: '+998 88 456 78 90', address: 'Andijon', amount: 4500000, loanDate: now.toISOString().split('T')[0], dueDate: d4.toISOString().split('T')[0], status: 'active', notes: 'Yangi qarz', totalPaid: 0, payments: [] }
    ];
    demo.forEach(d => { d.id = generateId(); d.createdAt = new Date().toISOString(); d.updatedAt = new Date().toISOString(); });
    state.debtors = demo;
    saveData();
    updateUI();
    renderDebtors();
    closeModal('settingsModal');
    showToast('🧪 Demo ma\'lumot qo\'shildi', 'success');
    syncToServer();
});

// Barchasini o'chirish
document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (confirm('Barcha ma\'lumotlar o\'chiriladi. Davom?')) {
        state.debtors = [];
        saveData();
        updateUI();
        renderDebtors();
        closeModal('settingsModal');
        showToast('🗑️ Hammasi o\'chirildi', 'success');
        syncToServer();
    }
});

// ---------- SERVER BILAN SINXRON ----------
async function apiError(response, fallback) {
    const body = await response.json().catch(() => ({}));
    return body.details || body.error || `${fallback} (${response.status})`;
}

async function syncDebtorToServer(debtor, action) {
    if (!debtor) return;
    try {
        const res = await fetch(API_BASE + '/api/debtors', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ debtor, action })
        });
        if (!res.ok) throw new Error(await apiError(res, 'Telegram xatosi'));
    } catch (e) { showToast(`Telegram: ${e.message}`, 'error'); console.info(e); }
}

async function syncPaymentToServer(debtor) {
    try {
        const res = await fetch(API_BASE + '/api/payments', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ debtorId: debtor.id, debtor, payments: debtor.payments, totalPaid: debtor.totalPaid, status: debtor.status })
        });
        if (!res.ok) throw new Error(await apiError(res, 'Telegram xatosi'));
    } catch (e) { showToast(`To'lov xabari: ${e.message}`, 'error'); console.info(e); }
}

async function syncDeleteToServer(debtorId) {
    try {
        const url = API_BASE + '/api/debtors/' + encodeURIComponent(debtorId);
        let res = await fetch(url, { method: 'DELETE' });
        if (res.status === 405) {
            res = await fetch(url + '/delete', { method: 'POST' });
        }
        if (!res.ok) throw new Error(await apiError(res, 'Server yoki Telegram xatosi'));
    } catch (e) { showToast(`O'chirish xabari: ${e.message}`, 'error'); console.info(e); }
}

async function syncToServer(action = null) {
    try {
        const res = await fetch(API_BASE + '/api/sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ debtors: state.debtors, action })
        });
        if (!res.ok) throw new Error('Server xatosi');
        const data = await res.json();
        if (action && !data.telegramSent) console.warn('Telegram yuborilmadi');
    } catch (e) {
        console.info('Serverga ulanish yo\'q, localStorage ishlatiladi.');
    }
}

async function syncFromServer() {
    try {
        const res = await fetch(API_BASE + '/api/debtors');
        if (!res.ok) return;
        const data = await res.json();
        if (data.debtors && data.debtors.length) {
            state.debtors = data.debtors;
            saveData();
            updateUI();
            renderDebtors();
        }
    } catch (e) { console.info('Serverdan yuklash mumkin emas'); }
}

// ---------- PDF EKSPORT (SODDA) ----------
document.getElementById('exportPdfBtn').addEventListener('click', () => {
    // Bu yerda haqiqiy PDF generatsiyasi uchun jspdf kutubxonasidan foydalanish mumkin
    // Hozircha brauzerning chop etish funksiyasidan foydalanamiz
    window.print();
});

// ---------- EXCEL EKSPORT ----------
document.getElementById('exportExcelBtn').addEventListener('click', () => {
    // CSV formatida eksport (Excel ochadi)
    let csv = 'Ism,Telefon,Manzil,Summa,To\'langan,Qolgan,Status,Muddat\n';
    state.debtors.forEach(d => {
        const rem = d.amount - d.totalPaid;
        csv += `${d.fullName},${d.phone},"${d.address || ''}",${d.amount},${d.totalPaid},${rem},${d.status},${d.dueDate}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qarzlar_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('📊 Excel (CSV) eksport qilindi', 'success');
});

// ---------- BACKUP / RESTORE ----------
document.getElementById('backupBtn').addEventListener('click', () => {
    const data = { version: '1.0', timestamp: new Date().toISOString(), debtors: state.debtors };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('💾 Zaxira saqlandi', 'success');
});

document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFileInput').click());
document.getElementById('restoreFileInput').addEventListener('change', function(e) {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.debtors && Array.isArray(data.debtors)) {
                state.debtors = data.debtors;
                saveData();
                updateUI();
                renderDebtors();
                showToast('♻️ Zaxiradan tiklandi!', 'success');
                syncToServer();
            } else {
                showToast('Noto\'g\'ri backup fayli', 'error');
            }
        } catch(e) { showToast('Xatolik', 'error'); }
    };
    reader.readAsText(file);
    this.value = '';
});

// ---------- BULK DELETE ----------
document.getElementById('bulkDeleteBtn')?.addEventListener('click', () => {
    if (confirm('Barcha qarzlarni o\'chirishni tasdiqlaysizmi?')) {
        state.debtors = [];
        saveData();
        updateUI();
        renderDebtors();
        closeModal('settingsModal');
        showToast('🗑️ Barcha qarzlar o\'chirildi', 'success');
        syncToServer();
    }
});

// ---------- BULK EXPORT ----------
document.getElementById('bulkExportBtn')?.addEventListener('click', () => {
    // Faqat faol va qisman qarzlarni eksport qilish
    const filtered = state.debtors.filter(d => d.status === 'active' || d.status === 'partial');
    if (!filtered.length) { showToast('Eksport uchun qarzdor yo\'q', 'error'); return; }
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `faol_qarzlar_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('📤 Tanlanganlar eksport qilindi', 'success');
});

// ---------- BOSHLANG'ICH CHAQIRUVLAR ----------
setDefaultDates();