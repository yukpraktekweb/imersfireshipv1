const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZn9Q-5Ks8T2fePe7PCyYIhQtUq6ZxCh7uszdCFEtquQD0uLDLAC3Rip-1_GmAbB3n/exec";

async function apiCall(action, payload = null) {
    if (SCRIPT_URL === "URL_WEB_APP_APPS_SCRIPT_LO_DISINI" || !SCRIPT_URL) {
        showToast("Script URL belum diganti di index.html!", "error");
        throw new Error("URL Belum disetting");
    }
    
    // Pastikan URL bersih dari spasi yang nggak sengaja ke-copy
    const cleanUrl = SCRIPT_URL.trim();
    let url = `${cleanUrl}?action=${action}`;
    
    // Konfigurasi fetch standar untuk Google Apps Script
    // redirect: 'follow' wajib karena Google selalu melakukan redirect internal
    let options = { 
        method: 'GET', 
        redirect: 'follow',
        mode: 'cors'
    };

    if (payload) {
        options.method = 'POST';
        /**
         * KUNCI PERBAIKAN CORS: 
         * Kita gunakan 'text/plain'. Kalau pakai 'application/json', browser bakal kirim 
         * request OPTIONS (Preflight) yang sering ditolak mentah-mentah sama Google.
         */
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        options.body = JSON.stringify(payload);
    }

    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const text = await response.text(); 
        let data;
        try {
            data = JSON.parse(text); 
        } catch(e) {
            /** * Kalau masuk sini, artinya GAS lo ngirim HTML Error (Backend Crash).
             * Browser nangkep ini sebagai CORS error karena halaman HTML Google nggak punya header CORS.
             */
            console.error("Respon bukan JSON (Kemungkinan GAS Error):", text);
            throw new Error("Gagal konek ke DB! Cek tab 'Executions' di Editor Apps Script untuk lihat error kodenya.");
        }
        
        if (!data.success) throw new Error(data.error || "Terjadi kesalahan pada server");
        return data;
    } catch (err) {
        console.error(`API Call Error (${action}) -> ${url}:`, err);
        
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            throw new Error("Koneksi ditolak Google! Pastikan di GAS lo fungsinya sudah di-Return pakai ContentService.createTextOutput.");
        }
        
        throw err;
    }
}

window.hashPassword = async (password) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

window.toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
};

function updateThemeIcon(isDark) {
    const icon = document.getElementById('themeIcon');
    if(icon) icon.className = isDark ? 'ph ph-sun text-xl' : 'ph ph-moon text-xl';
}

if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
} else {
    updateThemeIcon(false);
}

window.appState = {
    user: null, products: [], orders: [], coupons: [], templates: [], usersData: [], isSidebarOpen: false,
    settings: {
        banks: [],
        notifications: { waProvider: 'fonnte', waToken: '', adminWa: '', emailProvider: 'google', emailToken: '', telegramToken: '', telegramChatId: '' },
        waFloatingActive: false,
        waFloatingNum: ''
    },
    currentCheckoutProduct: null, currentCheckoutUniqueCode: 0, currentCheckoutCoupon: null
};

window.formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

// HELPER: Generate Random Short ID (6 Characters)
window.generateShortId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// HELPER: Auto Format WA (Mencegah Angka 0 Hilang di Google Sheets)
window.formatPhoneNumber = (number) => {
    if (!number) return '';
    let cleaned = String(number).replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
};

// HELPER: Kompresi Gambar ke Base64 agar muat di Google Sheets (Max 50k karakter)
window.compressImage = (file, maxWidth = 400) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round((maxWidth / w) * h);
                    w = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                // Menggunakan JPEG dengan kualitas 70% agar teks Base64 sangat ringan
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
    });
};

// --- SAFE EVENT LISTENERS SETUP ---
function initAppEvents() {
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', handleLogin);

    const rf = document.getElementById('registerForm');
    if (rf) rf.addEventListener('submit', handleRegister);

    const ff = document.getElementById('forgotForm');
    if (ff) ff.addEventListener('submit', handleForgot);

    const cpf = document.getElementById('changePasswordForm');
    if (cpf) cpf.addEventListener('submit', handleChangePassword);

    const mmBtn = document.getElementById('mobileMenuBtn');
    if (mmBtn) mmBtn.addEventListener('click', toggleMobileMenu);

    const sc = document.getElementById('settingColor');
    if (sc) {
        sc.addEventListener('input', (e) => {
            const sct = document.getElementById('settingColorText');
            if (sct) sct.value = e.target.value;
        });
    }

    // TRIGGER PEMBERSIHAN INPUT GAMBAR JIKA MENGISI URL MANUAL
    const settingLogoUrl = document.getElementById('settingLogoUrl');
    const settingLogoFile = document.getElementById('settingLogoFile');
    if (settingLogoUrl && settingLogoFile) {
        settingLogoUrl.addEventListener('input', () => {
            settingLogoFile.value = ''; // Kosongkan file upload jika ngetik manual
        });
    }

    const prodImageUrl = document.getElementById('prodImageUrl');
    const prodImageFile = document.getElementById('prodImageFile');
    if (prodImageUrl && prodImageFile) {
        prodImageUrl.addEventListener('input', () => {
            prodImageFile.value = ''; // Kosongkan file upload jika ngetik manual
        });
    }

    initializeAppState();
}

// Mengecek apakah HTML sudah siap. Jika sudah siap, langsung jalankan. Jika belum, tunggu sampai siap.
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initAppEvents);
} else {
    initAppEvents();
}

async function initializeAppState() {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutId = urlParams.get('checkout');
    const refId = urlParams.get('ref'); 
    
    if(refId) localStorage.setItem('affiliateRef', refId);
    
    const savedUser = localStorage.getItem('iMersUser');
    if(savedUser) {
        window.appState.user = JSON.parse(savedUser);
    }

    if (checkoutId) {
        document.getElementById('view-auth').classList.add('hidden');
        document.getElementById('view-app').classList.add('hidden');
        document.getElementById('view-checkout').classList.remove('hidden');
        
        if(window.appState.user) {
            const coGuestState = document.getElementById('coGuestState');
            const coAuthFields = document.getElementById('coAuthFields');
            const coLoggedInState = document.getElementById('coLoggedInState');
            const coLoggedInName = document.getElementById('coLoggedInName');
            
            if (coGuestState) coGuestState.classList.add('hidden');
            if (coAuthFields) coAuthFields.classList.add('hidden');
            if (coLoggedInState) coLoggedInState.classList.remove('hidden');
            if (coLoggedInName) coLoggedInName.innerText = window.appState.user.name;
            
            const coName = document.getElementById('coName');
            if(coName) coName.value = window.appState.user.name;
            const coEmail = document.getElementById('coEmail');
            if(coEmail) coEmail.value = window.appState.user.email;
            const coWa = document.getElementById('coWA');
            if(coWa) coWa.value = window.appState.user.wa || '';
            const coPwd = document.getElementById('coPassword');
            if(coPwd) coPwd.value = 'dummy_pwd'; 
        } else {
            const helper = document.getElementById('coLoginHelper');
            if (helper) helper.classList.remove('hidden');
        }

        await loadCheckoutProduct(checkoutId);
    } else {
        if(window.appState.user) {
            document.getElementById('view-auth').classList.add('hidden');
            document.getElementById('view-checkout').classList.add('hidden');
            document.getElementById('view-app').classList.remove('hidden');
            
            setupUserUI();
            await loadAllData();
            window.navigate('dashboard');
            initChart();
        } else {
            try {
                const setRes = await apiCall('getSettings');
                if(setRes && setRes.data) {
                    window.appState.settings = setRes.data;
                    applySettingsUI();
                }
            } catch(e){}
        }
    }
}

function setupUserUI() {
    const user = window.appState.user;
    const userDisplayNameEl = document.getElementById('userDisplayName');
    if (userDisplayNameEl) userDisplayNameEl.innerText = user.name;
    
    const userRoleDisplayEl = document.getElementById('userRoleDisplay');
    if (userRoleDisplayEl) userRoleDisplayEl.innerText = user.role;
    
    const userLicenseCodeEl = document.getElementById('userLicenseCode');
    if (userLicenseCodeEl) userLicenseCodeEl.innerText = user.license || 'TIDAK-ADA-LISENSI';
    
    if (user.role === 'user') {
        document.querySelectorAll('[data-target="products"], [data-target="orders"], [data-target="coupons"], [data-target="users"], [data-target="broadcast"], [data-target="templates"], [data-target="settings"]').forEach(el => el.classList.add('hidden'));
    }

    // --- FITUR BARU: SEMBUNYIKAN OMSET & CHART JIKA BUKAN ADMIN ---
    if (user.role !== 'admin') {
        const revenueCard = document.getElementById('statRevenue')?.closest('.glass');
        if (revenueCard) revenueCard.classList.add('hidden');
        
        const ordersCard = document.getElementById('statOrders')?.closest('.glass');
        if (ordersCard) ordersCard.classList.add('hidden');
        
        const chartCard = document.getElementById('salesChart')?.closest('.glass');
        if (chartCard) chartCard.classList.add('hidden');

        // Agency & User harus bisa akses menu Kupon
        if (user.role === 'agency' || user.role === 'user') {
            document.querySelectorAll('[data-target="coupons"]').forEach(el => el.classList.remove('hidden'));
        }
    }

    if(!user.affiliateCode) {
        user.affiliateCode = user.name.replace(/\s+/g, '').toUpperCase().substring(0, 5) + Math.floor(Math.random()*1000);
    }
}

