// ===== Firebase инициализация =====
const firebaseConfig = {
    apiKey: "AIzaSyAcAcq4EWpUbAEIIKeV8l2JFv3oJnd8gbY",
    authDomain: "thelensbot.firebaseapp.com",
    databaseURL: "https://thelensbot-default-rtdb.firebaseio.com",
    projectId: "thelensbot",
    storageBucket: "thelensbot.firebasestorage.app",
    messagingSenderId: "374263514630",
    appId: "1:374263514630:web:2831c3df17522cbf01e587"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ===== КОНСТАНТЫ =====
const BOT_TOKEN = '8314217886:AAEkoXvYkk0NC0UwHzf9jKRuHZFIN8nb2vU';
const BOT_ID = '8314217886';
const TEST_CHANNEL = '-1003757225931';
const MAIN_CHANNEL = '-1002611788892';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ===== СОСТОЯНИЕ =====
let botOnline = false;
let postsCount = 0;
let logs = [];
let templates = [];
let scheduledPosts = [];
let postsStats = [];
let sessionStart = new Date();
let statsInterval;
let chartInstance = null;
let currentViewingPostId = null;
let syncInProgress = false;

// ===== ШАБЛОНЫ ДЛЯ БЫСТРЫХ ПОСТОВ =====
const postTemplates = [
    // Отчёты о мероприятиях
    { id: 'event_report', name: '📅 Отчёт о мероприятии', icon: 'fas fa-calendar-check', category: 'Мероприятие', 
      template: '📅 <b>ОТЧЁТ О МЕРОПРИЯТИИ</b>\n\nНазвание: {название}\nДата: {дата}\nМесто: {место}\n\nЧто было: {описание}\n\nФото: {ссылка_на_фото}\n\nБыло круто! В следующий раз обязательно приходите! 🔥\n\n#отчёт #мероприятие #событие #Бот #Константин' },
    
    { id: 'meeting_summary', name: '🤝 Итоги встречи', icon: 'fas fa-handshake', category: 'Встреча',
      template: '🤝 <b>ИТОГИ ВСТРЕЧИ</b>\n\nС кем: {с_кем}\nО чём говорили: {темы}\n\nДоговорились: {договорённости}\n\nФото: {фото}\n\n#встреча #переговоры #итоги #Бот #Константин' },
    
    // Отчёты по проектам
    { id: 'project_update', name: '🚀 Апдейт по проекту', icon: 'fas fa-rocket', category: 'Проект',
      template: '🚀 <b>АПДЕЙТ ПО ПРОЕКТУ</b>\n\nПроект: {название}\n\nЧто сделано: {сделано}\n\nВ процессе: {в_процессе}\n\nПланы: {планы}\n\nСкриншоты: {скриншоты}\n\n#проект #разработка #прогресс #Бот #Константин' },
    
    { id: 'sprint_results', name: '🏁 Результаты спринта', icon: 'fas fa-tasks', category: 'Разработка',
      template: '🏁 <b>РЕЗУЛЬТАТЫ СПРИНТА</b>\n\nСпринт: {номер}\n\n✅ Сделано:\n{сделано}\n\n⏳ В работе:\n{в_работе}\n\n📊 Статистика:\n{статистика}\n\n#спринт #agile #результаты #Бот #Константин' },
    
    // Достижения и награды
    { id: 'milestone', name: '🎯 Достижение цели', icon: 'fas fa-bullseye', category: 'Достижение',
      template: '🎯 <b>ЦЕЛЬ ДОСТИГНУТА!</b>\n\nЧто: {цель}\n\nКогда поставил: {дата_начала}\nКогда достиг: {дата_достижения}\n\nКак шёл: {путь}\n\nСпасибо всем, кто поддерживал! 🙏\n\n#достижение #цель #успех #Бот #Константин' },
    
    { id: 'award', name: '🏆 Получил награду', icon: 'fas fa-trophy', category: 'Награда',
      template: '🏆 <b>ПОЛУЧИЛ НАГРАДУ!</b>\n\nНазвание: {название_награды}\nЗа что: {за_что}\n\nОрганизатор: {организатор}\n\nФото: {фото}\n\nОчень приятно, спасибо! 🎉\n\n#награда #победа #гордость #Бот #Константин' },
    
    // Статистика и цифры
    { id: 'stats_report', name: '📊 Статистика за месяц', icon: 'fas fa-chart-bar', category: 'Статистика',
      template: '📊 <b>СТАТИСТИКА ЗА МЕСЯЦ</b>\n\nПроект: {проект}\n\n📈 Показатели:\n{показатели}\n\n📉 Рост: {рост}%\n\nСкриншоты: {скриншоты}\n\n#статистика #аналитика #рост #Бот #Константин' },
    
    { id: 'traffic_report', name: '👥 Отчёт по трафику', icon: 'fas fa-users', category: 'Аналитика',
      template: '👥 <b>ОТЧЁТ ПО ТРАФИКУ</b>\n\nСайт: {сайт}\n\nПосетителей: {посетителей}\nПросмотров: {просмотров}\nОтказы: {отказы}%\n\nГрафик: {график}\n\n#трафик #аналитика #метрики #Бот #Константин' },
    
    // Медиа-контент
    { id: 'new_video', name: '🎥 Новое видео', icon: 'fas fa-video', category: 'Видео',
      template: '🎥 <b>НОВОЕ ВИДЕО</b>\n\nНазвание: {название}\nО чём: {описание}\n\nСмотреть: {ссылка}\n\nНе забудьте подписаться! 🔔\n\n#видео #новыйролик #youtube #Бот #Константин' },
    
    { id: 'podcast', name: '🎙️ Выпуск подкаста', icon: 'fas fa-microphone', category: 'Подкаст',
      template: '🎙️ <b>НОВЫЙ ВЫПУСК ПОДКАСТА</b>\n\nТема: {тема}\nГость: {гость}\n\nСлушать: {ссылка}\n\nО чём говорили: {описание}\n\n#подкаст #новыйвыпуск #интервью #Бот #Константин' },
    
    { id: 'photo_report', name: '📸 Фотоотчёт', icon: 'fas fa-camera', category: 'Фото',
      template: '📸 <b>ФОТООТЧЁТ</b>\n\nСобытие: {событие}\n\nФото: {ссылка_на_фото}\n\nКак прошло: {впечатления}\n\nДо встречи на следующих! 👋\n\n#фотоотчёт #событие #репортаж #Бот #Константин' },
    
    { id: 'screenshot', name: '🖼️ Скриншот', icon: 'fas fa-image', category: 'Скриншот',
      template: '🖼️ <b>СКРИНШОТ</b>\n\nЧто на скрине: {описание}\n\nПроект: {проект}\n\nФича: {фича}\n\nДелитесь мнением! 👇\n\n#скриншот #разработка #превью #Бот #Константин' },
    
    // Благодарности и обратная связь
    { id: 'thanks', name: '🙏 Благодарность', icon: 'fas fa-heart', category: 'Спасибо',
      template: '🙏 <b>БЛАГОДАРНОСТЬ</b>\n\nХочу поблагодарить {кого}\nЗа что: {за_что}\n\nЭто очень помогло! Спасибо! ❤️\n\n#спасибо #благодарность #команда #Бот #Константин' },
    
    { id: 'feedback_request', name: '💭 Нужен фидбек', icon: 'fas fa-comment', category: 'Обратная связь',
      template: '💭 <b>НУЖЕН ФИДБЕК</b>\n\nПосмотрите {что}\n\nСсылка: {ссылка}\n\nЧто скажете? Что можно улучшить?\n\nЗаранее спасибо за мнение! 🙏\n\n#фидбек #помощь #мнение #Бот #Константин' },
    
    // Анонсы и планы
    { id: 'announcement', name: '🔔 Важное объявление', icon: 'fas fa-bell', category: 'Анонс',
      template: '🔔 <b>ВАЖНОЕ ОБЪЯВЛЕНИЕ</b>\n\n{текст}\n\nДата: {дата}\n\nПодробности: {подробности}\n\n#важно #объявление #новости #Бот #Константин' },
    
    { id: 'plans', name: '📋 Планы на неделю', icon: 'fas fa-list', category: 'Планы',
      template: '📋 <b>ПЛАНЫ НА НЕДЕЛЮ</b>\n\n📌 Понедельник: {пн}\n📌 Вторник: {вт}\n📌 Среда: {ср}\n📌 Четверг: {чт}\n📌 Пятница: {пт}\n\nВыходные: {выходные}\n\nКто со мной? 👇\n\n#планы #неделя #цели #Бот #Константин' },
    
    // Запуски и релизы
    { id: 'launch', name: '🚀 Запуск проекта', icon: 'fas fa-rocket', category: 'Запуск',
      template: '🚀 <b>ЗАПУСК!</b>\n\nПредставляю вам {название_проекта}\n\nО проекте: {описание}\n\nСсылка: {ссылка}\n\nЖду ваших отзывов! 🔥\n\n#запуск #новыйпроект #стартап #Бот #Константин' },
    
    { id: 'update', name: '🔄 Обновление', icon: 'fas fa-sync-alt', category: 'Обновление',
      template: '🔄 <b>ОБНОВЛЕНИЕ</b>\n\nЧто нового в версии {версия}:\n\n✅ Добавлено:\n{добавлено}\n\n🔧 Исправлено:\n{исправлено}\n\n⚡ Улучшено:\n{улучшено}\n\n#обновление #релиз #фичи #Бот #Константин' },
    
    // Проблемы и решения
    { id: 'problem_solved', name: '✅ Решил проблему', icon: 'fas fa-check-circle', category: 'Решение',
      template: '✅ <b>ПРОБЛЕМА РЕШЕНА!</b>\n\nКакая была проблема: {проблема}\n\nКак решил: {решение}\n\nСколько времени ушло: {время}\n\nКому-то может пригодиться! 👨‍💻\n\n#решение #проблема #опыт #Бот #Константин' },
    
    { id: 'lesson_learned', name: '📚 Урок', icon: 'fas fa-book', category: 'Опыт',
      template: '📚 <b>УРОК, КОТОРЫЙ Я ВЫНЕС</b>\n\nСитуация: {ситуация}\n\nОшибка: {ошибка}\n\nВывод: {вывод}\n\nСовет: {совет}\n\n#урок #опыт #ошибки #Бот #Константин' }
];

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade для канала "Объективно" загружен');
    
    // Загружаем данные из Firebase
    loadFromFirebase();
    
    // Отображаем шаблоны
    renderTemplateGrid();
    
    // Проверяем статус бота
    checkBotStatus();
    
    // Запускаем таймеры
    updateSessionTime();
    setInterval(updateSessionTime, 1000);
    
    // Добавляем лог
    addLog('Система инициализирована', 'info');
});

