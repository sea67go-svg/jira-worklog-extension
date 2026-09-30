# Jira Worklog — расширение браузера

Недельный учёт worklog для Jira Server (`https://tasks.adv.ru`): сетка и список, создание/правка, перетаскивание. Чат агента читает GitLab MR (`gitlab.adv.ru`) из открытой вкладки и может списывать время в Jira.

Это **не плагин Jira**. Нужны сессии в браузере на Jira и, для MR, на GitLab.

## Сборка

```bash
npm install
npm run build
```

Unpacked: `.output/chrome-mv3`.

## Установка

1. Войдите в https://tasks.adv.ru и при работе с MR — в https://gitlab.adv.ru
2. `chrome://extensions` → режим разработчика → загрузить `.output/chrome-mv3`
3. Иконка → **Открыть неделю**. Кнопка **Агент** — чат.

В режиме **Месяц** кнопка **Выгрузить xlsx** скачивает `Отчет <месяц> <год>.xlsx` по шаблону: ФИО, Вых/раб, дата, часы, задачи с комментариями по дням, выходные подсвечены, внизу итог.

В настройках: URL Jira, цель часов, API-ключ модели (OpenAI-compatible) или GitHub token. Без ключа чат не запустится.

## Чат агента

Пишите обычным языком. Пример: ссылки на merge request GitLab + «залогируй время на сегодня». Агент вызывает `get_gitlab_mr` (нужна вкладка gitlab.adv.ru) и `create_worklog`.

Статус инструментов показывается в чате («Инструмент: get_gitlab_mr»).

## Правки кода (как Cursor)

Из MV3 Cursor не запускается. Локальный host:

```bash
set CURSOR_API_KEY=cursor_...
npm run agent-host
```

Ключ: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations). В настройках расширения тоже можно сохранить Cursor API key. Host слушает `http://127.0.0.1:7845`. Задания «поправь UI / git» идут инструментом `cursor_code_task`.
