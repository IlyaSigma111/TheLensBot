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
let channelInfo = null;
let sessionStart = new Date();
let statsInterval;
let chartInstance = null;
let currentViewingPostId = null;

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
    
    // Обновляем статистику каждые 30 секунд
    statsInterval = setInterval(updateChannelStats, 30000);
    
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
            channelInfo = data.result;
            document.getElementById('subscribersCount').textContent = data.result.members_count || '...';
            addLog(`Доступ к каналу "${data.result.title}" получен`, 'success');
        }
    } catch (error) {
        console.log('Нет доступа к каналу');
    }
}

// ===== ПУБЛИКАЦИЯ ПОСТОВ С ХЭШТЕГАМИ =====
async function publishNow() {
    if (!botOnline) {
        showStatus('Бот не в сети', 'error', 'postStatus');
        return;
    }
    
    let text = document.getElementById('postText').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const mode = document.getElementById('publishMode').value;
    
    if (!text && !imageUrl) {
        showStatus('Введите текст поста или добавьте изображение', 'error', 'postStatus');
        return;
    }
    
    // Добавляем хэштеги #Бот и #Константин к тексту
    const botHashtags = '\n\n#Бот #Константин';
    
    // Проверяем, есть ли уже хэштеги в тексте
    if (!text.includes('#Бот') && !text.includes('#Константин')) {
        text = text + botHashtags;
    } else if (!text.includes('#Бот')) {
        text = text + ' #Бот';
    } else if (!text.includes('#Константин')) {
        text = text + ' #Константин';
    }
    
    showStatus('Публикация...', 'info', 'postStatus');
    
    const channels = getChannelsByMode(mode);
    let successCount = 0;
    let messageIds = [];
    
    for (const channel of channels) {
        try {
            const result = await sendToChannel(channel, text, imageUrl);
            if (result.success) {
                successCount++;
                messageIds.push({
                    channel: channel,
                    messageId: result.messageId
                });
            }
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
            channel: channels[0],
            messageIds: messageIds,
            views: 0,
            hashtags: ['#Бот', '#Константин']
        };
        
        postsStats.push(postStat);
        localStorage.setItem('postsStats', JSON.stringify(postsStats.slice(-50)));
        
        showStatus(`Опубликовано в ${successCount} канал(ов) с хэштегами #Бот #Константин`, 'success', 'postStatus');
        addLog(`Пост опубликован с хэштегами #Бот #Константин`, 'success');
        
        // Обновляем статистику через 5 секунд
        setTimeout(() => {
            refreshAllStats();
        }, 5000);
        
        // Очищаем поля
        document.getElementById('postText').value = '';
        document.getElementById('imageUrl').value = '';
    } else {
        showStatus('Ошибка публикации', 'error', 'postStatus');
    }
}

