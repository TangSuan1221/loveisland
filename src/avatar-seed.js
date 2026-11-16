import { normalizeAppearance } from './avatar-schema.js';

const prefix = 'HD1.';
const defaults = normalizeAppearance({});

export function encodeFaceSeed(appearance) {
  const fields = Object.fromEntries(Object.entries(normalizeAppearance(appearance))
    .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key])));
  const bytes = new TextEncoder().encode(JSON.stringify(fields));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return prefix + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeFaceSeed(text) {
  const seed = text.trim();
  if (!seed.startsWith(prefix)) throw new Error('请输入 HD1. 开头的捏脸码。');
  try {
    const binary = atob(seed.slice(prefix.length).replaceAll('-', '+').replaceAll('_', '/'));
    const fields = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) ||
        Object.keys(fields).some(key => !Object.hasOwn(defaults, key))) throw new Error();
    const appearance = normalizeAppearance(fields);
    if (encodeFaceSeed(appearance) !== seed) throw new Error();
    return appearance;
  } catch {
    throw new Error('捏脸码无效，请重新复制完整内容。');
  }
}
