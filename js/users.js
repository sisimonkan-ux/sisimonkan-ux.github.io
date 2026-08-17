/* =========================================================
   users.js
   ورود / ثبت‌نام / خروج، پروفایل، تنظیمات حساب، آواتار و جستجوی کاربر
   وابسته به: core.js (باید قبل از این فایل لود شود)
   ========================================================= */

function nextStep() {
    const uName = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-password').value.trim();

    if (!uName || !pass) return alert('نام کاربری و رمز را وارد کنید');
    if (uName.toLowerCase() === 'admin') return alert('این نام کاربری مخصوص مدیریت است!');

    const exists = Object.values(users).some(u => u.username.toLowerCase() === uName.toLowerCase());
    if (exists) return alert('این نام کاربری قبلا ثبت شده است');

    tempAuth = { username: uName, password: pass };
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
}

function completeRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const family = document.getElementById('reg-family').value.trim();
    const userId = document.getElementById('reg-userid').value.trim().toLowerCase();

    if (!name || !userId) return alert('اطلاعات را کامل کنید');
    if (users[userId] || userId === 'admin') return alert('این آیدی قبلاً ثبت شده است!');

    users[userId] = {
        name, family, userId,
        username: tempAuth.username,
        password: tempAuth.password,
        isAdmin: false,
        avatar: null
    };

    saveUsers();

    const regBtn = document.querySelector('#step-2 button[onclick="completeRegister()"]');
    if (regBtn) { regBtn.disabled = true; regBtn.innerText = 'در حال بررسی اتصال...'; }

    /* بررسی می‌کنیم که آیا واقعاً به سرور دیتابیس وصل شدیم یا نه.
       اگر فیلترشکن کاربر خاموش باشد، اتصال به فایربیس برقرار نمی‌شود و
       اکانتی که بالا ساختیم فقط به‌صورت محلی/موقت باقی می‌ماند و هرگز
       واقعاً روی سرور ذخیره نمی‌شود؛ در این حالت اکانت را حذف و به کاربر اطلاع می‌دهیم. */
    verifyDatabaseConnection(function(isConnected) {
        if (regBtn) { regBtn.disabled = false; regBtn.innerText = 'ثبت نام'; }

        if (isConnected) {
            alert('ثبت‌نام با موفقیت انجام شد! حالا وارد شوید.');
            document.getElementById('login-username').value = tempAuth.username;
            document.getElementById('login-password').value = tempAuth.password;
            switchToLogin();
        } else {
            delete users[userId];
            localStorage.setItem('app_users_v6', JSON.stringify(users));
            alert('⚠️ ثبت‌نام شما ذخیره نشد!\nبه‌نظر می‌رسد فیلترشکن شما خاموش است و اتصال به سرور برقرار نشد.\nلطفاً فیلترشکن خود را روشن کنید و دوباره ثبت‌نام کنید.');
        }
    });
}

/* بررسی اتصال واقعی به سرور فایربیس با استفاده از مسیر ویژه‌ی .info/connected
   (که فقط زمانی true می‌شود که کلاینت واقعاً به سرور متصل شده باشد، نه فقط
   از کش محلی بخواند). اگر ظرف مدت timeoutMs اتصال برقرار نشود، callback با false صدا زده می‌شود. */
function verifyDatabaseConnection(callback, timeoutMs = 6000) {
    let settled = false;
    const connectedRef = db.ref('.info/connected');

    function onConnected(snapshot) {
        if (settled) return;
        if (snapshot.val() === true) {
            settled = true;
            clearTimeout(timer);
            connectedRef.off('value', onConnected);
            callback(true);
        }
    }

    const timer = setTimeout(function() {
        if (settled) return;
        settled = true;
        connectedRef.off('value', onConnected);
        callback(false);
    }, timeoutMs);

    connectedRef.on('value', onConnected);
}

function switchToLogin() {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('auth-title').innerText = 'ورود به حساب';
}

function switchToRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-1').classList.remove('hidden');
    document.getElementById('auth-title').innerText = 'ثبت نام (مرحله اول)';
}

