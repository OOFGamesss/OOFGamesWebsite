const ART_BASE = '/halloween/art';

export function artUrl(name) {
  return `${ART_BASE}/${name}.webp`;
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function artImage(name, className, piece) {
  const img = element('img', className);
  const owner = piece || img;
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('load', () => owner.classList.add('is-shown'), { once: true });
  img.addEventListener('error', () => owner.remove(), { once: true });
  img.src = artUrl(name);
  return img;
}

export function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}
