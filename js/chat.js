/* =========================================================
   chat.js
   لیست گفتگوها، ارسال/نمایش پیام، ری‌اکشن، پاسخ،
   حذف، فوروارد، بلاک کاربر و مدیریت تصویر گفتگو
   وابسته به: core.js
   ========================================================= */

function switchTab(tab, element) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    renderChatList();
}

function getAllChatsList() {
    let list = getStaticChats().filter(chat => {
        if (currentUser.isAdmin && chat.id === 'admin') return false;
        return true;
    });
    const myId = currentUser.userId.toLowerCase();
    const hasConvWith = new Set();
    messages.forEach(m => {
        if (m.deletedFor && m.deletedFor.includes(myId)) return;
        const sId = (m.sender || '').toLowerCase();
        const cId = (m.chatId || '').toLowerCase();
        if (sId === myId && users[cId] && cId !== 'admin') hasConvWith.add(cId);
        if (cId === myId && users[sId] && sId !== 'admin') hasConvWith.add(sId);
    });
    hasConvWith.forEach(uId => {
        const u = users[uId];
        if (u && !list.find(c => c.id.toLowerCase() === uId)) {
            list.push({ id: uId, title: `${u.name} ${u.family}`, type: 'direct', isVerified: false, avatar: u.avatar });
        }
    });
    return list;
}

function renderChatList() {
    const container = document.getElementById('chat-list-container');
    if(!container) return;
    container.innerHTML = '';

    let list = getAllChatsList();
    const myId = currentUser ? currentUser.userId.toLowerCase() : '';

    list.forEach(chat => {
        if (activeTab !== 'all' && chat.type !== activeTab && !(activeTab === 'direct' && chat.type === 'saved')) return;

        const unreadKey = `${myId}_${chat.id.toLowerCase()}`;
        const count = unreadCounts[unreadKey] || 0;

        const hasReactionAlert = (reactionAlerts[myId] || {})[chat.id.toLowerCase()];
        const hasReplyAlert = (replyAlerts[myId] || {})[chat.id.toLowerCase()];

        let badgesHtml = '<div class="badge-container">';
        if (hasReactionAlert) badgesHtml += `<span class="reaction-badge">❤️</span>`;
        if (hasReplyAlert) badgesHtml += `<span class="reply-badge" title="پاسخ داده شده"><i class="fa fa-reply"></i></span>`;
        if (count > 0) badgesHtml += `<span class="unread-badge">${count}</span>`;
        badgesHtml += '</div>';

        const verifiedHtml = chat.isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';

        let avatarHtml = '';
        const customChatMeta = chatMetaData[chat.id.toLowerCase()];
        if (customChatMeta && customChatMeta.avatar) {
            avatarHtml = `<img src="${customChatMeta.avatar}" class="avatar-img">`;
        } else if (chat.avatar) {
            avatarHtml = `<img src="${chat.avatar}" class="avatar-img">`;
        } else if (chat.id === 'admin' && users['admin'] && users['admin'].avatar) {
            avatarHtml = `<img src="${users['admin'].avatar}" class="avatar-img">`;
        } else {
            let iconClass = 'fa-user';
            if(chat.type === 'channel') iconClass = 'fa-bullhorn';
            if(chat.type === 'group') iconClass = 'fa-users';
            if(chat.type === 'saved') iconClass = 'fa-bookmark';
            avatarHtml = `<div class="avatar-placeholder"><i class="fa-solid ${iconClass}"></i></div>`;
        }

        let lastMsgText = 'برای مشاهده گفتگو کلیک کنید';
        const chatId_lc = chat.id.toLowerCase();
        const myId_lc = myId;
        const chatMsgsForPreview = messages.filter(m => {
            if (m.deletedFor && m.deletedFor.includes(myId_lc)) return false;
            if (chat.type === 'saved') return (m.chatId||'').toLowerCase() === getSavedMessagesChatId();
            if (chat.type === 'direct') {
                return ((m.sender||'').toLowerCase() === myId_lc && (m.chatId||'').toLowerCase() === chatId_lc) ||
                       ((m.sender||'').toLowerCase() === chatId_lc && (m.chatId||'').toLowerCase() === myId_lc);
            }
            return (m.chatId||'').toLowerCase() === chatId_lc;
        });
        if (chatMsgsForPreview.length > 0) {
            const lastMsg = chatMsgsForPreview[chatMsgsForPreview.length - 1];
            lastMsgText = lastMsg.image ? '📷 تصویر' : lastMsg.video ? '🎥 ویدیو' : lastMsg.voice ? '🎙 پیام صوتی' : (lastMsg.text || '').substring(0, 40);
        }

        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => openChat(chat.id, chat.title, chat.type, chat.isVerified);
        div.innerHTML = `
            ${avatarHtml}
            <div class="details">
                <h4>${chat.title} ${verifiedHtml}</h4>
                <p>${lastMsgText}</p>
            </div>
            ${badgesHtml}
        `;
        container.appendChild(div);
    });
}