function login() {
    const uName = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value.trim();

    let foundUser = null;
    if (uName === 'mostafa' && pass === 'Mostafa20266') {
        foundUser = { name: 'پشتیبانی مرکزی', family: '', userId: 'admin', username: 'Mostafa', password: 'Mostafa20266', isAdmin: true, avatar: (users['admin'] ? users['admin'].avatar : null) };
    } else {
        foundUser = Object.values(users).find(u => u.username.toLowerCase() === uName && u.password === pass);
    }

    if (foundUser) {
        currentUser = foundUser;
        persistSession();
        initApp();
    } else {
        alert('نام کاربری یا رمز عبور نادرست است');
    }
}

function initApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    renderChatList();
}

/* ---------- ماندگاری نشست (Session) بین رفرش‌های صفحه ---------- */
function persistSession() {
    if (currentUser) {
        localStorage.setItem('app_current_session_v6', JSON.stringify(currentUser));
    }
}

function restoreSession() {
    const saved = localStorage.getItem('app_current_session_v6');
    if (!saved) return;
    try {
        const savedUser = JSON.parse(saved);
        if (!savedUser || !savedUser.userId) return;

        if (savedUser.isAdmin) {
            // آواتار مدیر را از آخرین نسخه‌ی همگام‌شده می‌خوانیم
            currentUser = { ...savedUser, avatar: (users['admin'] ? users['admin'].avatar : savedUser.avatar) };
        } else {
            const freshUser = users[savedUser.userId.toLowerCase()];
            // اگر کاربر هنوز در دیتابیس وجود دارد از نسخه‌ی تازه‌اش استفاده کن، وگرنه از نسخه‌ی ذخیره‌شده
            currentUser = freshUser || savedUser;
        }
        initApp();
    } catch (e) {
        localStorage.removeItem('app_current_session_v6');
    }
}

function logout() {
    if (confirm("آیا می‌خواهید از حساب خود خارج شوید؟")) {
        currentUser = null;
        localStorage.removeItem('app_current_session_v6');
        hideMainSections();
        document.getElementById('auth-screen').classList.remove('hidden');
        switchToLogin();
    }
}

function uploadUserAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    compressAndReadImage(file, function(base64Image) {
        currentUser.avatar = base64Image;
        if (!currentUser.isAdmin) {
            if (users[currentUser.userId.toLowerCase()]) {
                users[currentUser.userId.toLowerCase()].avatar = base64Image;
                saveUsers();
            }
        } else {
            if (!users['admin']) users['admin'] = currentUser;
            users['admin'].avatar = base64Image;
            saveUsers();
        }

        persistSession();
        renderSettingsAvatar();
        renderChatList();
        alert('تصویر پروفایل شما با موفقیت بروزرسانی شد!');
    });
}

function renderSettingsAvatar() {
    const avatarBox = document.getElementById('settings-avatar-box');
    if (currentUser.avatar) {
        avatarBox.innerHTML = `<img src="${currentUser.avatar}" class="profile-avatar">`;
    } else {
        const initial = currentUser.name ? currentUser.name.charAt(0) : '؟';
        avatarBox.innerHTML = `<div class="profile-avatar" id="settings-avatar-icon">${initial}</div>`;
    }
}

function openSettings() {
    document.getElementById('setting-name').value = currentUser.name || '';
    document.getElementById('setting-family').value = currentUser.family || '';
    document.getElementById('setting-userid').value = currentUser.userId || '';
    document.getElementById('setting-username').value = currentUser.username || '';
    document.getElementById('setting-password').value = currentUser.password || '';

    const btnAdminPanel = document.getElementById('btn-admin-panel');
    if(currentUser.isAdmin) {
        btnAdminPanel.classList.remove('hidden');
        document.getElementById('setting-userid').disabled = true;
        document.getElementById('setting-username').disabled = true;
    } else {
        btnAdminPanel.classList.add('hidden');
        document.getElementById('setting-userid').disabled = false;
        document.getElementById('setting-username').disabled = false;
    }

    hideMainSections();
    document.getElementById('settings-screen').classList.remove('hidden');
    setActiveNav('settings');
}

