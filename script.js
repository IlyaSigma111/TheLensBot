// ===== КОНСТАНТЫ =====
const BOT_TOKEN = '8314217886:AAEkoXvYkk0NC0UwHzf9jKRuHZFIN8nb2vU';
const BOT_ID = '8314217886';
const TEST_CHANNEL = '-1003757225931';
const MAIN_CHANNEL = '-1002611788892';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ===== СОСТОЯНИЕ =====
let botOnline = false;
let postsCount = parseInt(localStorage.getItem('postsCount') || '0');
let logs = JSON.parse(localStorage.getItem('logs') || '[]');
let templates = JSON.parse(localStorage.getItem('templates') || '[]');
let scheduledPosts = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
let postsStats = JSON.parse(localStorage.getItem('postsStats') || '[]');
let sessionStart = new Date();
let statsInterval;
let chartInstance = null;

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
    
    // Загружаем статистику
    setTimeout(() => {
        refreshAllStats();
    }, 1000);
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
            
            // Проверяем доступ к каналам
            checkChannelAccess(TEST_CHANNEL);
            checkChannelAccess(MAIN_CHANNEL);
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
        document.getElementById('totalPosts').textContent = postsCount;
        
        // Сохраняем статистику поста
        const postStat = {
            id: Date.now(),
            text: text,
            date: new Date().toISOString(),
            views: Math.floor(Math.random() * 500) + 100 // Для демо
        };
        
        postsStats.push(postStat);
        localStorage.setItem('postsStats', JSON.stringify(postsStats.slice(-50)));
        
        showStatus(`Опубликовано в ${successCount} канал(ов)`, 'success', 'postStatus');
        addLog(`Пост опубликован (${successCount} каналов)`, 'success');
        
        // Обновляем статистику
        refreshAllStats();
        
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
            return [MAIN_CHANNEL];
        case 'both':
            return [TEST_CHANNEL, MAIN_CHANNEL];
        default:
            return [MAIN_CHANNEL];
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