function openChatOptionsMenu() {
    if (!currentChat) return;

    const list = document.getElementById('chat-options-list');
    list.innerHTML = '';

    const myId = currentUser.userId.toLowerCase();
    const chatId = currentChat.id.toLowerCase();

    if (currentChat.type === 'direct' && chatId !== getSavedMessagesChatId()) {
        if (chatId !== 'admin') {
            const myBlockedList = blockedUsers[myId] || [];
            const isBlockedByMe = myBlockedList.includes(chatId);

            list.innerHTML += `<button class="modal-btn ${isBlockedByMe ? 'btn-secondary' : 'btn-danger'}" onclick="toggleBlockUser('${chatId}')"><i class="fa fa-ban"></i> ${isBlockedByMe ? 'آن‌بلاک کردن کاربر' : 'بلاک کردن کاربر'}</button>`;
            list.innerHTML += `<button class="modal-btn btn-danger" onclick="closeChatOptionsMenu(); openDeleteChatModal();"><i class="fa fa-trash"></i> حذف کامل پیوی</button>`;
        }
    }

    if (currentUser.isAdmin && (currentChat.type === 'group' || currentChat.type === 'channel')) {
        const isLocked = chatLockStatus[chatId] || false;
        list.innerHTML += `<button class="modal-btn btn-secondary" onclick="toggleChatLock('${chatId}')"><i class="fa fa-${isLocked ? 'unlock' : 'lock'}"></i> ${isLocked ? 'باز کردن قفل ارسال پیام' : 'قفل کردن ارسال پیام'}</button>`;
        list.innerHTML += `<button class="modal-btn btn-secondary" style="background:#e5824b;" onclick="document.getElementById('group-avatar-file-input').click()"><i class="fa fa-camera"></i> تغییر عکس ${currentChat.type === 'channel' ? 'کانال' : 'گروه'}</button>`;
    }

    document.getElementById('chat-options-modal').classList.remove('hidden');
}

function closeChatOptionsMenu() {
    document.getElementById('chat-options-modal').classList.add('hidden');
}

function openChat(chatId, title, type, isVerified) {
    currentChat = { id: chatId, title, type, isVerified };

    const chatMsgs = messages.filter(m => filterMsgForUser(m));

    const unreadKey = `${currentUser.userId.toLowerCase()}_${chatId.toLowerCase()}`;
    const count = unreadCounts[unreadKey] || 0;

    let markUnreadIndex = -1;
    if (count > 0 && chatMsgs.length >= count) {
        markUnreadIndex = chatMsgs.length - count;
    }

    unreadCounts[unreadKey] = 0;
    localStorage.setItem('app_unread_v6', JSON.stringify(unreadCounts));
    db.ref('app_unread_v6').set(unreadCounts);

    const myId = currentUser.userId.toLowerCase();
    if (reactionAlerts[myId]) {
        delete reactionAlerts[myId][chatId.toLowerCase()];
        localStorage.setItem('app_reaction_alerts_v6', JSON.stringify(reactionAlerts));
    }
    if (replyAlerts[myId]) {
        delete replyAlerts[myId][chatId.toLowerCase()];
        localStorage.setItem('app_reply_alerts_v6', JSON.stringify(replyAlerts));
    }

    const verifiedHtml = isVerified ? ' <i class="fa-solid fa-circle-check verified-badge"></i>' : '';
    document.getElementById('current-chat-title').innerHTML = title + verifiedHtml;
    const subtitleEl = document.getElementById('current-chat-subtitle');
    if (type === 'direct') {
        subtitleEl.textContent = '@' + chatId;
    } else if (type === 'group') {
        subtitleEl.textContent = 'گروه';
    } else if (type === 'channel') {
        subtitleEl.textContent = 'کانال';
    } else if (type === 'saved') {
        subtitleEl.textContent = 'پیام‌های ذخیره شده';
    } else {
        subtitleEl.textContent = '';
    }

    const headerAvatarContainer = document.getElementById('chat-header-avatar');
    const customChatMeta = chatMetaData[chatId.toLowerCase()];
    if (customChatMeta && customChatMeta.avatar) {
        headerAvatarContainer.innerHTML = `<img src="${customChatMeta.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`;
    } else if (type === 'direct' && users[chatId.toLowerCase()] && users[chatId.toLowerCase()].avatar) {
        headerAvatarContainer.innerHTML = `<img src="${users[chatId.toLowerCase()].avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`;
    } else {
        headerAvatarContainer.innerHTML = '';
    }

    const isLocked = chatLockStatus[chatId] || false;
    const inputArea = document.getElementById('input-area');
    const lockedNotice = document.getElementById('locked-notice');

    const targetBlockedList = blockedUsers[chatId.toLowerCase()] || [];
    const amIBlockedByTarget = targetBlockedList.includes(currentUser.userId.toLowerCase());
    const myBlockedList = blockedUsers[currentUser.userId.toLowerCase()] || [];
    const isTargetBlockedByMe = myBlockedList.includes(chatId.toLowerCase());

    if (isTargetBlockedByMe) {
        inputArea.style.display = 'none';
        lockedNotice.innerHTML = '<i class="fa fa-ban"></i> شما این کاربر را بلاک کرده‌اید و نمی‌توانید به او پیام دهید.';
        lockedNotice.classList.remove('hidden');
    } else if (amIBlockedByTarget) {
        inputArea.style.display = 'none';
        lockedNotice.innerHTML = '<i class="fa fa-ban"></i> امکان ارسال پیام در این گفتگو وجود ندارد.';
        lockedNotice.classList.remove('hidden');
    } else if (isLocked && !currentUser.isAdmin) {
        inputArea.style.display = 'none';
        lockedNotice.innerHTML = '<i class="fa fa-lock"></i> ارسال پیام در این گفتگو محدود شده است.';
        lockedNotice.classList.remove('hidden');
    } else {
        inputArea.style.display = 'flex';
        lockedNotice.classList.add('hidden');
    }

    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('chat-screen').classList.remove('hidden');

    removePendingImage();
    removePendingVideo();
    removePendingVoice();
    renderMessages(markUnreadIndex);
}