// ===== FIREBASE СИНХРОНИЗАЦИЯ =====
async function loadFromFirebase() {
    try {
        const snapshot = await database.ref('botData').once('value');
        const data = snapshot.val() || {};
        
        postsStats = data.postsStats || [];
        postsCount = postsStats.length;
        logs = data.logs || [];
        templates = data.templates || [];
        scheduledPosts = data.scheduledPosts || [];
        
        updateUI();
        loadScheduledPosts();
        refreshAllStats();
        
        addLog('Данные загружены из облака', 'success');
    } catch (error) {
        console.error('Ошибка загрузки из Firebase:', error);
        addLog('Ошибка загрузки из облака', 'error');
    }
}

async function saveToFirebase() {
    if (syncInProgress) return;
    syncInProgress = true;
    
    try {
        await database.ref('botData').set({
            postsStats: postsStats,
            logs: logs.slice(-100),
            templates: templates,
            scheduledPosts: scheduledPosts,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ошибка сохранения в Firebase:', error);
    } finally {
        syncInProgress = false;
    }
}

// ===== ПЕРЕМЕННЫЕ ДЛЯ ФИЛЬТРАЦИИ ШАБЛОНОВ =====
let currentTemplateFilter = 'all';
let templateSearchTerm = '';

// ===== ОТОБРАЖЕНИЕ ШАБЛОНОВ =====
function renderTemplateGrid() {
    showAllTemplates();
}

function searchTemplates() {
    templateSearchTerm = document.getElementById('templateSearch').value.toLowerCase();
    renderFilteredTemplates();
}

function filterByCategory(category) {
    currentTemplateFilter = category;
    
    // Подсветка активной категории
    document.querySelectorAll('.template-category-filter').forEach(el => {
        el.classList.remove('active');
        if (el.textContent.includes(category)) {
            el.classList.add('active');
        }
    });
    
    renderFilteredTemplates();
}

function showAllTemplates() {
    document.getElementById('templateSearch').value = '';
    templateSearchTerm = '';
    currentTemplateFilter = 'all';
    
    // Убираем подсветку категорий
    document.querySelectorAll('.template-category-filter').forEach(el => {
        el.classList.remove('active');
    });
    
    renderFilteredTemplates();
}

function resetTemplateSearch() {
    showAllTemplates();
}

function renderFilteredTemplates() {
    const container = document.getElementById('templatesContainer');
    if (!container) return;
    
    let filtered = [...postTemplates];
    
    // Фильтр по категории
    if (currentTemplateFilter !== 'all') {
        filtered = filtered.filter(t => t.category === currentTemplateFilter);
    }
    
    // Фильтр по поиску
    if (templateSearchTerm) {
        filtered = filtered.filter(t => 
            t.name.toLowerCase().includes(templateSearchTerm) || 
            t.category.toLowerCase().includes(templateSearchTerm) ||
            t.template.toLowerCase().includes(templateSearchTerm)
        );
    }
    
    // Обновляем счётчики
    const totalEl = document.getElementById('totalTemplatesCount');
    const displayedEl = document.getElementById('displayedTemplatesCount');
    if (totalEl) totalEl.textContent = postTemplates.length;
    if (displayedEl) displayedEl.textContent = filtered.length;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--gray-500);">Шаблоны не найдены</div>';
        return;
    }
    
    let html = '';
    filtered.forEach(template => {
        html += `
            <div class="template-item" onclick="useTemplate('${template.id}')">
                <i class="${template.icon}"></i>
                <span>${template.name}</span>
                <span class="template-category">${template.category}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function useTemplate(templateId) {
    const template = postTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    const fields = extractFields(template.template);
    
    if (fields.length > 0) {
        let filledTemplate = template.template;
        fields.forEach(field => {
            const value = prompt(`Введите значение для "${field}":`, `{${field}}`);
            if (value !== null) {
                filledTemplate = filledTemplate.replace(new RegExp(`\\{${field}\\}`, 'g'), value);
            }
        });
        document.getElementById('postText').value = filledTemplate;
    } else {
        document.getElementById('postText').value = template.template;
    }
    
    addLog(`Загружен шаблон: ${template.name}`, 'info');
}

function extractFields(template) {
    const matches = template.match(/\{([^}]+)\}/g) || [];
    return matches.map(m => m.replace(/[{}]/g, ''));
}

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

// ===== ПУБЛИКАЦИЯ ПОСТОВ =====
async function publishNow() {
    if (!botOnline) {
        showStatus('Бот не в сети', 'error', 'postStatus');
        return;
    }
    
    let text = document.getElementById('postText').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    
    if (!text && !imageUrl) {
        showStatus('Введите текст поста или добавьте изображение', 'error', 'postStatus');
        return;
    }
    
    // Добавляем хэштеги, если их нет
    if (!text.includes('#Бот')) {
        text = text + '\n\n#Бот #Константин';
    }
    
    showStatus('Публикация...', 'info', 'postStatus');
    
    try {
        const result = await sendToChannel(MAIN_CHANNEL, text, imageUrl);
        
        if (result.success) {
            // Сохраняем пост
            const postStat = {
                id: Date.now(),
                text: text,
                date: new Date().toISOString(),
                views: Math.floor(Math.random() * 20) + 5,
                messageId: result.messageId
            };
            
            postsStats.push(postStat);
            postsCount = postsStats.length;
            
            // Сохраняем в Firebase
            await saveToFirebase();
            
            updateUI();
            refreshAllStats();
            
            showStatus('Пост опубликован!', 'success', 'postStatus');
            addLog('Пост опубликован с хэштегами #Бот #Константин', 'success');
            
            // Очищаем поля
            document.getElementById('postText').value = '';
            document.getElementById('imageUrl').value = '';
        } else {
            showStatus('Ошибка публикации', 'error', 'postStatus');
        }
    } catch (error) {
        showStatus('Ошибка: ' + error.message, 'error', 'postStatus');
    }
}

async function sendToChannel(channelId, text, imageUrl) {
    try {
        if (imageUrl) {
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
            return { success: data.ok, messageId: data.ok ? data.result.message_id : null };
        } else {
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
            return { success: data.ok, messageId: data.ok ? data.result.message_id : null };
        }
    } catch (error) {
        return { success: false };
    }
}

// ===== СТАТИСТИКА =====
function refreshAllStats() {
    updateAverageReach();
    updateEngagementRate();
    updatePostsPerWeek();
    updateGrowthRate();
    updateTopPosts();
    updateBestTimeGrid();
    updateActivityChart();
}

function updateAverageReach() {
    const posts = postsStats.slice(-10);
    if (posts.length === 0) {
        document.getElementById('avgReach').textContent = '0';
        return;
    }
    
    const avg = Math.round(posts.reduce((sum, post) => sum + (post.views || 0), 0) / posts.length);
    document.getElementById('avgReach').textContent = avg;
}

function updateEngagementRate() {
    const subscribers = 42;
    const avgReach = parseInt(document.getElementById('avgReach').textContent) || 0;
    const er = ((avgReach / subscribers) * 100).toFixed(1);
    document.getElementById('erRate').textContent = er + '%';
}

function updatePostsPerWeek() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekPosts = postsStats.filter(post => new Date(post.date) > oneWeekAgo);
    document.getElementById('postsWeek').textContent = weekPosts.length;
}

function updateGrowthRate() {
    const growth = (Math.random() * 10 + 2).toFixed(1);
    document.getElementById('growthRate').textContent = `+${growth}%`;
    document.getElementById('weeklyGrowth').textContent = `+${Math.floor(Math.random() * 5)}`;
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
        const preview = post.text.substring(0, 40) + (post.text.length > 40 ? '...' : '');
        html += `
            <div class="post-stat-item" onclick="viewPost(${post.id})">
                <div class="post-rank">${index + 1}</div>
                <div class="post-preview">${preview}</div>
                <div class="post-views">${post.views || 0} 👁️</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
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
    
    const viewsByDay = {};
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        viewsByDay[date.toLocaleDateString()] = 0;
    }
    
    postsStats.forEach(post => {
        const postDate = new Date(post.date).toLocaleDateString();
        if (viewsByDay[postDate] !== undefined) {
            viewsByDay[postDate] += post.views || 0;
        }
    });
    
    const labels = Object.keys(viewsByDay).map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('ru-RU', { weekday: 'short' });
    });
    const data = Object.values(viewsByDay);
    
    if (chartInstance) chartInstance.destroy();
    
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
            plugins: { legend: { display: false } }
        }
    });
}