async function loadAllData() {
    try {
        showToast("Memuat data dari server...", "info");
        
        const safeCall = async (action) => {
            try { return await apiCall(action); } 
            catch(e) { 
                console.warn(action + ' failed:', e); 
                showToast(`Gagal memuat ${action}: ` + e.message, "error"); 
                return {data: []}; 
            }
        };

        const [prodRes, orderRes, coupRes, tmplRes, userRes, setRes] = await Promise.all([
            apiCall('getProducts'),
            apiCall('getOrders'),
            apiCall('getCoupons'),
            apiCall('getTemplates'),
            apiCall('getUsers'),
            apiCall('getSettings')
        ]);
        
        window.appState.products = prodRes.data || [];
        window.appState.orders = orderRes.data || [];
        window.appState.coupons = coupRes.data || [];
        window.appState.templates = tmplRes.data || [];
        window.appState.usersData = userRes.data || [];
        if (setRes.data && !Array.isArray(setRes.data)) {
            window.appState.settings = setRes.data;
        }

        if(window.appState.products.length) window.appState.products.sort((a,b) => b.createdAt - a.createdAt);
        if(window.appState.orders.length) window.appState.orders.sort((a,b) => b.createdAt - a.createdAt);
        if(window.appState.coupons.length) window.appState.coupons.sort((a,b) => b.createdAt - a.createdAt);
        if(window.appState.templates.length) window.appState.templates.sort((a,b) => a.createdAt - b.createdAt);
        
        const statProductsEl = document.getElementById('statProducts');
        if (statProductsEl) statProductsEl.innerText = window.appState.products.length;
        
        const statUsersEl = document.getElementById('statUsers');
        if (statUsersEl) statUsersEl.innerText = window.appState.usersData.length;
        
        let totalRevenue = 0;
        let activeOrdersCount = 0;
        window.appState.orders.forEach(o => {
            if (o.status === 'Paid') {
                totalRevenue += Number(o.totalPay || o.basePrice || 0);
                activeOrdersCount++;
            }
        });

        const statOrdersEl = document.getElementById('statOrders');
        if (statOrdersEl) statOrdersEl.innerText = activeOrdersCount;

        const statRevenueEl = document.getElementById('statRevenue');
        if (statRevenueEl) {
            statRevenueEl.innerText = window.formatRp(totalRevenue);
        }
        
        applySettingsUI();
        renderProductsTable();
        renderMarketplaceList();
        renderOrdersTable();
        renderCouponsTable();
        renderTemplatesTable();
        renderSettingsBankList();
        renderUsersTable();
        renderAffiliateList();

        if (window.appState.user && window.appState.user.role !== 'admin') {
            const btnAdd = document.getElementById('btnAddUser');
            if(btnAdd) btnAdd.classList.add('hidden');
        }

        const recContainer = document.getElementById('recentOrdersList');
        if (recContainer) {
            recContainer.innerHTML = '';
            const recents = window.appState.orders.slice(0, 5);
            if(recents.length === 0) recContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Belum ada order</p>';
            recents.forEach(o => {
                const statusClass = o.status === 'Paid' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600';
                recContainer.innerHTML += `
                    <div class="flex items-center gap-4 bg-white/30 dark:bg-slate-800/30 p-3 rounded-xl border border-white/40 dark:border-slate-700/50">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${o.status === 'Paid'?'from-emerald-400 to-teal-500':'from-amber-400 to-orange-500'} flex items-center justify-center text-white shadow-sm"><i class="ph ph-shopping-bag text-xl"></i></div>
                        <div class="flex-1">
                            <p class="text-sm font-bold text-slate-800 dark:text-white truncate">${o.productTitle}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">${o.customerName}</p>
                        </div>
                        <span class="px-2.5 py-1 ${statusClass} text-[10px] font-black uppercase rounded-lg">${o.status}</span>
                    </div>
                `;
            });
        }
        
        showToast("Data berhasil dimuat!", "success");
    } catch (err) {
        console.error("Gagal memuat sebagian data:", err);
        showToast("Sebagian data gagal dimuat dari server.", "error");
    }
}

/**
 * =========================================================================
 * SETTINGS & LIVE CHAT UI BINDING (FIXED PERSISTENCE)
 * =========================================================================
 */
function applySettingsUI() {
    const set = window.appState.settings;
    if(set.primaryColor) {
        document.documentElement.style.setProperty('--brand-color', set.primaryColor);
        document.documentElement.style.setProperty('--brand-hover', set.primaryColor);
    }
    if(set.appName) {
        document.querySelectorAll('.app-name-display').forEach(el => el.innerText = set.appName);
    }
    applyLogo(set.logoUrl);
    
    const settingAppNameEl = document.getElementById('settingAppName');
    if (settingAppNameEl) settingAppNameEl.value = set.appName || 'iMersFireship';
    
    const settingColorEl = document.getElementById('settingColor');
    if (settingColorEl) settingColorEl.value = set.primaryColor || '#4f46e5';
    
    const settingColorTextEl = document.getElementById('settingColorText');
    if (settingColorTextEl) settingColorTextEl.value = set.primaryColor || '#4f46e5';
    
    const settingLogoUrlEl = document.getElementById('settingLogoUrl');
    if (settingLogoUrlEl) settingLogoUrlEl.value = set.logoUrl || '';

    if (set.notifications) {
        const notifWaProviderEl = document.getElementById('notifWaProvider');
        if (notifWaProviderEl) notifWaProviderEl.value = set.notifications.waProvider || 'fonnte';
        
        const notifWaTokenEl = document.getElementById('notifWaToken');
        if (notifWaTokenEl) notifWaTokenEl.value = set.notifications.waToken || '';
        
        const notifAdminWaEl = document.getElementById('notifAdminWa');
        if (notifAdminWaEl) notifAdminWaEl.value = set.notifications.adminWa || '';
    }

    // Setup WA Floating Button dari Database (SINKRONISASI DATABASE)
    const floatingCheckbox = document.getElementById('settingWaFloatingActive');
    if (floatingCheckbox) floatingCheckbox.checked = (set.waFloatingActive === true || set.waFloatingActive === 'true');

    const floatingNum = document.getElementById('settingWaFloatingNum');
    if (floatingNum) floatingNum.value = set.waFloatingNum || '';

    const waBtn = document.getElementById('floatingWaBtn');
    if (waBtn) {
        const isActive = (set.waFloatingActive === true || set.waFloatingActive === 'true');
        if (isActive && set.waFloatingNum) {
            let cleanWa = window.formatPhoneNumber(set.waFloatingNum);
            waBtn.href = `https://wa.me/${cleanWa}?text=Halo%20Admin,%20saya%20ingin%20bertanya%20tentang%20produk%20Anda...`;
            waBtn.classList.remove('hidden');
        } else {
            waBtn.classList.add('hidden');
        }
    }
}

// --- AUTH LOGIC ---
window.switchAuthView = (view) => {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    const ff = document.getElementById('forgotForm');
    const subtitle = document.getElementById('authSubtitle');

    if (lf) lf.classList.add('hidden');
    if (rf) rf.classList.add('hidden');
    if (ff) ff.classList.add('hidden');

    if (view === 'login') {
        if (lf) lf.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Admin & User Login";
    } else if (view === 'register') {
        if (rf) rf.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Daftar Akun Baru";
    } else if (view === 'forgot') {
        if (ff) ff.classList.remove('hidden');
        if (subtitle) subtitle.innerText = "Pemulihan Akun";
    }
};

window.gotoLoginFromCheckout = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutId = urlParams.get('checkout');
    if(checkoutId) localStorage.setItem('checkoutIntent', checkoutId);
    
    document.getElementById('view-checkout').classList.add('hidden');
    document.getElementById('view-auth').classList.remove('hidden');
    switchAuthView('login');
};

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value;
    const rawPass = document.getElementById('loginPassword').value;

    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Memeriksa...';
    
    try {
        const hashedPass = await window.hashPassword(rawPass);
        const res = await apiCall('getUsers');
        const users = res.data || [];
        
        const user = users.find(u => u.email === email && (u.password === hashedPass || u.password === rawPass));

        if (user) {
            window.appState.user = user;
            localStorage.setItem('iMersUser', JSON.stringify(user)); 
            
            const checkoutIntent = localStorage.getItem('checkoutIntent');
            if (checkoutIntent) {
                localStorage.removeItem('checkoutIntent');
                window.location.href = '?checkout=' + checkoutIntent;
                return;
            }
            
            document.getElementById('view-auth').classList.add('hidden');
            document.getElementById('view-app').classList.remove('hidden');
            
            setupUserUI();
            showToast("Login Berhasil! Selamat datang " + user.name);
            
            await loadAllData();
            window.navigate('dashboard');
            initChart();
        } else {
            showToast("Email atau password salah.", "error");
        }
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        btn.innerHTML = '<span>Sign In</span> <i class="ph ph-sign-in"></i>';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const rawWa = document.getElementById('regWa').value;
    const wa = window.formatPhoneNumber(rawWa); // KUNCI PERBAIKAN WA
    const rawPass = document.getElementById('regPassword').value;

    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Memproses...';
    
    try {
        const hashedPass = await window.hashPassword(rawPass);
        const payload = { name, email, wa, password: hashedPass, role: 'user', license: 'USER-BASIC-'+Math.floor(Math.random()*999) };
        
        await apiCall('register', payload);
        
        showToast("Registrasi berhasil! Silakan periksa WA/Email Anda.", "success");
        document.getElementById('registerForm').reset();
        switchAuthView('login');
    } catch(err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.innerHTML = '<span>Daftar Sekarang</span> <i class="ph ph-user-plus"></i>';
    }
}

async function handleForgot(e) {
    e.preventDefault();
    const btn = document.getElementById('forgotBtn');
    const email = document.getElementById('forgotEmail').value;

    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Memproses...';

    try {
        await apiCall('forgotPassword', {email});
        showToast("Instruksi reset password telah dikirim ke Email/WA Anda.", "success");
        document.getElementById('forgotForm').reset();
        switchAuthView('login');
    } catch(err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.innerHTML = '<span>Kirim Reset Link</span> <i class="ph ph-paper-plane-tilt"></i>';
    }
}

async function handleChangePassword(e) {
    if(e) e.preventDefault();
    const oldPass = document.getElementById('cpOldPass').value;
    const newPass = document.getElementById('cpNewPass').value;
    const confirmPass = document.getElementById('cpConfirmPass').value;
    const btn = document.getElementById('cpBtn');

    if (newPass !== confirmPass) {
        showToast("Konfirmasi password baru tidak cocok!", "error");
        return;
    }

    btn.innerHTML = '<i class="ph ph-spinner animate-spin text-xl"></i> Memproses...';

    try {
        const oldHash = await window.hashPassword(oldPass);
        const newHash = await window.hashPassword(newPass);

        const payload = {
            id: window.appState.user.id,
            oldPasswordHash: oldHash,
            newPasswordHash: newHash
        };

        await apiCall('changePassword', payload);
        
        showToast("Password berhasil diperbarui!", "success");
        document.getElementById('changePasswordForm').reset();
    } catch (err) {
        showToast("Error: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="ph ph-floppy-disk text-xl"></i> Simpan Password';
    }
}

window.logout = () => {
    window.appState.user = null;
    localStorage.removeItem('iMersUser'); 
    localStorage.removeItem('checkoutIntent');
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('view-app').classList.add('hidden');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('hidden'));
};

