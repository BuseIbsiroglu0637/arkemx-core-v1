import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

// Source-level CSS contracts; these do not claim browser visual verification.
function stylesheet(name) {
  return postcss.parse(fs.readFileSync(new URL(`../app/${name}`, import.meta.url), 'utf8'));
}
const corporate = stylesheet('corporate-system.css');
const navigation = stylesheet('corporate-navigation.css');

test('footer directory stays visible and compact social icons retain touch targets', () => {
  const closed = declarations(corporate, 'body.arkem-corporate-site .corporate-footer-directory:not([open]) > .corporate-footer-directory-content');
  assert.equal(closed.display, undefined);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .corporate-footer-directory-content'), 'display', 'grid');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .corporate-footer-group h3'), 'font-size', '1rem');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .corporate-footer-group a'), 'font-size', '.875rem');
  const social = declarations(corporate, 'body.arkem-corporate-site .corporate-footer-social a');
  expectDeclaration(social, 'min-height', '44px');
  expectDeclaration(social, 'min-width', '44px');
  expectDeclaration(social, 'font-size', '.875rem');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .corporate-footer-social .corporate-social-icon'), 'width', '22px');
});

test('homepage carousel owns its horizontal overflow and home choice motion respects reduction', () => {
  const track = declarations(corporate, 'body.arkem-corporate-site .home-project-track');
  expectDeclaration(track, 'overflow-x', 'auto');
  expectDeclaration(track, 'scroll-snap-type', 'x mandatory');
  const focus = declarations(corporate, 'body.arkem-corporate-site #main-content :is(.home-project-track,.home-project-slide):focus-visible');
  expectDeclaration(focus, 'outline-offset', '-2px', true);
  expectDeclaration(focus, 'box-shadow', 'none', true);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .home-project-controls button'), 'min-height', '44px');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .v4-home .v4-hero'), 'background', 'var(--brand-deep)');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .v4-home .v4-hero-copy h1'), 'color', 'white');
  const reduced = declarations(corporate, 'body.arkem-corporate-site .v4-home .v4-capability-band a');
  expectDeclaration(reduced, 'transform', 'none', true);
  expectDeclaration(reduced, 'transition', 'none');
});

function declarations(root, selector) {
  const result = {};
  root.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls(declaration => { result[declaration.prop] = declaration; });
  });
  return result;
}
function expectDeclaration(values, name, value, important = false) {
  assert.equal(values[name]?.value, value, name);
  if (important) assert.equal(values[name]?.important, true, `${name} must override legacy important rules`);
}

test('capability titles and notes use natural vertical flow after decorative indices are hidden', () => {
  const values = declarations(corporate, 'body.arkem-corporate-site .v4-capability-band a');
  expectDeclaration(values, 'display', 'flex');
  expectDeclaration(values, 'flex-direction', 'column');
  expectDeclaration(values, 'height', 'auto');
  expectDeclaration(values, 'min-width', '0');
  expectDeclaration(values, 'gap', '10px');
  const text = declarations(corporate, 'body.arkem-corporate-site .v4-capability-band :is(strong,small)');
  expectDeclaration(text, 'white-space', 'normal');
  expectDeclaration(text, 'max-width', '100%');
  expectDeclaration(text, 'overflow-wrap', 'break-word');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .v4-capability-band small'), 'font-size', '.875rem', true);
});

test('desktop header supplies a real white surface and restores its full-width pseudo-element', () => {
  const header = declarations(navigation, 'body.arkem-corporate-site .v4-site-header');
  expectDeclaration(header, 'background', 'white', true);
  expectDeclaration(header, 'isolation', 'isolate');
  for (const selector of ['body.arkem-corporate-site .v4-site-header::before', 'body.arkem-corporate-site .v4-site-header.is-dark::before']) {
    const surface = declarations(navigation, selector);
    expectDeclaration(surface, 'content', '""', true);
    expectDeclaration(surface, 'display', 'block', true);
    expectDeclaration(surface, 'background', 'white', true);
    expectDeclaration(surface, 'border-bottom', '1px solid var(--brand-line)', true);
  }
});

