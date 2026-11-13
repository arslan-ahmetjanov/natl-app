# Репозитории и публикация

Карта проекта: что где лежит, что публично, что архивировано и как это связано.
Монорепозиторий не обязателен: движок, приложение и сайт живут отдельно,
потому что у них разные циклы выпуска.

## Карта

| Репозиторий | Роль | Видимость | Выпуск |
|---|---|---|---|
| [`natl-app`](https://github.com/arslan-ahmetjanov/natl-app) | продукт: приложение, установщики | публичный | теги `v0.x.y`, релизы |
| [`natl`](https://github.com/arslan-ahmetjanov/natl) | движок: `@natl/core`, CLI, адаптеры, агент | публичный | npm `1.x` |
| [`natl-site`](https://github.com/arslan-ahmetjanov/natl-site) | сайт документации | публичный | GitHub Pages |
| `testblox`, `testblox-mcp`, `testblox-runner` | прототипы до объединения | архив | не выпускаются |

Почему не один репозиторий:

- **приложение** выпускается тегами и установщиками, ему нужен CI под Windows;
- **движок** выпускается в npm, ему нужен CI по пакетам и контрактные тесты;
- **сайт** публикуется на каждый коммит и не должен ждать сборку приложения.

Связь между ними — версия: приложение `0.x` зависит от `@natl/core 1.0.0`.
Версия движка в приложении фиксируется в `package.json`, а не «примерно».

## Как связать репозитории в один проект

GitHub Projects — это доска, а не хранилище кода. Она позволяет видеть задачи
из всех репозиториев в одном месте, не перенося код.

1. Создать проект: `gh project create --owner arslan-ahmetjanov --title "NATL IDE"`.
2. Добавить репозитории: `gh project link 1 --owner arslan-ahmetjanov --repo arslan-ahmetjanov/natl-app`
   (и так же для `natl` и `natl-site`).
3. Разложить задачи из `docs/roadmap-1.0.md` в issues с метками
   `блокер`, `качество`, `продукт`, `документация`.
4. Поля проекта: `Статус` (Todo / Doing / Done), `Версия` (0.9.x / 1.0.0),
   `Область` (app / engine / site).

Альтернатива без Projects: milestones в каждом репозитории с общим именем
`1.0.0` и одинаковыми метками. Проще, но нет единой доски.

Права: для Projects нужен scope `project` у токена
(`gh auth refresh -s project`).

## Ребрендинг npm

Пакеты остаются в scope `@natl`: имя уже опубликовано, внешние проекты
на него ссылаются, переименование сломает установки. Ребрендинг — это
метаданные и документация, а не новое имя пакета.

Что меняется в каждом пакете:

| Поле | Было | Стало |
|---|---|---|
| `description` | «NATL CLI — run YAML scenarios» | «NATL IDE · CLI для прогона YAML-сценариев» |
| `keywords` | без бренда | добавить `natl-ide`, `полигон` |
| `homepage` | `natl-dev.github.io` (не работает) | адрес сайта после публикации |
| README | описание движка | короткая шапка NATL IDE и ссылка на продукт |

Порядок:

1. Обновить `description`, `keywords`, `homepage`, README в `core`, `cli`,
   `adapter-playwright`, `adapter-selenium`, `adapter-cypress`, `agent`.
2. Поднять версии патчем: `1.0.0 → 1.0.1` (контракт API не меняется).
3. `npm login`, затем `pnpm -r publish --access public` или по одному пакету.
4. Проверить страницы пакетов: описание, README, ссылки.

Важно: npm-версии не перезапускаются. Приложение идёт к 1.0.0, движок уже
на 1.x — это разные линейки, см. [`versioning.md`](./versioning.md).

## Публикация сайта

Сайт лежит в `natl-site` и публикуется workflow `pages.yml` на каждый пуш
в `main`: проверка локалей, артефакт, деплой через `actions/deploy-pages`.

Адрес: `https://arslan-ahmetjanov.github.io/natl-site/`.

Почему отдельный репозиторий: GitHub Pages для приватного репозитория требует
платного плана, а держать публичным весь код приложения до 1.0.0 не обязательно.

## Что сделать при разблокировке

Порядок действий, когда почта подтверждена и есть вход в npm:

```bash
# 1. приложение и сайт
cd C:/Users/arsla/Desktop/natl-app && git push
cd C:/Users/arsla/Desktop/natl-site && git push -u origin main

# 2. Pages
gh api -X POST repos/arslan-ahmetjanov/natl-site/pages -f build_type=workflow

# 3. публичность и связи
gh repo edit arslan-ahmetjanov/natl-app --visibility public --accept-visibility-change-consequences
gh repo edit arslan-ahmetjanov/natl --visibility public --accept-visibility-change-consequences
gh project create --owner arslan-ahmetjanov --title "NATL IDE"

# 4. npm
npm login
cd C:/Users/arsla/Desktop/natl-app/core && npm publish --access public
# и так далее для cli, adapters, agent
```

## Состояние

Сделано: репозитории `natl-app`, `natl` и `natl-site` публичны; сайт
опубликован на `https://arslan-ahmetjanov.github.io/natl-site/` через
GitHub Actions; метаданные пакетов переведены на бренд NATL IDE.

Осталось: публикация пакетов в npm (нужен `npm login`) и доска GitHub
Projects (нужен scope `project`: `gh auth refresh -s project`).
