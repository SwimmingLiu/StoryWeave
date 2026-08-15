const WIDTH = 1280;
const HEIGHT = 720;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function tokens(theme = {}) {
  return theme.tokens ?? {
    background: '#F3F4EF', surface: '#FFFFFF', text: '#172019', muted: '#59645C',
    accent: '#146C5A', support: '#C58C2B', line: '#D3D9D1', radius: '6px',
    heading: "Inter, 'Noto Sans SC', system-ui, sans-serif",
    body: "Inter, 'Noto Sans SC', system-ui, sans-serif",
  };
}

function copy(source) {
  const lines = source.exact_text?.length ? source.exact_text : [source.claim ?? ''];
  const title = `<h1>${escapeHtml(lines[0])}</h1>`;
  if (source.role === 'process') return `${title}<ol>${lines.slice(1).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>`;
  if (source.role === 'comparison') return `${title}<div class="columns">${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
  if (source.role === 'data' && source.metrics?.length) return `${title}<div class="metrics">${source.metrics.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join('')}</div>`;
  return `${title}${lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('')}`;
}

function slideMarkup(source, index, total, { active = false } = {}) {
  const role = source.role ?? 'statement';
  return `<section class="slide role-${escapeHtml(role)}${active ? ' active' : ''}" data-storyweave-slide data-slide-id="${escapeHtml(source.id)}" data-slide-index="${index}"><div class="art" aria-hidden="true"><i></i><i></i><i></i></div><div class="copy">${copy(source)}</div><span class="counter">${index + 1} / ${total}</span></section>`;
}

function css(theme) {
  const t = tokens(theme);
  return `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${t.background};color:${t.text};font-family:${t.body}}body{display:grid;place-items:center}.deck{width:100%;height:100%;display:grid;place-items:center}.slide{display:none;position:relative;width:min(100vw,177.7778vh);aspect-ratio:16/9;overflow:hidden;background:${t.background};border:1px solid ${t.line}}.slide.active,.single .slide{display:block}.copy{position:absolute;z-index:2;left:7.5%;top:12%;width:54%;height:76%;display:flex;flex-direction:column;justify-content:center}.copy h1{margin:0 0 28px;font-family:${t.heading};font-size:clamp(34px,4.4vw,64px);line-height:1.04;letter-spacing:-.025em}.copy p,.copy li{font-size:clamp(18px,2vw,30px);line-height:1.38;color:${t.muted}}.copy ol{display:grid;gap:12px;margin:0;padding-left:1.3em}.columns,.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.columns p,.metrics>div{margin:0;padding:20px;border:1px solid ${t.line};background:${t.surface};border-radius:${t.radius}}.metrics strong,.metrics span{display:block}.metrics strong{font-size:44px;color:${t.accent}}.art{position:absolute;right:5%;top:12%;width:35%;height:76%;border:1px solid ${t.line};background:${t.surface};overflow:hidden;border-radius:${t.radius}}.art:before,.art:after,.art i{content:"";position:absolute;border-radius:50%}.art:before{width:68%;aspect-ratio:1;right:-10%;top:8%;border:18px solid ${t.accent};opacity:.8}.art:after{width:54%;aspect-ratio:1;left:-16%;bottom:-8%;background:${t.support};opacity:.72}.art i:nth-child(1){width:72%;height:3px;left:10%;top:52%;background:${t.text};transform:rotate(-17deg)}.art i:nth-child(2){width:20px;height:20px;left:25%;top:24%;background:${t.accent}}.art i:nth-child(3){width:36px;height:36px;right:18%;bottom:17%;border:8px solid ${t.text}}.role-cover,.role-closing{background:${t.text};color:${t.surface}}.role-cover .copy,.role-closing .copy{width:64%}.role-cover .copy p,.role-closing .copy p{color:${t.surface};opacity:.78}.role-cover .art,.role-closing .art{background:transparent;border-color:${t.accent}}.counter{position:absolute;z-index:3;right:18px;bottom:14px;padding:5px 8px;background:${t.text};color:${t.surface};font:12px system-ui}.nav{position:fixed;z-index:9;top:50%;width:42px;height:42px;border:0;border-radius:50%;background:${t.text};color:${t.surface};font-size:24px;cursor:pointer}.nav.prev{left:12px}.nav.next{right:12px}@media print{body{display:block;overflow:visible}.deck{display:block}.slide{display:block;width:100vw;height:56.25vw;page-break-after:always}.nav,.counter{display:none}}`;
}

function runtime() {
  return `(()=>{const slides=[...document.querySelectorAll('[data-storyweave-slide]')];let current=0;function show(next){slides[current]?.classList.remove('active');current=(next+slides.length)%slides.length;slides[current]?.classList.add('active')}document.querySelector('.prev').onclick=()=>show(current-1);document.querySelector('.next').onclick=()=>show(current+1);addEventListener('keydown',event=>{if(['ArrowRight','PageDown',' '].includes(event.key))show(current+1);if(['ArrowLeft','PageUp'].includes(event.key))show(current-1)})})();`;
}

function shell(title, language, theme, body, script = '') {
  return `<!doctype html><html lang="${escapeHtml(language ?? 'zh-CN')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="storyweave-producer" content="storyweave-html"><meta name="storyweave-canvas" content="${WIDTH}x${HEIGHT}"><title>${escapeHtml(title)}</title><style>${css(theme)}</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`;
}

export function renderHtmlDeck(deck, theme) {
  const slides = deck.slides.map((slide, index) => slideMarkup(slide, index, deck.slides.length, { active: index === 0 })).join('');
  return shell(deck.title, deck.language, theme, `<main class="deck">${slides}</main><button class="nav prev" aria-label="上一页">‹</button><button class="nav next" aria-label="下一页">›</button>`, runtime());
}

export function renderHtmlSlide(deck, source, index, theme) {
  return shell(`${deck.title} · ${index + 1}`, deck.language, theme, `<main class="deck single">${slideMarkup(source, index, deck.slides.length, { active: true })}</main>`);
}

export function createHtmlManifest(deck) {
  return {
    format: 'storyweave/slides', version: 1, producer: 'storyweave-html', kind: 'html',
    title: deck.title, canvas: { width: WIDTH, height: HEIGHT }, entry: 'index.html',
    slides: deck.slides.map((slide) => ({ id: slide.id, role: slide.role, source: `slides/${slide.id}.html`, claim: slide.claim, notes: slide.speaker_notes ?? slide.claim })),
  };
}

export function validateHtmlManifest(manifest) {
  const findings = [];
  if (manifest?.format !== 'storyweave/slides' || manifest?.version !== 1) findings.push({ severity: 'blocking', code: 'manifest.format', message: 'Expected storyweave/slides version 1.' });
  if (manifest?.producer !== 'storyweave-html' || manifest?.kind !== 'html') findings.push({ severity: 'blocking', code: 'manifest.producer', message: 'Expected an HTML producer manifest.' });
  if (!Array.isArray(manifest?.slides) || !manifest.slides.length) findings.push({ severity: 'blocking', code: 'manifest.slides', message: 'At least one slide is required.' });
  return { valid: findings.length === 0, findings };
}
