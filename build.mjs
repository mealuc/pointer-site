/**
 * Generates `privacy.html` and `terms.html`.
 *
 * The two pages have **different sources**, on purpose:
 *
 * - `terms.html` comes from `rn-app/src/content/legal.ts`, so the site and the in-app
 *   modal show the same Terms.
 * - `privacy.html` comes from `content/privacy-{en,tr}.txt`, which is the full policy
 *   the store listings link to. The in-app privacy text stays a short plain-language
 *   summary; a linked policy has to carry retention periods, transfer, rights and an
 *   age limit, and a consent footer should not be 1,500 words. Only one of them is
 *   canonical, and it is this one.
 *
 * The point is to stop the public site from becoming a fourth hand-maintained copy of
 * the legal text. Edit the documents in the Swift constants and in `legal.ts`, run this,
 * and the website follows. It reads the TypeScript as text rather than importing it,
 * so no build step or dependency is involved:
 *
 *   node web/build.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'rn-app', 'src', 'content', 'legal.ts'), 'utf8');

function literal(name) {
  const match = source.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
  if (!match) throw new Error(`legal.ts has no ${name}`);
  return match[1].replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\\\\/g, '\\');
}

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Inline marks shared by both renderers: `**bold**` and bare https URLs.
 * Applied after escaping, so the escape still sees the raw text.
 */
function inline(text) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');
}

/**
 * The in-app documents are plain text with a shape: an "updated" line, numbered
 * ALL-CAPS headings, "- " bullets, and paragraphs. This turns that shape into
 * semantic markup rather than dumping the whole thing into a <pre>.
 */
function toHtml(text) {
  const lines = text.split('\n');
  const out = [];
  let bullets = [];

  const flush = () => {
    if (!bullets.length) return;
    out.push('<ul>' + bullets.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>');
    bullets = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return flush();

    if (index === 0) {
      out.push(`<p class="updated">${inline(line)}</p>`);
      return;
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
      return;
    }

    flush();

    // "## Heading" and "### Heading" come from the long-form documents in
    // `web/content`; "3. THIRD-PARTY SERVICES" is how the shorter in-app ones mark a
    // section. A line that merely starts with a digit is not one.
    if (line.startsWith('### ')) {
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      return;
    }
    if (line.startsWith('## ')) {
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      return;
    }
    if (/^\d+\.\s+\S/.test(line) && line === line.toLocaleUpperCase('tr-TR')) {
      out.push(`<h2>${inline(line)}</h2>`);
      return;
    }

    out.push(`<p>${inline(line)}</p>`);
  });

  flush();
  return out.join('\n    ');
}

/** The long-form policy, which is authored here rather than shipped in the app. */
const content = (name) => readFileSync(join(here, 'content', name), 'utf8').trim();

const PAGES = [
  {
    file: 'privacy.html',
    slug: 'privacy',
    en: { title: 'Privacy Policy', body: content('privacy-en.txt') },
    tr: { title: 'Gizlilik Politikası', body: content('privacy-tr.txt') },
    description: 'How Pointer collects, uses and protects your information.',
  },
  {
    file: 'terms.html',
    slug: 'terms',
    en: { title: 'Terms of Service', body: literal('TERMS_EN') },
    tr: { title: 'Kullanım Koşulları', body: literal('TERMS_TR') },
    description: 'The rules for using Pointer.',
  },
];

const page = ({ slug, en, tr, description }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${en.title} — Pointer</title>
<meta name="description" content="${description}">
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<div class="shell">

  <div class="top">
    <a class="wordmark" href="./">Point<span>er</span></a>
    <nav>
      <a href="privacy.html"${slug === 'privacy' ? ' aria-current="page"' : ''} data-t="nav-privacy">Privacy Policy</a>
      <a href="terms.html"${slug === 'terms' ? ' aria-current="page"' : ''} data-t="nav-terms">Terms of Service</a>
      <a href="delete-account.html" data-t="nav-delete">Delete account</a>
      <button class="lang" id="lang" type="button">Türkçe</button>
    </nav>
  </div>

  <h1 data-t="h1">${en.title}</h1>

  <div data-t="doc">
    ${toHtml(en.body)}
  </div>

  <footer>
    <span>Pointer</span>
    <a href="privacy.html" data-t="nav-privacy">Privacy Policy</a>
    <a href="terms.html" data-t="nav-terms">Terms of Service</a>
    <a href="delete-account.html" data-t="nav-delete">Delete account</a>
  </footer>

</div>
<script src="assets/i18n.js"></script>
<script>
  applyLang({
    en: {},
    tr: {
      "nav-privacy": "Gizlilik Politikası",
      "nav-terms": "Kullanım Koşulları",
      "nav-delete": "Hesap silme",
      "h1": ${JSON.stringify(tr.title)},
      "doc": ${JSON.stringify('\n    ' + toHtml(tr.body) + '\n  ')}
    }
  });
</script>
</body>
</html>
`;

for (const spec of PAGES) {
  writeFileSync(join(here, spec.file), page(spec));
  console.log(`${spec.file} yazıldı`);
}
