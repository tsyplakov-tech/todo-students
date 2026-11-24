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

Джоба `runtime` запускается при push, pull request из того же репозитория и через **Actions → CI → Run workflow**. Она выполняет валидацию Prisma, генерацию клиента, lint, unit/API-тесты, сборку и аудит, а также проверяет чтение списка дел через API в контейнере. Для pull request из форков джоба пропускается, поскольку секреты недоступны.

Добавьте секреты `DATABASE_URL`, `API_TOKEN`, `MOODLE_LOGIN` и `MOODLE_FULL_NAME` в **Settings → Secrets and variables → Actions**. БД должна быть доступна с раннера, а таблица `todo.tasks` должна быть подготовлена. Контейнер останавливается после проверки. Интеграционные и браузерные тесты можно запустить локально командами выше.

В **Settings → Secrets and variables → Actions → Variables** задайте `HOST` и `PORT` для адреса и порта прослушивания внутри контейнера. Если их не указать, используются `0.0.0.0` и `3000`. Для `HOST` можно также указать `127.0.0.1`, поскольку проверка API выполняется внутри контейнера.

Runtime приложения не использует pg напрямую или Prisma raw SQL: src/db.js работает с моделью Task.
Драйвер pg используется адаптером Prisma и SQL-подключениями тестов,
которые имитируют независимый доступ преподавателя. Интеграционные тесты проверяют также недоступность БД
через настоящий Prisma Client и наличие SQL CHECK-ограничений после миграции.

CI дополнительно проверяет Compose и собирает runtime Docker-образ на Node.js 22. Образ не публикуется.