// --- NAVIGATION & UI LOGIC ---
window.navigate = (targetId) => {
    document.querySelectorAll('.nav-link').forEach(link => {
        if(link.dataset.target === targetId) {
            link.classList.add('bg-white/40', 'dark:bg-slate-800/40', 'active');
            link.classList.remove('bg-transparent');
        } else {
            link.classList.remove('bg-white/40', 'dark:bg-slate-800/40', 'active');
            link.classList.add('bg-transparent');
        }
    });

    const titles = {
        'dashboard': 'Dashboard Overview',
        'products': 'Product Management',
        'marketplace': 'Digital Marketplace',
        'license': 'License Management',
        'orders': 'Order Management',
        'coupons': 'Kupon & Diskon',
        'users': 'Users Directory',
        'affiliate': 'Affiliate Center',
        'templates': 'Notification Templates',
        'broadcast': 'Marketing Broadcast',
        'settings': 'Admin Settings',
        'profile': 'My Profile'
    };
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) pageTitleEl.innerText = titles[targetId] || 'Panel';

    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
    const targetEl = document.getElementById('content-' + targetId);
    if (targetEl) targetEl.classList.remove('hidden');

    if(window.innerWidth < 768 && window.appState.isSidebarOpen) {
        toggleMobileMenu();
    }
};

window.toggleMobileMenu = () => {
    window.appState.isSidebarOpen = !window.appState.isSidebarOpen;
    const sidebar = document.getElementById('sidebar');
    if(window.appState.isSidebarOpen) {
        if(sidebar) sidebar.classList.remove('-translate-x-full');
    } else {
        if(sidebar) sidebar.classList.add('-translate-x-full');
    }
};

async function simulateBroadcast(e) {
    if(e) e.preventDefault();
    const target = document.getElementById('bcTarget').value;
    const msg = document.getElementById('bcMessage').value;
    if(!msg) return;

    showToast("Memproses Broadcast...", "info");
    
    // Disable button dan tampilkan loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-xl"></i> Mengirim...';
    }

    try {
        const payload = {
            target: target,
            message: msg
        };
        
        // Memanggil API Broadcast di backend (Code.gs)
        await apiCall('sendBroadcast', payload);
        
        showToast("Berhasil mengirim notifikasi massal!", "success");
        document.getElementById('bcMessage').value = '';
    } catch(err) {
        showToast("Error memproses broadcast: " + err.message, "error");
    } finally {
        // Kembalikan tombol seperti semula
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="ph ph-paper-plane-tilt text-xl"></i> Kirim Broadcast Sekarang';
        }
    }
}

window.copyLicenseCode = () => {
    const code = document.getElementById('userLicenseCode').innerText;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showToast("Kode Lisensi berhasil disalin!");
        }).catch(err => {
            console.error("Gagal menyalin: ", err);
        });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        showToast("Kode Lisensi berhasil disalin!");
    }
};

// --- USERS CRUD LOGIC ---
window.renderUsersTable = () => {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(window.appState.usersData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500 font-bold">Belum ada user.</td></tr>`;
        return;
    }

    window.appState.usersData.forEach(u => {
        const roleColors = {
            admin: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
            agency: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
            user: 'bg-slate-500/20 text-slate-700 dark:text-slate-400'
        };
        const roleClass = roleColors[u.role] || roleColors['user'];

        // --- DETAIL REKENING AFFILIATE UNTUK ADMIN ---
        let bankInfo = '<span class="text-slate-400 italic text-xs">Belum diatur</span>';
        if(u.bankName || u.bankNo) {
            bankInfo = `<div class="bg-brand/5 p-2 rounded-lg border border-brand/10">
                <p class="text-[11px] font-black text-brand uppercase">${u.bankName || '???'}</p>
                <p class="text-xs font-mono font-bold text-slate-700 dark:text-white">${u.bankNo || '???'}</p>
                <p class="text-[10px] text-slate-500 italic">a.n ${u.bankOwner || '???'}</p>
            </div>`;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-800 dark:text-white text-base">${u.name}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">${u.email}</p>
                </td>
                <td class="px-6 py-4">${bankInfo}</td>
                <td class="px-6 py-4">
                    <span class="${roleClass} px-3 py-1 rounded-lg text-xs font-black uppercase">${u.role}</span>
                </td>
                <td class="px-6 py-4 font-mono text-xs text-brand font-bold">${u.affiliateCode || u.license || '-'}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="editUser('${u.id}')" class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors" title="Edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                    <button onclick="deleteUser('${u.id}')" class="p-2 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors" title="Delete"><i class="ph ph-trash text-xl"></i></button>
                </td>
            </tr>
        `;
    });
};

window.openUserModal = () => {
    const form = document.getElementById('userForm');
    if(form) form.reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').innerText = 'Tambah User Baru';
    document.getElementById('userPasswordContainer').classList.remove('hidden');
    document.getElementById('userPassword').required = true;
    document.getElementById('userModal').classList.remove('hidden');
};

window.closeUserModal = () => {
    const modal = document.getElementById('userModal');
    if(modal) modal.classList.add('hidden');
};

window.saveUser = async () => {
    let id = document.getElementById('userId').value;
    if (!id) id = window.generateShortId();
    
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const rawWa = document.getElementById('userWa').value;
    const wa = window.formatPhoneNumber(rawWa); // KUNCI PERBAIKAN WA
    const role = document.getElementById('userRole').value;
    const rawPass = document.getElementById('userPassword').value;

    if(!name || !email) {
        showToast("Nama dan Email wajib diisi", "error");
        return;
    }

    let payload = { id, name, email, wa, role };

    if (document.getElementById('userId').value) {
        if (rawPass) {
            payload.password = await window.hashPassword(rawPass);
        }
    } else {
        if (!rawPass) {
            showToast("Password wajib diisi untuk user baru", "error");
            return;
        }
        payload.password = await window.hashPassword(rawPass);
        payload.license = role.toUpperCase() + '-' + Math.floor(Math.random() * 9999);
        payload.affiliateCode = name.replace(/\s+/g, '').toUpperCase().substring(0, 5) + Math.floor(Math.random()*1000);
    }

    try {
        await apiCall('saveUser', payload);
        showToast("Data user berhasil disimpan!");
        await loadAllData();
        closeUserModal();
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.editUser = (id) => {
    const u = window.appState.usersData.find(x => x.id === id);
    if(!u) return;
    document.getElementById('userModalTitle').innerText = 'Edit User';
    document.getElementById('userId').value = u.id;
    document.getElementById('userName').value = u.name;
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userWa').value = u.wa || '';
    document.getElementById('userRole').value = u.role || 'user';
    
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').required = false;
    
    document.getElementById('userModal').classList.remove('hidden');
};

window.deleteUser = async (id) => {
    if(confirm("Hapus user ini?")) {
        try {
            await apiCall('deleteUser', {id});
            showToast("User dihapus.");
            await loadAllData();
        } catch (e) {
            showToast(e.message, "error");
        }
    }
};

/**
 * =========================================================================
 * AFFILIATE SYSTEM LOGIC (DUAL LINKS - INTERNAL FIXED)
 * =========================================================================
 */
window.renderAffiliateList = () => {
    const container = document.getElementById('affiliateProductsList');
    const refCodeEl = document.getElementById('affiliateRefCode');
    if(!container || !window.appState.user) return;
    
    container.innerHTML = '';
    const user = window.appState.user;
    const refId = user.affiliateCode || user.id.substring(0, 8).toUpperCase();
    if(refCodeEl) refCodeEl.innerText = refId;

    let totalSales = 0;
    let totalCommission = 0;
    
    const affiliateOrders = window.appState.orders.filter(o => o.affiliateRef === refId && o.status === 'Paid');
    totalSales = affiliateOrders.length;
    
    affiliateOrders.forEach(o => {
        const prod = window.appState.products.find(p => p.id === o.productId);
        if(prod && prod.commissionValue) {
            if(prod.commissionType === 'percent') {
                totalCommission += (o.basePrice * (Number(prod.commissionValue) / 100));
            } else {
                totalCommission += Number(prod.commissionValue);
            }
        }
    });

    const tsEl = document.getElementById('affTotalSales');
    if(tsEl) tsEl.innerText = totalSales;
    const tcEl = document.getElementById('affTotalCommission');
    if(tcEl) tcEl.innerText = window.formatRp(totalCommission);
    
    if(user.bankName) {
        const bN = document.getElementById('affBankName');
        if(bN) bN.value = user.bankName;
    }
    if(user.bankNo) {
        const bNo = document.getElementById('affBankNo');
        if(bNo) bNo.value = user.bankNo;
    }
    if(user.bankOwner) {
        const bOw = document.getElementById('affBankOwner');
        if(bOw) bOw.value = user.bankOwner;
    }

    if(window.appState.products.length === 0) {
        container.innerHTML = `<p class="col-span-full text-slate-500 font-bold text-center py-10">Belum ada produk aktif.</p>`;
        return;
    }

    window.appState.products.forEach(p => {
        const currentPath = window.location.origin + window.location.pathname;
        
        // Link 1: Link Direct Checkout (Murni domain lo sendiri)
        const affCheckoutLink = `${currentPath}?checkout=${p.id}&ref=${refId}`;
        
        // Link 2: Link Salespage (Internal jika salesPageUrl kosong)
        let affSalespageLink = p.salesPageUrl ? 
            `${p.salesPageUrl}${p.salesPageUrl.includes('?') ? '&' : '?'}ref=${refId}` : 
            affCheckoutLink;

        let commInfo = p.commissionType === 'percent' ? `${p.commissionValue}%` : window.formatRp(p.commissionValue);

        container.innerHTML += `
            <div class="glass rounded-2xl p-5 border border-white/40 dark:border-slate-700/50 flex flex-col hover:shadow-xl transition-shadow">
                <h4 class="font-black text-slate-800 dark:text-white mb-2 text-lg truncate" title="${p.title}">${p.title}</h4>
                <div class="bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-lg mb-4 flex items-center justify-between">
                    <span class="text-xs font-bold text-orange-600 dark:text-orange-400">Komisi per Sale:</span>
                    <span class="text-sm font-black text-orange-600 dark:text-orange-400">${commInfo}</span>
                </div>
                <div class="mt-auto space-y-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Link Landing Page</label>
                        <div class="flex gap-2">
                            <input type="text" readonly value="${affSalespageLink}" class="flex-1 px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none">
                            <button onclick="copyTextToClipboard('${affSalespageLink}')" class="bg-slate-800 text-white p-2 rounded-xl"><i class="ph ph-copy"></i></button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-brand uppercase mb-1 ml-1">Link Checkout Langsung</label>
                        <div class="flex gap-2">
                            <input type="text" readonly value="${affCheckoutLink}" class="flex-1 px-3 py-2 bg-brand/5 border border-brand/20 rounded-xl text-[11px] font-bold text-brand outline-none">
                            <button onclick="copyTextToClipboard('${affCheckoutLink}')" class="bg-brand text-white p-2 rounded-xl shadow-lg shadow-brand/30 transition-transform active:scale-95">
                                <i class="ph ph-copy"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
};

window.saveUserBank = async (e) => {
    e.preventDefault();
    const bName = document.getElementById('affBankName').value;
    const bNo = document.getElementById('affBankNo').value;
    const bOwner = document.getElementById('affBankOwner').value;

    if(!window.appState.user) return;
    const payload = {
        id: window.appState.user.id,
        bankName: bName, bankNo: bNo, bankOwner: bOwner
    };

    try {
        await apiCall('saveUser', payload);
        window.appState.user.bankName = bName;
        window.appState.user.bankNo = bNo;
        window.appState.user.bankOwner = bOwner;
        localStorage.setItem('iMersUser', JSON.stringify(window.appState.user));
        showToast("Rekening pencairan berhasil disimpan!", "success");
    } catch(err) {
        showToast("Error saving bank: " + err.message, "error");
    }
};

window.copyTextToClipboard = (text) => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast("Link disalin!"));
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        showToast("Link disalin!");
    }
};

