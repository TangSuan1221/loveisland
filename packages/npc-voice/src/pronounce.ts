export function resolveVocab(id, table) {
  const word = table.get(id);
  if (!word?.name_zh || !word.voice_zh?.trim()) throw Error('Missing pronunciation: ' + id);
  return {name: word.name_zh, voice: word.voice_zh};
}