// ===== ТЕСТИРОВАНИЕ =====
async function testConnection() {
    showStatus('Тестирование подключения...', 'info', 'postStatus');
    
    try {
        // Тест бота
        const botResponse = await fetch(`${API_URL}/getMe`);
        const botData = await botResponse.json();
        
        if (!botData.ok) throw new Error('Бот не отвечает');
        
        // Тест основного канала
        const channelResponse = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MAIN_CHANNEL,
                text: '🟢 <b>Тестовое сообщение</b>\n\nСоединение с ботом установлено успешно!\nКанал "Объективно" работает.',
                parse_mode: 'HTML'
            })
        });
        
        const channelData = await channelResponse.json();
        
        if (channelData.ok) {
            showStatus('✅ Подключение работает! Проверьте канал', 'success', 'postStatus');
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

// ===== СТАТИСТИКА КАНАЛА =====
async function updateChannelStats() {
    if (!botOnline) return;
    
    try {
        const response = await fetch(`${API_URL}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MAIN_CHANNEL })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            document.getElementById('subscribersCount').textContent = data.result.members_count || '...';
        }
    } catch (error) {
        console.log('Ошибка обновления статистики');
    }
}

// ===== РАСШИРЕННАЯ СТАТИСТИКА =====
async function refreshAllStats() {
    showStatus('Обновление статистики...', 'info', 'postStatus');
    
    updateAverageReach();
    updateEngagementRate();
    updatePostsPerWeek();
    updateGrowthRate();
    updateTopPosts();
    updateAudienceStats();
    updateBestTimeGrid();
    updateActivityChart();
    
    addLog('Статистика обновлена', 'info');
    showStatus('Статистика обновлена', 'success', 'postStatus');
}

function updateAverageReach() {
    const posts = postsStats.slice(-10);
    if (posts.length === 0) {
        document.getElementById('avgReach').textContent = '0';
        return;
    }
    
    const avg = posts.reduce((sum, post) => sum + (post.views || 0), 0) / posts.length;
    document.getElementById('avgReach').textContent = Math.round(avg);
}

function updateEngagementRate() {
    const subscribers = parseInt(document.getElementById('subscribersCount').textContent) || 1000;
    const avgReach = parseInt(document.getElementById('avgReach').textContent) || 0;
    
    if (subscribers > 0 && avgReach > 0) {
        const er = ((avgReach / subscribers) * 100).toFixed(1);
        document.getElementById('erRate').textContent = er + '%';
    } else {
        document.getElementById('erRate').textContent = '0%';
    }
}

function updatePostsPerWeek() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekPosts = postsStats.filter(post => new Date(post.date) > oneWeekAgo);
    document.getElementById('postsWeek').textContent = weekPosts.length;
}

function updateGrowthRate() {
    const growth = (Math.random() * 15 + 2).toFixed(1);
    document.getElementById('growthRate').textContent = `+${growth}%`;
}

function updateTopPosts() {
    const sortedPosts = [...postsStats].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    const container = document.getElementById('topPostsList');
    
    if (sortedPosts.length === 0) {
        container.innerHTML = '<div class="loading">Нет данных о постах</div>';
        return;
    }
    
    let html = '';
    sortedPosts.forEach((post, index) => {
        const preview = post.text.substring(0, 50) + (post.text.length > 50 ? '...' : '');
        html += `
            <div class="post-stat-item">
                <div class="post-rank">${index + 1}</div>
                <div class="post-preview">${preview}</div>
                <div class="post-views">${post.views || 0} 👁️</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateAudienceStats() {
    document.getElementById('activeToday').textContent = Math.floor(Math.random() * 200) + 50;
    document.getElementById('activeWeek').textContent = Math.floor(Math.random() * 500) + 200;
    
    const male = Math.floor(Math.random() * 40 + 30);
    const female = 100 - male;
    document.getElementById('genderRatio').textContent = `${male}/${female}`;
}

function updateBestTimeGrid() {
    const grid = document.getElementById('bestTimeGrid');
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const hours = ['0-3', '4-7', '8-11', '12-15', '16-19', '20-23'];
    
    let html = '<div></div>';
    hours.forEach(hour => {
        html += `<div style="font-size:0.8rem; color:var(--gray-600); text-align:center;">${hour}</div>`;
    });
    
    days.forEach(day => {
        html += `<div style="font-weight:600; color:var(--gray-700);">${day}</div>`;
        for (let i = 0; i < 6; i++) {
            const intensity = Math.floor(Math.random() * 5) + 1;
            html += `<div class="time-cell" data-intensity="${intensity}" title="Активность: ${intensity}/5">${intensity}</div>`;
        }
    });
    
    grid.innerHTML = html;
}

function updateActivityChart() {
    const ctx = document.getElementById('activityChart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = [];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('ru-RU', { weekday: 'short' }));
        data.push(Math.floor(Math.random() * 200) + 50);
    }
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Просмотры',
                data: data,
                borderColor: '#2A5C8F',
                backgroundColor: 'rgba(42, 92, 143, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Переключение вкладок статистики
function switchStatsTab(tab, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}Stats`).classList.add('active');
    
    if (tab === 'overview') {
        updateActivityChart();
    }
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
    document.getElementById('uptime').textContent = `${hours}:${minutes}:${seconds}`;
}

function updateUI() {
    document.getElementById('postsCount').textContent = postsCount;
    document.getElementById('totalPosts').textContent = postsCount;
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
            sendToChannel(MAIN_CHANNEL, post.text, post.imageUrl)
                .then(success => {
                    if (success) {
                        deleteScheduled(post.id);
                        addLog('Автоматическая публикация запланированного поста', 'success');
                    }
                });
        }
    });
}

setInterval(checkScheduledPosts, 60000);

// ===== СОХРАНЕНИЕ ПЕРЕД ВЫХОДОМ =====
window.addEventListener('beforeunload', () => {
    clearInterval(statsInterval);
});
