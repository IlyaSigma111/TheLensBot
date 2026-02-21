// ===== КОНСТАНТЫ =====
const BOT_TOKEN = '8314217886:AAEkoXvYkk0NC0UwHzf9jKRuHZFIN8nb2vU';
const BOT_ID = '8314217886';
const TEST_CHANNEL = '-1003757225931';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ===== СОСТОЯНИЕ =====
let botOnline = false;
let postsCount = parseInt(localStorage.getItem('postsCount') || '0');
let logs = JSON.parse(localStorage.getItem('logs') || '[]');
let templates = JSON.parse(localStorage.getItem('templates') || '[]');
let scheduledPosts = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
let mainChannel = localStorage.getItem('mainChannel') || '';
let sessionStart = new Date();
let statsInterval;

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade для канала "Объективно" загружен');
    
    // Загружаем данные
    loadTemplates();
    loadScheduledPosts();
    updateUI();
    
    // Проверяем статус бота
    checkBotStatus();
    
    // Запускаем таймеры
    updateSessionTime();
    setInterval(updateSessionTime, 1000);
    
    // Обновляем статистику каждые 10 секунд
    statsInterval = setInterval(updateChannelStats, 10000);
    
    // Добавляем лог
    addLog('Система инициализирована', 'info');
    
    // Обновляем отображение канала
    updateChannelDisplay();
});

// ===== ПРОВЕРКА СТАТУСА =====
async function checkBotStatus() {
    const statusElement = document.getElementById('botStatus');
    
    try {
        const response = await fetch(`${API_URL}/getMe`);
        const data = await response.json();
        
        if (data.ok) {
            botOnline = true;
            statusElement.className = 'status-badge online';
            statusElement.innerHTML = `
                <div class="status-dot online pulse"></div>
                <span>Бот онлайн: ${data.result.first_name}</span>
            `;
            addLog('Бот подключён', 'success');
            
            // Проверяем доступ к тестовому каналу
            checkChannelAccess(TEST_CHANNEL);
        } else {
            throw new Error(data.description);
        }
    } catch (error) {
        botOnline = false;
        statusElement.className = 'status-badge offline';
        statusElement.innerHTML = `
            <div class="status-dot offline"></div>
            <span>Бот офлайн: ${error.message}</span>
        `;
        addLog('Ошибка подключения бота', 'error');
    }
}

async function checkChannelAccess(channelId) {
    try {
        const response = await fetch(`${API_URL}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: channelId })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            document.getElementById('subscribersCount').textContent = data.result.members_count || '...';
            addLog(`Доступ к каналу "${data.result.title}" получен`, 'success');
        }
    } catch (error) {
        console.log('Нет доступа к каналу');
    }
}

// ===== ПУБЛИКАЦИЯ ПОСТОВ =====
async function publishNow() {
    if (!botOnline) {
        showStatus('Бот не в сети', 'error', 'postStatus');
        return;
    }
    
    const text = document.getElementById('postText').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const mode = document.getElementById('publishMode').value;
    
    if (!text && !imageUrl) {
        showStatus('Введите текст поста или добавьте изображение', 'error', 'postStatus');
        return;
    }
    
    showStatus('Публикация...', 'info', 'postStatus');
    
    const channels = getChannelsByMode(mode);
    let successCount = 0;
    
    for (const channel of channels) {
        try {
            const success = await sendToChannel(channel, text, imageUrl);
            if (success) successCount++;
        } catch (error) {
            console.error(`Ошибка отправки в ${channel}:`, error);
        }
    }
    
    if (successCount > 0) {
        postsCount++;
        localStorage.setItem('postsCount', postsCount.toString());
        document.getElementById('postsCount').textContent = postsCount;
        
        showStatus(`Опубликовано в ${successCount} канал(ов)`, 'success', 'postStatus');
        addLog(`Пост опубликован (${successCount} каналов)`, 'success');
        
        // Очищаем поля
        document.getElementById('postText').value = '';
        document.getElementById('imageUrl').value = '';
    } else {
        showStatus('Ошибка публикации', 'error', 'postStatus');
    }
}

async function sendToChannel(channelId, text, imageUrl) {
    if (imageUrl) {
        // Отправка с фото
        const response = await fetch(`${API_URL}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                photo: imageUrl,
                caption: text,
                parse_mode: 'HTML'
            })
        });
        return (await response.json()).ok;
    } else {
        // Отправка текста
        const response = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return (await response.json()).ok;
    }
}

function getChannelsByMode(mode) {
    switch(mode) {
        case 'test':
            return [TEST_CHANNEL];
        case 'main':
            return mainChannel ? [mainChannel] : [];
        case 'both':
            const channels = [TEST_CHANNEL];
            if (mainChannel) channels.push(mainChannel);
            return channels;
        default:
            return [TEST_CHANNEL];
    }
}

