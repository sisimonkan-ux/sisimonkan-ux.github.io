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
            const isSuspended = u.suspendedUntil && u.suspendedUntil > Date.now();
            const suspendBadge = isSuspended
                ? `<div style="font-size:10px; color:#ffb84d; margin-top:6px;"><i class="fa fa-clock"></i> تعلیق تا ${new Date(u.suspendedUntil).toLocaleDateString('fa-IR')}</div>`
                : '';

            const isVerified = !!u.verified;
            const verifiedNameBadge = isVerified ? ' <i class="fa-solid fa-circle-check verified-badge"></i>' : '';

            const div = document.createElement('div');
            div.className = 'user-list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'stretch';
            div.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center;">
                        ${avatarHtml}
                        <div>
                            <b>${u.name} ${u.family}${verifiedNameBadge}</b>
                            <div style="font-size:11px; color:#6ab0ff;">@${u.userId}</div>
                        </div>
                    </div>
                    <span style="font-size:11px; color:#aaa;">نام کاربری: ${u.username}</span>
                </div>
                ${suspendBadge}
                <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                    <select id="suspend-days-${u.userId}" style="flex:1; min-width:70px; font-size:11px; background:#242f3d; color:#fff; border:1px solid #37424f; border-radius:5px; padding:6px;">
                        <option value="7">۷ روز</option>
                        <option value="15">۱۵ روز</option>
                        <option value="30">۳۰ روز</option>
                    </select>
                    <button class="modal-btn btn-secondary" style="flex:1; min-width:80px; padding:6px; font-size:11px;" onclick="adminSuspendUser('${u.userId}')"><i class="fa fa-clock"></i> تعلیق</button>
                    ${isSuspended ? `<button class="modal-btn btn-secondary" style="flex:1; min-width:80px; padding:6px; font-size:11px;" onclick="adminUnsuspendUser('${u.userId}')"><i class="fa fa-unlock"></i> لغو تعلیق</button>` : ''}
                    <button class="modal-btn btn-secondary" style="flex:1; min-width:80px; padding:6px; font-size:11px; ${isVerified ? 'background:#2AABEE;' : ''}" onclick="adminToggleVerified('${u.userId}')"><i class="fa fa-certificate"></i> ${isVerified ? 'حذف تیک رسمی' : 'دادن تیک رسمی'}</button>
                    <button class="modal-btn btn-danger" style="flex:1; min-width:80px; padding:6px; font-size:11px;" onclick="adminDeleteUser('${u.userId}')"><i class="fa fa-trash"></i> حذف اکانت</button>
                </div>
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

/* ---------- حذف اکانت توسط مدیریت ---------- */
function adminDeleteUser(userId) {
    const uid = userId.toLowerCase();
    if (!users[uid]) return;

    if (!confirm(`آیا مطمئنید می‌خواهید اکانت @${userId} را برای همیشه حذف کنید؟ این عمل قابل بازگشت نیست.`)) return;

    delete users[uid];
    saveUsers(null, uid);

    alert(`اکانت @${userId} با موفقیت حذف شد.`);
    openAdminPanel();
}

/* ---------- تعلیق موقت اکانت توسط مدیریت (بر حسب روز) ---------- */
function adminSuspendUser(userId) {
    const uid = userId.toLowerCase();
    if (!users[uid]) return;

    const select = document.getElementById(`suspend-days-${userId}`);
    const days = select ? parseInt(select.value, 10) : 7;
    if (!days || days <= 0) return;

    if (!confirm(`آیا مطمئنید می‌خواهید اکانت @${userId} را به مدت ${days} روز تعلیق کنید؟`)) return;

    users[uid].suspendedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    saveUsers(uid);

    alert(`اکانت @${userId} به مدت ${days} روز تعلیق شد.`);
    openAdminPanel();
}

/* ---------- لغو تعلیق اکانت ---------- */
function adminUnsuspendUser(userId) {
    const uid = userId.toLowerCase();
    if (!users[uid]) return;

    delete users[uid].suspendedUntil;
    saveUsers(uid);

    alert(`تعلیق اکانت @${userId} لغو شد.`);
    openAdminPanel();
}

/* ---------- دادن / حذف تیک رسمی (Verified) به یک اکانت ---------- */
function adminToggleVerified(userId) {
    const uid = userId.toLowerCase();
    if (!users[uid]) return;

    users[uid].verified = !users[uid].verified;
    saveUsers(uid);

    alert(users[uid].verified ? `تیک رسمی به @${userId} داده شد.` : `تیک رسمی از @${userId} حذف شد.`);
    openAdminPanel();
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
window.adminDeleteUser = adminDeleteUser;
window.adminSuspendUser = adminSuspendUser;
window.adminUnsuspendUser = adminUnsuspendUser;
window.adminToggleVerified = adminToggleVerified;