function handleVoiceButtonClick() {
    if (mediaRecorderInstance && mediaRecorderInstance.state === 'recording') return;
    startVoiceRecording();
}

/* ---------- انتخاب فایل از گالری: فقط عکس ---------- */
function handleChatMediaSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('لطفا یک فایل تصویری معتبر انتخاب کنید.');
        event.target.value = '';
        return;
    }

    removePendingImage();
    removePendingVoice();

    compressAndReadImage(file, function(base64Img) {
        pendingImageBase64 = base64Img;
        document.getElementById('img-preview-thumb').src = base64Img;
        document.getElementById('img-preview-bar').classList.remove('hidden');
    });
    event.target.value = '';
}

function removePendingImage() {
    pendingImageBase64 = null;
    document.getElementById('img-preview-bar').classList.add('hidden');
    document.getElementById('img-preview-thumb').src = '';
}

function removePendingVideo() {
    pendingVideoBase64 = null;
}

function removePendingVoice() {
    pendingVoiceBase64 = null;
    document.getElementById('voice-preview-bar').classList.add('hidden');
    const audioEl = document.getElementById('voice-preview-audio');
    if (audioEl) audioEl.src = '';
}

async function startVoiceRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.');
        return;
    }
    removePendingImage();
    removePendingVideo();
    removePendingVoice();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedAudioChunks = [];

        /* انتخاب فرمت ضبط: در آیفون/سافاری اصلاً webm پشتیبانی نمی‌شود (نه ضبط، نه پخش)
           و همین باعث می‌شد ویس‌ها روی گوشی‌های اپل اصلاً پخش نشوند. با اولویت دادن
           به mp4 (که هم روی اندروید/کروم و هم روی آیفون/سافاری پخش می‌شود) این مشکل رفع می‌شود. */
        const mimeCandidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        let chosenMime = '';
        for (const m of mimeCandidates) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) {
                chosenMime = m;
                break;
            }
        }
        mediaRecorderInstance = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);

        mediaRecorderInstance.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) recordedAudioChunks.push(e.data);
        };

        mediaRecorderInstance.onstop = function() {
            stream.getTracks().forEach(track => track.stop());
            if (recordedAudioChunks.length === 0) return;
            const actualMime = (mediaRecorderInstance.mimeType || chosenMime || 'audio/webm').split(';')[0];
            const blob = new Blob(recordedAudioChunks, { type: actualMime });
            const reader = new FileReader();
            reader.onload = function(e) {
                pendingVoiceBase64 = e.target.result;
                document.getElementById('voice-preview-duration').innerText = formatRecordTime(voiceRecordSeconds);
                document.getElementById('voice-preview-audio').src = pendingVoiceBase64;
                document.getElementById('voice-preview-bar').classList.remove('hidden');
            };
            reader.readAsDataURL(blob);
        };

        mediaRecorderInstance.start();
        voiceRecordSeconds = 0;
        document.getElementById('mic-record-indicator').classList.remove('hidden');
        document.getElementById('mic-record-timer').innerText = formatRecordTime(voiceRecordSeconds);
        document.getElementById('btn-voice-record').classList.add('recording-active');

        voiceRecordTimerInterval = setInterval(function() {
            voiceRecordSeconds++;
            document.getElementById('mic-record-timer').innerText = formatRecordTime(voiceRecordSeconds);
            if (voiceRecordSeconds >= MAX_VOICE_SECONDS) {
                stopVoiceRecording();
            }
        }, 1000);
    } catch (err) {
        alert('دسترسی به میکروفون امکان‌پذیر نشد. لطفا اجازه دسترسی را بررسی کنید.');
    }
}

function stopVoiceRecording() {
    if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
        mediaRecorderInstance.stop();
    }
    clearInterval(voiceRecordTimerInterval);
    document.getElementById('mic-record-indicator').classList.add('hidden');
    document.getElementById('btn-voice-record').classList.remove('recording-active');
}