// ===== ЗАПЛАНИРОВАННЫЕ ПОСТЫ =====
function schedulePost() {
    const text = document.getElementById('postText').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const scheduledTime = document.getElementById('scheduledTime').value;
    
    if (!text && !imageUrl) {
        showStatus('Введите текст поста', 'error', 'postStatus');
        return;
    }
    
    if (!scheduledTime) {
        showStatus('Выберите время публикации', 'error', 'postStatus');
        return;
    }
    
    const post = {
        id: Date.now(),
        text: text,
        imageUrl: imageUrl,
        scheduledTime: scheduledTime,
        createdAt: new Date().toISOString()
    };
    
    scheduledPosts.push(post);
    localStorage.setItem('scheduledPosts', JSON.stringify(scheduledPosts));
    
    loadScheduledPosts();
    showStatus('Пост запланирован', 'success', 'postStatus');
    addLog(`Пост запланирован на ${new Date(scheduledTime).toLocaleString()}`, 'info');
}

function loadScheduledPosts() {
    const container = document.getElementById('scheduledList');
    
    if (scheduledPosts.length === 0) {
        container.innerHTML = `
            <div class="scheduled-empty">
                <i class="fas fa-calendar-plus"></i>
                <p>Нет запланированных постов</p>
            </div>
        `;
        return;
    }
    
    // Сортируем по времени
    scheduledPosts.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
    
    let html = '';
    scheduledPosts.forEach(post => {
        const time = new Date(post.scheduledTime).toLocaleString();
        const preview = post.text.substring(0, 50) + (post.text.length > 50 ? '...' : '');
        
        html += `
            <div class="scheduled-item">
                <div class="scheduled-time">
                    <i class="far fa-clock"></i> ${time}
                </div>
                <div class="scheduled-preview">${preview}</div>
                <div style="margin-top: 8px;">
                    <button class="btn-icon" onclick="deleteScheduled(${post.id})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function deleteScheduled(id) {
    scheduledPosts = scheduledPosts.filter(p => p.id !== id);
    localStorage.setItem('scheduledPosts', JSON.stringify(scheduledPosts));
    loadScheduledPosts();
    addLog('Запланированный пост удалён', 'info');
}

// ===== ШАБЛОНЫ =====
function useTemplate(type) {
    const templates = {
        news: '📰 <b>НОВОСТЬ</b>\n\n{текст новости}\n\n#новости #объективно',
        announcement: '📢 <b>ВАЖНОЕ ОБЪЯВЛЕНИЕ</b>\n\n{текст объявления}\n\n#важно',
        poll: '📊 <b>ОПРОС</b>\n\n{вопрос}\n\n👇 Голосуйте в комментариях!\n\n#опрос',
        quote: '💭 <b>ЦИТАТА ДНЯ</b>\n\n«{цитата}»\n\n#{теги}'
    };
    
    document.getElementById('postText').value = templates[type];
    addLog(`Загружен шаблон: ${type}`, 'info');
}

function saveAsTemplate() {
    const text = document.getElementById('postText').value.trim();
    
    if (!text) {
        showStatus('Нет текста для сохранения', 'error', 'postStatus');
        return;
    }
    
    const name = prompt('Введите название шаблона:');
    if (!name) return;
    
    templates.push({ name, text });
    localStorage.setItem('templates', JSON.stringify(templates));
    
    loadTemplates();
    showStatus('Шаблон сохранён', 'success', 'postStatus');
    addLog(`Сохранён шаблон: ${name}`, 'success');
}

function loadTemplates() {
    const select = document.getElementById('savedTemplates');
    
    select.innerHTML = '<option value="">Выберите шаблон...</option>';
    
    templates.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = template.name;
        select.appendChild(option);
    });
}

function loadTemplate() {
    const index = document.getElementById('savedTemplates').value;
    if (index === '') return;
    
    document.getElementById('postText').value = templates[index].text;
    addLog(`Загружен шаблон: ${templates[index].name}`, 'info');
}

// ===== УПРАВЛЕНИЕ КАНАЛОМ =====
function setMainChannel() {
    document.getElementById('mainChannelModal').classList.add('show');
}

function closeModal() {
    document.getElementById('mainChannelModal').classList.remove('show');
}

function saveMainChannel() {
    const channel = document.getElementById('mainChannelInput').value.trim();
    
    if (!channel) {
        alert('Введите ID канала или @username');
        return;
    }
    
    mainChannel = channel;
    localStorage.setItem('mainChannel', channel);
    
    updateChannelDisplay();
    closeModal();
    addLog(`Установлен основной канал: ${channel}`, 'info');
}

function updateChannelDisplay() {
    document.getElementById('mainChannelId').textContent = mainChannel || 'Не указан';
}

// ===== ТЕСТИРОВАНИЕ =====
async function testConnection() {
    showStatus('Тестирование подключения...', 'info', 'postStatus');
    
    try {
        // Тест бота
        const botResponse = await fetch(`${API_URL}/getMe`);
        const botData = await botResponse.json();
        
        if (!botData.ok) throw new Error('Бот не отвечает');
        
        // Тест канала
        const channelResponse = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TEST_CHANNEL,
                text: '🟢 <b>Тестовое сообщение</b>\n\nСоединение с ботом установлено успешно!',
                parse_mode: 'HTML'
            })
        });
        
        const channelData = await channelResponse.json();
        
        if (channelData.ok) {
            showStatus('✅ Подключение работает! Проверьте тестовый канал', 'success', 'postStatus');
            addLog('Тест подключения успешен', 'success');
        } else {
            throw new Error('Ошибка отправки в канал');
        }
    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error', 'postStatus');
        addLog(`Ошибка тестирования: ${error.message}`, 'error');
    }
}

function emergencyStop() {
    if (confirm('⚠️ Экстренная остановка бота?\nЭто отменит все запланированные посты.')) {
        scheduledPosts = [];
        localStorage.setItem('scheduledPosts', '[]');
        loadScheduledPosts();
        showStatus('🛑 Бот остановлен, посты отменены', 'error', 'postStatus');
        addLog('Экстренная остановка бота', 'warning');
    }
}

// ===== СТАТИСТИКА =====
async function updateChannelStats() {
    if (!botOnline || !mainChannel) return;
    
    try {
        const response = await fetch(`${API_URL}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: mainChannel })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            document.getElementById('subscribersCount').textContent = data.result.members_count || '...';
            
            // Рандомные данные для демонстрации
            document.getElementById('viewsToday').textContent = Math.floor(Math.random() * 1000) + 500;
            document.getElementById('newSubscribers').textContent = Math.floor(Math.random() * 50) + 10;
            document.getElementById('engagement').textContent = (Math.random() * 10 + 5).toFixed(1) + '%';
        }
    } catch (error) {
        console.log('Ошибка обновления статистики');
    }
}