function openProfile() {
    document.getElementById('settings-profile-fullname').innerText = `${currentUser.name} ${currentUser.family}`;
    document.getElementById('settings-profile-id').innerText = `@${currentUser.userId}`;

    renderSettingsAvatar();

    hideMainSections();
    document.getElementById('profile-screen').classList.remove('hidden');
    setActiveNav('profile');
}

function saveSettings() {
    const name = document.getElementById('setting-name').value.trim();
    const family = document.getElementById('setting-family').value.trim();
    const newUserId = document.getElementById('setting-userid').value.trim().toLowerCase();
    const newUsername = document.getElementById('setting-username').value.trim();
    const newPassword = document.getElementById('setting-password').value.trim();

    if (!name || !newUserId || !newUsername || !newPassword) {
        return alert('تمام فیلدها را پر کنید');
    }

    if (currentUser.isAdmin) {
        currentUser.name = name;
        currentUser.family = family;
        currentUser.password = newPassword;
        persistSession();
        alert('اطلاعات مدیریت با موفقیت بروز شد!');
        openSettings();
        return;
    }

    const oldUserId = currentUser.userId.toLowerCase();

    if (newUserId !== oldUserId && (users[newUserId] || newUserId === 'admin')) {
        return alert('این آیدی قبلاً توسط شخص دیگری ثبت شده است!');
    }

    const existsUsername = Object.values(users).some(u => u.userId.toLowerCase() !== oldUserId && u.username.toLowerCase() === newUsername.toLowerCase());
    if (existsUsername) {
        return alert('این نام کاربری قبلاً استفاده شده است!');
    }

    delete users[oldUserId];

    currentUser.name = name;
    currentUser.family = family;
    currentUser.userId = newUserId;
    currentUser.username = newUsername;
    currentUser.password = newPassword;

    users[newUserId] = currentUser;

    messages.forEach(m => {
        if (m.sender.toLowerCase() === oldUserId) m.sender = newUserId;
        if (m.chatId.toLowerCase() === oldUserId) m.chatId = newUserId;
        if (m.chatId.toLowerCase() === `saved_${oldUserId}`) m.chatId = `saved_${newUserId}`;
    });

    saveUsers();
    saveMessages();
    persistSession();

    alert('اطلاعات شما با موفقیت بروزرسانی شد!');
    openSettings();
}

function searchUser() {
    const searchId = document.getElementById('search-input').value.trim().toLowerCase();
    if (!searchId) return;

    if (searchId === 'admin' && currentUser.isAdmin) {
        return alert('شما در حال حاضر با اکانت مدیریت فعال هستید.');
    }

    if (users[searchId] || searchId === 'admin') {
        const targetName = users[searchId] ? `${users[searchId].name} ${users[searchId].family}` : 'پشتیبانی مرکزی';
        const isVerified = searchId === 'admin' || (users[searchId] && users[searchId].isAdmin);
        openChat(searchId, targetName, 'direct', isVerified);
        document.getElementById('search-input').value = '';
    } else {
        alert('کاربری با این آیدی یافت نشد!');
    }
}

window.login = login;
window.switchToRegister = switchToRegister;
window.nextStep = nextStep;
window.switchToLogin = switchToLogin;
window.completeRegister = completeRegister;
window.openSettings = openSettings;
window.logout = logout;
window.searchUser = searchUser;
window.uploadUserAvatar = uploadUserAvatar;
window.saveSettings = saveSettings;

/* هنگام لود اولیه‌ی صفحه، اگر کاربر قبلاً وارد شده، به‌جای صفحه‌ی ورود مستقیم به چت‌ها می‌رویم.
   کمی تأخیر می‌دهیم تا لیستنرهای دیتابیس در core.js اولین دیتای users را بگیرند. */
setTimeout(restoreSession, 400);