function cancelVoiceRecording() {
    if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
        recordedAudioChunks = [];
        mediaRecorderInstance.onstop = function() {
            mediaRecorderInstance.stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderInstance.stop();
    }
    clearInterval(voiceRecordTimerInterval);
    document.getElementById('mic-record-indicator').classList.add('hidden');
    document.getElementById('btn-voice-record').classList.remove('recording-active');
    pendingVoiceBase64 = null;
    document.getElementById('voice-preview-bar').classList.add('hidden');
}

function uploadGroupOrChannelAvatar(event) {
    const file = event.target.files[0];
    if (!file || !currentChat) return;

    compressAndReadImage(file, function(base64Image) {
        const chatId = currentChat.id.toLowerCase();
        if (!chatMetaData[chatId]) chatMetaData[chatId] = {};
        chatMetaData[chatId].avatar = base64Image;

        localStorage.setItem('app_chat_meta_v6', JSON.stringify(chatMetaData));
        alert('تصویر این بخش با موفقیت تغییر کرد!');
        closeChatOptionsMenu();
        openChat(currentChat.id, currentChat.title, currentChat.type, currentChat.isVerified);
    });
}

function viewFullImage(imageSrc) {
    document.getElementById('full-image-target').src = imageSrc;
    document.getElementById('image-viewer-modal').classList.remove('hidden');
}

function closeImageViewer() {
    document.getElementById('image-viewer-modal').classList.add('hidden');
}

function openMessageMenu(msgId) {
    const msgObj = messages.find(m => m.id === msgId);
    if (!msgObj) return;

    selectedMessageObj = msgObj;
    const isMyMsg = msgObj.sender.toLowerCase() === currentUser.userId.toLowerCase();

    const reactionsContainer = document.getElementById('message-reactions-list');
    reactionsContainer.innerHTML = '';

    if (currentChat.type === 'channel') {
        reactionsContainer.innerHTML = '<div style="font-size:11px; color:#aaa; text-align:center;"><i class="fa fa-eye-slash"></i> لیست افراد واکنش‌دهنده در کانال نمایش داده نمی‌شود.</div>';
    } else {
        let totalReactionsCount = 0;
        let reactionsHtml = '<div class="reactions-info-title"><i class="fa fa-heart"></i> واکنش‌های ثبت‌شده روی این پیام:</div>';

        if (msgObj.reactions) {
            for (let emoji in msgObj.reactions) {
                const userList = msgObj.reactions[emoji];
                if (userList && userList.length > 0) {
                    userList.forEach(uId => {
                        totalReactionsCount++;
                        let fullName = 'کاربر ناشناس';
                        if (uId.toLowerCase() === 'admin') {
                            fullName = 'پشتیبانی مرکزی';
                        } else if (users[uId.toLowerCase()]) {
                            const u = users[uId.toLowerCase()];
                            fullName = `${u.name} ${u.family}`;
                        } else if (uId.toLowerCase() === currentUser.userId.toLowerCase()) {
                            fullName = `${currentUser.name} ${currentUser.family} (شما)`;
                        }

                        reactionsHtml += `
                            <div class="reaction-user-row">
                                <span>${emoji} <b>${fullName}</b></span>
                                <span style="color:#7f91a4; font-size:11px;">@${uId}</span>
                            </div>
                        `;
                    });
                }
            }
        }

        if (totalReactionsCount === 0) {
            reactionsContainer.innerHTML = '<div style="font-size:11px; color:#aaa; text-align:center;">هنوز هیچ واکنشی ثبت نشده است.</div>';
        } else {
            reactionsContainer.innerHTML = reactionsHtml;
        }
    }

    const actionsContainer = document.getElementById('message-menu-actions');
    actionsContainer.innerHTML = '';

    actionsContainer.innerHTML += `<button class="modal-btn btn-secondary" onclick="triggerAction('reply')"><i class="fa fa-reply"></i> پاسخ به پیام</button>`;
    actionsContainer.innerHTML += `<button class="modal-btn btn-secondary" onclick="triggerAction('forward')"><i class="fa fa-share"></i> فوروارد پیام</button>`;

    let canEdit = isMyMsg && !msgObj.image && !msgObj.video && !msgObj.voice;
    if (currentChat.type === 'channel' && !currentUser.isAdmin) canEdit = false;
    if (canEdit) {
        actionsContainer.innerHTML += `<button class="modal-btn btn-secondary" onclick="triggerAction('edit')"><i class="fa fa-edit"></i> ویرایش متن پیام</button>`;
    }

    actionsContainer.innerHTML += `<button class="modal-btn btn-danger" onclick="triggerAction('delete')"><i class="fa fa-trash"></i> حذف پیام</button>`;

    document.getElementById('message-menu-modal').classList.remove('hidden');
}

function closeMessageMenu() {
    document.getElementById('message-menu-modal').classList.add('hidden');
}

function triggerAction(action) {
    closeMessageMenu();
    if (!selectedMessageObj) return;

    if (action === 'reply') {
        setReply(selectedMessageObj.id, selectedMessageObj.text || 'تصویر');
    } else if (action === 'forward') {
        openForwardModal(selectedMessageObj.id);
    } else if (action === 'edit') {
        startEditMessage(selectedMessageObj.id, selectedMessageObj.text);
    } else if (action === 'delete') {
        openDeleteModal(selectedMessageObj.id);
    }
}

