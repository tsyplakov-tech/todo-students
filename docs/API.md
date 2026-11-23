# HTTP-контракт

Все пути заканчиваются `/`. Для `/api/` нужен `Authorization: Bearer <токен из окружения сервера>`.
GET `/login/` общедоступен, возвращает логин Moodle как text/plain. GET `/api/author/` возвращает `{"login":"...","fullName":"..."}`.

POST и PATCH требуют `Content-Type: application/json`. POST допускает ровно `title` и `runId`.
PATCH принимает непустой набор `title`/`done`. Любые дополнительные поля, включая id, ownerLogin, createdAt, запрещены.

* title — строка, trim, 1–200 Unicode-кодовых точек (как char_length в PostgreSQL). NUL не допускается PostgreSQL.
* runId — строка 1–64 символа `[A-Za-z0-9_-]`; в GET списка обязателен ровно один параметр runId.
* done — JSON boolean, не строка или число.
* id — UUID в канонической записи с дефисами; неверная форма — 400.
* JSON-объект обязателен; массив, null, примитив или повреждённый JSON — 400. Максимальный JSON — 16 КБ.

Дело содержит ровно id, ownerLogin, title, done, runId, createdAt. id — UUID-строка, время — ISO 8601 UTC с Z.
Все выборки и изменения ограничены ownerLogin из серверной конфигурации. Чужой UUID возвращает 404.
GET списка с корректным неизвестным runId возвращает `[]`. Ответ DELETE 204 не имеет тела.
Ошибки имеют вид `{"error":"краткое описание"}` и application/json: 400 (ввод), 401 (токен), 404 (дело/маршрут), 503 (БД), 500 (неожиданная внутренняя ошибка).
401 проверяется до разбора JSON. Неизвестные API-маршруты также защищены токеном. SQL-ошибки и реквизиты в ответ не попадают.

```bash
# BASE_URL и API_TOKEN задаются локально, без публикации значений.
curl "$BASE_URL/login/"
curl -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/author/"
curl -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"Первое дело","runId":"manual"}' \
  "$BASE_URL/api/tasks/"
curl -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/tasks/?runId=manual"
# В TASK_ID запишите UUID из POST.
curl -X PATCH -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Обновлено","done":true}' "$BASE_URL/api/tasks/$TASK_ID/"
curl -X DELETE -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/tasks/$TASK_ID/"
```