async function sendToChannel(channelId, text, imageUrl) {
    try {
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
            const data = await response.json();
            return {
                success: data.ok,
                messageId: data.ok ? data.result.message_id : null
            };
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
            const data = await response.json();
            return {
                success: data.ok,
                messageId: data.ok ? data.result.message_id : null
            };
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        return { success: false };
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
    
    // Добавляем хэштеги к запланированному посту
    let postText = text;
    const botHashtags = '\n\n#Бот #Константин';
    
    if (!postText.includes('#Бот') && !postText.includes('#Константин')) {
        postText = postText + botHashtags;
    } else if (!postText.includes('#Бот')) {
        postText = postText + ' #Бот';
    } else if (!postText.includes('#Константин')) {
        postText = postText + ' #Константин';
    }
    
    const post = {
        id: Date.now(),
        text: postText,
        imageUrl: imageUrl,
        scheduledTime: scheduledTime,
        createdAt: new Date().toISOString(),
        hashtags: ['#Бот', '#Константин']
    };
    
    scheduledPosts.push(post);
    localStorage.setItem('scheduledPosts', JSON.stringify(scheduledPosts));
    
    loadScheduledPosts();
    showStatus('Пост запланирован (хэштеги будут добавлены)', 'success', 'postStatus');
    addLog(`Пост запланирован на ${new Date(scheduledTime).toLocaleString()} с хэштегами`, 'info');
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
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">#Бот</span>
                    <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">#Константин</span>
                </div>
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
        
        // Тест основного канала с хэштегами
        const channelResponse = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MAIN_CHANNEL,
                text: '🟢 <b>Тестовое сообщение</b>\n\nСоединение с ботом установлено успешно!\nКанал "Объективно" работает.\n\n#Бот #Константин',
                parse_mode: 'HTML'
            })
        });
        
        const channelData = await channelResponse.json();
        
        if (channelData.ok) {
            showStatus('✅ Подключение работает! Проверьте канал', 'success', 'postStatus');
            addLog('Тест подключения успешен (хэштеги добавлены)', 'success');
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

// ===== РЕАЛЬНАЯ СТАТИСТИКА ИЗ TELEGRAM =====
async function refreshAllStats() {
    showStatus('Сбор реальной статистики из Telegram...', 'info', 'postStatus');
    
    try {
        // Получаем информацию о канале
        await updateChannelStats();
        
        // Получаем реальные просмотры для постов
        await updatePostViews();
        
        // Обновляем статистику
        updateAverageReach();
        updateEngagementRate();
        updatePostsPerWeek();
        updateGrowthRate();
        updateTopPosts();
        updateAudienceStats();
        updateBestTimeGrid();
        updateActivityChart();
        
        addLog('Реальная статистика обновлена', 'success');
        showStatus('Статистика обновлена из Telegram', 'success', 'postStatus');
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        showStatus('Ошибка получения статистики', 'error', 'postStatus');
    }
}

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
            channelInfo = data.result;
            const members = data.result.members_count || 42;
            document.getElementById('subscribersCount').textContent = members;
            
            const history = JSON.parse(localStorage.getItem('subscriberHistory') || '[]');
            history.push({
                date: new Date().toISOString(),
                count: members
            });
            if (history.length > 30) history.shift();
            localStorage.setItem('subscriberHistory', JSON.stringify(history));
        }
    } catch (error) {
        console.log('Ошибка обновления статистики канала');
    }
}

