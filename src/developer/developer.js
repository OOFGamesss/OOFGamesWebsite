import { accountClient, discordLoginUrl } from '../api/account-client.js';

const app = document.getElementById('developer-app');

const state = {
  me: null,
  gameTypes: [],
  myGames: [],
  activeTab: 'profile',
  editingGame: null
};

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function statusLine() {
  return el('p', 'min-h-5 text-sm text-slate-400');
}

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.classList.toggle('text-red-400', isError);
  node.classList.toggle('text-neon-green', !isError && Boolean(message));
}

function fieldLabel(text) {
  return el('label', 'block text-sm font-semibold text-slate-200', text);
}

function textInput(placeholder, value = '') {
  const input = el('input', 'mt-1 w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = value;
  return input;
}

function primaryButton(text) {
  const button = el('button', 'btn-primary px-4 py-2 text-sm', text);
  button.type = 'button';
  return button;
}

function subtleButton(text) {
  const button = el('button', 'rounded-xl border border-neon-violet/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan', text);
  button.type = 'button';
  return button;
}

function dangerButton(text) {
  const button = el('button', 'rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10', text);
  button.type = 'button';
  return button;
}

function statusBadge(status) {
  const styles = {
    pending: 'bg-neon-gold/15 text-neon-gold border-neon-gold/40',
    approved: 'bg-neon-green/15 text-neon-green border-neon-green/40',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/40'
  };
  return el('span', `rounded-full border px-3 py-0.5 text-xs font-semibold uppercase ${styles[status] || ''}`, status);
}

function playerCountText(game) {
  if (game.players_over_24) return '24+ players';
  if (game.max_players) return `Up to ${game.max_players} players`;
  return null;
}

function renderLogin() {
  clear(app);
  const panel = el('section', 'panel mx-auto flex w-full max-w-md flex-col items-center gap-5 p-10 text-center');
  panel.appendChild(el('h2', 'text-2xl font-semibold text-neon-gold', 'Sign in required'));
  panel.appendChild(el('p', 'text-sm text-slate-300', 'Log in with Discord to access the developer hub.'));

  if (new URLSearchParams(window.location.search).get('login') === 'error') {
    panel.appendChild(el('p', 'text-sm text-red-400', 'Login failed, please try again.'));
  }

  const login = el('a', 'btn-primary', 'Login with Discord');
  login.href = discordLoginUrl;
  panel.appendChild(login);
  app.appendChild(panel);
}

function renderDashboard() {
  clear(app);
  const layout = el('div', 'flex flex-col gap-6 md:flex-row');

  const sidebar = el('aside', 'panel flex h-fit flex-row gap-2 overflow-x-auto p-3 md:w-56 md:flex-col');
  const content = el('section', 'min-w-0 flex-1');

  const tabs = [
    { id: 'profile', label: 'Profile Management', render: renderProfileTab },
    { id: 'games', label: 'Games', render: renderGamesTab },
    { id: 'settings', label: 'Settings', render: renderSettingsTab }
  ];
  if (state.me.is_admin) {
    tabs.push({ id: 'admin', label: 'Admin', render: renderAdminTab });
  }

  const buttons = new Map();
  const activate = (tab) => {
    state.activeTab = tab.id;
    for (const [id, button] of buttons) {
      button.classList.toggle('bg-neon-violet/20', id === tab.id);
      button.classList.toggle('text-neon-cyan', id === tab.id);
    }
    clear(content);
    tab.render(content);
  };

  for (const tab of tabs) {
    const button = el('button', 'whitespace-nowrap rounded-xl px-4 py-2 text-left text-sm font-semibold text-slate-200 transition hover:text-neon-cyan', tab.label);
    button.type = 'button';
    button.addEventListener('click', () => activate(tab));
    buttons.set(tab.id, button);
    sidebar.appendChild(button);
  }

  layout.appendChild(sidebar);
  layout.appendChild(content);
  app.appendChild(layout);

  activate(tabs.find((tab) => tab.id === state.activeTab) || tabs[0]);
}

function renderProfileTab(container) {
  const panel = el('div', 'panel flex flex-col gap-6 p-6');
  panel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', 'Profile Management'));

  const identity = el('div', 'flex items-center gap-4');
  const avatar = el('img', 'h-20 w-20 rounded-full border-2 border-neon-violet/50 object-cover');
  avatar.src = state.me.avatar_url;
  avatar.alt = 'Your avatar';
  avatar.referrerPolicy = 'no-referrer';
  identity.appendChild(avatar);
  const names = el('div');
  names.appendChild(el('p', 'text-lg font-semibold text-slate-100', state.me.username));
  names.appendChild(el('p', 'text-sm text-slate-400', `Discord: ${state.me.discord_username}`));
  identity.appendChild(names);
  panel.appendChild(identity);

  const usernameStatus = statusLine();
  const usernameBlock = el('div', 'flex flex-col gap-2');
  usernameBlock.appendChild(fieldLabel('Custom username'));
  const usernameInput = textInput('Leave blank to use your Discord name', state.me.custom_username || '');
  usernameInput.maxLength = 32;
  usernameBlock.appendChild(usernameInput);
  const usernameActions = el('div', 'flex gap-2');
  const saveButton = primaryButton('Save username');
  saveButton.addEventListener('click', async () => {
    setStatus(usernameStatus, 'Saving…');
    const value = usernameInput.value.trim() || null;
    const result = await accountClient.updateProfile(value);
    if (result.ok) {
      state.me = result.data;
      setStatus(usernameStatus, 'Username updated.');
      renderDashboard();
    } else {
      setStatus(usernameStatus, result.error, true);
    }
  });
  usernameActions.appendChild(saveButton);
  usernameBlock.appendChild(usernameActions);
  usernameBlock.appendChild(usernameStatus);
  panel.appendChild(usernameBlock);

  const avatarStatus = statusLine();
  const avatarBlock = el('div', 'flex flex-col gap-2');
  avatarBlock.appendChild(fieldLabel('Custom avatar'));
  avatarBlock.appendChild(el('p', 'text-xs text-slate-400', 'PNG, JPEG, GIF or WebP up to 5 MB.'));
  const fileInput = el('input', 'text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-neon-violet file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-neon-magenta');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    setStatus(avatarStatus, 'Uploading…');
    const result = await accountClient.uploadAvatar(file);
    if (result.ok) {
      setStatus(avatarStatus, 'Avatar updated.');
      const refreshed = await accountClient.getMe();
      if (refreshed.ok) state.me = refreshed.data;
      renderDashboard();
    } else {
      setStatus(avatarStatus, result.error, true);
    }
  });
  avatarBlock.appendChild(fileInput);
  avatarBlock.appendChild(avatarStatus);
  panel.appendChild(avatarBlock);

  container.appendChild(panel);
}

