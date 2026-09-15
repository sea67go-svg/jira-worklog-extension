# Jira Worklog — расширение браузера

Недельный учёт worklog для Jira Server/Data Center (`https://tasks.adv.ru`), в духе Tempo: сумма часов по дням, список записей, создание, правка и перетаскивание на другой день.

Это **не плагин Jira**. Нужна открытая сессия в браузере на `tasks.adv.ru`.

## Сборка

Нужны Node.js 20+ и npm.

```bash
npm install
npm run build
```

Готовый unpacked-каталог: `.output/chrome-mv3`.

Режим разработки:

```bash
npm run dev
```

## Установка в Chrome / Edge

1. Войдите в Jira: https://tasks.adv.ru/secure/Dashboard.jspa
2. Откройте `chrome://extensions` (или `edge://extensions`)
3. Включите «Режим разработчика»
4. «Загрузить распакованное расширение» → выберите `.output/chrome-mv3`
5. Нажмите иконку расширения → **Открыть неделю**

## Настройки

В options можно задать URL Jira (по умолчанию `https://tasks.adv.ru`) и цель часов в день (по умолчанию 8). Дни с недобором подсвечиваются.

После смены URL может понадобиться добавить хост в разрешениях расширения, если это не `tasks.adv.ru`.
