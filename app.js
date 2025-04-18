// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    const notesList = document.getElementById('notes-list');
    const noteInput = document.getElementById('note-input');
    const addBtn = document.getElementById('add-btn');
    const offlineStatus = document.getElementById('offline-status');
    const notificationsBtn = document.getElementById('notifications-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');

    let currentFilter = 'all';
    let notificationPermission = Notification.permission;
    let notificationInterval;

    // Загрузка заметок
    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    renderNotes();

    // Обработчики событий
    addBtn.addEventListener('click', addNote);
    noteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addNote();
        }
    });

    notificationsBtn.addEventListener('click', toggleNotifications);
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });

    // Проверка соединения
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Функции
    function addNote() {
        const text = noteInput.value.trim();
        if (text) {
            const newNote = {
                id: Date.now(),
                text: text,
                completed: false,
                date: new Date().toLocaleString()
            };

            notes.unshift(newNote);
            saveNotes();
            renderNotes();
            noteInput.value = '';

            // Показ уведомления
            if (notificationPermission === 'granted') {
                showNotification('Новое ToDo', `${text}`);
            }
        }
    }

    function renderNotes() {
        const filteredNotes = notes.filter(note => {
            if (currentFilter === 'active') return !note.completed;
            if (currentFilter === 'completed') return note.completed;
            return true;
        });

        notesList.innerHTML = filteredNotes.map(note => `
            <div class="note-card ${note.completed ? 'completed' : ''}">
                <div class="note-text">${note.text}</div>
                <div class="note-date">${note.date}</div>
                <div class="note-actions">
                    <button class="complete-btn" data-id="${note.id}">
                        ${note.completed ? 'Вернуть' : 'Завершить'}
                    </button>
                    <button class="delete-btn" data-id="${note.id}">Удалить</button>
                </div>
            </div>
        `).join('');
    }

    function saveNotes() {
        localStorage.setItem('notes', JSON.stringify(notes));
        // Запуск напоминаний, если есть активные задачи
        scheduleReminders();
    }

    function setFilter(filter) {
        currentFilter = filter;
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        renderNotes();
    }

    function toggleNotifications() {
        if (notificationPermission === 'granted') {
            disableNotifications();
        } else {
            requestNotificationPermission();
        }
    }

    function requestNotificationPermission() {
        Notification.requestPermission().then(permission => {
            notificationPermission = permission;
            updateNotificationButton();
            if (permission === 'granted') {
                showNotification('Уведомления включены', 'Вы будете получать напоминания о задачах');
                scheduleReminders();
            }
        });
    }

    function disableNotifications() {
        notificationPermission = 'denied';
        updateNotificationButton();
        clearInterval(notificationInterval);
        showNotification('Уведомления отключены', 'Вы больше не будете получать напоминания');
    }

    function updateNotificationButton() {
        notificationsBtn.textContent = notificationPermission === 'granted'
            ? 'Отключить уведомления'
            : 'Включить уведомления';
    }

    function scheduleReminders() {
        clearInterval(notificationInterval);

        if (notificationPermission === 'granted') {
            notificationInterval = setInterval(() => {
                const activeNotes = notes.filter(note => !note.completed);
                if (activeNotes.length > 0) {
                    showNotification(
                        'Напоминание о задачах',
                        `У вас ${activeNotes.length} невыполненных задач`
                    );
                }
            }, 2 * 60 * 60 * 1000); // 2 часа
        }
    }

    function showNotification(title, body) {
        if (notificationPermission === 'granted') {
            new Notification(title, { body });
        }
    }

    function updateOnlineStatus() {
        offlineStatus.classList.toggle('active', !navigator.onLine);
    }

    // Обработка действий с заметками
    notesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = parseInt(e.target.dataset.id);
            notes = notes.filter(note => note.id !== id);
            saveNotes();
            renderNotes();
        }

        if (e.target.classList.contains('complete-btn')) {
            const id = parseInt(e.target.dataset.id);
            notes = notes.map(note =>
                note.id === id ? { ...note, completed: !note.completed } : note
            );
            saveNotes();
            renderNotes();
        }
    });

    // Инициализация
    updateNotificationButton();
    scheduleReminders();
});

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered');
                // Подписка на push-уведомления
                return registration.pushManager.getSubscription()
                    .then(subscription => {
                        if (!subscription) {
                            return registration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array('ВАШ_PUBLIC_VAPID_KEY')
                            });
                        }
                        return subscription;
                    });
            })
            .catch(err => console.log('SW registration failed: ', err));
    });
}

// Вспомогательная функция для VAPID ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}