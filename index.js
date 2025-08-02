const mineflayer = require('mineflayer');
const FlayerCaptcha = require('FlayerCaptcha');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');
const originalWarn = console.warn;

const API_KEY = "ТВОЙ КЛЮЧ ДЛЯ Bare API";
const BOT_NAME = "IWasTesting321"
const REG_CMD = "/reg qwert321"

let bot;
let captcha;
let captchaSolved = false;

const directions = new Map([
    ['3 2', 'up'],
    ['3 -2', 'down'],
    ['3 0', 'south'],
    ['2 0', 'west'],
    ['0 0', 'north'],
    ['5 0', 'east'],
]);

const directions2 = {
    'up': 'down',
    'down': 'up',
    'south': 'north',
    'west': 'east',
    'north': 'south',
    'east': 'west'
};

console.warn = (...args) => {
    const message = args.join(" ");
    if (message.includes("chunk failed to load")) return;
    originalWarn(...args);
};

function getViewDirection(yaw, pitch) {
    const key = `${Math.round(yaw)} ${Math.round(pitch)}`;
    return directions2[directions.get(key)];
}

async function join() {
    try {
        bot = mineflayer.createBot({
            host: 'play.funtime.su',
            username: BOT_NAME,
            version: '1.16.5'
        });

        captcha = new FlayerCaptcha(bot);
        captcha.on('imageReady', async ({ data, image }) => {
            try {
                if (captchaSolved) return;

                if (getViewDirection(bot.entity.yaw, bot.entity.pitch) !== data.viewDirection) {
                    return;
                }

                const filePath = path.join(__dirname, 'captchas', 'captcha.png');
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await image.toFile(filePath);
                console.log('Капча сохранена в папку captchas.');
                const solvedCaptcha = await sendAPI(filePath);
                if (solvedCaptcha) {
                    bot.chat(`${solvedCaptcha}`);
                    captchaSolved = true;
                } else {
                    console.warn('Не удалось решить капчу или ответ пуст');
                }
            } catch (err) {
                console.error('Ошибка обработки капчи:', err.stack);
            }
        });

        bot.on('message', async (message) => {
            console.log(message.toAnsi());

            const text = message.toString();

            if (text.includes('[✾] Зарегистрируйтесь ↝ /reg <Пароль>')) {
                bot.chat(REG_CMD);
            }

            if (text.includes('[✾] Успешная регистрация! Приятной игры!')) {
                console.log(`Зашёл в лобби`);
                await bot.waitForTicks(220);
                const item = bot.inventory.slots[40];
                await bot.equip(item, 'hand');
                await bot.waitForTicks(20);
                bot.chat(`/an105`);
				// Здесь короче сам решай что дальше ему делать
            }
        });

        bot.on('spawn', () => {
            console.log('Бот заспавнился, позиция:', bot.entity.position);
            bot.waitForChunksToLoad(() => {
                console.log('Чанки загружены');
            });
        });

        bot.on('error', (err) => {
            console.error('Ошибка бота:', err.stack);
        });

    } catch (error) {
        console.error('Ошибка в join:', error.stack);
    }
}

async function sendAPI(filePath) {
    const site = "http://5.42.211.111/";
    try {
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        if (!exists) throw new Error('Файл капчи не найден!');
        const base64Image = await fs.readFile(filePath).then(buf => buf.toString('base64'));

        const postData = new URLSearchParams({
            key: API_KEY,
            method: "base64",
            body: base64Image
        });

        const postResponse = await fetch(`${site}/in.php`, {
            method: "POST",
            body: postData
        });

        const postText = await postResponse.text();
        console.log('Ответ in.php:', postText);
        if (!postText.includes("|")) {
            throw new Error(`Некорректный ответ сервера: ${postText}`);
        }

        const captcha_id = postText.split("|")[1].trim();
        await new Promise(res => setTimeout(res, 500));

        const getData = new URLSearchParams({
            key: API_KEY,
            action: "get",
            id: captcha_id
        });

        const getResponse = await fetch(`${site}/res.php?${getData}`);
        const getText = await getResponse.text();
        console.log(`Ответ res.php:`, getText);

        if (getText === "CAPCHA_NOT_READY") {
            console.warn("Капча ещё не готова. Попробуйте позже.");
            return null;
        }

        if (getText.startsWith("ERROR")) {
            throw new Error(`Ошибка API: ${getText}`);
        }

        if (!getText.includes("|")) {
            throw new Error(`Некорректный формат ответа: ${getText}`);
        }

        return getText.split("|")[1]?.trim() || null;

    } catch (error) {
        console.error('Ошибка в sendAPI:', error.message);
        return null;
    }
}

join();
