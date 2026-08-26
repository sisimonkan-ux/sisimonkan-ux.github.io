/* =========================================================
   core.js
   تنظیمات Firebase، متغیرهای مشترک (state) و توابع کمکی عمومی
   این فایل باید همیشه اول از همه لود شود.
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAUYnjKIDW33M4g6vFxDwYiIm3ZPFmPP9Q",
  authDomain: "jonlon.firebaseapp.com",
  databaseURL: "https://jonlon-default-rtdb.firebaseio.com",
  projectId: "jonlon",
  storageBucket: "jonlon.firebasestorage.app",
  messagingSenderId: "159750008628",
  appId: "1:159750008628:web:15701c88a46fbd75ddbf61",
  measurementId: "G-STSEFZ4PF9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---------- وضعیت مشترک برنامه (state) ---------- */
let currentUser = null;
let currentChat = null;
let replyingToMessageId = null;
let editingMessageId = null;
let activeTab = 'all';
let messageToForward = null;
let messageToDelete = null;
let selectedMessageObj = null;
let pendingImageBase64 = null;
let pendingVideoBase64 = null;
let pendingVoiceBase64 = null;
let tempAuth = {};

/* ---------- ضبط ویس ---------- */
let mediaRecorderInstance = null;
let recordedAudioChunks = [];
let voiceRecordTimerInterval = null;
let voiceRecordSeconds = 0;
const MAX_VOICE_SECONDS = 120;      // حداکثر ۲ دقیقه ویس
const MAX_VIDEO_FILE_MB = 15;       // حداکثر حجم ویدیو (به مگابایت)

let users = JSON.parse(localStorage.getItem('app_users_v6')) || {};
let messages = JSON.parse(localStorage.getItem('app_messages_v6')) || [];
let unreadCounts = JSON.parse(localStorage.getItem('app_unread_v6')) || {};
let blockedUsers = JSON.parse(localStorage.getItem('app_blocked_v6')) || {};
let reactionAlerts = JSON.parse(localStorage.getItem('app_reaction_alerts_v6')) || {};
let replyAlerts = JSON.parse(localStorage.getItem('app_reply_alerts_v6')) || {};
let chatMetaData = JSON.parse(localStorage.getItem('app_chat_meta_v6')) || {};

let chatLockStatus = JSON.parse(localStorage.getItem('app_chat_locks_v6')) || {
    'news_channel': true,
    'support_group': false
};

/* ---------- Firebase Sync Listeners ---------- */
db.ref('app_messages_v6').on('value', (snapshot) => {
    const data = snapshot.val();
    messages = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
    localStorage.setItem('app_messages_v6', JSON.stringify(messages));
    if (currentChat) renderMessages();
    renderChatList();
});

db.ref('app_users_v6').on('value', (snapshot) => {
    const data = snapshot.val();
    users = data || {};
    localStorage.setItem('app_users_v6', JSON.stringify(users));
    renderChatList();

    /* اگر همین الان یک کاربر عادی داخل برنامه لاگین است و مدیریت
       اکانتش را حذف یا تعلیق کرده باشد، بلافاصله (بدون نیاز به رفرش
       یا خروج/ورود دستی) از حساب خارجش می‌کنیم. */
    if (currentUser && !currentUser.isAdmin) {
        const uid = currentUser.userId.toLowerCase();
        const freshUser = users[uid];
        let kickMessage = null;

        if (!freshUser) {
            kickMessage = 'حساب کاربری شما توسط مدیریت حذف شده است.';
        } else if (freshUser.suspendedUntil && freshUser.suspendedUntil > Date.now()) {
            const days = Math.ceil((freshUser.suspendedUntil - Date.now()) / (24 * 60 * 60 * 1000));
            kickMessage = `حساب کاربری شما به‌صورت موقت تعلیق شده است.\nزمان باقی‌مانده: حدود ${days} روز دیگر.`;
        }

        if (kickMessage) {
            currentUser = null;
            localStorage.removeItem('app_current_session_v6');
            hideMainSections();
            const authScreen = document.getElementById('auth-screen');
            if (authScreen) authScreen.classList.remove('hidden');
            if (typeof switchToLogin === 'function') switchToLogin();
            alert(kickMessage);
        }
    }
});

db.ref('app_unread_v6').on('value', (snapshot) => {
    const data = snapshot.val();
    unreadCounts = data || {};
    localStorage.setItem('app_unread_v6', JSON.stringify(unreadCounts));
    renderChatList();
});

