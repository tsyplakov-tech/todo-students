# Проверки

Для основных проверок и сборки нужны Node.js 22.12+/24 и npm. Для интеграционных и браузерных тестов укажите готовую отдельную PostgreSQL БД с именем, оканчивающимся на `_test`. Её пользователь должен иметь права применить миграции. Используйте адрес с прямым подключением или пул в режиме сессии.

```bash
export TEST_DATABASE_URL='postgresql://test_user:test_password@db.example.com:5432/todo_students_test'
npm ci
npm run prisma:validate
npm run prisma:generate
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
DATABASE_URL="$TEST_DATABASE_URL" npm run db:check
npm run check
npm test
npm run test:integration
npx playwright install chromium
# На минимальном Linux могут потребоваться системные зависимости: npx playwright install-deps chromium
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=high
docker compose --env-file .env.example config --quiet
```

Браузерный тест запускает собственный сервер на 3011 и использует фиктивный профиль e2e_student.
Тесты создают и удаляют собственные данные. Для дополнительной проверки ограничений доступа задайте `TEST_APP_URL` и `TEST_REVIEWER_URL` для двух готовых ограниченных ролей в той же тестовой БД. Этот тест временно создаёт `todo.private_notes`.

Джоба `runtime` запускается на основной ветке после push или через **Actions → CI → Run workflow**. Она выполняет валидацию Prisma, генерацию клиента, lint, unit/API-тесты, сборку и аудит, а также проверяет чтение списка дел через API в контейнере.

В **Settings → Actions → Runners → New self-hosted runner** зарегистрируйте Linux-раннер. На машине должны быть Docker и Compose, доступные пользователю раннера. [Регистрация раннера](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).

Если PostgreSQL подключён к сети Docker `infrastructure`, CI присоединяет контейнер к этой сети. В `DATABASE_URL` укажите имя сервиса PostgreSQL или его сетевой алиас и внутренний порт `5432`. Раннер должен использовать тот же Docker Engine. Если фактическое имя сети отличается, например `db_infrastructure`, задайте его в переменной Actions `DOCKER_NETWORK`. [Сети Docker Compose](https://docs.docker.com/compose/how-tos/networking).

Для `127.0.0.1`, `localhost` и `::1` в `DATABASE_URL` CI использует сеть хоста. Этот режим подходит для PostgreSQL, опубликованного на loopback того же Linux-хоста. [Сеть хоста в Docker](https://docs.docker.com/engine/network/drivers/host/).

Добавьте секреты `DATABASE_URL`, `API_TOKEN`, `MOODLE_LOGIN` и `MOODLE_FULL_NAME` в **Settings → Secrets and variables → Actions**. БД должна быть доступна с раннера, а таблица `todo.tasks` должна быть подготовлена. При `503` CI отдельно проверяет подключение и чтение таблицы из того же контейнера. В журнал выводится этап сбоя и код ошибки без строки подключения. Контейнер останавливается после проверки. Интеграционные и браузерные тесты можно запустить локально командами выше.

В **Settings → Secrets and variables → Actions → Variables** задайте `HOST` и `PORT` для адреса и порта прослушивания. По умолчанию используются `127.0.0.1` и `3000`. При использовании сети хоста порт приложения должен быть свободен на хосте.

Runtime приложения не использует pg напрямую или Prisma raw SQL: src/db.js работает с моделью Task.
Драйвер pg используется адаптером Prisma и SQL-подключениями тестов,
которые имитируют независимый доступ преподавателя. Интеграционные тесты проверяют также недоступность БД
через настоящий Prisma Client и наличие SQL CHECK-ограничений после миграции.

CI дополнительно проверяет Compose и собирает runtime Docker-образ на Node.js 22. Образ не публикуется.
