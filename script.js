// ==================== STORAGE KEY ====================
const STORAGE_KEY = 'qarz_daftari_data';
const THEME_KEY = 'qarz_daftari_theme';
const API_BASE_URL = window.QARZ_API_URL ||
    (window.location.protocol === 'file:' ? 'http://localhost:3000' : '');

// ==================== STATE ====================
let appState = {
    debtors: [],
    currentEditId: null,
    currentDebtorId: null,
    searchTerm: '',
    filterType: 'all',
    sortBy: 'newest'
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadTheme();
    loadDataFromStorage();
    attachEventListeners();
    updateDashboard();
    renderDebtors();
    setDefaultDates();
    syncFromServer();
}

// ==================== THEME MANAGEMENT ====================
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    
    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
    showToast('Tema o\'zgartirildi', 'success');
});

// ==================== STORAGE MANAGEMENT ====================
function loadDataFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            appState.debtors = JSON.parse(data);
        }
    } catch (error) {
        console.error('Ma\'lumotlar yuklanishda xatolik:', error);
        showToast('Ma\'lumotlarni yuklashda xatolik', 'error');
    }
}

function saveDataToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.debtors));
        return true;
    } catch (error) {
        console.error('Ma\'lumotlarni saqlashda xatolik:', error);
        showToast('Ma\'lumotlarni saqlashda xatolik', 'error');
        return false;
    }
}

// ==================== EVENT LISTENERS ====================
function attachEventListeners() {
    // Debtor Modal
    document.getElementById('fabBtn').addEventListener('click', () => openDebtorModal());
    document.getElementById('modalCloseBtn').addEventListener('click', closeDebtorModal);
    document.getElementById('cancelBtn').addEventListener('click', closeDebtorModal);
    document.getElementById('debtorForm').addEventListener('submit', saveDebtor);
    document.getElementById('phone').addEventListener('input', (e) => {
        e.target.value = formatPhoneNumber(e.target.value);
    });
    
    // Payment Modal
    document.getElementById('paymentCloseBtn').addEventListener('click', closePaymentModal);
    document.getElementById('paymentCancelBtn').addEventListener('click', closePaymentModal);
    document.getElementById('paymentForm').addEventListener('submit', addPayment);
    
    // Details Modal
    document.getElementById('detailsCloseBtn').addEventListener('click', closeDetailsModal);
    
    // Settings Modal
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('settingsCloseBtn').addEventListener('click', closeSettingsModal);
    
    // Confirmation Modal
    document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
    
    // Search & Filter
    document.getElementById('searchInput').addEventListener('input', (e) => {
        appState.searchTerm = e.target.value;
        renderDebtors();
    });
    
    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            appState.filterType = e.target.dataset.filter;
            renderDebtors();
        });
    });
    
    // Sort Buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            appState.sortBy = e.target.dataset.sort;
            renderDebtors();
        });
    });
    
    // Bottom Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const page = e.currentTarget.dataset.page;
            handlePageNavigation(page);
        });
    });
    
    // Settings Buttons
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', importData);
    document.getElementById('addDemoBtn').addEventListener('click', addDemoData);
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        showConfirmation(
            'Barcha Ma\'lumotlarni O\'chirish',
            'Siz haqiqatan ham barcha ma\'lumotlarni o\'chirmoqchimisiz? Bu amalni qaytarish mumkin emas.',
            () => clearAllData()
        );
    });
    
    // Modal Overlay Click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.parentElement.classList.remove('active');
            }
        });
    });
    
    // Keyboard Events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ==================== MODALS ====================
function openDebtorModal(debtorId = null) {
    const modal = document.getElementById('debtorModal');
    const form = document.getElementById('debtorForm');
    const modalTitle = document.getElementById('modalTitle');
    
    appState.currentEditId = debtorId;
    
    form.reset();
    clearAllErrors();
    
    if (debtorId) {
        const debtor = appState.debtors.find(d => d.id === debtorId);
        if (debtor) {
            modalTitle.textContent = 'Qarzdorni Tahrirlash';
            document.getElementById('fullName').value = debtor.fullName;
            document.getElementById('phone').value = debtor.phone;
            document.getElementById('address').value = debtor.address;
            document.getElementById('amount').value = debtor.amount;
            document.getElementById('loanDate').value = debtor.loanDate;
            document.getElementById('dueDate').value = debtor.dueDate;
            document.getElementById('status').value = debtor.status;
            document.getElementById('notes').value = debtor.notes;
        }
    } else {
        modalTitle.textContent = 'Yangi Qarzdor Qo\'shish';
        setDefaultDates();
        if (!document.getElementById('loanDate').value || !document.getElementById('dueDate').value) {
            setDefaultDates();
        }
    }
    
    modal.classList.add('active');
}