db.ref('app_chat_locks_v6').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        chatLockStatus = data;
        localStorage.setItem('app_chat_locks_v6', JSON.stringify(chatLockStatus));
        if (currentChat) {
            openChat(currentChat.id, currentChat.title, currentChat.type, currentChat.isVerified);
        }
    }
});

/* ---------- توابع کمکی عمومی ---------- */
function compressAndReadImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 800;
            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function readVideoFileAsBase64(file, callback) {
    if (!file.type.startsWith('video/')) {
        alert('لطفا یک فایل ویدیویی معتبر انتخاب کنید.');
        return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_FILE_MB) {
        alert(`حجم ویدیو زیاد است. لطفا ویدیویی کمتر از ${MAX_VIDEO_FILE_MB} مگابایت انتخاب کنید.`);
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        callback(e.target.result, file.size);
    };
    reader.readAsDataURL(file);
}

function formatRecordTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function getSavedMessagesChatId() {
    return `saved_${currentUser.userId.toLowerCase()}`;
}

function getStaticChats() {
    return [
        { id: 'news_channel', title: 'کانال اخبار پشتیبانی', type: 'channel', isVerified: true },
        { id: 'support_group', title: 'گروه پشتیبانی', type: 'group', isVerified: true },
        { id: getSavedMessagesChatId(), title: 'پیام‌های ذخیره شده', type: 'saved', isVerified: false },
        { id: 'admin', title: 'پشتیبانی مرکزی', type: 'direct', isVerified: true }
    ];
}

function saveMessages() {
    localStorage.setItem('app_messages_v6', JSON.stringify(messages));
    db.ref('app_messages_v6').set(messages);
}

/* توجه: به‌جای بازنویسی کل نود app_users_v6 (که در صورت ناقص/قدیمی بودن
   نسخه‌ی محلی، باعث پاک شدن اکانت‌های دیگران می‌شد)، فقط رکورد همان
   کاربری که تغییر کرده را در دیتابیس می‌نویسیم. اگر رنیم/تغییر آیدی
   رخ داده باشد (deletedUserId)، آیدی قدیمی را جداگانه حذف می‌کنیم. */
function saveUsers(changedUserId, deletedUserId) {
    localStorage.setItem('app_users_v6', JSON.stringify(users));

    if (changedUserId && users[changedUserId]) {
        db.ref('app_users_v6/' + changedUserId).set(users[changedUserId]);
    }
    if (deletedUserId) {
        db.ref('app_users_v6/' + deletedUserId).remove();
    }
}

function setActiveNav(tab) {
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-nav') === tab);
    });
}

function hideMainSections() {
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('settings-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
}

function switchMainSection(tab) {
    if (tab === 'chats') {
        hideMainSections();
        document.getElementById('main-screen').classList.remove('hidden');
        renderChatList();
    } else if (tab === 'settings') {
        openSettings();
    } else if (tab === 'profile') {
        openProfile();
    }
    setActiveNav(tab);
}

window.switchMainSection = switchMainSection;

/* ---------- تطبیق ارتفاع صفحه با ظاهر شدن کیبورد موبایل ----------
   چون html/body با position:fixed تنظیم شده، با باز شدن کیبورد در
   موبایل، ارتفاع innerHeight تغییر نمی‌کند و کادر نوشتن پیام زیر
   کیبورد پنهان می‌ماند. با گوش دادن به visualViewport، ارتفاع واقعی
   صفحه‌ی قابل مشاهده را به .screen اعمال می‌کنیم تا کادر ورودی همیشه
   بالای کیبورد باقی بماند. */
function setupViewportKeyboardFix() {
    function updateHeight() {
        const vv = window.visualViewport;
        const h = vv ? vv.height : window.innerHeight;
        document.querySelectorAll('.screen').forEach(el => {
            el.style.height = h + 'px';
        });
        if (vv) window.scrollTo(0, 0);
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateHeight);
        window.visualViewport.addEventListener('scroll', updateHeight);
    }
    window.addEventListener('resize', updateHeight);
    updateHeight();

    // وقتی کاربر روی کادر نوشتن پیام می‌زند، مطمئن می‌شویم آن قسمت
    // در دید باقی می‌ماند و کیبورد آن را نمی‌پوشاند.
    const msgInput = document.getElementById('message-input');
    if (msgInput) {
        msgInput.addEventListener('focus', () => {
            setTimeout(updateHeight, 300);
            setTimeout(() => {
                msgInput.scrollIntoView({ block: 'end', behavior: 'smooth' });
            }, 350);
        });
    }
}

document.addEventListener('DOMContentLoaded', setupViewportKeyboardFix);
