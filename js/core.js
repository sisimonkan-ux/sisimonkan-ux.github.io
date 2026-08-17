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
let tempAuth = {};

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

function saveUsers() {
    localStorage.setItem('app_users_v6', JSON.stringify(users));
    db.ref('app_users_v6').set(users);
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
