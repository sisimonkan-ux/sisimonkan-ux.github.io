/* =========================================================
   admin.js
   پنل مدیریت: لیست کاربران، تعداد کل اکانت‌ها، قفل/باز کردن گفتگو
   وابسته به: core.js
   ========================================================= */

function openAdminPanel() {
    const userList = Object.values(users);
    document.getElementById('total-users-count').innerText = userList.length;

    const listContainer = document.getElementById('admin-user-list');
    listContainer.innerHTML = '';

    if (userList.length === 0) {
        listContainer.innerHTML = '<p style="font-size:12px; color:#7f91a4; text-align:center;">هیچ کاربری هنوز ثبت‌نام نکرده است.</p>';
    } else {
        userList.forEach(u => {
            const avatarHtml = u.avatar ? `<img src="${u.avatar}" class="avatar-img" style="width:30px;height:30px;margin-left:8px;">` : '';
            const div = document.createElement('div');
            div.className = 'user-list-item';
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    ${avatarHtml}
                    <div>
                        <b>${u.name} ${u.family}</b>
                        <div style="font-size:11px; color:#6ab0ff;">@${u.userId}</div>
                    </div>
                </div>
                <span style="font-size:11px; color:#aaa;">نام کاربری: ${u.username}</span>
            `;
            listContainer.appendChild(div);
        });
    }

    document.getElementById('settings-screen').classList.add('hidden');
    document.getElementById('admin-panel-screen').classList.remove('hidden');
}

function closeAdminPanel() {
    document.getElementById('admin-panel-screen').classList.add('hidden');
    document.getElementById('settings-screen').classList.remove('hidden');
}

function toggleChatLock(chatId) {
    chatLockStatus[chatId] = !chatLockStatus[chatId];
    localStorage.setItem('app_chat_locks_v6', JSON.stringify(chatLockStatus));
    db.ref('app_chat_locks_v6').set(chatLockStatus);

    alert(chatLockStatus[chatId] ? 'گفتگو قفل شد!' : 'گفتگو باز شد!');
    closeChatOptionsMenu();
    openChat(currentChat.id, currentChat.title, currentChat.type, currentChat.isVerified);
}

window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.toggleChatLock = toggleChatLock;
