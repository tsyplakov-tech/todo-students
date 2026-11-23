const $ = selector => document.querySelector(selector);
let token = '';
let author;
let activeRun = 'manual';
let requestVersion = 0;
function message(text = '') { $('#message').textContent = text; }
function logout() {
  token = ''; author = undefined; requestVersion++;
  $('#workspace').hidden = true; $('#login-panel').hidden = false;
  $('#tasks').replaceChildren(); $('#token').value = ''; $('#token').focus();
}
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) logout();
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}
async function action(button, operation) {
  button.disabled = true; message();
  try { await operation(); } catch (error) { message(error.message || 'Не удалось связаться с сервером'); }
  finally { button.disabled = false; }
}
function render(tasks) {
  $('#counter').textContent = `${tasks.length} · выполнено ${tasks.filter(task => task.done).length}`;
  $('#empty').hidden = tasks.length > 0;
  $('#tasks').replaceChildren(...tasks.map(task => {
    const li = document.createElement('li'); li.className = `task${task.done ? ' done' : ''}`;
    const main = document.createElement('div'); main.className = 'task-main';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = task.done;
    check.setAttribute('aria-label', `Выполнено: ${task.title}`);
    check.addEventListener('change', () => action(check, async () => {
      try { await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ done: check.checked }) }); }
      catch (error) { check.checked = !check.checked; throw error; }
      await loadTasks();
    }));
    const title = document.createElement('span'); title.className = 'task-title'; title.textContent = task.title;
    main.append(check, title);
    const details = document.createElement('small'); details.textContent = new Date(task.createdAt).toLocaleString('ru-RU');
    const actions = document.createElement('div'); actions.className = 'task-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Изменить';
    edit.addEventListener('click', () => {
      const form = document.createElement('form'); form.className = 'row';
      const input = document.createElement('input'); input.value = task.title; input.required = true; input.setAttribute('aria-label', 'Новое название');
      const save = document.createElement('button'); save.textContent = 'Сохранить'; save.type = 'submit';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Отмена'; cancel.className = 'secondary';
      cancel.addEventListener('click', () => { form.replaceWith(title); edit.disabled = false; });
      form.append(input, save, cancel); title.replaceWith(form); edit.disabled = true; input.focus();
      form.addEventListener('submit', event => { event.preventDefault(); action(save, async () => {
        await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ title: input.value }) }); await loadTasks();
      }); });
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Удалить';
    remove.addEventListener('click', () => action(remove, async () => {
      await api(`/tasks/${task.id}/`, { method: 'DELETE' }); await loadTasks();
    }));
    actions.append(edit, remove); li.append(main, details, actions); return li;
  }));
}
async function loadTasks() {
  const version = ++requestVersion;
  const tasks = await api(`/tasks/?runId=${encodeURIComponent(activeRun)}`);
  if (version === requestVersion && token) render(tasks);
}
$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  action(event.submitter, async () => {
    token = $('#token').value.trim();
    try { author = await api('/author/'); }
    catch (error) { logout(); throw error; }
    $('#token').value = '';
    $('#author-name').textContent = author.fullName; $('#author-login').textContent = `Moodle: ${author.login}`;
    $('#login-panel').hidden = true; $('#workspace').hidden = false;
    await loadTasks();
  });
});
$('#logout').addEventListener('click', () => { logout(); message(); });
$('#run-form').addEventListener('submit', event => {
  event.preventDefault(); action(event.submitter, async () => { activeRun = $('#run-id').value; await loadTasks(); });
});
$('#add-form').addEventListener('submit', event => {
  event.preventDefault(); action(event.submitter, async () => {
    const runId = $('#run-id').value;
    await api('/tasks/', { method: 'POST', body: JSON.stringify({ title: $('#new-title').value, runId }) });
    activeRun = runId; $('#new-title').value = ''; await loadTasks();
  });
});
$('#personal-task').addEventListener('click', event => action(event.currentTarget, async () => {
  await api('/tasks/', { method: 'POST', body: JSON.stringify({ title: `Итоговая работа 24.10.2026: ${author.login}`, runId: 'manual' }) });
  activeRun = 'manual'; $('#run-id').value = 'manual'; await loadTasks();
}));
