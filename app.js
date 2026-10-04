'use strict';

(() => {
  const API = 'https://khzfsdwxmvnsqziufkef.supabase.co/functions/v1/bdh-api';
  const VOTE_KEY = 'bdh:political-representation:v1';
  const $ = (id) => document.getElementById(id);
  const adminMode = new URLSearchParams(location.search).get('admin') === '1';
  const kinds = { temoignage: 'Témoignage', signalement: 'Signalement', autre: 'Autre' };
  const statuses = { new: 'Nouveau', read: 'Lu', archived: 'Archivé' };
  const number = new Intl.NumberFormat('fr-FR');
  let votedInMemory = false;
  let voting = false;
  let token = null;
  let adminFilter = 'all';
  let adminRequest = 0;
  let adminBusy = false;
  let pendingDelete = null;

  function feedback(id, message = '', tone = '') {
    $(id).textContent = message;
    $(id).dataset.tone = tone;
  }

  async function api(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
        body: JSON.stringify({ action, ...payload }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const error = new Error(result.error || 'request_failed');
        error.unauthorized = response.status === 401 || result.error === 'unauthorized';
        throw error;
      }
      return result.data;
    } finally { clearTimeout(timeout); }
  }

  function hasVoted() {
    try { return votedInMemory || Boolean(localStorage.getItem(VOTE_KEY)); }
    catch { return votedInMemory; }
  }

  function syncVoteButtons() {
    document.querySelectorAll('[data-vote]').forEach((button) => {
      button.disabled = voting || hasVoted();
    });
  }

  async function loadStats() {
    $('poll-results').setAttribute('aria-busy', 'true');
    $('retry-stats').hidden = true;
    feedback('stats-feedback');
    try {
      const data = await api('stats');
      const stats = Array.isArray(data) ? data[0] : data;
      if (!stats || !Number.isFinite(Number(stats.total_count))) throw new Error('invalid_stats');
      const total = Number(stats.total_count);
      const yes = total > 0 ? Number(stats.yes_count) / total * 100 : 0;
      const no = total > 0 ? Number(stats.no_count) / total * 100 : 0;
      $('yes-percent').textContent = `${yes.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
      $('no-percent').textContent = `${no.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
      $('yes-progress').value = yes;
      $('no-progress').value = no;
      $('vote-total').textContent = `${number.format(total)} vote${total === 1 ? '' : 's'} au total`;
    } catch {
      if ($('vote-total').textContent.startsWith('Chargement')) $('vote-total').textContent = 'Résultats indisponibles pour le moment.';
      feedback('stats-feedback', 'Impossible de charger les résultats. Réessayez dans un instant.', 'error');
      $('retry-stats').hidden = false;
    } finally { $('poll-results').setAttribute('aria-busy', 'false'); }
  }

  async function vote(choice) {
    if (voting || hasVoted()) return;
    voting = true;
    syncVoteButtons();
    feedback('vote-feedback', 'Enregistrement de votre vote…');
    try {
      await api('vote', { choice, website: '' });
      votedInMemory = true;
      try { localStorage.setItem(VOTE_KEY, choice); } catch { /* A vote remains blocked in this tab. */ }
      feedback('vote-feedback', 'Merci. Votre vote a bien été enregistré.', 'success');
      await loadStats();
    } catch {
      feedback('vote-feedback', 'La confirmation du vote n’a pas pu être reçue. Vérifiez votre connexion avant de réessayer.', 'error');
    } finally { voting = false; syncVoteButtons(); }
  }

  function messageLength() { return Array.from($('message').value.trim()).length; }

  async function sendMessage(event) {
    event.preventDefault();
    if ($('send-message').disabled) return;
    if ($('website').value) {
      $('message-form').reset();
      updateCount();
      feedback('message-feedback', 'Merci. Votre message anonyme a bien été transmis.', 'success');
      return;
    }
    const length = messageLength();
    if (length < 10 || length > 5000) {
      feedback('message-feedback', 'Votre message doit contenir de 10 à 5 000 caractères.', 'error');
      $('message').focus();
      return;
    }
    const button = $('send-message');
    button.disabled = true;
    button.querySelector('span').textContent = 'Envoi en cours…';
    feedback('message-feedback');
    try {
      await api('submission', {
        kind: new FormData($('message-form')).get('kind'),
        message: $('message').value.trim(), website: '',
      });
      $('message-form').reset();
      updateCount();
      feedback('message-feedback', 'Merci. Votre message anonyme a bien été transmis.', 'success');
    } catch {
      feedback('message-feedback', 'La confirmation d’envoi n’a pas pu être reçue. Votre texte est conservé ; vérifiez votre connexion avant de réessayer.', 'error');
    } finally { button.disabled = false; button.querySelector('span').textContent = 'Envoyer anonymement'; }
  }

  function updateCount() { $('message-count').textContent = `${number.format(messageLength())} / 5 000`; }

  function showLogin(message = '') {
    token = null;
    adminRequest++;
    $('admin-panel').hidden = true;
    $('login-panel').hidden = false;
    $('messages').replaceChildren();
    ['admin-new', 'admin-total', 'admin-yes', 'admin-no'].forEach((id) => { $(id).textContent = '—'; });
    feedback('admin-feedback');
    feedback('login-feedback', message);
  }

  function handleAdminError(error) {
    if (error.unauthorized) {
      showLogin('Votre session a expiré. Reconnectez-vous.');
      $('password').focus();
    } else feedback('admin-feedback', 'Impossible de terminer cette action. Réessayez dans un instant.', 'error');
  }

  function setAdminBusy(busy) {
    adminBusy = busy;
    $('admin-panel').querySelectorAll('button').forEach((button) => {
      button.disabled = busy || button.dataset.unavailable === 'true';
    });
    $('messages').setAttribute('aria-busy', String(busy));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderMessages(rows) {
    const fragment = document.createDocumentFragment();
    if (!rows.length) fragment.append(element('p', 'empty-state', 'Aucun message dans cette catégorie.'));
    for (const row of rows) {
      const card = element('article', 'card received-message');
      card.dataset.id = String(row.id);
      const head = element('div', 'message-head');
      const badge = element('span', 'status-badge', statuses[row.status] || row.status);
      badge.dataset.status = row.status;
      const date = new Date(row.created_at);
      const dateNode = element('time', 'message-date', Number.isNaN(date.getTime()) ? 'Date indisponible' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }));
      if (!Number.isNaN(date.getTime())) dateNode.dateTime = date.toISOString();
      head.append(element('span', 'message-type', kinds[row.kind] || row.kind), badge, dateNode);
      card.append(head, element('p', 'message-content', row.message), element('p', 'message-reference', `Référence ID : ${row.id}`));
      const actions = element('div', 'message-actions');
      for (const [action, label] of [['read', 'Lu'], ['archive', 'Archiver'], ['delete', 'Supprimer']]) {
        const button = element('button', action === 'delete' ? 'danger-button' : 'secondary-button', label);
        button.type = 'button';
        button.dataset.action = action;
        if ((action === 'read' && row.status === 'read') || (action === 'archive' && row.status === 'archived')) {
          button.disabled = true;
          button.dataset.unavailable = 'true';
        }
        button.addEventListener('click', () => {
          if (action === 'delete') {
            pendingDelete = row.id;
            $('delete-reference').textContent = `Référence ID : ${row.id}`;
            $('delete-dialog').returnValue = 'cancel';
            $('delete-dialog').showModal();
          } else performAction(row.id, action);
        });
        actions.append(button);
      }
      card.append(actions);
      fragment.append(card);
    }
    $('messages').replaceChildren(fragment);
  }

  async function loadAdmin() {
    if (!token) return;
    const request = ++adminRequest;
    const currentToken = token;
    setAdminBusy(true);
    try {
      const data = await api('admin_list', { token: currentToken, filter: adminFilter });
      if (request !== adminRequest || currentToken !== token) return;
      if (!Array.isArray(data?.rows) || !data?.stats) throw new Error('invalid_messages');
      for (const key of ['new', 'total', 'yes', 'no']) $('admin-' + key).textContent = number.format(Number(data.stats[key] || 0));
      renderMessages(data.rows);
    } catch (error) {
      if (request === adminRequest && currentToken === token) handleAdminError(error);
    } finally { if (request === adminRequest) setAdminBusy(false); }
  }

  async function login(event) {
    event.preventDefault();
    if ($('login-button').disabled) return;
    $('login-button').disabled = true;
    feedback('login-feedback', 'Connexion en cours…');
    try {
      const result = await api('admin_login', { password: $('password').value });
      $('password').value = '';
      if (typeof result !== 'string' || !result) {
        feedback('login-feedback', 'Mot de passe incorrect.', 'error');
        $('password').focus();
        return;
      }
      token = result;
      adminFilter = 'all';
      document.querySelectorAll('[data-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === 'all')));
      feedback('login-feedback');
      feedback('admin-feedback');
      $('login-panel').hidden = true;
      $('admin-panel').hidden = false;
      await loadAdmin();
    } catch { feedback('login-feedback', 'Connexion impossible pour le moment. Réessayez dans un instant.', 'error'); }
    finally { $('login-button').disabled = false; }
  }

  async function performAction(id, action) {
    if (!token || adminBusy) return;
    setAdminBusy(true);
    feedback('admin-feedback');
    try {
      await api('admin_action', { token, id, do: action });
      feedback('admin-feedback', action === 'delete' ? 'Message supprimé.' : action === 'read' ? 'Message marqué comme lu.' : 'Message archivé.', 'success');
      await loadAdmin();
    } catch (error) { handleAdminError(error); }
    finally { setAdminBusy(false); }
  }

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  async function exportCsv() {
    if (!token || adminBusy) return;
    setAdminBusy(true);
    feedback('admin-feedback');
    try {
      const data = await api('admin_list', { token, filter: adminFilter });
      if (!Array.isArray(data?.rows)) throw new Error('invalid_messages');
      const rows = [['Référence ID', 'Type', 'Statut', 'Date', 'Message'], ...data.rows.map((row) => [row.id, kinds[row.kind] || row.kind, statuses[row.status] || row.status, row.created_at, row.message])];
      const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = element('a');
      link.href = url;
      link.download = `briseur-de-haine-${adminFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      feedback('admin-feedback', `${number.format(data.rows.length)} message${data.rows.length === 1 ? '' : 's'} exporté${data.rows.length === 1 ? '' : 's'} (filtre actuel).`, 'success');
    } catch (error) { handleAdminError(error); }
    finally { setAdminBusy(false); }
  }

  async function logout() {
    if (!token || adminBusy) return;
    setAdminBusy(true);
    try {
      await api('admin_logout', { token });
      showLogin('Vous êtes déconnecté.');
      $('password').focus();
    } catch (error) { handleAdminError(error); }
    finally { setAdminBusy(false); }
  }

  $('public-view').hidden = adminMode;
  $('admin-view').hidden = !adminMode;

  if (adminMode) {
    document.title = 'Administration — BRISEUR DE HAINE';
    $('login-form').addEventListener('submit', login);
    $('logout-button').addEventListener('click', logout);
    $('export-csv').addEventListener('click', exportCsv);
    $('refresh-admin').addEventListener('click', () => { feedback('admin-feedback'); loadAdmin(); });
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        if (adminBusy) return;
        adminFilter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        feedback('admin-feedback');
        loadAdmin();
      });
    });
    $('delete-dialog').addEventListener('close', () => {
      const id = pendingDelete;
      pendingDelete = null;
      if ($('delete-dialog').returnValue === 'delete' && id) performAction(id, 'delete');
    });
  } else {
    syncVoteButtons();
    if (hasVoted()) feedback('vote-feedback', 'Vous avez déjà voté depuis ce navigateur. Merci pour votre participation.');
    document.querySelectorAll('[data-vote]').forEach((button) => button.addEventListener('click', () => vote(button.dataset.vote)));
    window.addEventListener('storage', (event) => { if (event.key === VOTE_KEY) syncVoteButtons(); });
    $('retry-stats').addEventListener('click', loadStats);
    $('message-form').addEventListener('submit', sendMessage);
    $('message').addEventListener('input', updateCount);
    loadStats();
  }
})();
