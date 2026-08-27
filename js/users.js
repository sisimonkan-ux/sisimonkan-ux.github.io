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
        avatar: null,
        bio: '',
        lastSeen: Date.now(),
        isVerified: false
    };

    saveUsers(userId);

    const regBtn = document.querySelector('#step-2 button[onclick="completeRegister()"]');
    if (regBtn) { regBtn.disabled = true; regBtn.innerText = 'در حال بررسی اتصال...'; }

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
        foundUser = { name: 'پشتیبانی مرکزی', family: '', userId: 'admin', username: 'Mostafa', password: 'Mostafa20266', isAdmin: true, avatar: (users['admin'] ? users['admin'].avatar : null), bio: 'پشتیبانی رسمی', lastSeen: Date.now(), isVerified: true };
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
            currentUser = { ...savedUser, avatar: (users['admin'] ? users['admin'].avatar : savedUser.avatar) };
            initApp();
            return;
        }

        const uid = savedUser.userId.toLowerCase();

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
    document.getElementById('settings-profile-bio').innerText = currentUser.bio || '';

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
    const bio = document.getElementById('setting-bio').value.trim();

    if (!name || !newUserId || !newUsername || !newPassword) {
        return alert('تمام فیلدها را پر کنید');
    }

    if (currentUser.isAdmin) {
        currentUser.name = name;
        currentUser.family = family;
        currentUser.password = newPassword;
        currentUser.bio = bio;
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
    currentUser.bio = bio;

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

function searchUser() {
    const searchId = document.getElementById('search-input').value.trim().toLowerCase();
    if (!searchId) return;

    if (searchId === 'admin' && currentUser.isAdmin) {
        return alert('شما در حال حاضر با اکانت مدیریت فعال هستید.');
    }

    if (users[searchId] || searchId === 'admin') {
        const targetName = users[searchId] ? `${users[searchId].name} ${users[searchId].family}` : 'پشتیبانی مرکزی';
        const isVerified = searchId === 'admin' || (users[searchId] && users[searchId].isVerified);
        openChat(searchId, targetName, 'direct', isVerified);
        document.getElementById('search-input').value = '';
        return;
    }

    const searchBtn = document.querySelector('.search-box button[onclick="searchUser()"]');
    if (searchBtn) searchBtn.disabled = true;

    db.ref('app_users_v6/' + searchId).once('value').then(snapshot => {
        if (searchBtn) searchBtn.disabled = false;
        const data = snapshot.val();
        if (data) {
            users[searchId] = data;
            localStorage.setItem('app_users_v6', JSON.stringify(users));
            openChat(searchId, `${data.name} ${data.family}`, 'direct', !!data.isVerified);
            document.getElementById('search-input').value = '';
        } else {
            alert('کاربری با این آیدی یافت نشد!');
        }
    }).catch(() => {
        if (searchBtn) searchBtn.disabled = false;
        alert('خطا در اتصال به سرور. لطفاً فیلترشکن/اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.');
    });
}

// ===== توابع پروفایل کاربر =====

function updateLastSeen() {
    if (currentUser && !currentUser.isAdmin) {
        const uid = currentUser.userId.toLowerCase();
        if (users[uid]) {
            users[uid].lastSeen = Date.now();
            saveUsers(uid);
        }
    }
}

setInterval(updateLastSeen, 30000);

function openProfileUser(userId) {
    const uid = userId.toLowerCase();
    
    if (!users[uid]) {
        db.ref('app_users_v6/' + uid).once('value').then(snapshot => {
            const data = snapshot.val();
            if (data) {
                users[uid] = data;
                localStorage.setItem('app_users_v6', JSON.stringify(users));
                renderProfileUser(uid);
            } else {
                alert('کاربر یافت نشد!');
            }
        });
        return;
    }
    
    renderProfileUser(uid);
}

function renderProfileUser(uid) {
    const user = users[uid];
    if (!user) {
        alert('کاربر یافت نشد!');
        return;
    }

    const container = document.getElementById('profile-user-container');
    
    // تبدیل زمان آخرین بازدید
    let lastSeenText = 'اخیراً';
    if (user.lastSeen) {
        const diff = Date.now() - user.lastSeen;
        if (diff < 60000) {
            lastSeenText = 'هم‌اکنون';
        } else if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            lastSeenText = `${mins} دقیقه پیش`;
        } else if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            lastSeenText = `${hours} ساعت پیش`;
        } else {
            const days = Math.floor(diff / 86400000);
            lastSeenText = `${days} روز پیش`;
        }
    }

    const isMyProfile = currentUser && currentUser.userId.toLowerCase() === uid;
    const isAdmin = currentUser && currentUser.isAdmin;

    // دکمه وریفای فقط برای ادمین
    let verifyButton = '';
    if (isAdmin && !isMyProfile) {
        if (user.isVerified) {
            verifyButton = `<button class="btn-unverify" onclick="toggleUserVerify('${uid}')"><i class="fa fa-times-circle"></i> لغو وریفای</button>`;
        } else {
            verifyButton = `<button class="btn-verify" onclick="toggleUserVerify('${uid}')"><i class="fa fa-check-circle"></i> وریفای کردن</button>`;
        }
    }

    const verifiedBadge = user.isVerified ? '<i class="fa-solid fa-circle-check verified-big"></i>' : '';

    container.innerHTML = `
        <div class="profile-user-header">
            <div class="profile-user-avatar" style="${user.avatar ? `background-image:url('${user.avatar}');background-size:cover;` : ''}">
                ${user.avatar ? '' : (user.name ? user.name.charAt(0) : '؟')}
            </div>
            <div class="profile-user-name">
                ${user.name} ${user.family || ''} ${verifiedBadge}
            </div>
            <div class="profile-user-username">@${user.userId}</div>
            ${user.bio ? `<div class="profile-user-bio">${user.bio}</div>` : ''}
            <div class="profile-user-lastseen">آخرین بازدید: ${lastSeenText}</div>
            
            <div class="profile-user-actions">
                ${isMyProfile ? '' : `<button class="btn-primary" onclick="openChat('${uid}', '${user.name} ${user.family}', 'direct', ${user.isVerified || false})"><i class="fa fa-comment"></i> پیام</button>`}
                ${verifyButton}
            </div>
        </div>

        <div class="profile-user-info">
            <div class="profile-user-info-item">
                <span class="label">نام کاربری</span>
                <span class="value">@${user.userId}</span>
            </div>
            <div class="profile-user-info-item">
                <span class="label">نام</span>
                <span class="value">${user.name} ${user.family || ''}</span>
            </div>
            ${user.isVerified ? `<div class="profile-user-info-item">
                <span class="label">وضعیت</span>
                <span class="value" style="color:#2AABEE;"><i class="fa fa-check-circle"></i> حساب رسمی</span>
            </div>` : ''}
        </div>
    `;

    hideMainSections();
    document.getElementById('profile-user-screen').classList.remove('hidden');
}

function closeProfileUser() {
    document.getElementById('profile-user-screen').classList.add('hidden');
    switchMainSection('chats');
}

function toggleUserVerify(userId) {
    const uid = userId.toLowerCase();
    if (!users[uid]) return;

    const newStatus = !users[uid].isVerified;
    users[uid].isVerified = newStatus;
    saveUsers(uid);

    alert(`✅ کاربر ${users[uid].name} ${newStatus ? 'وریفای' : 'آنوریفای'} شد!`);
    renderProfileUser(uid);
    renderChatList();
}

// ===== تابع برای رفتن به پروفایل از روی نام فرستنده =====
function goToProfileFromSender(senderId) {
    if (!senderId || senderId === currentUser.userId.toLowerCase()) {
        openProfile();
        return;
    }
    openProfileUser(senderId);
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
window.openProfileUser = openProfileUser;
window.closeProfileUser = closeProfileUser;
window.toggleUserVerify = toggleUserVerify;
window.goToProfileFromSender = goToProfileFromSender;

setTimeout(restoreSession, 400);