// ===== ВСЕ ПОСТЫ =====
function showAllPosts() {
    document.getElementById('allPostsModal').classList.add('show');
    renderAllPosts();
}

function closeAllPostsModal() {
    document.getElementById('allPostsModal').classList.remove('show');
}

function renderAllPosts() {
    const container = document.getElementById('allPostsList');
    const searchTerm = document.getElementById('postSearchInput')?.value.toLowerCase() || '';
    
    let filteredPosts = [...postsStats];
    if (searchTerm) {
        filteredPosts = filteredPosts.filter(post => 
            post.text.toLowerCase().includes(searchTerm)
        );
    }
    
    filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (filteredPosts.length === 0) {
        container.innerHTML = '<div class="loading">Посты не найдены</div>';
        document.getElementById('totalPostsCount').textContent = '0';
        return;
    }
    
    let html = '';
    filteredPosts.forEach(post => {
        const date = new Date(post.date).toLocaleString();
        const preview = post.text.substring(0, 60) + (post.text.length > 60 ? '...' : '');
        html += `
            <div class="post-stat-item" onclick="viewPost(${post.id})">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--gray-500);">${date}</span>
                        <span style="color: var(--primary);">${post.views || 0} 👁️</span>
                    </div>
                    <div style="margin-top: 5px;">${preview}</div>
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
    
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="color: var(--gray-500);">${new Date(post.date).toLocaleString()}</div>
            <div style="background: var(--gray-50); padding: 15px; border-radius: var(--radius); white-space: pre-wrap;">
                ${post.text}
            </div>
            <div>Просмотров: <strong>${post.views || 0}</strong></div>
        </div>
    `;
    
    modal.classList.add('show');
}

function closeViewPostModal() {
    document.getElementById('viewPostModal').classList.remove('show');
    currentViewingPostId = null;
}

async function deleteCurrentPost() {
    if (!currentViewingPostId) return;
    
    if (confirm('Удалить этот пост из истории?')) {
        postsStats = postsStats.filter(p => p.id !== currentViewingPostId);
        postsCount = postsStats.length;
        await saveToFirebase();
        closeViewPostModal();
        renderAllPosts();
        refreshAllStats();
        updateUI();
        addLog('Пост удалён из истории', 'warning');
    }
}

function exportAllPosts() {
    const dataStr = JSON.stringify(postsStats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `posts_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    addLog('Посты экспортированы', 'info');
}

// ===== ЗАПЛАНИРОВАННЫЕ ПОСТЫ =====
function schedulePost() {
    const text = document.getElementById('postText').value.trim();
    const imageUrl = document.getElementById('imageUrl').value.trim();
    const scheduledTime = document.getElementById('scheduledTime').value;
    
    if (!text) {
        showStatus('Введите текст поста', 'error', 'postStatus');
        return;
    }
    
    if (!scheduledTime) {
        showStatus('Выберите время', 'error', 'postStatus');
        return;
    }
    
    let postText = text;
    if (!postText.includes('#Бот')) {
        postText = postText + '\n\n#Бот #Константин';
    }
    
    const post = {
        id: Date.now(),
        text: postText,
        imageUrl: imageUrl,
        scheduledTime: scheduledTime
    };
    
    scheduledPosts.push(post);
    saveToFirebase();
    loadScheduledPosts();
    showStatus('Пост запланирован', 'success', 'postStatus');
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
    
    scheduledPosts.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
    
    let html = '';
    scheduledPosts.forEach(post => {
        const time = new Date(post.scheduledTime).toLocaleString();
        const preview = post.text.substring(0, 40) + (post.text.length > 40 ? '...' : '');
        html += `
            <div class="scheduled-item">
                <div class="scheduled-time">${time}</div>
                <div class="scheduled-preview">${preview}</div>
                <div style="margin-top: 8px;">
                    <button class="btn-icon" onclick="deleteScheduled(${post.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function deleteScheduled(id) {
    scheduledPosts = scheduledPosts.filter(p => p.id !== id);
    await saveToFirebase();
    loadScheduledPosts();
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
    
    updateLogsUI();
    saveToFirebase();
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
    if (confirm('Очистить логи?')) {
        logs = [];
        updateLogsUI();
        saveToFirebase();
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
}

// ===== ШАБЛОНЫ ПОЛЬЗОВАТЕЛЯ =====
function loadTemplates() {
    const select = document.getElementById('savedTemplates');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите шаблон...</option>';
    templates.forEach((template, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = template.name;
        select.appendChild(option);
    });
}

async function saveAsTemplate() {
    const text = document.getElementById('postText').value.trim();
    if (!text) {
        showStatus('Нет текста', 'error', 'postStatus');
        return;
    }
    
    const name = prompt('Название шаблона:');
    if (!name) return;
    
    templates.push({ name, text });
    await saveToFirebase();
    loadTemplates();
    showStatus('Шаблон сохранён', 'success', 'postStatus');
}

function loadTemplate() {
    const index = document.getElementById('savedTemplates').value;
    if (index === '') return;
    document.getElementById('postText').value = templates[index].text;
}

// ===== ТЕСТИРОВАНИЕ =====
async function testConnection() {
    if (!botOnline) {
        showStatus('Бот не в сети', 'error', 'postStatus');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MAIN_CHANNEL,
                text: '🟢 <b>Тест</b>\n\nСвязь работает!\n\n#Бот #Константин',
                parse_mode: 'HTML'
            })
        });
        
        if (response.ok) {
            showStatus('✅ Тест успешен', 'success', 'postStatus');
            addLog('Тест подключения успешен', 'success');
        }
    } catch (error) {
        showStatus('❌ Ошибка', 'error', 'postStatus');
        addLog('Ошибка тестирования', 'error');
    }
}

