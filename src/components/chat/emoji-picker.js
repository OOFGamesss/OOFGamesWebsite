import { EMOJI_CATEGORIES, emojiByCode, searchEmoji } from './emoji-data.js';

const RECENT_KEY = 'oof-chat-emoji-recent';
const RECENT_MAX = 16;
const SHORTCODE_RE = /(?:^|[\s(])(:([a-z0-9_+-]{2,}))$/i;
const SHORTCODE_LIMIT = 8;

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((code) => typeof code === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(codes) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(codes.slice(0, RECENT_MAX)));
  } catch {}
}

function rememberRecent(code) {
  const next = [code, ...readRecent().filter((entry) => entry !== code)];
  writeRecent(next);
}

export function insertIntoField(field, text) {
  const max = field.maxLength > 0 ? field.maxLength : Infinity;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  if (next.length > max) return false;
  field.value = next;
  const caret = start + text.length;
  field.setSelectionRange(caret, caret);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export function createEmojiPicker({ onPick } = {}) {
  const button = el('button', 'oof-chat__emoji-toggle', '\u{1F642}');
  button.type = 'button';
  button.setAttribute('aria-label', 'Insert emoji');
  button.setAttribute('aria-expanded', 'false');

  const popup = el('div', 'oof-chat__emoji-popup oof-chat__hidden');
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Emoji picker');

  const tabs = el('div', 'oof-chat__emoji-tabs');
  const search = el('input', 'oof-chat__emoji-search');
  search.type = 'search';
  search.placeholder = 'Search emoji';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search emoji');

  const body = el('div', 'oof-chat__emoji-body');
  const sections = el('div', 'oof-chat__emoji-sections');
  const results = el('div', 'oof-chat__emoji-sections oof-chat__hidden');
  const emptyResults = el('div', 'oof-chat__emoji-empty', 'No emoji found.');
  body.append(sections, results);
  popup.append(tabs, search, body);

  const state = { open: false, built: false, tabButtons: new Map(), sectionNodes: new Map() };

  function choose(entry) {
    rememberRecent(entry.code);
    if (onPick) onPick(entry.char);
  }

  function makeEmojiButton(entry) {
    const node = el('button', 'oof-chat__emoji', entry.char);
    node.type = 'button';
    node.title = `:${entry.code}:`;
    node.setAttribute('aria-label', entry.code.replace(/_/g, ' '));
    node.addEventListener('click', () => choose(entry));
    return node;
  }

  function buildSection(group) {
    const section = el('section', 'oof-chat__emoji-section');
    section.dataset.category = group.key;
    section.append(el('h4', 'oof-chat__emoji-heading', group.label));
    const grid = el('div', 'oof-chat__emoji-grid');
    section.append(grid);
    for (const [char, code, keywords] of group.emoji) {
      grid.append(
        makeEmojiButton({ char, code, terms: `${code} ${keywords}`.replace(/_/g, ' ') })
      );
    }
    return { section, grid };
  }

  function renderRecent() {
    const node = state.sectionNodes.get('recent');
    if (!node) return;
    const codes = readRecent();
    node.grid.replaceChildren();
    for (const code of codes) {
      const entry = emojiByCode(code);
      if (entry) node.grid.append(makeEmojiButton(entry));
    }
    node.section.classList.toggle('oof-chat__hidden', node.grid.childElementCount === 0);
    const tab = state.tabButtons.get('recent');
    if (tab) tab.classList.toggle('oof-chat__hidden', node.grid.childElementCount === 0);
  }

  function setActiveTab(key) {
    for (const [tabKey, tab] of state.tabButtons) {
      tab.setAttribute('aria-pressed', String(tabKey === key));
    }
  }

  function build() {
    if (state.built) return;
    state.built = true;
    for (const group of EMOJI_CATEGORIES) {
      const tab = el('button', 'oof-chat__emoji-tab', group.icon);
      tab.type = 'button';
      tab.title = group.label;
      tab.setAttribute('aria-label', group.label);
      tab.setAttribute('aria-pressed', 'false');
      tab.addEventListener('click', () => {
        search.value = '';
        showSections();
        const node = state.sectionNodes.get(group.key);
        if (node) body.scrollTop = node.section.offsetTop - sections.offsetTop;
        setActiveTab(group.key);
      });
      tabs.append(tab);
      state.tabButtons.set(group.key, tab);

      const node = buildSection(group);
      state.sectionNodes.set(group.key, node);
      sections.append(node.section);
    }
    body.addEventListener('scroll', () => {
      if (!results.classList.contains('oof-chat__hidden')) return;
      let current = null;
      for (const [key, node] of state.sectionNodes) {
        if (node.section.classList.contains('oof-chat__hidden')) continue;
        if (node.section.offsetTop - sections.offsetTop <= body.scrollTop + 12) current = key;
      }
      if (current) setActiveTab(current);
    });
  }

  function showSections() {
    results.classList.add('oof-chat__hidden');
    sections.classList.remove('oof-chat__hidden');
  }

  function runSearch(query) {
    if (!query.trim()) {
      showSections();
      return;
    }
    const hits = searchEmoji(query);
    const grid = el('div', 'oof-chat__emoji-grid');
    for (const entry of hits) grid.append(makeEmojiButton(entry));
    results.replaceChildren(
      el('h4', 'oof-chat__emoji-heading', hits.length ? 'Results' : 'Search'),
      hits.length ? grid : emptyResults
    );
    sections.classList.add('oof-chat__hidden');
    results.classList.remove('oof-chat__hidden');
    setActiveTab(null);
    body.scrollTop = 0;
  }

  function open() {
    build();
    renderRecent();
    search.value = '';
    showSections();
    popup.classList.remove('oof-chat__hidden');
    button.setAttribute('aria-expanded', 'true');
    state.open = true;
    body.scrollTop = 0;
    setActiveTab(readRecent().length ? 'recent' : 'smileys');
    if (window.matchMedia('(min-width: 768px)').matches) search.focus();
  }

  function close() {
    if (!state.open) return;
    popup.classList.add('oof-chat__hidden');
    button.setAttribute('aria-expanded', 'false');
    state.open = false;
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggle();
  });
  popup.addEventListener('click', (event) => event.stopPropagation());
  search.addEventListener('input', () => runSearch(search.value));
  popup.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      button.focus();
    }
  });

  return { button, popup, open, close, toggle, isOpen: () => state.open, refreshRecent: renderRecent };
}

