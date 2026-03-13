async function parseSite() {
    const output = document.getElementById('output');
    const targetUrl = 'https://poltava-svitlo.vnlab-apps.org/';
    
    // Список разных прокси-сервисов
    const proxyList = [
        //url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        url => 'https://billowing-fog-9e1b.iluhavmajnkrafte.workers.dev/?url=' + encodeURIComponent(url),
        url => 'https://cors-anywhere.herokuapp.com/' + url,
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        url => `https://thingproxy.freeboard.io/fetch/${url}`
    ];

    output.innerHTML = "⏳ Ищу рабочий путь к данным...";

    for (let i = 0; i < proxyList.length; i++) {
        try {
            console.log(`Попытка через прокси №${i + 1}...`);
            const response = await fetch(proxyList[i](targetUrl));
            
            if (!response.ok) throw new Error("Таймаут или ошибка сервера");

            let html = "";
            
            // AllOrigins возвращает JSON, остальные могут возвращать чистый текст
            if (proxyList[i].toString().includes('allorigins')) {
                const data = await response.json();
                html = data.contents;
            } else {
                html = await response.text();
            }

            if (!html || html.length < 500) throw new Error("Пустой ответ");

            // Если мы дошли сюда — данные получены!
            renderSchedule(html); 
            return; // Выходим из цикла, так как успех

        } catch (error) {
            console.warn(`Прокси ${i + 1} не справился: ${error.message}`);
            if (i === proxyList.length - 1) {
                output.innerHTML = `<b style="color:red">Все прокси перегружены.</b><br>Попробуй через минуту.`;
            }
        }
    }
}

function renderSchedule(html) {
    const output = document.getElementById('output');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const queue = doc.getElementById('queue_8');
    if (!queue) return;

    const spans = queue.querySelectorAll('.schedule-badge');
    let allIntervals = []; // Сюда будем собирать данные перед сортировкой

    spans.forEach(span => {
        const timeRange = span.innerText;
        const [startTime, endTime] = timeRange.split(' - ');
        const startHour = startTime.split(':')[0];
        const endHour = endTime.split(':')[0];

        const classList = Array.from(span.classList);
        const colorClass = classList.find(c => 
            (c.includes('green') || c.includes('red') || c.includes('yellow')) && c !== 'badge'
        ) || "";
        
        const [color1, color2] = colorClass.split('-');

        // Вместо вывода в HTML, пушим объекты в массив
        allIntervals.push({
            hour: parseInt(startHour),
            time: `${startHour}:00 - ${startHour}:30`,
            status: formatStatus(color1),
            bool: formatStatusToBool(color1)
        });
        allIntervals.push({
            hour: parseInt(startHour) + 0.5, // Для сортировки второй половины часа
            time: `${startHour}:30 - ${endHour}:00`,
            status: formatStatus(color2),
            bool: formatStatusToBool(color2)
        });
    });

    // --- СОРТИРОВКА ---
    allIntervals.sort((a, b) => a.hour - b.hour);

    console.log(allIntervals)
    // --- ВЫВОД ---
    let tableHtml = `<h3>График Полтава (Очередь 4.2)</h3>
    <table border="1" style="width:100%; border-collapse: collapse; font-family: sans-serif;">
    <tr style="background: #f2f2f2;"><th>Время</th><th>Статус</th></tr>`;

    allIntervals.forEach(item => {
        tableHtml += `<tr><td style="padding:6px;">${item.time}</td><td style="padding:6px;">${item.status}</td></tr>`;
    });

    tableHtml += `</table>`;
    output.innerHTML = tableHtml;

    let LightStatus = getLightStatus(allIntervals)
    console.log(LightStatus);
    document.getElementById('LightStatus').innerHTML = LightStatus
}

// Вспомогательная функция для оформления (вынеси её за пределы основной)
function formatStatus(color) {
    if (color === 'red') return "<span style='color:red; font-weight:bold;'>❌ НЕТ</span>";
    if (color === 'yellow') return "<span style='color:orange; font-weight:bold;'>⚠️ РИСК</span>";
    return "<span style='color:green; font-weight:bold;'>✅ ЕСТЬ</span>";
}
function formatStatusToBool(color) {
    if (color === 'red') return false;
    if (color === 'yellow') return true;
    return true;
}

parseSite();




function getLightStatus(data) {
    const now = new Date();
    let currentHour = now.getHours() + (now.getMinutes() >= 30 ? 0.5 : 0);

    // 1. Определяем, есть ли свет прямо сейчас
    const currentSlot = data.find(slot => slot.hour === currentHour);
    const isLightOn = currentSlot ? currentSlot.bool : true;

    // 2. Ищем следующее изменение статуса
    // Нам нужен первый слот, который идет ПОСЛЕ текущего и где bool отличается от текущего
    const nextChange = data.find(slot => slot.hour > currentHour && slot.bool !== isLightOn);

    if (isLightOn) {
        return nextChange 
            ? `Свет есть. Отключат в ${nextChange.time.split(' - ')[0]}` 
            : "Свет есть, отключений до конца дня не планируется.";
    } else {
        return nextChange 
            ? `Света нет. Включат в ${nextChange.time.split(' - ')[0]}` 
            : "Света нет, включение будет уже завтра.";
    }
}

