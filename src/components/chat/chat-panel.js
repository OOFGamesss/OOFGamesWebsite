import './chat.css';
import { createChatClient } from './chat-client.js';

const OPEN_KEY = 'oof-chat-open';
const RECONNECT_STEPS = [1000, 2000, 4000, 8000, 15000];

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function storageKey(game, roomKey) {
  return `oof-chat:${game}:${roomKey}`;
}

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {}
}

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'closed';
  } catch {
    return true;
  }
}

function writeOpen(isOpen) {
  try {
    localStorage.setItem(OPEN_KEY, isOpen ? 'open' : 'closed');
  } catch {}
}

export function mountChat({
  httpBase,
  wsBase,
  game,
  roomKey,
  title = 'Chat',
  startOpen = true,
  getAuthToken
} = {}) {
  if (!httpBase || !wsBase || !game || !roomKey) return null;

  const client = createChatClient({ httpBase, wsBase, game, roomKey, getAuthToken });
  const sessionStore = storageKey(game, roomKey);

  const state = {
    palette: [],
    limits: { messageMaxChars: 300, nameMinChars: 2, nameMaxChars: 24 },
    member: readSession(sessionStore),
    colour: (readSession(sessionStore) || {}).colour || 'cyan',
    open: false,
    unread: 0,
    socket: null,
    reconnects: 0,
    reconnectTimer: null,
    closed: false,
    blocked: false,
    reopenAfterBlock: false,
    destroyed: false
  };

  const root = el('section', 'oof-chat oof-chat__hidden');
  root.setAttribute('aria-live', 'polite');

  const handle = el('button', 'oof-chat__handle');
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Toggle chat');
  const handleText = el('span', 'oof-chat__handle-text', title);
  const handleIcon = el('span', '', '\u{1F4AC}');
  const unread = el('span', 'oof-chat__unread', '0');
  handle.append(handleIcon, handleText, unread);

  const panel = el('div', 'oof-chat__panel');
  const header = el('div', 'oof-chat__header');
  const headerLeft = el('div');
  const titleNode = el('div', 'oof-chat__title', title);
  const viewers = el('div', 'oof-chat__viewers', '');
  headerLeft.append(titleNode, viewers);
  const closeButton = el('button', 'oof-chat__close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close chat');
  header.append(headerLeft, closeButton);

  const messages = el('div', 'oof-chat__messages');
  const empty = el('div', 'oof-chat__empty', 'No messages yet. Say hello.');
  messages.append(empty);

  const footer = el('div', 'oof-chat__footer');
  const status = el('div', 'oof-chat__status');

  const joinForm = el('form', 'oof-chat__join');
  const nameLabel = el('label', 'oof-chat__label', 'Pick a name to chat');
  const nameInput = el('input', 'oof-chat__input');
  nameInput.type = 'text';
  nameInput.maxLength = 24;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'Your name';
  nameLabel.htmlFor = 'oof-chat-name';
  nameInput.id = 'oof-chat-name';
  const swatches = el('div', 'oof-chat__swatches');
  const joinButton = el('button', 'oof-chat__button', 'Join chat');
  joinButton.type = 'submit';
  joinForm.append(nameLabel, nameInput, swatches, joinButton);

  const composer = el('form', 'oof-chat__composer oof-chat__hidden');
  const composerRow = el('div', 'oof-chat__composer-row');
  const identity = el('div', 'oof-chat__identity');
  const identityName = el('span', '', '');
  const recolour = el('button', 'oof-chat__recolour', 'Colour');
  recolour.type = 'button';
  identity.append(identityName, recolour);
  const counter = el('div', 'oof-chat__counter', '');
  composerRow.append(identity, counter);
  const textInput = el('textarea', '');
  textInput.rows = 2;
  textInput.maxLength = 300;
  textInput.placeholder = 'Say something';
  const sendRow = el('div', 'oof-chat__composer-row');
  const sendButton = el('button', 'oof-chat__send', 'Send');
  sendButton.type = 'submit';
  const composerSwatches = el('div', 'oof-chat__swatches oof-chat__hidden');
  sendRow.append(el('span'), sendButton);
  composer.append(composerRow, textInput, composerSwatches, sendRow);

  footer.append(status, joinForm, composer);
  panel.append(header, messages, footer);
  root.append(handle, panel);

  function setStatus(message, isError = false) {
    status.textContent = message || '';
    status.classList.toggle('oof-chat__status--error', Boolean(message) && isError);
  }

  function setOpen(isOpen, persist = true) {
    if (isOpen && state.blocked) return;
    state.open = isOpen;
    root.classList.toggle('oof-chat--open', isOpen);
    document.body.classList.toggle('oof-chat-pushed', isOpen);
    handle.setAttribute('aria-expanded', String(isOpen));
    if (persist) writeOpen(isOpen);
    if (isOpen) {
      state.unread = 0;
      root.classList.remove('oof-chat--unread');
      scrollToBottom();
    }
  }

  function setBlocked(blocked) {
    if (blocked === state.blocked) return;
    state.blocked = blocked;
    root.classList.toggle('oof-chat--blocked', blocked);
    if (blocked) {
      state.reopenAfterBlock = state.open;
      if (state.open) setOpen(false, false);
      return;
    }
    if (state.reopenAfterBlock) {
      state.reopenAfterBlock = false;
      setOpen(true, false);
    }
  }

  function bumpUnread() {
    if (state.open) return;
    state.unread += 1;
    unread.textContent = state.unread > 99 ? '99+' : String(state.unread);
    root.classList.add('oof-chat--unread');
  }

  function nearBottom() {
    return messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function renderMessage(message) {
    const row = el('div', 'oof-chat__message');
    const author = el('span', 'oof-chat__author', message.name);
    author.style.color = message.colourHex || '#e2e8f0';
    row.append(author);

    if (message.isHost) {
      row.append(el('span', 'oof-chat__badge', 'Host'));
    } else if (message.tier === 'guest') {
      row.append(el('span', 'oof-chat__tag', 'guest'));
    }

    row.append(document.createTextNode(': '));
    row.append(el('span', 'oof-chat__text', message.text));
    return row;
  }

  function appendMessage(message) {
    const stick = nearBottom();
    if (empty.parentNode) empty.remove();
    messages.append(renderMessage(message));
    while (messages.childElementCount > 150) messages.firstElementChild.remove();
    if (stick) scrollToBottom();
  }

  function appendNotice(text) {
    if (empty.parentNode) empty.remove();
    messages.append(el('div', 'oof-chat__notice', text));
    scrollToBottom();
  }

  function clearMessages() {
    messages.replaceChildren(empty);
  }

  function renderSwatches(container, onPick) {
    container.replaceChildren();
    for (const entry of state.palette) {
      const swatch = el('button', 'oof-chat__swatch');
      swatch.type = 'button';
      swatch.style.background = entry.hex;
      swatch.title = entry.key;
      swatch.setAttribute('aria-label', `Name colour ${entry.key}`);
      swatch.setAttribute('aria-pressed', String(entry.key === state.colour));
      swatch.addEventListener('click', () => {
        state.colour = entry.key;
        for (const node of container.children) {
          node.setAttribute('aria-pressed', String(node.title === entry.key));
        }
        if (onPick) onPick(entry.key);
      });
      container.append(swatch);
    }
  }

  function showComposer() {
    joinForm.classList.add('oof-chat__hidden');
    composer.classList.remove('oof-chat__hidden');
    identityName.textContent = state.member.name;
    identityName.style.color = state.member.colourHex || '#e2e8f0';
    recolour.classList.toggle('oof-chat__hidden', Boolean(state.member.isHost));
    updateCounter();
  }

  function showJoinForm() {
    composer.classList.add('oof-chat__hidden');
    joinForm.classList.remove('oof-chat__hidden');
    nameInput.focus();
  }

  function updateCounter() {
    const max = state.limits.messageMaxChars;
    counter.textContent = `${textInput.value.length}/${max}`;
  }

  async function attemptJoin(displayName) {
    const result = await client.join(displayName || null, state.colour);
    if (result.ok) {
      state.member = result.data;
      state.colour = result.data.colour;
      writeSession(sessionStore, result.data);
      setStatus('');
      showComposer();
      return true;
    }
    if (result.status === 400 && !displayName) {
      showJoinForm();
      setStatus('');
      return false;
    }
    setStatus(result.error, true);
    showJoinForm();
    return false;
  }

  async function refreshIdentity() {
    const result = await client.join(null, state.colour);
    if (!result.ok) return false;
    state.member = result.data;
    state.colour = result.data.colour;
    writeSession(sessionStore, result.data);
    setStatus('');
    showComposer();
    return true;
  }

  async function resetIdentity() {
    state.member = null;
    writeSession(sessionStore, null);
    const joined = await attemptJoin(null);
    if (!joined) showJoinForm();
  }

  async function send(text) {
    const result = await client.send(state.member.token, text);
    if (result.ok) return true;
    if (result.status === 401) {
      const name = state.member && state.member.tier === 'guest' ? state.member.name : null;
      state.member = null;
      writeSession(sessionStore, null);
      const rejoined = await attemptJoin(name);
      if (!rejoined) return false;
      const retry = await client.send(state.member.token, text);
      if (retry.ok) return true;
      setStatus(retry.error, true);
      return false;
    }
    setStatus(result.error, true);
    return false;
  }

  function handleFrame(frame) {
    if (!frame || !frame.type) return;
    if (frame.type === 'chat_backlog') {
      clearMessages();
      const list = (frame.data && frame.data.messages) || [];
      for (const message of list) appendMessage(message);
      updateViewers(frame.data && frame.data.viewers);
      return;
    }
    if (frame.type === 'chat_message') {
      appendMessage(frame.data);
      bumpUnread();
      return;
    }
    if (frame.type === 'chat_presence') {
      updateViewers(frame.data && frame.data.viewers);
      return;
    }
    if (frame.type === 'chat_cleared') {
      clearMessages();
      const notice = frame.data && frame.data.notice;
      if (notice) appendNotice(notice);
      return;
    }
    if (frame.type === 'chat_closed') {
      state.closed = true;
      appendNotice('This session has ended. Chat is closed.');
      composer.classList.add('oof-chat__hidden');
      joinForm.classList.add('oof-chat__hidden');
    }
  }

  function updateViewers(count) {
    if (typeof count !== 'number') return;
    viewers.textContent = count === 1 ? '1 watching' : `${count} watching`;
  }

  function connect() {
    if (state.destroyed || state.closed) return;
    let socket;
    try {
      socket = new WebSocket(client.socketUrl());
    } catch {
      scheduleReconnect();
      return;
    }
    state.socket = socket;

    socket.addEventListener('open', () => {
      state.reconnects = 0;
    });
    socket.addEventListener('message', (event) => {
      try {
        handleFrame(JSON.parse(event.data));
      } catch {}
    });
    socket.addEventListener('close', () => {
      state.socket = null;
      if (!state.closed) scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try {
        socket.close();
      } catch {}
    });
  }

  function scheduleReconnect() {
    if (state.destroyed || state.closed) return;
    const delay = RECONNECT_STEPS[Math.min(state.reconnects, RECONNECT_STEPS.length - 1)];
    state.reconnects += 1;
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(connect, delay);
  }

  handle.addEventListener('click', () => setOpen(!state.open));
  closeButton.addEventListener('click', () => setOpen(false));

  joinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      setStatus('Enter a name first.', true);
      return;
    }
    joinButton.disabled = true;
    setStatus('Joining…');
    await attemptJoin(name);
    joinButton.disabled = false;
  });

  composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = textInput.value.trim();
    if (!text || !state.member) return;
    sendButton.disabled = true;
    const sent = await send(text);
    sendButton.disabled = false;
    if (sent) {
      textInput.value = '';
      updateCounter();
      setStatus('');
    }
    textInput.focus();
  });

  textInput.addEventListener('input', updateCounter);
  textInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  recolour.addEventListener('click', () => {
    composerSwatches.classList.toggle('oof-chat__hidden');
  });

  async function start() {
    const info = await client.info();
    if (!info.ok) return;

    state.palette = info.data.palette || [];
    state.limits = info.data.limits || state.limits;
    titleNode.textContent = info.data.label || title;
    nameInput.maxLength = state.limits.nameMaxChars;
    textInput.maxLength = state.limits.messageMaxChars;
    updateViewers(info.data.viewers);

    renderSwatches(swatches, null);
    renderSwatches(composerSwatches, async (colour) => {
      if (!state.member) return;
      const result = await client.setColour(state.member.token, colour);
      if (!result.ok) {
        setStatus(result.error, true);
        return;
      }
      state.member = { ...state.member, ...result.data };
      writeSession(sessionStore, state.member);
      identityName.style.color = result.data.colourHex;
      setStatus('');
    });

    root.classList.remove('oof-chat__hidden');
    document.body.append(root);
    setOpen(startOpen && readOpen() && window.innerWidth >= 768);

    if (state.member && state.member.token) {
      showComposer();
    } else {
      const joined = await attemptJoin(null);
      if (!joined) showJoinForm();
    }

    connect();
  }

  start();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    refreshIdentity,
    resetIdentity,
    setBlocked,
    destroy() {
      state.destroyed = true;
      clearTimeout(state.reconnectTimer);
      if (state.socket) {
        try {
          state.socket.close();
        } catch {}
      }
      document.body.classList.remove('oof-chat-pushed');
      root.remove();
    }
  };
}
