export const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

// Title-only protection left “来源” and “密度” split in body copy and diagram nodes.
// These spans preserve the exact text projection while allowing breaks between short Chinese words.
export function typesetText(value, className = 'copy-word') {
  const grouped = [];
  let opening = '';
  for (const { segment } of segmenter.segment(String(value ?? ''))) {
    if (/^[（【《「『“‘]+$/u.test(segment)) opening += segment;
    else if (/^[，。！？；：、）】》」』”’…,.!?;:)]+$/u.test(segment) && grouped.length) grouped[grouped.length - 1] += segment;
    else { grouped.push(opening + segment); opening = ''; }
  }
  if (opening) grouped.push(opening);
  return grouped.map((part) => /^[\p{Script=Han}\p{P}]{1,8}$/u.test(part)
    ? `<span class="${className}" data-storyweave-word>${escapeHtml(part)}</span>` : escapeHtml(part)).join('');
}