// --- NOTIFICATION TEMPLATES LOGIC ---
window.renderTemplatesTable = () => {
    const tbody = document.getElementById('templatesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(window.appState.templates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500 font-bold">Data template kosong.</td></tr>`;
        return;
    }

    window.appState.templates.forEach(t => {
        const isActiveEmail = t.isActiveEmail === true || t.isActiveEmail === 'true';
        const isActiveWA = t.isActiveWA === true || t.isActiveWA === 'true';

        const badgeEmail = isActiveEmail 
            ? `<span class="bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1"><i class="ph ph-check-circle"></i> On</span>`
            : `<span class="bg-slate-500/20 text-slate-700 dark:text-slate-400 px-3 py-1 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1"><i class="ph ph-minus-circle"></i> Off</span>`;
        
        const badgeWA = isActiveWA 
            ? `<span class="bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1"><i class="ph ph-check-circle"></i> On</span>`
            : `<span class="bg-slate-500/20 text-slate-700 dark:text-slate-400 px-3 py-1 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1"><i class="ph ph-minus-circle"></i> Off</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4">
                    <p class="font-black text-slate-800 dark:text-white text-sm mb-1">${t.title}</p>
                    <p class="font-mono text-xs text-brand font-bold uppercase tracking-wider">${t.type}</p>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 truncate max-w-[200px]">${t.subject}</td>
                <td class="px-6 py-4 text-center">${badgeEmail}</td>
                <td class="px-6 py-4 text-center">${badgeWA}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="editTemplate('${t.id}')" class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors" title="Edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                </td>
            </tr>
        `;
    });
};

window.editTemplate = (id) => {
    const template = window.appState.templates.find(t => t.id === id);
    if(!template) return;
    
    document.getElementById('tmplId').value = template.id;
    document.getElementById('tmplType').value = template.type;
    document.getElementById('tmplTitle').value = template.title;
    document.getElementById('tmplSubject').value = template.subject || '';
    document.getElementById('tmplEmailBody').value = template.messageEmail || '';
    document.getElementById('tmplWABody').value = template.messageWA || '';
    
    document.getElementById('tmplActiveEmail').checked = (template.isActiveEmail === true || template.isActiveEmail === 'true');
    document.getElementById('tmplActiveWA').checked = (template.isActiveWA === true || template.isActiveWA === 'true');
    
    const tModal = document.getElementById('templateModal');
    if (tModal) tModal.classList.remove('hidden');
};

window.closeTemplateModal = () => {
    const tModal = document.getElementById('templateModal');
    if (tModal) tModal.classList.add('hidden');
};

window.saveTemplate = async () => {
    let id = document.getElementById('tmplId').value;
    if (!id) id = window.generateShortId();
    
    const type = document.getElementById('tmplType').value;
    const title = document.getElementById('tmplTitle').value;
    const subject = document.getElementById('tmplSubject').value;
    const emailBody = document.getElementById('tmplEmailBody').value;
    const waBody = document.getElementById('tmplWABody').value;
    const activeEmail = document.getElementById('tmplActiveEmail').checked;
    const activeWA = document.getElementById('tmplActiveWA').checked;

    if(!title) {
        showToast("Judul Template wajib diisi", "error");
        return;
    }

    try {
        const payload = {
            id: id, type: type, title: title, subject: subject, messageEmail: emailBody, messageWA: waBody,
            isActiveEmail: activeEmail, isActiveWA: activeWA
        };
        
        await apiCall('saveTemplate', payload);
        showToast("Template Notifikasi diperbarui!");
        await loadAllData();
        closeTemplateModal();
    } catch (e) {
        showToast("Error: " + e.message, "error");
    }
};

// --- PRODUCT CRUD LOGIC ---