test('hover and keyboard focus retain explicit readable card color pairs', () => {
  const capability = declarations(corporate, 'body.arkem-corporate-site .v4-capability-band a:is(:hover,:focus-visible)');
  expectDeclaration(capability, 'background', 'var(--brand-navy)');
  expectDeclaration(capability, 'color', 'white');
  const note = declarations(corporate, 'body.arkem-corporate-site .v4-capability-band a:is(:hover,:focus-visible) small');
  expectDeclaration(note, 'color', 'var(--brand-on-dark)');
  const map = declarations(corporate, 'body.arkem-corporate-site .v4-group-map > a:is(:hover,:focus-visible) :is(span,b,small)');
  expectDeclaration(map, 'color', 'white');
});

test('dark digital hero and closing section use the light accent text token', () => {
  const values = declarations(corporate, 'body.arkem-corporate-site :is(.v117-digital-hero,.v117-digital-final,.v4-x-hero) .v4-index');
  expectDeclaration(values, 'color', 'var(--brand-copper-light)');
});

test('menu and direction descriptions are smaller and separated from titles', () => {
  for (const prefix of ['.v4-mega-columns a', '.v4-mobile-nav-content > div a']) {
    const selector = `body.arkem-corporate-site ${prefix}`;
    const title = declarations(navigation, `${selector} b`);
    const note = declarations(navigation, `${selector} span`);
    expectDeclaration(title, 'font-size', '1.125rem');
    expectDeclaration(note, 'font-size', '.875rem');
    expectDeclaration(note, 'font-weight', '400');
    expectDeclaration(declarations(navigation, selector), 'flex-direction', 'column');
  }
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .v4-capability-band a strong'), 'font-size', '1.125rem');
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .geo-workflow > button:last-child'), 'grid-column', 'auto', true);
});

test('archive photo windows cannot inherit image zoom or width constraints', () => {
  const image = declarations(corporate, 'body.arkem-corporate-site .project-photo .project-photo-plane > img');
  expectDeclaration(image, 'max-width', 'none', true);
  expectDeclaration(image, 'width', 'var(--photo-width)', true);
  expectDeclaration(image, 'height', 'var(--photo-height)', true);
  expectDeclaration(image, 'transform', 'none', true);
  expectDeclaration(image, 'filter', 'none', true);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .project-photo-plane'), 'width', 'max(100cqw,100cqh)');
});

test('shared header is isolated from hero padding and project guide cells have a readable size', () => {
  expectDeclaration(declarations(navigation, 'body.arkem-corporate-site .v4-site-header'), 'padding', '0', true);
  const intro = declarations(corporate, 'body.arkem-corporate-site .project-start-page .project-start-hero > .project-start-hero-content.shell:not(.v4-site-header)');
  expectDeclaration(intro, 'padding-top', '36px', true);
  expectDeclaration(intro, 'padding-bottom', '40px', true);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .project-start-page .project-start-hero-flow'), 'width', '100%', true);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .project-start-page .project-start-hero-flow i'), 'font-size', '1.5rem', true);
  const cells = declarations(corporate, 'body.arkem-corporate-site .project-start-page .project-start-hero-flow > li');
  assert.ok(parseInt(cells['min-height'].value, 10) >= 88);
  expectDeclaration(declarations(corporate, 'body.arkem-corporate-site .project-start-page .project-start-hero-flow b'), 'font-size', '1rem', true);
});

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(foreground, background) {
  const light = luminance(foreground), dark = luminance(background);
  return (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05);
}
test('shared corrected text/background token pairs meet normal-text contrast', () => {
  const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const files = [...layout.matchAll(/import "\.\/(.*\.css)"/g)].map(match => match[1]);
  const tokens = {};
  for (const file of files) {
    stylesheet(file).walkDecls(/^--brand-/, declaration => { tokens[declaration.prop] = declaration.value; });
  }
  for (const [foreground, background] of [
    [tokens['--brand-ink'], '#ffffff'],
    [tokens['--brand-muted'], '#ffffff'],
    [tokens['--brand-on-dark'], tokens['--brand-navy']],
    [tokens['--brand-copper-light'], tokens['--brand-deep']],
    ['#ffffff', tokens['--brand-copper']],
  ]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
});
