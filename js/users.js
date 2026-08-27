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

    saveUsers(userId);

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
            db.ref('app_users_v6/' + userId).remove();
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
        if (!foundUser.isAdmin && foundUser.suspendedUntil && foundUser.suspendedUntil > Date.now()) {
            const days = Math.ceil((foundUser.suspendedUntil - Date.now()) / (24 * 60 * 60 * 1000));
            return alert(`حساب شما توسط مدیریت به‌صورت موقت تعلیق شده است.\nزمان باقی‌مانده: حدود ${days} روز دیگر.`);
        }
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
            initApp();
            return;
        }

        const uid = savedUser.userId.toLowerCase();

        /* برای اطمینان از این‌که اکانت توسط مدیریت حذف یا تعلیق نشده، به‌جای
           اتکای صرف به کش محلی (که ممکن است هنوز کامل با سرور سینک نشده
           باشد)، یک‌بار مستقیم از خود فایربیس همان کاربر را می‌خوانیم. */
        db.ref('app_users_v6/' + uid).once('value').then(function(snapshot) {
            const freshUser = snapshot.val();

            if (!freshUser) {
                localStorage.removeItem('app_current_session_v6');
                alert('حساب کاربری شما توسط مدیریت حذف شده است.');
                return;
            }
            if (freshUser.suspendedUntil && freshUser.suspendedUntil > Date.now()) {
                localStorage.removeItem('app_current_session_v6');
                const days = Math.ceil((freshUser.suspendedUntil - Date.now()) / (24 * 60 * 60 * 1000));
                alert(`حساب کاربری شما به‌صورت موقت تعلیق شده است.\nزمان باقی‌مانده: حدود ${days} روز دیگر.`);
                return;
            }

            users[uid] = freshUser;
            currentUser = freshUser;
            initApp();
        }).catch(function() {
            // در صورت نبود اتصال، برای حفظ قابلیت استفاده‌ی آفلاین، با نسخه‌ی محلی وارد شو
            currentUser = users[uid] || savedUser;
            initApp();
        });
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
                saveUsers(currentUser.userId.toLowerCase());
            }
        } else {
            if (!users['admin']) users['admin'] = currentUser;
            users['admin'].avatar = base64Image;
            saveUsers('admin');
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
    document.getElementById('setting-bio').value = currentUser.bio || '';

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

    const bioEl = document.getElementById('settings-profile-bio');
    if (currentUser.bio && currentUser.bio.trim()) {
        bioEl.innerText = currentUser.bio;
        bioEl.classList.remove('profile-bio-empty');
    } else {
        bioEl.innerText = 'بیوگرافی ثبت نشده است';
        bioEl.classList.add('profile-bio-empty');
    }

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
    const newBio = document.getElementById('setting-bio').value.trim();

    if (!name || !newUserId || !newUsername || !newPassword) {
        return alert('تمام فیلدها را پر کنید');
    }

    if (currentUser.isAdmin) {
        currentUser.name = name;
        currentUser.family = family;
        currentUser.password = newPassword;
        currentUser.bio = newBio;
        if (!users['admin']) users['admin'] = currentUser;
        users['admin'].bio = newBio;
        users['admin'].name = name;
        users['admin'].family = family;
        saveUsers('admin');
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
    currentUser.bio = newBio;

    users[newUserId] = currentUser;

    messages.forEach(m => {
        if (m.sender.toLowerCase() === oldUserId) m.sender = newUserId;
        if (m.chatId.toLowerCase() === oldUserId) m.chatId = newUserId;
        if (m.chatId.toLowerCase() === `saved_${oldUserId}`) m.chatId = `saved_${newUserId}`;
    });

    saveUsers(newUserId, oldUserId);
    saveMessages();
    persistSession();

    alert('اطلاعات شما با موفقیت بروزرسانی شد!');
    openSettings();
}

let currentProfileTargetId = null;

/* نمایش مودال پروفایل یک کاربر دیگر (مثل تلگرام، با کلیک روی نام در هدر پیوی) */
function openContactProfile(userId) {
    if (!userId) return;
    const uid = userId.toLowerCase();

    renderContactProfileModal(uid);
    document.getElementById('contact-profile-modal').classList.remove('hidden');

    /* برای اطمینان از تازه بودن بیوگرافی/آواتار، یک‌بار از سرور هم می‌خوانیم
       (شبیه به همان روشی که searchUser برای کاربران ناشناس استفاده می‌کند) */
    if (uid !== 'admin' || !users['admin']) {
        db.ref('app_users_v6/' + uid).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                users[uid] = data;
                localStorage.setItem('app_users_v6', JSON.stringify(users));
                if (currentProfileTargetId === uid && !document.getElementById('contact-profile-modal').classList.contains('hidden')) {
                    renderContactProfileModal(uid);
                }
            }
        }).catch(() => {});
    }
}