function refreshStats() {
    updateChannelStats();
    showStatus('Статистика обновлена', 'success', 'postStatus');
    addLog('Статистика обновлена', 'info');
}

// ===== ЛОГИ =====
function addLog(message, type = 'info') {
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        message: message,
        type: type,
        timestamp: new Date().toISOString()
    };
    
    logs.push(logEntry);
    
    if (logs.length > 100) logs.shift();
    
    localStorage.setItem('logs', JSON.stringify(logs));
    updateLogsUI();
}

function updateLogsUI() {
    const container = document.getElementById('logsContainer');
    
    const recentLogs = logs.slice(-10).reverse();
    
    if (recentLogs.length === 0) {
        container.innerHTML = '<div class="log-entry">Логов нет</div>';
        return;
    }
    
    let html = '';
    recentLogs.forEach(log => {
        html += `
            <div class="log-entry">
                <span class="log-time">[${log.time}]</span>
                <span class="log-message">${log.message}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function clearLogs() {
    if (confirm('Очистить все логи?')) {
        logs = [];
        localStorage.setItem('logs', '[]');
        updateLogsUI();
        addLog('Логи очищены', 'warning');
    }
}

function exportLogs() {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `logs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    addLog('Логи экспортированы', 'info');
}

// ===== УТИЛИТЫ =====
function showStatus(message, type, elementId) {
    const element = document.getElementById(elementId);
    element.className = `status-message show ${type}`;
    element.innerHTML = message;
    
    if (type !== 'info') {
        setTimeout(() => {
            element.className = 'status-message';
        }, 3000);
    }
}

function updateSessionTime() {
    const now = new Date();
    const diff = Math.floor((now - sessionStart) / 1000);
    
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    
    document.getElementById('sessionTime').textContent = `${hours}:${minutes}:${seconds}`;
    document.getElementById('totalPosts').textContent = postsCount;
}

function updateUI() {
    document.getElementById('postsCount').textContent = postsCount;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showStatus('Скопировано!', 'success', 'postStatus');
}

function toggleToken() {
    const tokenElement = document.querySelector('.token-masked');
    if (tokenElement.style.filter === 'blur(3px)') {
        tokenElement.style.filter = 'none';
    } else {
        tokenElement.style.filter = 'blur(3px)';
    }
}

function logout() {
    if (confirm('Выйти из панели управления?')) {
        addLog('Выход из системы', 'info');
        alert('Выход выполнен. Обновите страницу для входа.');
    }
}

// ===== ПРОВЕРКА ЗАПЛАНИРОВАННЫХ ПОСТОВ =====
function checkScheduledPosts() {
    const now = new Date();
    
    scheduledPosts.forEach(post => {
        const postTime = new Date(post.scheduledTime);
        
        if (postTime <= now) {
            // Отправляем пост
            sendToChannel(TEST_CHANNEL, post.text, post.imageUrl)
                .then(success => {
                    if (success) {
                        deleteScheduled(post.id);
                        addLog('Автоматическая публикация запланированного поста', 'success');
                    }
                });
        }
    });
}

// Проверяем запланированные посты каждую минуту
setInterval(checkScheduledPosts, 60000);

// ===== СОХРАНЕНИЕ ПЕРЕД ВЫХОДОМ =====
window.addEventListener('beforeunload', () => {
    clearInterval(statsInterval);
});
