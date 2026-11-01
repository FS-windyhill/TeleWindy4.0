const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CustomCss = require('../js/custom-css.js');

const prefix = css => CustomCss.prefix(css);

test('普通选择器和组合选择器都会加前缀', () => {
    assert.equal(
        prefix('.a { color: red; }'),
        'body.custom-mode .a { color: red; }'
    );
    assert.equal(
        prefix('.a, .b { color: red; }'),
        'body.custom-mode .a, body.custom-mode .b { color: red; }'
    );
    assert.equal(
        prefix('#task-input { color: red; }'),
        'body.custom-mode #task-input { color: red; }'
    );
});

test('body / :root / html 的特殊处理', () => {
    assert.equal(prefix('body { --x: 1; }'), 'body.custom-mode { --x: 1; }');
    assert.equal(
        prefix('body.dark-mode .x { color: red; }'),
        'body.custom-mode.dark-mode .x { color: red; }'
    );
    assert.equal(
        prefix('body.custom-mode .x { color: red; }'),
        'body.custom-mode .x { color: red; }'
    );
    assert.equal(prefix(':root { --x: 1; }'), ':root { --x: 1; }');
    assert.equal(prefix('html body { color: red; }'), 'html body { color: red; }');
});

test('@media 内部规则继续加前缀，@keyframes / @font-face 原样保留', () => {
    assert.equal(
        prefix('@media (max-width: 600px) { .a { color: red; } .b { color: blue; } }'),
        '@media (max-width: 600px) { body.custom-mode .a { color: red; } body.custom-mode .b { color: blue; } }'
    );
    assert.equal(
        prefix('@layer base { .a { color: red; } }'),
        '@layer base { body.custom-mode .a { color: red; } }'
    );

    const keyframes = '@keyframes spin { from { transform: rotate(0); } to { transform: rotate(1turn); } }';
    assert.equal(prefix(keyframes), keyframes);

    const fontFace = '@font-face { font-family: X; src: url("a;b.woff2"); }';
    assert.equal(prefix(fontFace), fontFace);
});

test('@media 里的 @keyframes 不会被加前缀', () => {
    const input = '@media (prefers-reduced-motion: reduce) { @keyframes x { from { opacity: 1; } } .a { animation: x 1s; } }';
    const expected = '@media (prefers-reduced-motion: reduce) { @keyframes x { from { opacity: 1; } } body.custom-mode .a { animation: x 1s; } }';
    assert.equal(prefix(input), expected);
});

test('注释和字符串里的花括号不会打断解析', () => {
    assert.equal(
        prefix('/* leading } */ .a { content: "}"; }'),
        '/* leading } */ body.custom-mode .a { content: "}"; }'
    );
    assert.equal(
        prefix('/* @media */ .a { color: red; }'),
        '/* @media */ body.custom-mode .a { color: red; }'
    );
    assert.equal(
        prefix('/* @media */ @media (max-width: 1px) { .a { color: red; } }'),
        '/* @media */ @media (max-width: 1px) { body.custom-mode .a { color: red; } }'
    );
});

test('选择器里的逗号不会拆错', () => {
    assert.equal(
        prefix(':is(.a, .b) .c { color: red; }'),
        'body.custom-mode :is(.a, .b) .c { color: red; }'
    );
    assert.equal(
        prefix('[data-x="a,b"] { color: red; }'),
        'body.custom-mode [data-x="a,b"] { color: red; }'
    );
    assert.equal(
        prefix('body, .a { color: red; }'),
        'body.custom-mode, body.custom-mode .a { color: red; }'
    );
    assert.equal(
        prefix('.a, /* keep */ .b { color: red; }'),
        'body.custom-mode .a, body.custom-mode /* keep */ .b { color: red; }'
    );
});

test('原生 CSS 嵌套的块内容原样保留', () => {
    assert.equal(
        prefix('.a { & .b { color: red; } }'),
        'body.custom-mode .a { & .b { color: red; } }'
    );
});

test('输入到一半不抛错，并尽量加上前缀', () => {
    assert.doesNotThrow(() => prefix('.a { color: red'));
    assert.match(prefix('.a { color: red'), /body\.custom-mode \.a \{ color: red/);

    assert.doesNotThrow(() => prefix('@media (max-width: 600px) { .a { color: red'));
    assert.match(
        prefix('@media (max-width: 600px) { .a { color: red'),
        /@media \(max-width: 600px\) \{ body\.custom-mode \.a \{ color: red/
    );

    assert.doesNotThrow(() => prefix('/* unclosed'));
});

test('顶层 @import / @charset / @layer 语句原样保留', () => {
    assert.equal(
        prefix('@import url("a;b.css"); .a { color: red; }'),
        '@import url("a;b.css"); body.custom-mode .a { color: red; }'
    );
    assert.equal(prefix('@charset "utf-8";'), '@charset "utf-8";');
    assert.equal(prefix('@layer base, components;'), '@layer base, components;');
});

test('多条规则和空行原样保留', () => {
    assert.equal(
        prefix('.a { color: red; }\n\n.b { color: blue; }'),
        'body.custom-mode .a { color: red; }\n\nbody.custom-mode .b { color: blue; }'
    );
});

test('空输入直接返回空字符串', () => {
    assert.equal(prefix(''), '');
    assert.equal(prefix(null), '');
    assert.equal(prefix(undefined), '');
    assert.equal(prefix(123), '');
});

test('初始绿泡泡主题包含类名说明和关键选择器', () => {
    const context = { CONFIG: {} };
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '..', 'js', 'css-presets.js'), 'utf8'),
        context
    );

    const css = context.CONFIG.INITIAL_CUSTOM_CSS;
    assert.equal(context.CONFIG.INITIAL_CUSTOM_CSS_PRESET_NAME, '绿泡泡');
    assert.ok(css.includes('绿泡泡'));
    assert.ok(css.includes('.message-wrapper'));
    assert.ok(css.includes('.msg-time'));

    const output = prefix(css);
    assert.ok(output.includes('body.custom-mode .message-wrapper'));
    assert.ok(output.includes('body.custom-mode .msg-time'));
    assert.equal((output.match(/\{/g) || []).length, (output.match(/\}/g) || []).length);
});