function executeQuickReaction(emoji) {
    if (selectedMessageObj) {
        addReaction(selectedMessageObj.id, emoji);
        openMessageMenu(selectedMessageObj.id);
    }
}

function openDeleteChatModal() {
    if (currentChat && currentChat.id.toLowerCase() === 'admin') {
        return alert('امکان حذف گفتگو با پشتیبانی مرکزی وجود ندارد!');
    }
    document.getElementById('delete-chat-modal').classList.remove('hidden');
}

function closeDeleteChatModal() {
    document.getElementById('delete-chat-modal').classList.add('hidden');
}

function executeDeleteChat(mode) {
    if (!currentChat || currentChat.type !== 'direct') return;

    const targetId = currentChat.id.toLowerCase();
    const myId = currentUser.userId.toLowerCase();

    if (targetId === 'admin') {
        closeDeleteChatModal();
        return alert('امکان حذف پیوی پشتیبانی وجود ندارد!');
    }

    if (mode === 'everyone') {
        messages = messages.filter(m => {
            const isBetween = (m.sender.toLowerCase() === myId && m.chatId.toLowerCase() === targetId) ||
                              (m.sender.toLowerCase() === targetId && m.chatId.toLowerCase() === myId);
            return !isBetween;
        });
    } else if (mode === 'me') {
        messages.forEach(m => {
            const isBetween = (m.sender.toLowerCase() === myId && m.chatId.toLowerCase() === targetId) ||
                              (m.sender.toLowerCase() === targetId && m.chatId.toLowerCase() === myId);
            if (isBetween) {
                if (!m.deletedFor) m.deletedFor = [];
                if (!m.deletedFor.includes(myId)) {
                    m.deletedFor.push(myId);
                }
            }
        });
    }

    saveMessages();
    closeDeleteChatModal();
    closeChat();
    alert('پیوی با موفقیت حذف شد.');
}

function toggleBlockUser(targetUserId) {
    const targetId = targetUserId.toLowerCase();
    if (targetId === 'admin') {
        return alert('امکان بلاک کردن پشتیبانی وجود ندارد.');
    }

    const myId = currentUser.userId.toLowerCase();
    if (!blockedUsers[myId]) {
        blockedUsers[myId] = [];
    }

    const index = blockedUsers[myId].indexOf(targetId);
    if (index > -1) {
        blockedUsers[myId].splice(index, 1);
        alert('کاربر از لیست بلاک خارج شد.');
    } else {
        blockedUsers[myId].push(targetId);
        alert('کاربر بلاک شد.');
    }

    localStorage.setItem('app_blocked_v6', JSON.stringify(blockedUsers));
    closeChatOptionsMenu();
    openChat(currentChat.id, currentChat.title, currentChat.type, currentChat.isVerified);
}

function filterMsgForUser(m) {
    if (!currentChat) return false;

    const myId = currentUser.userId.toLowerCase();
    const chatId = currentChat.id.toLowerCase();

    if (m.deletedFor && m.deletedFor.includes(myId)) {
        return false;
    }

    if (currentChat.type === 'saved') {
        return m.chatId.toLowerCase() === getSavedMessagesChatId();
    } else if (currentChat.type === 'direct') {
        return (m.sender.toLowerCase() === myId && m.chatId.toLowerCase() === chatId) ||
               (m.sender.toLowerCase() === chatId && m.chatId.toLowerCase() === myId);
    } else {
        return m.chatId.toLowerCase() === chatId;
    }
}