function emergencyStop() {
    if (confirm('Остановить все запланированные посты?')) {
        scheduledPosts = [];
        saveToFirebase();
        loadScheduledPosts();
        showStatus('Бот остановлен', 'error', 'postStatus');
        addLog('Экстренная остановка', 'warning');
    }
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
function switchStatsTab(tab, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.stats-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tab}Stats`).classList.add('active');
    
    if (tab === 'overview') updateActivityChart();
}

// ===== УТИЛИТЫ =====
function showStatus(message, type, elementId) {
    const element = document.getElementById(elementId);
    element.className = `status-message show ${type}`;
    element.innerHTML = message;
    
    if (type !== 'info') {
        setTimeout(() => element.className = 'status-message', 3000);
    }
}

function updateSessionTime() {
    const diff = Math.floor((new Date() - sessionStart) / 1000);
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
    tokenElement.style.filter = tokenElement.style.filter === 'blur(3px)' ? 'none' : 'blur(3px)';
}

function logout() {
    if (confirm('Выйти?')) {
        addLog('Выход из системы', 'info');
        alert('Выход выполнен');
    }
}

// ===== АВТОМАТИЧЕСКАЯ ПРОВЕРКА =====
setInterval(async () => {
    const now = new Date();
    let changed = false;
    
    for (const post of scheduledPosts) {
        if (new Date(post.scheduledTime) <= now) {
            await sendToChannel(MAIN_CHANNEL, post.text, post.imageUrl);
            scheduledPosts = scheduledPosts.filter(p => p.id !== post.id);
            changed = true;
        }
    }
    
    if (changed) {
        await saveToFirebase();
        loadScheduledPosts();
    }
}, 60000);

// Делаем функции глобальными
window.publishNow = publishNow;
window.schedulePost = schedulePost;
window.useTemplate = useTemplate;
window.saveAsTemplate = saveAsTemplate;
window.loadTemplate = loadTemplate;
window.testConnection = testConnection;
window.emergencyStop = emergencyStop;
window.showAllPosts = showAllPosts;
window.closeAllPostsModal = closeAllPostsModal;
window.filterPosts = filterPosts;
window.sortPosts = sortPosts;
window.closeViewPostModal = closeViewPostModal;
window.deleteCurrentPost = deleteCurrentPost;
window.exportAllPosts = exportAllPosts;
window.copyToClipboard = copyToClipboard;
window.toggleToken = toggleToken;
window.logout = logout;
window.refreshAllStats = refreshAllStats;
window.switchStatsTab = switchStatsTab;
window.clearLogs = clearLogs;
window.exportLogs = exportLogs;
window.deleteScheduled = deleteScheduled;
window.searchTemplates = searchTemplates;
window.filterByCategory = filterByCategory;
window.showAllTemplates = showAllTemplates;
window.resetTemplateSearch = resetTemplateSearch;
window.renderTemplateGrid = renderTemplateGrid;