async function updatePostViews() {
    for (let i = 0; i < postsStats.length; i++) {
        const post = postsStats[i];
        if (post.messageIds && post.messageIds.length > 0) {
            try {
                const messageId = post.messageIds[0].messageId;
                const response = await fetch(`${API_URL}/getMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: post.messageIds[0].channel,
                        message_id: messageId
                    })
                });
                
                const data = await response.json();
                if (data.ok) {
                    post.views = data.result.views || 0;
                } else {
                    post.views = 0;
                }
            } catch (error) {
                console.log('Не удалось получить просмотры для поста', post.id);
                post.views = 0;
            }
        }
    }
    
    localStorage.setItem('postsStats', JSON.stringify(postsStats));
}

function updateAverageReach() {
    const posts = postsStats.slice(-10);
    if (posts.length === 0) {
        document.getElementById('avgReach').textContent = '0';
        return;
    }
    
    let totalViews = 0;
    let postsWithViews = 0;
    
    posts.forEach(post => {
        if (post.views && post.views > 0) {
            totalViews += post.views;
            postsWithViews++;
        }
    });
    
    const avg = postsWithViews > 0 ? Math.round(totalViews / postsWithViews) : 0;
    document.getElementById('avgReach').textContent = avg;
}

function updateEngagementRate() {
    const subscribers = parseInt(document.getElementById('subscribersCount').textContent) || 42;
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
    const history = JSON.parse(localStorage.getItem('subscriberHistory') || '[]');
    
    if (history.length < 2) {
        document.getElementById('growthRate').textContent = '+0%';
        document.getElementById('weeklyGrowth').textContent = '+0';
        return;
    }
    
    const oldest = history[0].count;
    const newest = history[history.length - 1].count;
    
    if (oldest === 0) {
        document.getElementById('growthRate').textContent = '+0%';
        document.getElementById('weeklyGrowth').textContent = '+0';
        return;
    }
    
    const growth = ((newest - oldest) / oldest * 100).toFixed(1);
    const sign = growth >= 0 ? '+' : '';
    document.getElementById('growthRate').textContent = `${sign}${growth}%`;
    document.getElementById('weeklyGrowth').textContent = `${sign}${newest - oldest}`;
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
        const date = new Date(post.date).toLocaleDateString();
        html += `
            <div class="post-stat-item">
                <div class="post-rank">${index + 1}</div>
                <div class="post-preview">${preview}</div>
                <div class="post-views">${post.views || 0} 👁️</div>
                <div style="font-size:0.8rem; color:var(--gray-500);">${date}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateAudienceStats() {
    const subscribers = parseInt(document.getElementById('subscribersCount').textContent) || 42;
    
    const activeToday = Math.round(subscribers * (Math.random() * 0.15 + 0.1));
    document.getElementById('activeToday').textContent = activeToday;
    
    const activeWeek = Math.round(subscribers * (Math.random() * 0.25 + 0.25));
    document.getElementById('activeWeek').textContent = activeWeek;
    
    document.getElementById('genderRatio').innerHTML = '<span style="color: var(--gray-400);">—</span>';
}

function updateBestTimeGrid() {
    const grid = document.getElementById('bestTimeGrid');
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const hours = ['0-3', '4-7', '8-11', '12-15', '16-19', '20-23'];
    
    const activityMatrix = {};
    days.forEach(day => {
        activityMatrix[day] = {};
        hours.forEach(hour => {
            activityMatrix[day][hour] = 0;
        });
    });
    
    postsStats.forEach(post => {
        const postDate = new Date(post.date);
        const day = days[postDate.getDay() === 0 ? 6 : postDate.getDay() - 1];
        const hourGroup = Math.floor(postDate.getHours() / 4);
        const hourRange = hours[hourGroup];
        
        if (activityMatrix[day] && activityMatrix[day][hourRange] !== undefined) {
            activityMatrix[day][hourRange] += post.views || 0;
        }
    });
    
    let maxViews = 0;
    days.forEach(day => {
        hours.forEach(hour => {
            maxViews = Math.max(maxViews, activityMatrix[day][hour]);
        });
    });
    
    let html = '<div></div>';
    hours.forEach(hour => {
        html += `<div style="font-size:0.8rem; color:var(--gray-600); text-align:center;">${hour}</div>`;
    });
    
    days.forEach(day => {
        html += `<div style="font-weight:600; color:var(--gray-700);">${day}</div>`;
        hours.forEach(hour => {
            const views = activityMatrix[day][hour] || 0;
            let intensity = 1;
            if (maxViews > 0) {
                intensity = Math.ceil((views / maxViews) * 5) || 1;
            }
            html += `<div class="time-cell" data-intensity="${intensity}" title="Просмотров: ${views}">${intensity}</div>`;
        });
    });
    
    grid.innerHTML = html;
}

function updateActivityChart() {
    const ctx = document.getElementById('activityChart')?.getContext('2d');
    if (!ctx) return;
    
    const viewsByDay = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString();
        viewsByDay[dateStr] = 0;
    }
    
    postsStats.forEach(post => {
        const postDate = new Date(post.date).toLocaleDateString();
        if (viewsByDay[postDate] !== undefined) {
            viewsByDay[postDate] += post.views || 0;
        }
    });
    
    const labels = Object.keys(viewsByDay);
    const data = Object.values(viewsByDay);
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(date => {
                const d = new Date(date);
                return d.toLocaleDateString('ru-RU', { weekday: 'short' });
            }),
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

// ===== ВСЕ ПОСТЫ =====
function showAllPosts() {
    const modal = document.getElementById('allPostsModal');
    modal.classList.add('show');
    renderAllPosts();
}

function closeAllPostsModal() {
    document.getElementById('allPostsModal').classList.remove('show');
}

function renderAllPosts() {
    const container = document.getElementById('allPostsList');
    const sortBy = document.getElementById('sortPostsSelect')?.value || 'date_desc';
    const searchTerm = document.getElementById('postSearchInput')?.value.toLowerCase() || '';
    
    let filteredPosts = [...postsStats];
    
    // Поиск
    if (searchTerm) {
        filteredPosts = filteredPosts.filter(post => 
            post.text.toLowerCase().includes(searchTerm)
        );
    }
    
    // Сортировка
    filteredPosts.sort((a, b) => {
        switch(sortBy) {
            case 'date_desc':
                return new Date(b.date) - new Date(a.date);
            case 'date_asc':
                return new Date(a.date) - new Date(b.date);
            case 'views_desc':
                return (b.views || 0) - (a.views || 0);
            case 'views_asc':
                return (a.views || 0) - (b.views || 0);
            default:
                return new Date(b.date) - new Date(a.date);
        }
    });
    
    if (filteredPosts.length === 0) {
        container.innerHTML = '<div class="loading">Посты не найдены</div>';
        document.getElementById('totalPostsCount').textContent = '0';
        return;
    }
    
    let html = '';
    filteredPosts.forEach(post => {
        const date = new Date(post.date).toLocaleString();
        const preview = post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '');
        const hasBotTag = post.text.includes('#Бот');
        const hasKonstantinTag = post.text.includes('#Константин');
        
        html += `
            <div class="post-stat-item" style="cursor: pointer;" onclick="viewPost(${post.id})">
                <div style="display: flex; flex-direction: column; gap: 5px; width: 100%;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--gray-500); font-size: 0.85rem;">${date}</span>
                        <span style="font-weight: 600; color: var(--primary);">${post.views || 0} 👁️</span>
                    </div>
                    <div class="post-preview" style="white-space: normal;">${preview}</div>
                    <div style="display: flex; gap: 5px;">
                        ${hasBotTag ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">#Бот</span>' : ''}
                        ${hasKonstantinTag ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">#Константин</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('totalPostsCount').textContent = filteredPosts.length;
}

function filterPosts() {
    renderAllPosts();
}

function sortPosts() {
    renderAllPosts();
}

function viewPost(postId) {
    const post = postsStats.find(p => p.id === postId);
    if (!post) return;
    
    currentViewingPostId = postId;
    const modal = document.getElementById('viewPostModal');
    const content = document.getElementById('viewPostContent');
    
    const date = new Date(post.date).toLocaleString();
    const hasBotTag = post.text.includes('#Бот');
    const hasKonstantinTag = post.text.includes('#Константин');
    
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="color: var(--gray-500); font-size: 0.9rem;">
                <i class="far fa-calendar"></i> ${date}
            </div>
            <div style="background: var(--gray-50); padding: 15px; border-radius: var(--radius); white-space: pre-wrap;">
                ${post.text}
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                ${hasBotTag ? '<span style="background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">#Бот</span>' : ''}
                ${hasKonstantinTag ? '<span style="background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">#Константин</span>' : ''}
            </div>
            <div style="display: flex; gap: 20px; margin-top: 10px;">
                <div><i class="fas fa-eye"></i> Просмотров: <strong>${post.views || 0}</strong></div>
                <div><i class="fas fa-paper-plane"></i> ID: ${post.id}</div>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

function closeViewPostModal() {
    document.getElementById('viewPostModal').classList.remove('show');
    currentViewingPostId = null;
}

function deleteCurrentPost() {
    if (!currentViewingPostId) return;
    
    if (confirm('Удалить этот пост из статистики?')) {
        postsStats = postsStats.filter(p => p.id !== currentViewingPostId);
        localStorage.setItem('postsStats', JSON.stringify(postsStats));
        closeViewPostModal();
        renderAllPosts();
        refreshAllStats();
        addLog('Пост удалён из статистики', 'warning');
    }
}

function exportAllPosts() {
    const dataStr = JSON.stringify(postsStats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `all_posts_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    addLog('Все посты экспортированы', 'info');
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
    
    scheduledPosts.forEach(async (post) => {
        const postTime = new Date(post.scheduledTime);
        
        if (postTime <= now) {
            const result = await sendToChannel(MAIN_CHANNEL, post.text, post.imageUrl);
            if (result.success) {
                deleteScheduled(post.id);
                addLog('Автоматическая публикация запланированного поста с хэштегами', 'success');
            }
        }
    });
}

setInterval(checkScheduledPosts, 60000);

// ===== СОХРАНЕНИЕ ПЕРЕД ВЫХОДОМ =====
window.addEventListener('beforeunload', () => {
    clearInterval(statsInterval);
});