function renderContactProfileModal(uid) {
    currentProfileTargetId = uid;

    let data;
    if (uid === 'admin') {
        const adminData = users['admin'] || {};
        data = { name: 'پشتیبانی مرکزی', family: '', userId: 'admin', avatar: adminData.avatar || null, bio: adminData.bio || '', isVerified: true };
    } else {
        const u = users[uid] || {};
        data = { name: u.name || uid, family: u.family || '', userId: u.userId || uid, avatar: u.avatar || null, bio: u.bio || '', isVerified: !!u.isAdmin };
    }

    const fullName = `${data.name} ${data.family}`.trim() || uid;
    const verifiedHtml = data.isVerified ? ' <i class="fa-solid fa-circle-check verified-badge"></i>' : '';
    document.getElementById('contact-profile-name').innerHTML = fullName + verifiedHtml;
    document.getElementById('contact-profile-id').innerText = '@' + data.userId;

    const avatarBox = document.getElementById('contact-profile-avatar');
    if (data.avatar) {
        avatarBox.innerHTML = `<img src="${data.avatar}" class="profile-avatar">`;
    } else {
        const initial = fullName.charAt(0).toUpperCase();
        avatarBox.innerHTML = `<div class="profile-avatar">${initial}</div>`;
    }

    const bioEl = document.getElementById('contact-profile-bio');
    if (data.bio && data.bio.trim()) {
        bioEl.innerText = data.bio;
        bioEl.classList.remove('profile-bio-empty');
    } else {
        bioEl.innerText = 'بیوگرافی ثبت نشده است';
        bioEl.classList.add('profile-bio-empty');
    }
}

function closeContactProfile() {
    document.getElementById('contact-profile-modal').classList.add('hidden');
    currentProfileTargetId = null;
}

function copyContactProfileId() {
    if (!currentProfileTargetId) return;
    copyTextWithToast('@' + currentProfileTargetId);
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
        return;
    }

    /* اگر کاربر در نسخه‌ی محلی (users) پیدا نشد، به‌جای اعلام فوری «یافت نشد»
       یک‌بار مستقیماً از سرور فایربیس همان آیدی را می‌خوانیم.
       این حالت مخصوصاً برای کاربرانی رخ می‌دهد که تازه ثبت‌نام/وارد شده‌اند:
       لیستنر app_users_v6 هنوز کل لیست کاربران قدیمی را از سرور کامل
       دریافت نکرده، در نتیجه جستجوی اکانت‌های از قبل ساخته‌شده با شکست
       مواجه می‌شد در حالی که آن اکانت‌ها واقعاً روی سرور وجود داشتند. */
    const searchBtn = document.querySelector('.search-box button[onclick="searchUser()"]');
    if (searchBtn) searchBtn.disabled = true;

    db.ref('app_users_v6/' + searchId).once('value').then(snapshot => {
        if (searchBtn) searchBtn.disabled = false;
        const data = snapshot.val();
        if (data) {
            users[searchId] = data;
            localStorage.setItem('app_users_v6', JSON.stringify(users));
            openChat(searchId, `${data.name} ${data.family}`, 'direct', !!data.isAdmin);
            document.getElementById('search-input').value = '';
        } else {
            alert('کاربری با این آیدی یافت نشد!');
        }
    }).catch(() => {
        if (searchBtn) searchBtn.disabled = false;
        alert('خطا در اتصال به سرور. لطفاً فیلترشکن/اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.');
    });
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
window.openContactProfile = openContactProfile;
window.closeContactProfile = closeContactProfile;
window.copyContactProfileId = copyContactProfileId;

/* هنگام لود اولیه‌ی صفحه، اگر کاربر قبلاً وارد شده، به‌جای صفحه‌ی ورود مستقیم به چت‌ها می‌رویم.
   کمی تأخیر می‌دهیم تا لیستنرهای دیتابیس در core.js اولین دیتای users را بگیرند. */
setTimeout(restoreSession, 400);