window.renderProductsTable = () => {
    const tbody = document.getElementById('productsTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    if(window.appState.products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-10 text-center text-slate-500 font-bold">No products found. Add one above.</td></tr>`;
        return;
    }

    window.appState.products.forEach(p => {
        const typeLabel = p.type === 'lms' 
            ? `<span class="bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-lg text-xs font-black uppercase"><i class="ph ph-video"></i> LMS Course</span>`
            : `<span class="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg text-xs font-black uppercase"><i class="ph ph-download-simple"></i> Download</span>`;
        
        const tr = document.createElement('tr');
        tr.className = "hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <p class="font-bold text-slate-800 dark:text-white text-base">${p.title}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 w-48 truncate font-medium mt-1" title="${p.description}">${p.description || ''}</p>
            </td>
            <td class="px-6 py-4">${typeLabel}</td>
            <td class="px-6 py-4 font-black text-brand dark:text-brandHover">${window.formatRp(p.price)}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-3">
                    <button onclick="editProduct('${p.id}')" class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors" title="Edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                    <button onclick="duplicateProduct('${p.id}')" class="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 rounded-xl transition-colors" title="Duplicate"><i class="ph ph-copy text-xl"></i></button>
                    <button onclick="deleteProduct('${p.id}')" class="p-2 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors" title="Delete"><i class="ph ph-trash text-xl"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.openProductModal = () => {
    const pf = document.getElementById('productForm');
    if (pf) pf.reset();
    document.getElementById('prodId').value = '';
    document.getElementById('productModalTitle').innerText = 'Add New Product';
    document.getElementById('checkoutLinkContainer').classList.add('hidden');
    
    document.getElementById('downloadsContainer').innerHTML = '';
    document.getElementById('lessonsContainer').innerHTML = '';
    window.addDownloadField(); 
    window.addLessonField();
    
    window.toggleProductFields();
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeProductModal = () => {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('hidden');
};

window.toggleProductFields = () => {
    const typeEl = document.getElementById('prodType');
    if (!typeEl) return;
    const type = typeEl.value;
    if(type === 'lms') {
        document.getElementById('fieldLMS').classList.remove('hidden');
        document.getElementById('fieldDownload').classList.add('hidden');
    } else {
        document.getElementById('fieldLMS').classList.add('hidden');
        document.getElementById('fieldDownload').classList.remove('hidden');
    }
};

window.addDownloadField = (title = '', url = '') => {
    const container = document.getElementById('downloadsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = "flex gap-3 items-center dl-item bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-white/40 dark:border-slate-700/50";
    div.innerHTML = `
        <div class="flex-1 space-y-3">
            <input type="text" placeholder="Nama Tombol (mis: Download Ebook)" value="${title}" class="dl-title w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg outline-none focus:border-brand font-bold dark:text-white">
            <input type="url" placeholder="URL Link (mis: https://drive.google.com/...)" value="${url}" class="dl-url w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg outline-none focus:border-brand dark:text-white">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-colors"><i class="ph ph-trash text-2xl"></i></button>
    `;
    container.appendChild(div);
};

window.addLessonField = (title = '', url = '') => {
    const container = document.getElementById('lessonsContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = "flex gap-3 items-center lesson-item bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-white/40 dark:border-slate-700/50";
    div.innerHTML = `
        <div class="flex-1 space-y-3">
            <input type="text" placeholder="Judul Materi (mis: Bab 1 Pendahuluan)" value="${title}" class="lesson-title w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg outline-none focus:border-brand font-bold dark:text-white">
            <input type="url" placeholder="YouTube URL (mis: https://www.youtube.com/watch?v=...)" value="${url}" class="lesson-url w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg outline-none focus:border-brand dark:text-white">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-colors"><i class="ph ph-trash text-2xl"></i></button>
    `;
    container.appendChild(div);
};

window.copyCheckoutLink = () => {
    const input = document.getElementById('prodCheckoutUrl');
    input.select();
    document.execCommand('copy');
    showToast("Checkout Link Berhasil Disalin!");
};

window.saveProduct = async () => {
    let id = document.getElementById('prodId').value;
    if (!id) id = window.generateShortId();
    
    const type = document.getElementById('prodType').value;
    const title = document.getElementById('prodTitle').value;
    const price = Number(document.getElementById('prodPrice').value);
    const desc = document.getElementById('prodDesc').value;
    const accessHtml = document.getElementById('prodAccess').value;
    const salesPageUrl = document.getElementById('prodSalesPage').value;
    const salesPageHtml = document.getElementById('prodSalesPageHtml').value;
    const commissionType = document.getElementById('prodCommType').value;
    const commissionValue = document.getElementById('prodCommValue').value;
    
    const prodImageUrlEl = document.getElementById('prodImageUrl');
    const prodImageFileEl = document.getElementById('prodImageFile');

    let finalImageUrl = prodImageUrlEl.value;
    if (prodImageFileEl.files && prodImageFileEl.files[0]) {
        // Menggunakan kompresi saat upload gambar produk (Max 600px)
        finalImageUrl = await window.compressImage(prodImageFileEl.files[0], 600);
        prodImageFileEl.value = ''; // KUNCI PERBAIKAN: Bersihkan input file
        prodImageUrlEl.value = finalImageUrl;
    }
    
    if(!title || !price) {
        showToast("Title and Price are required", "error");
        return;
    }

    let data = { id, type, title, price, description: desc, accessHtml, salesPageUrl, salesPageHtml, commissionType, commissionValue, imageUrl: finalImageUrl };

    if (type === 'download') {
        let files = [];
        document.querySelectorAll('.dl-item').forEach(el => {
            const lTitle = el.querySelector('.dl-title').value;
            const lUrl = el.querySelector('.dl-url').value;
            if(lTitle || lUrl) files.push({ title: lTitle, url: lUrl });
        });
        data.files = files;
    } else {
        let lessons = [];
        document.querySelectorAll('.lesson-item').forEach(el => {
            const lTitle = el.querySelector('.lesson-title').value;
            const lUrl = el.querySelector('.lesson-url').value;
            if(lTitle || lUrl) lessons.push({ title: lTitle, url: lUrl });
        });
        data.lessons = lessons;
    }

    try {
        await apiCall('saveProduct', data);
        showToast("Product saved!");
        await loadAllData();
        window.closeProductModal();
    } catch (error) {
        showToast("Error saving product: " + error.message, "error");
    }
};

window.editProduct = (id) => {
    const product = window.appState.products.find(p => p.id === id);
    if(!product) return;

    document.getElementById('productModalTitle').innerText = 'Edit Product';
    document.getElementById('prodId').value = product.id;
    document.getElementById('prodTitle').value = product.title;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodType').value = product.type;
    document.getElementById('prodDesc').value = product.description || '';
    document.getElementById('prodAccess').value = product.accessHtml || '';
    
    document.getElementById('prodSalesPage').value = product.salesPageUrl || '';
    document.getElementById('prodSalesPageHtml').value = product.salesPageHtml || '';
    document.getElementById('prodCommType').value = product.commissionType || 'percent';
    document.getElementById('prodCommValue').value = product.commissionValue || '';
    
    document.getElementById('prodImageUrl').value = product.imageUrl || '';
    document.getElementById('prodImageFile').value = '';
    
    document.getElementById('downloadsContainer').innerHTML = '';
    document.getElementById('lessonsContainer').innerHTML = '';

    if (product.type === 'download') {
        if(product.files && product.files.length > 0) {
            product.files.forEach(f => window.addDownloadField(f.title, f.url));
        } else { window.addDownloadField(); }
    } else {
        if(product.lessons && product.lessons.length > 0) {
            product.lessons.forEach(l => window.addLessonField(l.title, l.url));
        } else { window.addLessonField(); }
    }
    
    window.toggleProductFields();

    const checkoutUrl = window.location.origin + window.location.pathname + "?checkout=" + product.id;
    document.getElementById('prodCheckoutUrl').value = checkoutUrl;
    document.getElementById('checkoutLinkContainer').classList.remove('hidden');

    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('hidden');
};

window.deleteProduct = async (id) => {
    if(confirm("Are you sure you want to delete this product?")) {
        try {
            await apiCall('deleteProduct', {id: id});
            showToast("Product deleted");
            await loadAllData();
        } catch(err) {
            showToast("Error deleting: " + err.message, "error");
        }
    }
};

window.duplicateProduct = async (id) => {
    const product = window.appState.products.find(p => p.id === id);
    if(!product) return;
    
    const newData = JSON.parse(JSON.stringify(product));
    newData.id = window.generateShortId();
    newData.title = newData.title + " (Copy)";

    try {
        await apiCall('saveProduct', newData);
        showToast("Produk berhasil di-copy!");
        await loadAllData();
    } catch(err) {
        showToast("Error duplicating: " + err.message, "error");
    }
};

// --- COUPONS CRUD LOGIC ---

window.renderCouponsTable = () => {
    const tbody = document.getElementById('couponsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // --- FITUR BARU: FILTER TAMPILAN KUPON ---
    const isUserAdmin = window.appState.user.role === 'admin';
    const filteredCoupons = isUserAdmin 
        ? window.appState.coupons 
        : window.appState.coupons.filter(c => c.createdBy === window.appState.user.id);

    if(filteredCoupons.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-500 font-bold">Belum ada kupon. Buat kupon pertama Anda.</td></tr>`;
        return;
    }

    filteredCoupons.forEach(c => {
        const typeLabel = c.type === 'percent' ? 'Persentase (%)' : 'Nominal (Rp)';
        const valueLabel = c.type === 'percent' ? `${c.value}%` : window.formatRp(c.value);
        
        let applicableLabel = '<span class="bg-blue-500/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-lg text-xs font-black uppercase">Semua Produk</span>';
        if (c.applicableProductId && c.applicableProductId !== 'all') {
            const prod = window.appState.products.find(p => p.id === c.applicableProductId);
            applicableLabel = prod 
                ? `<span class="bg-slate-500/20 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg text-xs font-bold border border-white/20 dark:border-slate-700" title="${prod.title}">${prod.title.substring(0, 20)}${prod.title.length > 20 ? '...' : ''}</span>` 
                : '<span class="text-red-500 text-xs font-black uppercase">Produk Dihapus</span>';
        }

        tbody.innerHTML += `
            <tr class="hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 font-mono font-black text-brand dark:text-brandHover text-base">${c.code}</td>
                <td class="px-6 py-4 font-medium">${typeLabel}</td>
                <td class="px-6 py-4 font-black">${valueLabel}</td>
                <td class="px-6 py-4">${applicableLabel}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="editCoupon('${c.id}')" class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl transition-colors" title="Edit"><i class="ph ph-pencil-simple text-xl"></i></button>
                    <button onclick="deleteCoupon('${c.id}')" class="p-2 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors" title="Delete"><i class="ph ph-trash text-xl"></i></button>
                </td>
            </tr>
        `;
    });
};

window.populateCouponProductSelect = (selectedId = 'all') => {
    const select = document.getElementById('couponProductId');
    if(!select) return;
    select.innerHTML = '<option value="all">Semua Produk</option>';
    window.appState.products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.innerText = p.title;
        if (p.id === selectedId) option.selected = true;
        select.appendChild(option);
    });
};

window.openCouponModal = () => {
    const f = document.getElementById('couponForm');
    if(f) f.reset();
    document.getElementById('couponId').value = '';
    document.getElementById('couponModalTitle').innerText = 'Tambah Kupon';
    window.populateCouponProductSelect('all');

    // --- FITUR BARU: LOGIKA KUPON MASTER ---
    const masterSelectContainer = document.getElementById('masterCouponContainer');
    if (window.appState.user.role !== 'admin') {
        // Tampilkan pilihan master kupon jika bukan admin
        if (!masterSelectContainer) {
            const container = document.createElement('div');
            container.id = 'masterCouponContainer';
            container.className = 'mb-4';
            container.innerHTML = `
                <label class="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">Pilih Master Kupon Admin</label>
                <select id="masterCouponId" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-brand font-bold dark:text-white transition-all">
                    <option value="">-- Pilih Kupon Admin --</option>
                </select>
                <p class="text-[10px] text-slate-400 mt-1 italic">*Diskon akan mengikuti Master Kupon yang dipilih.</p>
            `;
            // Sisipkan sebelum baris Tipe Kupon
            const couponTypeEl = document.getElementById('couponType').parentElement;
            couponTypeEl.parentNode.insertBefore(container, couponTypeEl);
        }
        
        const mSelect = document.getElementById('masterCouponId');
        mSelect.innerHTML = '<option value="">-- Pilih Kupon Admin --</option>';
        window.appState.coupons.filter(c => c.createdBy === 'admin' || !c.createdBy).forEach(mc => {
            mSelect.innerHTML += `<option value="${mc.id}">${mc.code} (${mc.type === 'percent' ? mc.value+'%' : window.formatRp(mc.value)})</option>`;
        });

        // Kunci input Tipe & Nilai jika bukan admin karena harus ikut master
        document.getElementById('couponType').disabled = true;
        document.getElementById('couponValue').disabled = true;
        
        mSelect.onchange = (e) => {
            const selectedMaster = window.appState.coupons.find(c => c.id === e.target.value);
            if (selectedMaster) {
                document.getElementById('couponType').value = selectedMaster.type;
                document.getElementById('couponValue').value = selectedMaster.value;
                document.getElementById('couponProductId').value = selectedMaster.applicableProductId || 'all';
            }
        };
    } else {
        if (masterSelectContainer) masterSelectContainer.remove();
        document.getElementById('couponType').disabled = false;
        document.getElementById('couponValue').disabled = false;
    }

    const cModal = document.getElementById('couponModal');
    if(cModal) cModal.classList.remove('hidden');
};

window.closeCouponModal = () => {
    const cModal = document.getElementById('couponModal');
    if(cModal) cModal.classList.add('hidden');
};

window.saveCoupon = async () => {
    let id = document.getElementById('couponId').value;
    if (!id) id = window.generateShortId();
    
    const code = document.getElementById('couponCode').value.toUpperCase().trim();
    const type = document.getElementById('couponType').value;
    const value = Number(document.getElementById('couponValue').value);
    const applicableProductId = document.getElementById('couponProductId').value;
    
    // --- FITUR BARU: SIMPAN SIAPA YANG BUAT ---
    const createdBy = window.appState.user.id;
    const role = window.appState.user.role;

    if(!code || !value) {
        showToast("Kode dan Nilai harus diisi", "error");
        return;
    }

    let data = { id, code, type, value, applicableProductId, createdBy, creatorRole: role };

    try {
        await apiCall('saveCoupon', data);
        showToast("Kupon tersimpan!");
        await loadAllData();
        window.closeCouponModal();
    } catch (e) {
        showToast("Error: " + e.message, "error");
    }
};

window.editCoupon = (id) => {
    const coupon = window.appState.coupons.find(c => c.id === id);
    if(!coupon) return;
    document.getElementById('couponModalTitle').innerText = 'Edit Kupon';
    document.getElementById('couponId').value = coupon.id;
    document.getElementById('couponCode').value = coupon.code;
    document.getElementById('couponType').value = coupon.type;
    document.getElementById('couponValue').value = coupon.value;
    window.populateCouponProductSelect(coupon.applicableProductId || 'all');
    const cModal = document.getElementById('couponModal');
    if(cModal) cModal.classList.remove('hidden');
};

window.deleteCoupon = async (id) => {
    if(confirm("Hapus kupon ini?")) {
        await apiCall('deleteCoupon', {id});
        showToast("Kupon dihapus.");
        await loadAllData();
    }
};

// --- MARKETPLACE LOGIC ---

function getYTVideoId(url) {
    if(!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

window.renderMarketplaceList = () => {
    const container = document.getElementById('marketplaceList');
    if(!container) return;
    
    container.innerHTML = '';
    const products = window.appState.products;

    if(products.length === 0) {
        container.innerHTML = `<p class="col-span-full text-slate-500 font-bold text-center py-10">Belum ada produk.</p>`;
        return;
    }
    
    const myOrders = window.appState.user ? window.appState.orders.filter(o => o.customerEmail === window.appState.user.email && o.status === 'Paid') : [];

    products.forEach(course => {
        const isLms = course.type === 'lms';
        const icon = isLms ? 'ph-video' : 'ph-download-simple';
        const typeLabel = isLms ? 'COURSE' : 'DOWNLOAD';
        const colorFrom = isLms ? 'from-indigo-500' : 'from-emerald-500';
        const colorTo = isLms ? 'to-purple-600' : 'to-teal-600';
        
        const hasBought = myOrders.some(o => o.productId === course.id);
        
        let buttonHtml = '';
        if(hasBought) {
            buttonHtml = `
                <button onclick="openProductAccess('${course.id}')" class="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-500/30 flex justify-center items-center gap-2">
                    Akses Produk <i class="ph ph-lock-key-open"></i>
                </button>
            `;
        } else {
            const checkoutLink = "?checkout=" + course.id;
            buttonHtml = `
                <a href="${checkoutLink}" class="w-full py-3 bg-white/60 hover:bg-white dark:bg-slate-800/60 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold rounded-xl transition-all border border-white/50 dark:border-slate-600 shadow-sm flex justify-center items-center gap-2 block text-center">
                    Beli (${window.formatRp(course.price)}) <i class="ph ph-arrow-right"></i>
                </a>
            `;
        }
        
        let salesPageBtn = '';
        if (course.salesPageUrl) {
            salesPageBtn = `<a href="${course.salesPageUrl}" target="_blank" class="w-full py-2 mb-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 border border-blue-500/20"><i class="ph ph-storefront"></i> Lihat Info Lengkap</a>`;
        } else if (course.salesPageHtml && course.salesPageHtml.trim() !== '') {
            salesPageBtn = `<button onclick="openSalesPageModal('${course.id}')" class="w-full py-2 mb-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 border border-purple-500/20"><i class="ph ph-article"></i> Baca Salespage</button>`;
        }
        
        const imageHtml = course.imageUrl 
            ? `<img src="${course.imageUrl}" alt="${course.title}" class="w-full h-full object-cover">` 
            : `<div class="absolute inset-0 bg-black/10"></div>
               <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
               <i class="ph ${icon} text-6xl text-white/80 drop-shadow-md"></i>`;

        container.innerHTML += `
            <div class="glass rounded-3xl overflow-hidden shadow-lg transition-all border border-white/40 dark:border-slate-700/50 flex flex-col">
                <div class="h-40 bg-gradient-to-br ${colorFrom} ${colorTo} flex items-center justify-center relative overflow-hidden shrink-0">
                    ${imageHtml}
                </div>
                <div class="p-6 flex-1 flex flex-col bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm">
                    <span class="text-[10px] font-black ${isLms ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'} uppercase tracking-widest mb-2 block bg-white/50 dark:bg-slate-800/50 w-max px-2 py-1 rounded-md shadow-sm">${typeLabel}</span>
                    <h3 class="font-black text-slate-800 dark:text-white mb-2 text-lg leading-tight">${course.title}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 font-medium">${course.description || 'No description'}</p>
                    <div class="mt-auto">
                        ${salesPageBtn}
                        ${buttonHtml}
                    </div>
                </div>
            </div>
        `;
    });
};

window.openSalesPageModal = (id) => {
    const product = window.appState.products.find(p => p.id === id);
    if(!product) return;
    
    document.getElementById('spModalContent').innerHTML = product.salesPageHtml || '<p class="text-center py-10">Salespage tidak tersedia.</p>';
    
    const refId = localStorage.getItem('affiliateRef') || (window.appState.user ? (window.appState.user.affiliateCode || window.appState.user.id.substring(0,8).toUpperCase()) : null);
    let checkoutLink = "?checkout=" + product.id;
    if (refId) checkoutLink += "&ref=" + refId;
    
    document.getElementById('spModalBuyBtn').href = checkoutLink;
    document.getElementById('spModalBuyBtn').innerHTML = `Beli Sekarang (${window.formatRp(product.price)}) <i class="ph ph-arrow-right"></i>`;
    
    document.getElementById('salesPageModal').classList.remove('hidden');
};

window.closeSalesPageModal = () => {
    document.getElementById('salesPageModal').classList.add('hidden');
    document.getElementById('spModalContent').innerHTML = '';
};

window.openProductAccess = (id) => {
    const product = window.appState.products.find(p => p.id === id);
    if(!product) return;

    document.getElementById('marketplaceList').classList.add('hidden');
    const viewer = document.getElementById('productViewer');
    if(viewer) viewer.classList.remove('hidden');
    
    document.getElementById('pvTitle').innerText = product.title;

    const structuredArea = document.getElementById('pvStructuredArea');
    structuredArea.innerHTML = '';

    if (product.type === 'download' && product.files && product.files.length > 0) {
        let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">';
        product.files.forEach(f => {
            html += `
                <a href="${f.url}" target="_blank" class="flex items-center gap-4 bg-gradient-to-r from-emerald-500/10 to-teal-600/10 hover:from-emerald-500/20 hover:to-teal-600/20 text-emerald-700 dark:text-emerald-400 p-5 rounded-2xl border border-emerald-500/30 transition-all font-bold shadow-md hover:shadow-lg group">
                    <div class="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <i class="ph ph-download-simple text-2xl"></i>
                    </div>
                    <span class="flex-1 text-sm">${f.title || 'Download File'}</span>
                </a>`;
        });
        html += '</div>';
        structuredArea.innerHTML = html;
    } 
    else if (product.type === 'lms' && product.lessons && product.lessons.length > 0) {
        structuredArea.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-8">
                <div class="flex-1 bg-black rounded-3xl overflow-hidden aspect-video relative shadow-2xl border border-white/10">
                    <iframe id="pvYtPlayer" class="w-full h-full absolute inset-0" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
                <div class="w-full lg:w-80 shrink-0 bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-slate-700/50 rounded-3xl flex flex-col max-h-[500px] shadow-xl backdrop-blur-md overflow-hidden">
                    <div class="p-5 border-b border-white/30 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-2">
                        <i class="ph ph-list-dashes text-brand"></i> Daftar Modul
                    </div>
                    <div class="overflow-y-auto flex-1 p-3 space-y-2" id="pvLessonList"></div>
                </div>
            </div>
        `;
        
        const lessonList = document.getElementById('pvLessonList');
        product.lessons.forEach((lesson, idx) => {
            const div = document.createElement('div');
            const isActive = idx === 0;
            div.className = `p-4 rounded-2xl cursor-pointer transition-all border ${isActive ? 'bg-gradient-to-r from-brand to-purple-600 border-transparent text-white shadow-lg shadow-brand/30' : 'hover:bg-white/50 dark:hover:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'}`;
            div.innerHTML = `<div class="font-bold text-sm flex items-center gap-3"><i class="ph ${isActive ? 'ph-play-circle text-2xl' : 'ph-video text-xl'} shrink-0"></i> <span class="leading-tight">${idx + 1}. ${lesson.title}</span></div>`;
            
            div.onclick = () => {
                Array.from(lessonList.children).forEach(c => {
                    c.className = 'p-4 rounded-2xl cursor-pointer transition-all border hover:bg-white/50 dark:hover:bg-slate-800/50 border-white/40 dark:border-slate-700/50 text-slate-700 dark:text-slate-300';
                    c.querySelector('i').className = 'ph ph-video text-xl shrink-0';
                });
                
                div.className = 'p-4 rounded-2xl cursor-pointer transition-all border bg-gradient-to-r from-brand to-purple-600 border-transparent text-white shadow-lg shadow-brand/30';
                div.querySelector('i').className = 'ph ph-play-circle text-2xl shrink-0';
                
                const videoId = getYTVideoId(lesson.url);
                document.getElementById('pvYtPlayer').src = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';
            };
            lessonList.appendChild(div);
        });

        const firstId = getYTVideoId(product.lessons[0].url);
        if(firstId) document.getElementById('pvYtPlayer').src = `https://www.youtube.com/embed/${firstId}?autoplay=1&rel=0`;
    } else {
        structuredArea.innerHTML = `<div class="text-slate-500 font-bold p-8 bg-white/40 dark:bg-slate-800/40 rounded-3xl text-center border border-white/50 dark:border-slate-700/50"><i class="ph ph-empty text-4xl mb-2 opacity-50 block"></i>Belum ada file atau materi yang diupload.</div>`;
    }

    const htmlArea = document.getElementById('pvHtmlArea');
    if (product.accessHtml && product.accessHtml.trim() !== '') {
        htmlArea.innerHTML = `<h4 class="font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2"><i class="ph ph-info text-amber-500"></i> Info Tambahan</h4>` + product.accessHtml;
        htmlArea.classList.remove('hidden');
    } else {
        htmlArea.classList.add('hidden');
    }
};

window.closeProductViewer = () => {
    const player = document.getElementById('pvYtPlayer');
    if(player) player.src = ''; 
    const pv = document.getElementById('productViewer');
    if(pv) pv.classList.add('hidden');
    const ml = document.getElementById('marketplaceList');
    if(ml) ml.classList.remove('hidden');
};

// --- CHECKOUT LOGIC ---

window.loadCheckoutProduct = async (productId) => {
    try {
        // Paralelkan pengambilan produk dan pengaturan
        const [res, setRes] = await Promise.all([
            apiCall('getProducts'),
            apiCall('getSettings')
        ]);
        
        const products = res.data || [];
        let found = products.find(p => p.id === productId);
        
        if(found) {
            window.appState.currentCheckoutProduct = found;
            document.getElementById('coProdTitle').innerText = found.title;
            document.getElementById('coProdPrice').innerText = window.formatRp(found.price);
            
            const coProdImageContainer = document.getElementById('coProdImageContainer');
            if (coProdImageContainer) {
                if(found.imageUrl) {
                    coProdImageContainer.innerHTML = `<img src="${found.imageUrl}" class="w-full h-full object-cover">`;
                    coProdImageContainer.className = "w-14 h-14 rounded-xl shadow-lg shadow-brand/30 overflow-hidden shrink-0";
                } else {
                    coProdImageContainer.innerHTML = `<i class="ph ph-package"></i>`;
                    coProdImageContainer.className = "w-14 h-14 bg-gradient-to-br from-brand to-purple-500 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg shadow-brand/30 shrink-0";
                }
            }
            
            window.appState.currentCheckoutUniqueCode = Math.floor(Math.random() * 900) + 100;
            
            if(setRes && setRes.data) window.appState.settings = setRes.data;

            window.recalculateCheckout();
            window.renderCheckoutPaymentMethods();

            const refId = localStorage.getItem('affiliateRef');
            if (refId) {
                const badge = document.getElementById('coAffiliateBadgeContainer');
                if(badge) badge.classList.remove('hidden');
                const nameDisplay = document.getElementById('coAffiliateNameDisplay');
                if(nameDisplay) nameDisplay.innerText = refId.toUpperCase();
            }

        } else {
            document.getElementById('view-checkout').innerHTML = "<h2 class='text-center mt-20 text-3xl font-black text-slate-800 dark:text-white'>Product Not Found</h2>";
        }
    } catch(e) {
        console.error(e);
    }
};

window.recalculateCheckout = () => {
    const product = window.appState.currentCheckoutProduct;
    const coupon = window.appState.currentCheckoutCoupon;
    const uniqueCode = window.appState.currentCheckoutUniqueCode;
    
    if(!product) return;

    const fee = 113;
    document.getElementById('coFee').innerText = `- Rp. ${fee}`;

    let discount = 0;
    if (coupon) {
        if (coupon.type === 'percent') {
            discount = product.price * (coupon.value / 100);
        } else {
            discount = coupon.value;
        }
        if(discount > product.price) discount = product.price;

        document.getElementById('coDiscountRow').classList.remove('hidden');
        document.getElementById('coDiscountCodeDisplay').innerText = coupon.code;
        document.getElementById('coDiscountAmount').innerText = `- ${window.formatRp(discount)}`;
    } else {
        document.getElementById('coDiscountRow').classList.add('hidden');
    }

    const total = product.price - fee - discount + uniqueCode;
    
    const totalStr = total.toString();
    const paddedTotal = totalStr.padStart(4, '0');
    const last3 = paddedTotal.slice(-3);
    const rest = paddedTotal.slice(0, -3);
    const formattedRest = new Intl.NumberFormat('id-ID').format(Number(rest));
    
    const finalHtml = `Rp. ${formattedRest}.<span class="text-red-500 dark:text-red-400">${last3}</span>`;
    document.getElementById('coTotal').innerHTML = finalHtml;
    document.getElementById('coTotalPay').innerHTML = finalHtml;
};

window.applyVoucher = async () => {
    const codeInput = document.getElementById('coVoucherInput').value.toUpperCase().trim();
    const msgEl = document.getElementById('coVoucherMsg');
    
    if(!codeInput) return;
    
    const btn = document.getElementById('btnApplyVoucher');
    btn.innerText = "...";

    try {
        const res = await apiCall('getCoupons');
        const coupons = res.data || [];
        let found = coupons.find(c => c.code === codeInput);

        if(found) {
            if (found.applicableProductId && found.applicableProductId !== 'all' && found.applicableProductId !== window.appState.currentCheckoutProduct.id) {
                window.appState.currentCheckoutCoupon = null;
                window.recalculateCheckout();
                msgEl.innerHTML = `<i class="ph ph-warning-circle"></i> Kupon tidak berlaku untuk produk ini.`;
                msgEl.className = "text-xs mt-3 bg-red-500/10 text-red-500 p-2 rounded-lg font-bold flex items-center gap-1";
            } else {
                window.appState.currentCheckoutCoupon = found;
                window.recalculateCheckout();
                msgEl.innerHTML = `<i class="ph ph-check-circle text-lg"></i> Kupon ${found.code} berhasil diterapkan!`;
                msgEl.className = "text-xs mt-3 bg-green-500/10 text-green-600 dark:text-green-400 p-2 rounded-lg font-bold flex items-center gap-1";
            }
        } else {
            window.appState.currentCheckoutCoupon = null;
            window.recalculateCheckout();
            msgEl.innerHTML = `<i class="ph ph-warning-circle"></i> Kupon tidak ditemukan / tidak valid.`;
            msgEl.className = "text-xs mt-3 bg-red-500/10 text-red-500 p-2 rounded-lg font-bold flex items-center gap-1";
        }
    } catch(e) {
        console.error(e);
    }
    btn.innerText = "PAKAI";
};

window.renderCheckoutPaymentMethods = () => {
    const container = document.getElementById('coPaymentMethods');
    if(!container) return;
    container.innerHTML = '';
    
    const settings = window.appState.settings;
    if(settings && settings.banks) {
        settings.banks.forEach((bank, index) => {
            container.innerHTML += `
                <label class="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-brand transition-all">
                    <div class="flex items-center gap-3">
                        <input type="radio" name="paymentMethod" value="Manual-${bank.name}" class="w-5 h-5 text-brand accent-brand" ${index===0?'checked':''}>
                        <div class="font-bold text-slate-800 dark:text-white text-sm">Bank ${bank.name}</div>
                    </div>
                    <i class="ph ph-bank text-2xl text-slate-400"></i>
                </label>
            `;
        });
    }
};

window.submitCheckout = async () => {
    const name = document.getElementById('coName').value;
    const email = document.getElementById('coEmail').value;
    const rawPassword = document.getElementById('coPassword').value;
    const rawWa = document.getElementById('coWA').value;
    const wa = window.formatPhoneNumber(rawWa); // KUNCI PERBAIKAN WA
    const methodEl = document.querySelector('input[name="paymentMethod"]:checked');
    
    if(!name || !email || !rawPassword || !wa) {
        alert("Harap isi lengkap form Akun.");
        return;
    }
    if(!methodEl) {
        alert("Pilih metode pembayaran.");
        return;
    }

    const btn = document.getElementById('btnSubmitCheckout');
    btn.innerText = "PROCESSING...";

    const methodRaw = methodEl.value;
    const product = window.appState.currentCheckoutProduct;
    const coupon = window.appState.currentCheckoutCoupon;
    const uniqueCode = window.appState.currentCheckoutUniqueCode;

    const hashedPassword = await window.hashPassword(rawPassword);
    const refId = localStorage.getItem('affiliateRef') || null;

    // --- LOGIKA AUTO REGISTER USER BARU SAAT CHECKOUT ---
    if (!window.appState.user) {
        try {
            const regPayload = { 
                name: name, 
                email: email, 
                wa: wa, 
                password: hashedPassword, 
                role: 'user', 
                license: 'USER-BASIC-' + Math.floor(Math.random() * 9999),
                affiliateCode: name.replace(/\s+/g, '').toUpperCase().substring(0, 5) + Math.floor(Math.random() * 1000)
            };
            await apiCall('register', regPayload);
        } catch (err) {
            alert("Gagal membuat akun: " + err.message + "\n\nJika email sudah terdaftar, silakan klik tombol 'Login' di bagian atas halaman.");
            btn.innerText = "CREATE ORDER";
            return; 
        }
    }

    let discount = 0;
    if (coupon) {
        discount = coupon.type === 'percent' ? product.price * (coupon.value / 100) : coupon.value;
        if(discount > product.price) discount = product.price;
    }
    const finalTotal = product.price - 113 - discount + uniqueCode;
    
    // FORMAT INFORMASI BANK
    let methodDisplay = methodRaw;
    let paymentInstructions = '';

    if (methodRaw.startsWith('Manual-')) {
        const bankName = methodRaw.split('-')[1];
        const bankObj = window.appState.settings.banks.find(b => b.name === bankName);
        if (bankObj) {
            methodDisplay = `Transfer Bank ${bankObj.name} (No. Rek: ${bankObj.no} a.n ${bankObj.owner})`;
            paymentInstructions = `
                <div class="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl mt-4 text-center border border-slate-200 dark:border-slate-700 shadow-inner">
                    <span class="block text-sm text-slate-500 dark:text-slate-400">Transfer ke Bank</span>
                    <strong class="text-xl text-slate-800 dark:text-white">${bankObj.name}</strong><br>
                    <span class="block text-sm text-slate-500 dark:text-slate-400 mt-2">Nomor Rekening</span>
                    <strong class="text-2xl text-brand font-mono select-all">${bankObj.no}</strong><br>
                    <span class="block text-sm text-slate-500 dark:text-slate-400 mt-2">Atas Nama</span>
                    <strong class="text-lg text-slate-800 dark:text-white">${bankObj.owner}</strong>
                </div>
            `;
        }
    }

    const orderData = {
        id: window.generateShortId(), 
        customerName: name,
        customerEmail: email,
        customerWA: wa,
        productId: product.id,
        productTitle: product.title,
        basePrice: product.price,
        discountApplied: discount,
        couponCode: coupon ? coupon.code : null,
        totalPay: finalTotal,
        paymentMethod: methodDisplay, 
        status: 'Pending',
        userPasswordHash: hashedPassword,
        affiliateRef: refId
    };

    try {
        await apiCall('saveOrder', orderData);
        
        document.getElementById('view-checkout').innerHTML = `
            <div class="max-w-md mx-auto mt-10 glass p-8 sm:p-10 rounded-3xl shadow-2xl text-center border border-white/40 dark:border-slate-700/50">
                <div class="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                    <i class="ph ph-check text-4xl text-white font-black"></i>
                </div>
                <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-2">Order Diterima!</h2>
                <p class="text-slate-600 dark:text-slate-400 mb-2 font-medium">Lakukan pembayaran sejumlah <br><span class="text-red-500 text-3xl font-black mt-2 inline-block select-all">${window.formatRp(finalTotal)}</span></p>
                
                ${paymentInstructions}

                <div class="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-xs text-blue-800 dark:text-blue-300 text-left mb-6 mt-6 font-medium leading-relaxed">
                    Pastikan Anda menyimpan bukti transfer. Admin akan segera memverifikasi pesanan Anda. Akses produk akan terbuka otomatis di akun Anda setelah status menjadi <b>Paid</b>.
                </div>
                <a href="?" class="bg-gradient-to-r from-brand to-purple-600 hover:from-brandHover hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl block transition-all shadow-lg shadow-brand/30">Selesai & Login</a>
            </div>
        `;
    } catch(e) {
        alert("Terjadi kesalahan: " + e.message);
        btn.innerText = "CREATE ORDER";
    }
};

// --- ORDERS LOGIC (ADMIN) ---

window.renderOrdersTable = () => {
    const tbody = document.getElementById('ordersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(window.appState.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-slate-500 font-bold">Belum ada orderan masuk.</td></tr>`;
        return;
    }

    window.appState.orders.forEach(o => {
        const isPaid = o.status === 'Paid';
        const statusBadge = isPaid 
            ? `<span class="bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-lg text-xs font-black uppercase">Paid</span>`
            : `<span class="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-lg text-xs font-black uppercase">Pending</span>`;
        
        const actionBtn = isPaid 
            ? `<button class="text-xs text-slate-400 dark:text-slate-500 font-bold bg-white/30 dark:bg-slate-800/30 px-4 py-2 rounded-lg cursor-not-allowed border border-white/20 dark:border-slate-700/50" disabled>Aktif</button>`
            : `<button onclick="window.approveOrder('${o.id}')" class="bg-gradient-to-r from-brand to-purple-600 hover:from-brandHover hover:to-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md shadow-brand/30 transition-all flex items-center gap-1 justify-center"><i class="ph ph-check-circle text-base"></i> Approve / Aktifkan</button>`;

        tbody.innerHTML += `
            <tr class="hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 text-xs font-mono font-bold text-slate-500 dark:text-slate-400">#${o.id.substring(0,6)}</td>
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-800 dark:text-white text-base">${o.customerName}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">${o.paymentMethod}</p>
                </td>
                <td class="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-bold">${o.productTitle}</td>
                <td class="px-6 py-4 text-sm">
                    <p class="font-black text-slate-800 dark:text-white text-base">${window.formatRp(o.totalPay || o.basePrice)}</p>
                    ${o.couponCode ? `<p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 border border-emerald-500/20"><i class="ph ph-ticket"></i> ${o.couponCode}</p>` : ''}
                </td>
                <td class="px-6 py-4 text-center">${statusBadge}</td>
                <td class="px-6 py-4 text-right flex justify-end">${actionBtn}</td>
            </tr>
        `;
    });
};

window.approveOrder = async (orderId) => {
    const order = window.appState.orders.find(o => o.id === orderId);
    if(!order) return;
    
    if(confirm(`Approve pesanan dari ${order.customerName}? Akses produk otomatis terbuka.`)) {
        try {
            await apiCall('approveOrder', {id: orderId});
            showToast("Order Approved! Akses diberikan ke kustomer.");
            await loadAllData();
        } catch(e) {
            showToast(e.message, "error");
        }
    }
};

// --- SETTINGS & UI UTILITIES LOGIC ---

window.renderSettingsBankList = () => {
    const container = document.getElementById('bankList');
    if(!container) return;
    container.innerHTML = '';
    
    const settings = window.appState.settings;
    if(settings && settings.banks) {
        settings.banks.forEach((b) => {
            container.innerHTML += `
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 bank-item bg-white/50 dark:bg-slate-900/50 p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <input type="text" placeholder="Nama Bank (BCA)" value="${b.name}" class="w-full sm:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-bold dark:text-white b-name">
                    <input type="text" placeholder="No Rekening" value="${b.no}" class="w-2/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-mono dark:text-white b-no">
                    <input type="text" placeholder="Atas Nama" value="${b.owner}" class="w-full sm:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-medium dark:text-white b-owner">
                    <button type="button" onclick="this.parentElement.remove()" class="text-red-500 p-2 hover:bg-red-500/20 rounded-lg transition-colors bg-red-500/10 sm:bg-transparent"><i class="ph ph-trash text-xl"></i></button>
                </div>
            `;
        });
    }
};

window.addBankField = () => {
    const container = document.getElementById('bankList');
    if (container) {
        container.innerHTML += `
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 bank-item bg-white/50 dark:bg-slate-900/50 p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
                <input type="text" placeholder="Nama Bank" class="w-full sm:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-bold dark:text-white b-name">
                <input type="text" placeholder="No Rekening" class="w-full sm:w-2/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-mono dark:text-white b-no">
                <input type="text" placeholder="Atas Nama" class="w-full sm:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent rounded-lg text-sm outline-none focus:border-brand font-medium dark:text-white b-owner">
                <button type="button" onclick="this.parentElement.remove()" class="text-red-500 p-2 hover:bg-red-500/20 rounded-lg transition-colors bg-red-500/10 sm:bg-transparent"><i class="ph ph-trash text-xl"></i></button>
            </div>
        `;
    }
};

window.saveSettings = async () => {
    const name = document.getElementById('settingAppName').value;
    const color = document.getElementById('settingColor').value;
    const logoUrlInputEl = document.getElementById('settingLogoUrl');
    const logoFileInputEl = document.getElementById('settingLogoFile');
    
    const waProv = document.getElementById('notifWaProvider') ? document.getElementById('notifWaProvider').value : '';
    const waToken = document.getElementById('notifWaToken') ? document.getElementById('notifWaToken').value : '';
    const rawAdminWa = document.getElementById('notifAdminWa') ? document.getElementById('notifAdminWa').value : '';
    const adminWa = window.formatPhoneNumber(rawAdminWa);
    
    const emailProv = document.getElementById('notifEmailProvider') ? document.getElementById('notifEmailProvider').value : '';
    const emailToken = document.getElementById('notifEmailToken') ? document.getElementById('notifEmailToken').value : '';
    const telegramToken = document.getElementById('notifTelegramToken') ? document.getElementById('notifTelegramToken').value : '';
    const telegramChatId = document.getElementById('notifTelegramChatId') ? document.getElementById('notifTelegramChatId').value : '';
    
    // WA Melayang Data (AMBIL DARI DOM)
    const waFloatingActive = document.getElementById('settingWaFloatingActive') ? document.getElementById('settingWaFloatingActive').checked : false;
    const waFloatingNum = document.getElementById('settingWaFloatingNum') ? document.getElementById('settingWaFloatingNum').value : '';

    document.documentElement.style.setProperty('--brand-color', color);
    document.documentElement.style.setProperty('--brand-hover', color); 
    
    document.querySelectorAll('.app-name-display').forEach(el => {
        el.innerText = name || 'iMersFireship';
    });
    
    const settingColorTextEl = document.getElementById('settingColorText');
    if (settingColorTextEl) settingColorTextEl.value = color;

    const bankItems = document.querySelectorAll('.bank-item');
    const banks = [];
    bankItems.forEach(el => {
        const bname = el.querySelector('.b-name').value;
        const bno = el.querySelector('.b-no').value;
        const bowner = el.querySelector('.b-owner').value;
        if(bname) banks.push({name: bname, no: bno, owner: bowner});
    });

    let finalLogoUrl = logoUrlInputEl.value;
    if (logoFileInputEl.files && logoFileInputEl.files[0]) {
        finalLogoUrl = await window.compressImage(logoFileInputEl.files[0], 400);
        logoFileInputEl.value = ''; 
        logoUrlInputEl.value = finalLogoUrl; 
    }
    
    const payload = {
        appName: name,
        primaryColor: color,
        logoUrl: finalLogoUrl,
        banks: banks,
        waProvider: waProv, waToken: waToken, adminWa: adminWa,
        emailProvider: emailProv, emailToken: emailToken,
        telegramToken: telegramToken, telegramChatId: telegramChatId,
        waFloatingActive: waFloatingActive,
        waFloatingNum: waFloatingNum
    };

    try {
        await apiCall('saveSettings', payload);
        window.applyLogo(finalLogoUrl);
        showToast("Admin settings saved to server!");
        await loadAllData();
    } catch(e) {
        showToast("Error saving settings: " + e.message, "error");
    }
};

window.applyLogo = (src) => {
    const appLogoSidebar = document.getElementById('appLogoSidebar');
    const appIconSidebarBg = document.getElementById('appIconSidebarBg');
    const appLogoAuth = document.getElementById('appLogoAuth');
    const appIconAuth = document.getElementById('appIconAuth');

    if (src) {
        if(appLogoSidebar) { appLogoSidebar.src = src; appLogoSidebar.classList.remove('hidden'); }
        if(appIconSidebarBg) appIconSidebarBg.classList.add('hidden');
        
        if(appLogoAuth) { appLogoAuth.src = src; appLogoAuth.classList.remove('hidden'); }
        if(appIconAuth) appIconAuth.classList.add('hidden');
    } else {
        if(appLogoSidebar) { appLogoSidebar.src = ''; appLogoSidebar.classList.add('hidden'); }
        if(appIconSidebarBg) appIconSidebarBg.classList.remove('hidden');
        
        if(appLogoAuth) { appLogoAuth.src = ''; appLogoAuth.classList.add('hidden'); }
        if(appIconAuth) appIconAuth.classList.remove('hidden');
    }
};

window.showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    if(!toast) return;
    const msgEl = document.getElementById('toastMsg');
    if(msgEl) msgEl.innerText = msg;
    
    const icon = document.getElementById('toastIcon');
    
    toast.className = "fixed bottom-6 right-6 glass text-slate-800 dark:text-white px-5 py-4 rounded-2xl shadow-2xl transition-all duration-300 z-[60] flex items-center gap-3 border-l-4 transform translate-y-20 opacity-0 hidden";

    if (icon) {
        if(type === 'error') {
            icon.className = "ph ph-x-circle text-red-500 text-3xl drop-shadow-sm";
            toast.classList.add('border-l-red-500');
        } else if (type === 'info') {
            icon.className = "ph ph-info text-blue-500 text-3xl drop-shadow-sm";
            toast.classList.add('border-l-blue-500');
        } else {
            icon.className = "ph ph-check-circle text-green-500 text-3xl drop-shadow-sm";
            toast.classList.add('border-l-green-500');
        }
    }

    toast.classList.remove('hidden');
    void toast.offsetWidth;

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }

    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 300); 
    }, 3000);
};

function initChart() {
    setTimeout(() => {
        const canvas = document.getElementById('salesChart');
        if(!canvas) return;

        let existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
        
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        const textColor = isDark ? '#cbd5e1' : '#64748b';

        new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
                datasets: [{
                    label: 'Revenue',
                    data: [1200000, 1900000, 3000000, 5000000, 4200000, 6800000, 12450000],
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--brand-color').trim() || '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: gridColor }, 
                        ticks: { color: textColor }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }, 100);
}