function pendingChangesBadge() {
  return el('span', 'rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-0.5 text-xs font-semibold uppercase text-neon-cyan', 'changes in review');
}

async function refreshMyGames() {
  const games = await accountClient.getMyGames();
  if (games.ok) state.myGames = games.data;
}

function gameCard(game, { withdrawable }) {
  const card = el('article', 'install-step flex-col items-stretch gap-3');
  const header = el('div', 'flex flex-wrap items-center justify-between gap-2');
  const title = el('div', 'flex items-center gap-3');
  const thumb = el('img', 'h-12 w-12 rounded-lg border border-neon-violet/30 object-cover');
  thumb.src = game.image_url;
  thumb.alt = '';
  thumb.referrerPolicy = 'no-referrer';
  title.appendChild(thumb);
  const titleText = el('div');
  titleText.appendChild(el('p', 'font-semibold text-slate-100', game.name));
  titleText.appendChild(el('p', 'text-xs text-slate-400', `${game.game_type_name} · by ${game.authors}`));
  title.appendChild(titleText);
  header.appendChild(title);
  const badges = el('div', 'flex items-center gap-2');
  if (game.pending_changes) badges.appendChild(pendingChangesBadge());
  badges.appendChild(statusBadge(game.status));
  header.appendChild(badges);
  card.appendChild(header);

  card.appendChild(el('p', 'text-sm text-slate-300', game.description));

  const meta = el('div', 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400');
  const players = playerCountText(game);
  if (players) meta.appendChild(el('span', '', players));
  for (const [label, url] of [
    ['Download', game.repo_url],
    ['Information', game.info_url],
    ['Discord', game.discord_invite_url]
  ]) {
    if (!url) continue;
    const link = el('a', 'text-neon-cyan hover:underline', label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    meta.appendChild(link);
  }
  card.appendChild(meta);

  if (game.status === 'rejected' && game.rejection_reason) {
    card.appendChild(el('p', 'text-sm text-red-400', `Rejected: ${game.rejection_reason}`));
  }
  if (game.status === 'approved' && game.rejection_reason && !game.pending_changes) {
    card.appendChild(el('p', 'text-sm text-red-400', `Your last edit was rejected: ${game.rejection_reason}`));
  }

  if (withdrawable) {
    const actions = el('div', 'flex flex-wrap justify-end gap-2');
    const edit = subtleButton(game.pending_changes ? 'Edit pending changes' : 'Edit');
    edit.addEventListener('click', () => {
      state.editingGame = game;
      renderDashboard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    actions.appendChild(edit);
    if (game.pending_changes) {
      const cancelChanges = dangerButton('Cancel changes');
      cancelChanges.addEventListener('click', async () => {
        if (!window.confirm('Discard the changes waiting for review? The live version stays as-is.')) return;
        const result = await accountClient.cancelChanges(game.id);
        if (result.ok) {
          await refreshMyGames();
          renderDashboard();
        }
      });
      actions.appendChild(cancelChanges);
    }
    if (game.status !== 'approved') {
      const withdraw = dangerButton('Withdraw');
      withdraw.addEventListener('click', async () => {
        if (!window.confirm(`Withdraw "${game.name}"? This cannot be undone.`)) return;
        const result = await accountClient.withdrawGame(game.id);
        if (result.ok) {
          state.myGames = state.myGames.filter((entry) => entry.id !== game.id);
          renderDashboard();
        }
      });
      actions.appendChild(withdraw);
    }
    card.appendChild(actions);
  }

  return card;
}

function renderGamesTab(container) {
  const wrapper = el('div', 'flex flex-col gap-6');

  const editing = state.editingGame;
  const initial = editing ? { ...editing, ...(editing.pending_changes || {}) } : null;

  const formPanel = el('div', 'panel flex flex-col gap-4 p-6');
  formPanel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', editing ? `Editing "${editing.name}"` : 'Submit a game'));
  formPanel.appendChild(el('p', 'text-sm text-slate-400', editing && editing.status === 'approved'
    ? 'Your live listing stays published while these changes wait for admin review.'
    : 'Submissions are reviewed by an admin before appearing in the public catalogue.'));

  const formStatus = statusLine();

  const typeBlock = el('div');
  typeBlock.appendChild(fieldLabel('Game type'));
  const typeSelect = el('select', 'neon-select mt-1');
  for (const gameType of state.gameTypes) {
    const option = el('option', '', gameType.name);
    option.value = String(gameType.id);
    typeSelect.appendChild(option);
  }
  if (initial) typeSelect.value = String(initial.game_type_id);
  typeBlock.appendChild(typeSelect);
  formPanel.appendChild(typeBlock);

  const nameBlock = el('div');
  nameBlock.appendChild(fieldLabel('Plugin Name'));
  const nameInput = textInput('e.g. Triple Triad Royale', initial ? initial.name : '');
  nameInput.maxLength = 100;
  nameBlock.appendChild(nameInput);
  formPanel.appendChild(nameBlock);

  const authorsBlock = el('div');
  authorsBlock.appendChild(fieldLabel('Authors'));
  const authorsInput = textInput('Everyone who created the game, e.g. Alice, Bob', initial ? initial.authors : '');
  authorsInput.maxLength = 200;
  authorsBlock.appendChild(authorsInput);
  formPanel.appendChild(authorsBlock);

  const imageBlock = el('div');
  imageBlock.appendChild(fieldLabel('Game image URL'));
  const imageInput = textInput('https://…', initial ? initial.image_url : '');
  imageBlock.appendChild(imageInput);
  formPanel.appendChild(imageBlock);

  const descriptionBlock = el('div');
  descriptionBlock.appendChild(fieldLabel('Description'));
  const descriptionInput = el('textarea', 'mt-1 w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  descriptionInput.rows = 4;
  descriptionInput.maxLength = 2000;
  descriptionInput.placeholder = 'What is the game and how is it played?';
  if (initial) descriptionInput.value = initial.description;
  descriptionBlock.appendChild(descriptionInput);
  formPanel.appendChild(descriptionBlock);

  const playersBlock = el('div');
  playersBlock.appendChild(fieldLabel('Player count (optional)'));
  const playersRow = el('div', 'mt-1 flex flex-wrap items-center gap-4');
  const playersSelect = el('select', 'neon-select w-44');
  const noneOption = el('option', '', 'Not specified');
  noneOption.value = '';
  playersSelect.appendChild(noneOption);
  for (let count = 1; count <= 24; count += 1) {
    const option = el('option', '', `Up to ${count}`);
    option.value = String(count);
    playersSelect.appendChild(option);
  }
  const overLabel = el('label', 'flex items-center gap-2 text-sm text-slate-300');
  const overCheckbox = el('input');
  overCheckbox.type = 'checkbox';
  overCheckbox.addEventListener('change', () => {
    playersSelect.disabled = overCheckbox.checked;
  });
  if (initial) {
    overCheckbox.checked = Boolean(initial.players_over_24);
    playersSelect.disabled = overCheckbox.checked;
    if (initial.max_players) playersSelect.value = String(initial.max_players);
  }
  overLabel.appendChild(overCheckbox);
  overLabel.appendChild(document.createTextNode('More than 24 players'));
  playersRow.appendChild(playersSelect);
  playersRow.appendChild(overLabel);
  playersBlock.appendChild(playersRow);
  formPanel.appendChild(playersBlock);

  const repoBlock = el('div');
  repoBlock.appendChild(fieldLabel('Download link (optional)'));
  const repoInput = textInput('https://…', initial ? initial.repo_url || '' : '');
  repoBlock.appendChild(repoInput);
  formPanel.appendChild(repoBlock);

  const infoBlock = el('div');
  infoBlock.appendChild(fieldLabel('Information link (optional)'));
  const infoInput = textInput('https://…', initial ? initial.info_url || '' : '');
  infoBlock.appendChild(infoInput);
  formPanel.appendChild(infoBlock);

  const inviteBlock = el('div');
  inviteBlock.appendChild(fieldLabel('Discord invite (optional)'));
  const inviteInput = textInput('https://discord.gg/…', initial ? initial.discord_invite_url || '' : '');
  inviteBlock.appendChild(inviteInput);
  formPanel.appendChild(inviteBlock);

  const buttonRow = el('div', 'flex flex-wrap gap-2');
  const submitButton = primaryButton(editing ? 'Save changes for review' : 'Submit for review');
  submitButton.addEventListener('click', async () => {
    setStatus(formStatus, 'Submitting…');
    submitButton.disabled = true;
    const payload = {
      game_type_id: Number(typeSelect.value),
      name: nameInput.value,
      authors: authorsInput.value,
      image_url: imageInput.value,
      description: descriptionInput.value,
      max_players: overCheckbox.checked || !playersSelect.value ? null : Number(playersSelect.value),
      players_over_24: overCheckbox.checked,
      repo_url: repoInput.value.trim() || null,
      info_url: infoInput.value.trim() || null,
      discord_invite_url: inviteInput.value.trim() || null
    };
    const result = editing
      ? await accountClient.editGame(editing.id, payload)
      : await accountClient.submitGame(payload);
    submitButton.disabled = false;
    if (result.ok) {
      state.editingGame = null;
      await refreshMyGames();
      renderDashboard();
    } else {
      setStatus(formStatus, result.error, true);
    }
  });
  buttonRow.appendChild(submitButton);
  if (editing) {
    const cancelEdit = subtleButton('Cancel editing');
    cancelEdit.addEventListener('click', () => {
      state.editingGame = null;
      renderDashboard();
    });
    buttonRow.appendChild(cancelEdit);
  }
  formPanel.appendChild(buttonRow);
  formPanel.appendChild(formStatus);
  wrapper.appendChild(formPanel);

  const listPanel = el('div', 'panel flex flex-col gap-4 p-6');
  listPanel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', 'My submissions'));
  if (state.myGames.length === 0) {
    listPanel.appendChild(el('p', 'text-sm text-slate-400', 'Nothing submitted yet.'));
  } else {
    for (const game of state.myGames) {
      listPanel.appendChild(gameCard(game, { withdrawable: true }));
    }
  }
  wrapper.appendChild(listPanel);

  container.appendChild(wrapper);
}

function renderSettingsTab(container) {
  const panel = el('div', 'panel flex flex-col gap-6 p-6');
  panel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', 'Settings'));

  const sessionBlock = el('div', 'flex flex-col gap-2');
  sessionBlock.appendChild(fieldLabel('Session'));
  const logoutButton = subtleButton('Log out');
  logoutButton.addEventListener('click', async () => {
    await accountClient.logout();
    window.location.href = '/';
  });
  sessionBlock.appendChild(logoutButton);
  panel.appendChild(sessionBlock);

  const exportBlock = el('div', 'flex flex-col gap-2');
  exportBlock.appendChild(fieldLabel('Your data'));
  const exportButton = subtleButton('Download my data (JSON)');
  exportButton.addEventListener('click', async () => {
    const result = await accountClient.exportData();
    if (!result.ok) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'oofgames-account-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  exportBlock.appendChild(exportButton);
  panel.appendChild(exportBlock);

  const dangerBlock = el('div', 'flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4');
  dangerBlock.appendChild(el('p', 'font-semibold text-red-400', 'Danger zone'));
  dangerBlock.appendChild(el('p', 'text-sm text-slate-400', 'Deleting your account removes your profile, sessions, and pending submissions. Approved games stay in the catalogue without your name attached.'));
  const deleteStatus = statusLine();
  const deleteButton = dangerButton('Delete my account');
  deleteButton.addEventListener('click', async () => {
    if (!window.confirm('Delete your account? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Your profile and sessions will be removed permanently.')) return;
    const result = await accountClient.deleteAccount();
    if (result.ok) {
      window.location.href = '/';
    } else {
      setStatus(deleteStatus, result.error, true);
    }
  });
  dangerBlock.appendChild(deleteButton);
  dangerBlock.appendChild(deleteStatus);
  panel.appendChild(dangerBlock);

  container.appendChild(panel);
}

function buildChangesDiff(game) {
  const changes = game.pending_changes;
  const block = el('div', 'flex flex-col gap-1 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3');
  block.appendChild(el('p', 'text-sm font-semibold text-neon-cyan', 'Proposed changes (live version stays published until approved)'));

  const playerText = (maxPlayers, over24) => {
    if (over24) return '24+ players';
    if (maxPlayers) return `Up to ${maxPlayers} players`;
    return 'Not specified';
  };
  const typeName = (typeId) => {
    const match = state.gameTypes.find((entry) => entry.id === typeId);
    return match ? match.name : `type #${typeId}`;
  };

  const rows = [
    ['Plugin Name', game.name, changes.name],
    ['Authors', game.authors, changes.authors],
    ['Type', game.game_type_name, typeName(changes.game_type_id)],
    ['Image', game.image_url, changes.image_url],
    ['Description', game.description, changes.description],
    ['Players', playerCountText(game) || 'Not specified', playerText(changes.max_players, changes.players_over_24)],
    ['Download link', game.repo_url || '-', changes.repo_url || '-'],
    ['Information', game.info_url || '-', changes.info_url || '-'],
    ['Discord', game.discord_invite_url || '-', changes.discord_invite_url || '-']
  ];
  let anyChange = false;
  for (const [label, oldValue, newValue] of rows) {
    if (oldValue === newValue) continue;
    anyChange = true;
    const row = el('p', 'text-xs text-slate-300');
    row.appendChild(el('span', 'font-semibold text-slate-200', `${label}: `));
    row.appendChild(el('span', 'text-slate-400 line-through', String(oldValue)));
    row.appendChild(document.createTextNode(' → '));
    row.appendChild(el('span', 'text-neon-green', String(newValue)));
    block.appendChild(row);
  }
  if (!anyChange) {
    block.appendChild(el('p', 'text-xs text-slate-400', 'No field differences from the live version.'));
  }
  return block;
}

async function renderAdminTab(container) {
  const wrapper = el('div', 'flex flex-col gap-6');

  const queuePanel = el('div', 'panel flex flex-col gap-4 p-6');
  queuePanel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', 'Review queue'));
  const queueStatus = statusLine();
  queuePanel.appendChild(queueStatus);
  const queueList = el('div', 'flex flex-col gap-4');
  queuePanel.appendChild(queueList);
  wrapper.appendChild(queuePanel);

  const typesPanel = el('div', 'panel flex flex-col gap-4 p-6');
  typesPanel.appendChild(el('h2', 'text-xl font-semibold text-neon-violet', 'Game types'));
  const typesStatus = statusLine();
  const typesList = el('div', 'flex flex-wrap gap-2');
  const addRow = el('div', 'flex gap-2');
  const addInput = textInput('New game type');
  addInput.maxLength = 64;
  const addButton = primaryButton('Add');
  addRow.appendChild(addInput);
  addRow.appendChild(addButton);
  typesPanel.appendChild(typesList);
  typesPanel.appendChild(addRow);
  typesPanel.appendChild(typesStatus);
  wrapper.appendChild(typesPanel);

  container.appendChild(wrapper);

  const refreshTypes = async () => {
    const result = await accountClient.getGameTypes();
    if (!result.ok) return;
    state.gameTypes = result.data;
    clear(typesList);
    for (const gameType of state.gameTypes) {
      const chip = el('span', 'flex items-center gap-2 rounded-full border border-neon-violet/40 px-3 py-1 text-sm text-slate-200');
      chip.appendChild(el('span', '', gameType.name));
      const remove = el('button', 'text-slate-400 transition hover:text-red-400', '✕');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Delete ${gameType.name}`);
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete game type "${gameType.name}"?`)) return;
        const removal = await accountClient.deleteGameType(gameType.id);
        if (removal.ok) {
          setStatus(typesStatus, 'Game type deleted.');
          refreshTypes();
        } else {
          setStatus(typesStatus, removal.error, true);
        }
      });
      chip.appendChild(remove);
      typesList.appendChild(chip);
    }
  };

  addButton.addEventListener('click', async () => {
    const name = addInput.value.trim();
    if (!name) return;
    const result = await accountClient.createGameType(name);
    if (result.ok) {
      addInput.value = '';
      setStatus(typesStatus, 'Game type added.');
      refreshTypes();
    } else {
      setStatus(typesStatus, result.error, true);
    }
  });

  const refreshQueue = async () => {
    const result = await accountClient.getPendingGames();
    clear(queueList);
    if (!result.ok) {
      setStatus(queueStatus, result.error, true);
      return;
    }
    if (result.data.length === 0) {
      setStatus(queueStatus, 'No games waiting for review.');
      return;
    }
    setStatus(queueStatus, `${result.data.length} item(s) waiting for review.`);
    for (const game of result.data) {
      const card = gameCard(game, { withdrawable: false });
      if (game.developer_name) {
        card.appendChild(el('p', 'text-xs text-slate-400', `Submitted by ${game.developer_name}`));
      }
      if (game.pending_changes) {
        card.appendChild(buildChangesDiff(game));
      }
      const actions = el('div', 'flex justify-end gap-2');
      const approve = primaryButton('Approve');
      approve.addEventListener('click', async () => {
        const approval = await accountClient.approveGame(game.id);
        if (approval.ok) refreshQueue();
      });
      const reject = dangerButton('Reject');
      reject.addEventListener('click', async () => {
        const reason = window.prompt(`Why is "${game.name}" being rejected?`);
        if (!reason || !reason.trim()) return;
        const rejection = await accountClient.rejectGame(game.id, reason.trim());
        if (rejection.ok) refreshQueue();
      });
      actions.appendChild(approve);
      actions.appendChild(reject);
      card.appendChild(actions);
      queueList.appendChild(card);
    }
  };

  refreshQueue();
  refreshTypes();
}

async function init() {
  const me = await accountClient.getMe();
  if (!me.ok) {
    renderLogin();
    return;
  }
  state.me = me.data;

  const [types, games] = await Promise.all([
    accountClient.getGameTypes(),
    accountClient.getMyGames()
  ]);
  state.gameTypes = types.ok ? types.data : [];
  state.myGames = games.ok ? games.data : [];

  if (window.location.search) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  renderDashboard();
}

init();