function closeDebtorModal() {
    document.getElementById('debtorModal').classList.remove('active');
    appState.currentEditId = null;
}

function openDetailsModal(debtorId) {
    const debtor = appState.debtors.find(d => d.id === debtorId);
    if (!debtor) return;
    
    appState.currentDebtorId = debtorId;
    const modal = document.getElementById('detailsModal');
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsContent = document.getElementById('detailsContent');
    
    detailsTitle.textContent = debtor.fullName;
    
    let remainingDebt = debtor.amount - debtor.totalPaid;
    if (remainingDebt < 0) remainingDebt = 0;
    
    let html = `
        <div class="detail-section">
            <div class="detail-row">
                <span class="detail-label">Telefon:</span>
                <span class="detail-value"><a href="tel:${debtor.phone}" style="color: var(--color-blue); text-decoration: none;">${debtor.phone}</a></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Manzil:</span>
                <span class="detail-value">${debtor.address || 'Ko\'rsatilmagan'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Holati:</span>
                <span class="detail-value">${getStatusText(debtor.status)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3 style="margin-bottom: 12px; font-weight: 700;">Qarz Ma\'lumotlari</h3>
            <div class="detail-row">
                <span class="detail-label">Berilgan Qarz:</span>
                <span class="detail-value">${formatCurrency(debtor.amount)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Qarz Sanasi:</span>
                <span class="detail-value">${formatDate(debtor.loanDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Qaytarish Muddati:</span>
                <span class="detail-value">${formatDate(debtor.dueDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Jami To\'langan:</span>
                <span class="detail-value" style="color: var(--color-green);">${formatCurrency(debtor.totalPaid)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Qolgan Qarz:</span>
                <span class="detail-value" style="color: ${remainingDebt > 0 ? 'var(--color-red)' : 'var(--color-green)'};">${formatCurrency(remainingDebt)}</span>
            </div>
    `;
    
    if (debtor.notes) {
        html += `
            <div class="detail-row">
                <span class="detail-label">Izoh:</span>
                <span class="detail-value">${debtor.notes}</span>
            </div>
        `;
    }
    
    html += '</div>';
    
    if (debtor.payments && debtor.payments.length > 0) {
        html += `
            <div class="detail-section">
                <h3 style="margin-bottom: 12px; font-weight: 700;">To\'lovlar Tarixi</h3>
                <div class="payment-history">
        `;
        
        debtor.payments.forEach(payment => {
            html += `
                <div class="payment-item">
                    <div>
                        <div class="payment-date">${formatDate(payment.date)}</div>
                        <div style="font-size: 12px; color: var(--text-tertiary);">${payment.method || 'Naqd'}</div>
                    </div>
                    <span class="payment-amount">${formatCurrency(payment.amount)}</span>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    html += `
        <div style="display: flex; gap: 8px; margin-top: var(--spacing-md);">
            <button class="btn btn-primary" style="flex: 1;" onclick="openPaymentModal('${debtorId}')">To\'lov Qo\'shish</button>
            <button class="btn btn-secondary" style="flex: 1;" onclick="openDebtorModal('${debtorId}')">Tahrirlash</button>
            <button class="btn btn-danger" style="flex: 1;" onclick="deleteDebtorConfirm('${debtorId}')">O\'chirish</button>
        </div>
    `;
    
    detailsContent.innerHTML = html;
    modal.classList.add('active');
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    appState.currentDebtorId = null;
}

function openPaymentModal(debtorId) {
    const debtor = appState.debtors.find(d => d.id === debtorId);
    if (!debtor) return;
    
    appState.currentDebtorId = debtorId;
    const modal = document.getElementById('paymentModal');
    
    const remainingDebt = debtor.amount - debtor.totalPaid;
    document.getElementById('paymentAmount').max = remainingDebt;
    document.getElementById('paymentAmount').placeholder = `Maksimum: ${formatCurrency(remainingDebt)}`;
    
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentError').classList.remove('show');

    // Reset first, then set today's date so the required field is never cleared.
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;
    
    modal.classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    appState.currentDebtorId = null;
}

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ==================== CONFIRMATION DIALOG ====================
function showConfirmation(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    document.getElementById('confirmYesBtn').onclick = () => {
        onConfirm();
        closeConfirmModal();
    };
    
    modal.classList.add('active');
}

// ==================== DEBTOR CRUD ====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveDebtor(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const loanDate = document.getElementById('loanDate').value;
    const dueDate = document.getElementById('dueDate').value;
    const status = document.getElementById('status').value;
    const notes = document.getElementById('notes').value.trim();
    
    clearAllErrors();
    let isValid = true;
    
    if (!fullName) {
        showError('fullName', 'Ism va familiya majburiy');
        isValid = false;
    }
    
    if (!phone) {
        showError('phone', 'Telefon raqami majburiy');
        isValid = false;
    } else if (!/^\+?998[-\s]?/.test(phone)) {
        // Allow various phone formats
        if (phone.length < 9) {
            showError('phone', 'Telefon raqami noto\'g\'ri');
            isValid = false;
        }
    }
    
    if (!amount || amount <= 0) {
        showError('amount', 'Qarz summasi noto\'g\'ri');
        isValid = false;
    }
    
    if (!loanDate) {
        showError('loanDate', 'Qarz sanasi majburiy');
        isValid = false;
    }
    
    if (!dueDate) {
        showError('dueDate', 'Qaytarish muddati majburiy');
        isValid = false;
    }
    
    if (loanDate && dueDate && loanDate > dueDate) {
        showError('dueDate', 'Qaytarish muddati qarz sanasidan keyin bo\'lsin');
        isValid = false;
    }
    
    if (!isValid) {
        showToast('Maydonlarni to\'g\'ri to\'ldiring', 'error');
        return;
    }
    
    const action = appState.currentEditId ? 'updated' : 'created';
    let savedDebtor;

    if (appState.currentEditId) {
        // Edit existing
        const debtor = appState.debtors.find(d => d.id === appState.currentEditId);
        debtor.fullName = fullName;
        debtor.phone = phone;
        debtor.address = address;
        debtor.amount = amount;
        debtor.loanDate = loanDate;
        debtor.dueDate = dueDate;
        debtor.status = status;
        debtor.notes = notes;
        debtor.updatedAt = new Date().toISOString();
        savedDebtor = debtor;
        
        showToast('Qarzdor yangilandi', 'success');
    } else {
        // Add new
        const newDebtor = {
            id: generateId(),
            fullName,
            phone,
            address,
            amount,
            loanDate,
            dueDate,
            status,
            notes,
            totalPaid: 0,
            payments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        appState.debtors.push(newDebtor);
        savedDebtor = newDebtor;
        showToast('Yangi qarzdor qo\'shildi', 'success');
    }
    
    saveDataToStorage();
    updateDashboard();
    renderDebtors();
    closeDebtorModal();
    sendDebtorEvent(savedDebtor, action);
}

function deleteDebtorConfirm(debtorId) {
    const debtor = appState.debtors.find(d => d.id === debtorId);
    if (!debtor) return;
    
    closeDetailsModal();
    
    showConfirmation(
        'Qarzdorni O\'chirish',
        `${debtor.fullName} ni o\'chirasizmi? Bu amalni qaytarish mumkin emas.`,
        () => deleteDebtor(debtorId)
    );
}

function deleteDebtor(debtorId) {
    const debtor = appState.debtors.find(d => d.id === debtorId);
    appState.debtors = appState.debtors.filter(d => d.id !== debtorId);
    saveDataToStorage();
    updateDashboard();
    renderDebtors();
    showToast('Qarzdor o\'chirildi', 'success');
    if (debtor) {
        fetch(`${API_BASE_URL}/api/debtors/${encodeURIComponent(debtorId)}`, { method: 'DELETE' })
            .catch(error => console.info('O\'chirish serverga yuborilmadi:', error.message));
    }
}

function markAsCompleted(debtorId) {
    const debtor = appState.debtors.find(d => d.id === debtorId);
    if (debtor) {
        debtor.status = 'completed';
        debtor.updatedAt = new Date().toISOString();
        saveDataToStorage();
        updateDashboard();
        renderDebtors();
        openDetailsModal(debtorId);
        showToast('Qarz to\'liq to\'langan deb belgilandi', 'success');
        sendDebtorEvent(debtor, 'updated');
    }
}

// ==================== PAYMENTS ====================
function addPayment(e) {
    e.preventDefault();
    
    if (!appState.currentDebtorId) return;
    
    const debtor = appState.debtors.find(d => d.id === appState.currentDebtorId);
    if (!debtor) return;
    
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    
    const errorElement = document.getElementById('paymentError');
    errorElement.classList.remove('show');
    
    if (!amount || amount <= 0) {
        errorElement.textContent = 'To\'lov summasi noto\'g\'ri';
        errorElement.classList.add('show');
        return;
    }
    
    const remainingDebt = debtor.amount - debtor.totalPaid;
    if (amount > remainingDebt) {
        errorElement.textContent = `Qolgan qarz ${formatCurrency(remainingDebt)} dan ko\'p to\'lov qo\'shib bo\'lmaydi`;
        errorElement.classList.add('show');
        return;
    }
    
    if (!date) {
        errorElement.textContent = 'Sana majburiy';
        errorElement.classList.add('show');
        return;
    }
    
    debtor.payments.push({
        id: generateId(),
        amount,
        date,
        method,
        createdAt: new Date().toISOString()
    });
    
    debtor.totalPaid += amount;
    
    // Update status
    if (debtor.totalPaid >= debtor.amount) {
        debtor.status = 'completed';
    } else if (debtor.totalPaid > 0) {
        debtor.status = 'partial';
    }
    
    debtor.updatedAt = new Date().toISOString();
    
    saveDataToStorage();
    updateDashboard();
    renderDebtors();
    closePaymentModal();
    openDetailsModal(appState.currentDebtorId);
    showToast('To\'lov qo\'shildi', 'success');
    sendPaymentEvent(debtor);
}

// ==================== RENDERING ====================
function renderDebtors() {
    const list = document.getElementById('debtorsList');
    
    let filteredDebtors = [...appState.debtors];
    
    // Search
    if (appState.searchTerm) {
        const term = appState.searchTerm.toLowerCase();
        filteredDebtors = filteredDebtors.filter(d =>
            d.fullName.toLowerCase().includes(term) ||
            d.phone.includes(term)
        );
    }
    
    // Filter
    if (appState.filterType !== 'all') {
        filteredDebtors = filteredDebtors.filter(d => {
            if (appState.filterType === 'overdue') {
                return isDebtorOverdue(d);
            }
            return d.status === appState.filterType;
        });
    }
    
    // Sort
    if (appState.sortBy === 'newest') {
        filteredDebtors.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (appState.sortBy === 'amount') {
        filteredDebtors.sort((a, b) => b.amount - a.amount);
    }
    
    if (filteredDebtors.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p class="empty-text">Qarzdor topilmadi</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = filteredDebtors.map(debtor => {
        const remainingDebt = debtor.amount - debtor.totalPaid;
        const progress = (debtor.totalPaid / debtor.amount) * 100;
        const statusText = getStatusText(debtor.status);
        const isOverdue = isDebtorOverdue(debtor);
        
        return `
            <div class="debtor-card">
                <div class="debtor-card-header">
                    <div class="debtor-name">${debtor.fullName}</div>
                    <span class="status-badge ${debtor.status} ${isOverdue ? 'overdue' : ''}">
                        ${isOverdue ? 'Muddati' : statusText}
                    </span>
                </div>
                
                <div class="debtor-info">
                    <div class="info-item">
                        <span class="info-label"><svg class="inline-icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path></svg> Telefon:</span>
                        <span class="info-value"><a href="tel:${debtor.phone}" style="color: var(--color-blue); text-decoration: none;">${debtor.phone}</a></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><svg class="inline-icon" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg> Qarz:</span>
                        <span class="info-value">${formatCurrency(debtor.amount)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><svg class="inline-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Sana:</span>
                        <span class="info-value">${formatDate(debtor.loanDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><svg class="inline-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> Muddati:</span>
                        <span class="info-value">${formatDate(debtor.dueDate)}</span>
                    </div>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                
                <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 12px;">
                    To\'langan: ${formatCurrency(debtor.totalPaid)} / ${formatCurrency(debtor.amount)}
                </div>
                
                <div class="debtor-actions">
                    <button class="action-btn" onclick="openDetailsModal('${debtor.id}')">Detallar</button>
                    <button class="action-btn" onclick="openPaymentModal('${debtor.id}')"><svg class="button-icon" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg> To\'lov</button>
                    <button class="action-btn success" onclick="markAsCompleted('${debtor.id}')"><svg class="button-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> To\'liq</button>
                    <button class="action-btn" onclick="openDebtorModal('${debtor.id}')"><svg class="button-icon" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg> Tahrirlash</button>
                    <button class="action-btn danger" onclick="deleteDebtorConfirm('${debtor.id}')"><svg class="button-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> O\'chirish</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== DASHBOARD ====================
function updateDashboard() {
    const totalDebtors = appState.debtors.length;
    const totalDebt = appState.debtors.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = appState.debtors.reduce((sum, d) => sum + d.totalPaid, 0);
    const totalRemaining = totalDebt - totalPaid;
    const overdueCount = appState.debtors.filter(d => isDebtorOverdue(d)).length;
    const completedCount = appState.debtors.filter(d => d.status === 'completed').length;
    
    document.getElementById('totalDebtors').textContent = totalDebtors;
    document.getElementById('totalDebt').textContent = formatCurrency(totalDebt);
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('totalRemaining').textContent = formatCurrency(totalRemaining);
    document.getElementById('overdueCount').textContent = overdueCount;
    document.getElementById('completedCount').textContent = completedCount;
}

// ==================== HELPERS ====================
function isDebtorOverdue(debtor) {
    const today = new Date();
    const dueDate = new Date(debtor.dueDate);
    return today > dueDate && debtor.status !== 'completed';
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Faol',
        'partial': 'Qisman',
        'completed': 'To\'liq',
        'overdue': 'Muddati'
    };
    return statusMap[status] || status;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' so\'m';
}

function formatPhoneNumber(value) {
    let digits = value.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('998')) {
        digits = digits.slice(3);
    }

    digits = digits.slice(0, 9);
    const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
        .filter(Boolean);
    return `+998${groups.length ? ` ${groups.join(' ')}` : ''}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 30);

    const toDateInputValue = date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayString = toDateInputValue(today);
    const tomorrowString = toDateInputValue(tomorrow);
    
    document.getElementById('loanDate').value = todayString;
    document.getElementById('dueDate').value = tomorrowString;
    document.getElementById('paymentDate').value = todayString;
}

// ==================== VALIDATION ====================
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        document.getElementById(fieldId).parentElement.classList.add('error');
    }
}

function clearAllErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
    document.querySelectorAll('.form-group').forEach(el => {
        el.classList.remove('error');
    });
}

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== PAGE NAVIGATION ====================
function handlePageNavigation(page) {
    if (page === 'home') {
        document.querySelector('.container').scrollTop = 0;
    } else if (page === 'add') {
        openDebtorModal();
    } else if (page === 'stats') {
        showToast('Statistika sahifasi tezda bo\'ladi', 'info');
    }
}

// ==================== EXPORT/IMPORT ====================
function exportData() {
    try {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            debtors: appState.debtors
        };
        
        const dataString = JSON.stringify(data, null, 2);
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qarz_daftari_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        showToast('Ma\'lumotlar eksport qilindi', 'success');
    } catch (error) {
        showToast('Eksportda xatolik', 'error');
    }
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (data.debtors && Array.isArray(data.debtors)) {
                appState.debtors = data.debtors;
                saveDataToStorage();
                syncDataToServer('imported');
                updateDashboard();
                renderDebtors();
                showToast('Ma\'lumotlar import qilindi', 'success');
            } else {
                showToast('Noto\'g\'ri fayl formati', 'error');
            }
        } catch (error) {
            showToast('Faylni o\'qishda xatolik', 'error');
        }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    e.target.value = '';
}