function closeChat() {
    currentChat = null;
    cancelReply();
    removePendingImage();
    removePendingVideo();
    removePendingVoice();
    document.getElementById('chat-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    renderChatList();
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if ((!text && !pendingImageBase64 && !pendingVideoBase64 && !pendingVoiceBase64) || !currentChat) return;

    if (editingMessageId) {
        const msgObj = messages.find(m => m.id === editingMessageId);
        if (msgObj) {
            msgObj.text = text;
            msgObj.isEdited = true;
            saveMessages();
        }
        cancelReply();
        renderMessages();
        input.value = '';
        return;
    }

    messages.push({
        id: Date.now(),
        sender: currentUser.userId,
        chatId: currentChat.id,
        text: text,
        image: pendingImageBase64,
        video: pendingVideoBase64,
        voice: pendingVoiceBase64,
        replyTo: replyingToMessageId,
        forwardFrom: null,
        reactions: {},
        deletedFor: [],
        isEdited: false
    });

    if (replyingToMessageId) {
        const parentMsg = messages.find(m => m.id === replyingToMessageId);
        if (parentMsg && parentMsg.sender.toLowerCase() !== currentUser.userId.toLowerCase()) {
            const targetOwnerId = parentMsg.sender.toLowerCase();
            if (!replyAlerts[targetOwnerId]) replyAlerts[targetOwnerId] = {};
            replyAlerts[targetOwnerId][currentChat.id.toLowerCase()] = true;
            localStorage.setItem('app_reply_alerts_v6', JSON.stringify(replyAlerts));
        }
    }

    if (currentChat.type === 'direct') {
        const targetKey = `${currentChat.id.toLowerCase()}_${currentUser.userId.toLowerCase()}`;
        unreadCounts[targetKey] = (unreadCounts[targetKey] || 0) + 1;
    } else if (currentChat.type !== 'saved') {
        Object.keys(users).forEach(uId => {
            if (uId.toLowerCase() !== currentUser.userId.toLowerCase()) {
                const key = `${uId.toLowerCase()}_${currentChat.id.toLowerCase()}`;
                unreadCounts[key] = (unreadCounts[key] || 0) + 1;
            }
        });
    }
    localStorage.setItem('app_unread_v6', JSON.stringify(unreadCounts));
    db.ref('app_unread_v6').set(unreadCounts);

    saveMessages();
    input.value = '';
    cancelReply();
    removePendingImage();
    removePendingVideo();
    removePendingVoice();
    renderMessages();
}

function renderMessages(unreadStartIndex = -1) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    if (!currentChat) return;

    const chatMsgs = messages.filter(m => filterMsgForUser(m));

    chatMsgs.forEach((msg, index) => {
        if (index === unreadStartIndex && unreadStartIndex !== -1) {
            const sep = document.createElement('div');
            sep.className = 'unread-separator';
            sep.innerHTML = '<span>پیام‌های خوانده نشده</span>';
            container.appendChild(sep);
        }

        const isMyMsg = msg.sender.toLowerCase() === currentUser.userId.toLowerCase();
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isMyMsg ? 'my-msg' : ''}`;
        msgDiv.id = `msg-${msg.id}`;

        msgDiv.onclick = () => openMessageMenu(msg.id);

        let senderNameHtml = '';
        let avatarHtml = '';
        const senderId = (msg.sender || '').toLowerCase();

        if (currentChat.type === 'group' || currentChat.type === 'channel') {
            if (!isMyMsg) {
                if (senderId === 'admin') {
                    senderNameHtml = `<div class="sender-name" onclick="event.stopPropagation(); goToUserChat('${senderId}')">پشتیبانی مرکزی <i class="fa-solid fa-circle-check verified-badge"></i></div>`;
                    const adminAvatar = users['admin'] ? users['admin'].avatar : null;
                    avatarHtml = adminAvatar
                        ? `<img src="${adminAvatar}" class="msg-avatar-small" onclick="event.stopPropagation(); goToUserChat('${senderId}')">`
                        : `<div class="msg-avatar-small-placeholder" onclick="event.stopPropagation(); goToUserChat('${senderId}')"><i class="fa fa-headset"></i></div>`;
                } else {
                    const senderObj = users[senderId] || { name: 'کاربر' };
                    const senderMsgCount = chatMsgs.filter(m2 => (m2.sender||'').toLowerCase() === senderId).length;
                    senderNameHtml = `<div class="sender-name" onclick="event.stopPropagation(); goToUserChat('${senderId}')">${senderObj.name} <span style="font-size:10px;color:#7f91a4;font-weight:normal;">${senderMsgCount} پیام</span></div>`;
                    avatarHtml = senderObj.avatar
                        ? `<img src="${senderObj.avatar}" class="msg-avatar-small" onclick="event.stopPropagation(); goToUserChat('${senderId}')">`
                        : `<div class="msg-avatar-small-placeholder" onclick="event.stopPropagation(); goToUserChat('${senderId}')">${(senderObj.name || '؟').charAt(0)}</div>`;
                }
            }
        }

        let forwardHeaderHtml = '';
        if (msg.forwardFrom) {
            forwardHeaderHtml = `<div class="forwarded-header"><i class="fa fa-reply"></i> فوروارد شده از: <b>${msg.forwardFrom}</b></div>`;
        }

        let replyHtml = '';
        if (msg.replyTo) {
            const parent = messages.find(m => m.id === msg.replyTo);
            if (parent) {
                const pText = parent.text ? parent.text.substring(0, 30) : (parent.video ? '🎥 ویدیو' : (parent.voice ? '🎙 پیام صوتی' : '📷 تصویر'));
                replyHtml = `<div class="replied-box"><i class="fa fa-reply" style="font-size:10px; margin-left:3px;"></i> ${pText}...</div>`;
            }
        }

        let imageHtml = '';
        if (msg.image) {
            imageHtml = `<img src="${msg.image}" class="message-img" onclick="event.stopPropagation(); viewFullImage('${msg.image}')">`;
        }

        let videoHtml = '';
        if (msg.video) {
            videoHtml = `<video src="${msg.video}" class="message-video" controls onclick="event.stopPropagation();"></video>`;
        }

        let voiceHtml = '';
        if (msg.voice) {
            voiceHtml = `<audio src="${msg.voice}" class="message-voice" controls onclick="event.stopPropagation();"></audio>`;
        }

        let editedHtml = msg.isEdited ? '<span class="edited-tag">(ویرایش شده)</span>' : '';
        let formattedText = msg.text ? msg.text.replace(/@(\w+)/g, '<span class="mention-link">@$1</span>') : '';

        let reactionsHtml = '<div class="reactions-container">';
        for (let emoji in msg.reactions) {
            const userList = msg.reactions[emoji];
            if (userList && userList.length > 0) {
                reactionsHtml += `<span class="reaction-chip">${emoji} ${userList.length}</span>`;
            }
        }
        reactionsHtml += '</div>';

        msgDiv.innerHTML = `
            ${forwardHeaderHtml}
            ${senderNameHtml}
            ${replyHtml}
            ${imageHtml}
            ${videoHtml}
            ${voiceHtml}
            ${formattedText ? `<div>${formattedText} ${editedHtml}</div>` : ''}
            ${reactionsHtml}
        `;

        if (avatarHtml) {
            const row = document.createElement('div');
            row.className = 'message-row';
            row.innerHTML = avatarHtml;
            row.appendChild(msgDiv);
            container.appendChild(row);
        } else {
            container.appendChild(msgDiv);
        }
    });
    container.scrollTop = container.scrollHeight;
}

function goToUserChat(senderIdRaw) {
    const senderId = (senderIdRaw || '').toLowerCase();
    if (!senderId || senderId === currentUser.userId.toLowerCase()) return;

    if (senderId === 'admin') {
        openChat('admin', 'پشتیبانی مرکزی', 'direct', true);
        return;
    }
    const u = users[senderId];
    if (!u) return;
    openChat(u.userId, `${u.name} ${u.family || ''}`.trim(), 'direct', false);
}

function startEditMessage(msgId, text) {
    editingMessageId = msgId;
    replyingToMessageId = null;
    removePendingImage();
    removePendingVideo();
    removePendingVoice();
    document.getElementById('reply-preview').classList.remove('hidden');
    document.getElementById('reply-text').innerText = 'ویرایش پیام: ' + (text || '');
    const input = document.getElementById('message-input');
    input.value = text || '';
    input.focus();
}

function openDeleteModal(msgId) {
    const msgObj = messages.find(m => m.id === msgId);
    if (!msgObj) return;

    messageToDelete = msgObj;
    const optionsContainer = document.getElementById('delete-options');
    optionsContainer.innerHTML = '';

    const isMyMsg = msgObj.sender.toLowerCase() === currentUser.userId.toLowerCase();

    if (currentChat.type === 'channel') {
        if (currentUser.isAdmin) {
            optionsContainer.innerHTML = `
                <button class="modal-btn btn-danger" onclick="executeDelete('everyone')">حذف از کانال</button>
            `;
        } else {
            return alert('شما دسترسی حذف پیام در کانال را ندارید.');
        }
    } else if (currentChat.type === 'direct' || currentChat.type === 'group' || currentChat.type === 'saved') {
        let everyoneText = currentChat.type === 'group' ? 'حذف برای همه کاربران' : 'حذف برای هر دو طرف';
        let html = `<button class="modal-btn btn-secondary" onclick="executeDelete('me')">حذف فقط برای خودم</button>`;

        if (currentChat.type !== 'saved' && (isMyMsg || currentUser.isAdmin)) {
            html += `<button class="modal-btn btn-danger" onclick="executeDelete('everyone')">${everyoneText}</button>`;
        }

        optionsContainer.innerHTML = html;
    }

    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    messageToDelete = null;
}

function executeDelete(type) {
    if (!messageToDelete) return;

    if (type === 'everyone') {
        messages = messages.filter(m => m.id !== messageToDelete.id);
    } else if (type === 'me') {
        if (!messageToDelete.deletedFor) messageToDelete.deletedFor = [];
        messageToDelete.deletedFor.push(currentUser.userId.toLowerCase());
    }

    saveMessages();
    closeDeleteModal();
    renderMessages();
}

function openForwardModal(msgId) {
    const msgObj = messages.find(m => m.id === msgId);
    if (!msgObj) return;

    messageToForward = msgObj;
    const container = document.getElementById('forward-chat-list');
    container.innerHTML = '';

    const list = getAllChatsList();
    list.forEach(chat => {
        let iconClass = 'fa-user';
        if(chat.type === 'channel') iconClass = 'fa-bullhorn';
        if(chat.type === 'group') iconClass = 'fa-users';
        if(chat.type === 'saved') iconClass = 'fa-bookmark';

        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => executeForward(chat.id);
        div.innerHTML = `
            <div class="avatar-placeholder"><i class="fa-solid ${iconClass}"></i></div>
            <div class="details">
                <h4>${chat.title}</h4>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('forward-modal').classList.remove('hidden');
}

function closeForwardModal() {
    document.getElementById('forward-modal').classList.add('hidden');
}

function executeForward(targetChatId) {
    if (!messageToForward) return;

    let sourceTitle = null;
    if (currentChat && (currentChat.type === 'direct' || currentChat.type === 'channel')) {
        sourceTitle = currentChat.title;
    }

    messages.push({
        id: Date.now(),
        sender: currentUser.userId,
        chatId: targetChatId,
        text: messageToForward.text,
        image: messageToForward.image || null,
        video: messageToForward.video || null,
        voice: messageToForward.voice || null,
        replyTo: null,
        forwardFrom: sourceTitle,
        reactions: {},
        deletedFor: [],
        isEdited: false
    });

    const targetChat = getAllChatsList().find(c => c.id.toLowerCase() === targetChatId.toLowerCase());
    if (targetChat && targetChat.type === 'direct') {
        const targetKey = `${targetChatId.toLowerCase()}_${currentUser.userId.toLowerCase()}`;
        unreadCounts[targetKey] = (unreadCounts[targetKey] || 0) + 1;
    } else if (targetChatId !== getSavedMessagesChatId()) {
        Object.keys(users).forEach(uId => {
            if (uId.toLowerCase() !== currentUser.userId.toLowerCase()) {
                const key = `${uId.toLowerCase()}_${targetChatId.toLowerCase()}`;
                unreadCounts[key] = (unreadCounts[key] || 0) + 1;
            }
        });
    }
    localStorage.setItem('app_unread_v6', JSON.stringify(unreadCounts));
    db.ref('app_unread_v6').set(unreadCounts);

    saveMessages();
    closeForwardModal();
    alert('پیام با موفقیت فوروارد شد!');
}

function addReaction(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const myId = currentUser.userId.toLowerCase();

    if (!msg.reactions[emoji].includes(myId)) {
        msg.reactions[emoji].push(myId);

        if (msg.sender.toLowerCase() !== myId) {
            const msgOwnerId = msg.sender.toLowerCase();
            if (!reactionAlerts[msgOwnerId]) reactionAlerts[msgOwnerId] = {};
            reactionAlerts[msgOwnerId][currentChat.id.toLowerCase()] = true;
            localStorage.setItem('app_reaction_alerts_v6', JSON.stringify(reactionAlerts));
        }
    } else {
        msg.reactions[emoji] = msg.reactions[emoji].filter(id => id.toLowerCase() !== myId);
    }
    saveMessages();
    renderMessages();
}

function setReply(msgId, text) {
    editingMessageId = null;
    replyingToMessageId = msgId;
    document.getElementById('reply-preview').classList.remove('hidden');
    document.getElementById('reply-text').innerText = 'پاسخ به: ' + text;
}

function cancelReply() {
    replyingToMessageId = null;
    editingMessageId = null;
    document.getElementById('reply-preview').classList.add('hidden');
    document.getElementById('message-input').value = '';
}

/* کپی کردن یک متن در کلیپ‌بورد همراه با نمایش یک پیام کوچک (toast) */
function copyTextWithToast(textToCopy) {
    const toast = document.createElement('div');
    toast.textContent = textToCopy + ' کپی شد';
    toast.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#5288c1;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:9999;opacity:1;transition:opacity 0.4s;pointer-events:none;';
    document.body.appendChild(toast);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(() => {});
    } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }

    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 1800);
}