export function createShortcodeMenu({ field, onPick } = {}) {
  const menu = el('div', 'oof-chat__shortcodes oof-chat__hidden');
  menu.setAttribute('role', 'listbox');
  const state = { matches: [], index: 0, query: '', open: false };

  function close() {
    if (!state.open) return;
    state.open = false;
    state.matches = [];
    menu.classList.add('oof-chat__hidden');
    menu.replaceChildren();
  }

  function highlight() {
    for (const [index, node] of [...menu.children].entries()) {
      node.setAttribute('aria-selected', String(index === state.index));
      if (index === state.index) node.scrollIntoView({ block: 'nearest' });
    }
  }

  function accept(index) {
    const entry = state.matches[index];
    if (!entry) return;
    const caret = field.selectionStart ?? field.value.length;
    const before = field.value.slice(0, caret);
    const match = SHORTCODE_RE.exec(before);
    if (!match) {
      close();
      return;
    }
    const start = caret - match[1].length;
    const max = field.maxLength > 0 ? field.maxLength : Infinity;
    const next = field.value.slice(0, start) + entry.char + field.value.slice(caret);
    close();
    if (next.length > max) return;
    field.value = next;
    const position = start + entry.char.length;
    field.setSelectionRange(position, position);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    rememberRecent(entry.code);
    if (onPick) onPick(entry.char);
  }

  function render() {
    menu.replaceChildren();
    for (const [index, entry] of state.matches.entries()) {
      const row = el('button', 'oof-chat__shortcode');
      row.type = 'button';
      row.setAttribute('role', 'option');
      row.append(el('span', 'oof-chat__shortcode-emoji', entry.char));
      row.append(el('span', 'oof-chat__shortcode-name', `:${entry.code}:`));
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        accept(index);
      });
      menu.append(row);
    }
    menu.classList.remove('oof-chat__hidden');
    state.open = true;
    highlight();
  }

  function refresh() {
    const caret = field.selectionStart ?? field.value.length;
    const match = SHORTCODE_RE.exec(field.value.slice(0, caret));
    if (!match) {
      close();
      return;
    }
    const query = match[2].toLowerCase();
    const matches = searchEmoji(query, SHORTCODE_LIMIT);
    if (!matches.length) {
      close();
      return;
    }
    state.query = query;
    state.matches = matches;
    state.index = 0;
    render();
  }

  function handleKeydown(event) {
    if (!state.open) return false;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.index = (state.index + 1) % state.matches.length;
      highlight();
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.index = (state.index - 1 + state.matches.length) % state.matches.length;
      highlight();
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      accept(state.index);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return true;
    }
    return false;
  }

  return { element: menu, refresh, close, handleKeydown, isOpen: () => state.open };
}