// ==================== DEMO DATA ====================
function addDemoData() {
    if (appState.debtors.length > 0) {
        showConfirmation(
            'Ehtiyot',
            'Demo ma\'lumot qo\'shishdan avval barcha mavjud ma\'lumotlar o\'chib ketadi. Davom etasizmi?',
            () => {
                appState.debtors = [];
                insertDemoData();
            }
        );
    } else {
        insertDemoData();
    }
}

function insertDemoData() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);
    
    const demoDebtors = [
        {
            id: generateId(),
            fullName: 'Ali Karimov',
            phone: '+998 (90) 123-45-67',
            address: 'Tashkent, Chilanzar 8',
            amount: 5000000,
            loanDate: lastMonth.toISOString().split('T')[0],
            dueDate: yesterday.toISOString().split('T')[0],
            status: 'overdue',
            notes: 'Muddati o\'tgan qarz',
            totalPaid: 2000000,
            payments: [
                {
                    id: generateId(),
                    amount: 2000000,
                    date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    method: 'cash',
                    createdAt: new Date().toISOString()
                }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: generateId(),
            fullName: 'Gulnora Akbarova',
            phone: '+998 (91) 234-56-78',
            address: 'Samarkand, Registan 5',
            amount: 3500000,
            loanDate: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dueDate: nextWeek.toISOString().split('T')[0],
            status: 'partial',
            notes: 'Qisman to\'langan qarz',
            totalPaid: 1500000,
            payments: [
                {
                    id: generateId(),
                    amount: 1000000,
                    date: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    method: 'card',
                    createdAt: new Date().toISOString()
                },
                {
                    id: generateId(),
                    amount: 500000,
                    date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    method: 'transfer',
                    createdAt: new Date().toISOString()
                }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: generateId(),
            fullName: 'Jasur Maxmudov',
            phone: '+998 (99) 345-67-89',
            address: 'Fergona, Sharafliy 12',
            amount: 2000000,
            loanDate: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dueDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'completed',
            notes: 'To\'liq to\'langan qarz',
            totalPaid: 2000000,
            payments: [
                {
                    id: generateId(),
                    amount: 2000000,
                    date: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    method: 'transfer',
                    createdAt: new Date().toISOString()
                }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: generateId(),
            fullName: 'Sonya Uzbekova',
            phone: '+998 (88) 456-78-90',
            address: 'Andijan, Bobur 7',
            amount: 4500000,
            loanDate: today.toISOString().split('T')[0],
            dueDate: nextMonth.toISOString().split('T')[0],
            status: 'active',
            notes: 'Yangi qarz',
            totalPaid: 0,
            payments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    appState.debtors = demoDebtors;
    saveDataToStorage();
    syncDataToServer('demo');
    updateDashboard();
    renderDebtors();
    closeSettingsModal();
    showToast('Demo ma\'lumot qo\'shildi', 'success');
}

// ==================== CLEAR ALL DATA ====================
function clearAllData() {
    appState.debtors = [];
    saveDataToStorage();
    syncDataToServer('cleared');
    updateDashboard();
    renderDebtors();
    closeSettingsModal();
    showToast('Barcha ma\'lumotlar o\'chirildi', 'success');
}

async function syncFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/debtors`);
        if (!response.ok) return;

        const data = await response.json();
        if (data.debtors.length > 0 || appState.debtors.length === 0) {
            appState.debtors = data.debtors;
            saveDataToStorage();
            updateDashboard();
            renderDebtors();
        } else {
            await syncDataToServer();
        }
    } catch (error) {
        console.info('Server hozircha ulanmagan, localStorage ishlatilmoqda.');
    }
}

async function syncDataToServer(action = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ debtors: appState.debtors, action })
        });
        const result = await response.json();
        if (!response.ok || (action && !result.telegramSent)) throw new Error(`Telegram yuborilmadi (server ${response.status})`);
    } catch (error) {
        console.info('Ma\'lumotlar serverga yuborilmadi:', error.message);
    }
}

async function sendDebtorEvent(debtor, action) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/debtors`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ debtor, action })
        });
        const result = await response.json();
        if (!response.ok || !result.telegramSent) throw new Error(`Telegram yuborilmadi (server ${response.status})`);
    } catch (error) {
        console.error('Telegram bildirishnomasi yuborilmadi:', error.message);
        showToast('Telegramga yuborishda xatolik', 'error');
    }
}

async function sendPaymentEvent(debtor) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payments`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                debtorId: debtor.id,
                debtor,
                payments: debtor.payments,
                totalPaid: debtor.totalPaid,
                status: debtor.status
            })
        });
        const result = await response.json();
        if (!response.ok || !result.telegramSent) throw new Error(`Telegram yuborilmadi (server ${response.status})`);
    } catch (error) {
        console.error('To\'lov Telegramga yuborilmadi:', error.message);
        showToast('Telegramga yuborishda xatolik', 'error');
    }
}