function copyCurrentChatId() {
    if (!currentChat) return;
    if (currentChat.type !== 'direct') return;

    copyTextWithToast('@' + currentChat.id);
}

/* کلیک روی نام/آواتار در هدر گفتگو: مثل تلگرام، در پیوی پروفایل طرف مقابل
   (شامل بیوگرافی) باز می‌شود. برای گروه/کانال فعلاً کاری انجام نمی‌شود. */
function openHeaderProfile() {
    if (!currentChat) return;
    if (currentChat.type !== 'direct') return;

    openContactProfile(currentChat.id);
}

window.switchTab = switchTab;
window.openChatOptionsMenu = openChatOptionsMenu;
window.cancelReply = cancelReply;
window.removePendingImage = removePendingImage;
window.handleChatMediaSelect = handleChatMediaSelect;
window.removePendingVideo = removePendingVideo;
window.removePendingVoice = removePendingVoice;
window.startVoiceRecording = startVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.cancelVoiceRecording = cancelVoiceRecording;
window.handleVoiceButtonClick = handleVoiceButtonClick;
window.uploadGroupOrChannelAvatar = uploadGroupOrChannelAvatar;
window.sendMessage = sendMessage;
window.closeChatOptionsMenu = closeChatOptionsMenu;
window.executeQuickReaction = executeQuickReaction;
window.closeMessageMenu = closeMessageMenu;
window.executeDeleteChat = executeDeleteChat;
window.closeDeleteChatModal = closeDeleteChatModal;
window.closeForwardModal = closeForwardModal;
window.closeDeleteModal = closeDeleteModal;
window.closeImageViewer = closeImageViewer;
window.openChat = openChat;
window.copyCurrentChatId = copyCurrentChatId;
window.openHeaderProfile = openHeaderProfile;
window.toggleBlockUser = toggleBlockUser;
window.openDeleteChatModal = openDeleteChatModal;
window.viewFullImage = viewFullImage;
window.triggerAction = triggerAction;
window.executeDelete = executeDelete;
window.executeForward = executeForward;
window.closeChat = closeChat;
window.goToUserChat = goToUserChat;
