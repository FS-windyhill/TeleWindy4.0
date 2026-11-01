// =========================================
// 用户自定义 CSS 前缀处理
// 把用户 CSS 的选择器统一加上 body.custom-mode，保证能压过基础主题；
// 同时保留 @media / @keyframes 等结构，输入到一半也不抛错。
// =========================================
const CustomCss = {
    PREFIX: 'body.custom-mode',

    // 这些 at-rule 里面装的仍然是普通选择器，需要继续加前缀。
    // 其余 at-rule（@keyframes、@font-face 等）整块原样保留。
    CONTAINER_AT_RULES: new Set([
        'media',
        'supports',
        'layer',
        'container',
        'scope',
        'starting-style'
    ]),

    prefix(rawCss) {
        if (!rawCss || typeof rawCss !== 'string') return '';
        return this.prefixBlock(rawCss);
    },

    prefixBlock(css) {
        let output = '';
        let i = 0;
        const len = css.length;

        while (i < len) {
            const triviaStart = i;
            i = this.skipTrivia(css, i);
            const leading = css.slice(triviaStart, i);

            if (i >= len) {
                output += leading;
                break;
            }

            // 顶层多余的 }（用户正在删规则时很常见）原样输出，别把后面的规则吞掉。
            if (css[i] === '}') {
                output += leading + '}';
                i += 1;
                continue;
            }

            const delimiter = this.findRuleDelimiter(css, i);
            if (!delimiter) {
                output += leading + css.slice(i);
                break;
            }

            // 顶层 @import / @charset / @layer a, b; 这种语句原样保留。
            if (delimiter.char === ';') {
                output += leading + css.slice(i, delimiter.index + 1);
                i = delimiter.index + 1;
                continue;
            }

            const prelude = css.slice(i, delimiter.index);
            const blockEnd = this.findMatchingBrace(css, delimiter.index);

            if (blockEnd === -1) {
                // 用户可能正输到一半（例如刚敲了 `.foo {`）：能加的加，剩下的原样保留，
                // 浏览器自己会补全，编辑过程中不要抛错。
                output += leading + this.processIncomplete(prelude, css.slice(delimiter.index + 1));
                break;
            }

            const inner = css.slice(delimiter.index + 1, blockEnd);
            output += leading + this.processCompleteRule(prelude, inner);
            i = blockEnd + 1;
        }

        return output;
    },

    processCompleteRule(prelude, inner) {
        const type = this.classifyPrelude(prelude);

        if (type === 'at-container') {
            // @media / @supports / @layer / @container 等：保留外壳，继续处理内部规则。
            return prelude + '{' + this.prefixBlock(inner) + '}';
        }

        if (type === 'at-verbatim') {
            // @keyframes / @font-face 等：整块原样保留。
            return prelude + '{' + inner + '}';
        }

        return this.prefixSelectorPrelude(prelude) + '{' + inner + '}';
    },

    processIncomplete(prelude, rest) {
        const type = this.classifyPrelude(prelude);

        if (type === 'at-container') {
            return prelude + '{' + this.prefixBlock(rest);
        }

        if (type === 'at-verbatim') {
            return prelude + '{' + rest;
        }

        return this.prefixSelectorPrelude(prelude) + '{' + rest;
    },

    classifyPrelude(prelude) {
        const trimmed = prelude.trim();
        if (!trimmed.startsWith('@')) return 'selector';

        const match = trimmed.match(/^@([\w-]+)/);
        const name = match ? match[1].toLowerCase() : '';
        return this.CONTAINER_AT_RULES.has(name) ? 'at-container' : 'at-verbatim';
    },

    prefixSelectorPrelude(prelude) {
        // 保留选择器和 { 之间的空白/注释，只替换选择器本身。
        const trailingMatch = prelude.match(/\s+$/);
        const trailing = trailingMatch ? trailingMatch[0] : '';
        const selectors = trailing ? prelude.slice(0, -trailing.length) : prelude;
        return this.prefixSelectorList(selectors) + trailing;
    },

    prefixSelectorList(selectorText) {
        const selectors = this.splitSelectors(selectorText);
        const prefixed = selectors
            .map(selector => this.prefixSelector(selector))
            .filter(Boolean);

        if (!prefixed.length) return selectorText.trim();
        return prefixed.join(', ');
    },

    prefixSelector(selector) {
        const trimmed = selector.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('@')) return trimmed;

        // 已经带前缀的不要重复加。
        if (/^body\.custom-mode(?![\w-])/.test(trimmed)) return trimmed;

        // body 规则改写成 body.custom-mode，保证压得过 body.dark-mode 等基础样式。
        // body.dark-mode -> body.custom-mode.dark-mode
        if (/^body(?![\w-])/.test(trimmed)) {
            return trimmed.replace(/^body(?![\w-])/, this.PREFIX);
        }

        // :root / html 不加前缀：这段 CSS 只在自定义模式注入，本身已经足够安全；
        // 加了反而会变成 body.custom-mode :root 这种永远不匹配的选择器。
        if (/^html(?![\w-])/.test(trimmed) || /^:root(?![\w-])/.test(trimmed)) {
            return trimmed;
        }

        return this.PREFIX + ' ' + trimmed;
    },

    splitSelectors(text) {
        const selectors = [];
        let start = 0;
        let quote = '';
        let escaped = false;
        let parenDepth = 0;
        let bracketDepth = 0;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }

            if (ch === '/' && text[i + 1] === '*') {
                const commentEnd = text.indexOf('*/', i + 2);
                if (commentEnd === -1) break;
                i = commentEnd + 1;
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }

            if (ch === '(') {
                parenDepth += 1;
                continue;
            }

            if (ch === ')') {
                parenDepth = Math.max(0, parenDepth - 1);
                continue;
            }

            if (ch === '[') {
                bracketDepth += 1;
                continue;
            }

            if (ch === ']') {
                bracketDepth = Math.max(0, bracketDepth - 1);
                continue;
            }

            if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
                selectors.push(text.slice(start, i));
                start = i + 1;
            }
        }

        selectors.push(text.slice(start));
        return selectors;
    },

    // 从当前位置找到规则头结束的 { 或顶层 ;，忽略注释、字符串、括号里的符号。
    findRuleDelimiter(css, start) {
        let quote = '';
        let escaped = false;
        let parenDepth = 0;
        let bracketDepth = 0;

        for (let i = start; i < css.length; i++) {
            const ch = css[i];

            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }

            if (ch === '/' && css[i + 1] === '*') {
                const commentEnd = css.indexOf('*/', i + 2);
                if (commentEnd === -1) return null;
                i = commentEnd + 1;
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }

            if (ch === '(') {
                parenDepth += 1;
                continue;
            }

            if (ch === ')') {
                parenDepth = Math.max(0, parenDepth - 1);
                continue;
            }

            if (ch === '[') {
                bracketDepth += 1;
                continue;
            }

            if (ch === ']') {
                bracketDepth = Math.max(0, bracketDepth - 1);
                continue;
            }

            if (parenDepth === 0 && bracketDepth === 0) {
                if (ch === '{' || ch === ';') return { index: i, char: ch };
                // 顶层未匹配的 }：交给主循环，避免把后面的规则一起吞掉。
                if (ch === '}') return null;
            }
        }

        return null;
    },

    // 从规则头的 { 找到匹配的 }，忽略注释、字符串和括号里的花括号。
    findMatchingBrace(css, openIndex) {
        let depth = 0;
        let parenDepth = 0;
        let quote = '';
        let escaped = false;

        for (let i = openIndex; i < css.length; i++) {
            const ch = css[i];

            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }

            if (ch === '/' && css[i + 1] === '*') {
                const commentEnd = css.indexOf('*/', i + 2);
                if (commentEnd === -1) return -1;
                i = commentEnd + 1;
                continue;
            }

            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }

            if (ch === '(') {
                parenDepth += 1;
                continue;
            }

            if (ch === ')') {
                parenDepth = Math.max(0, parenDepth - 1);
                continue;
            }

            if (parenDepth > 0) continue;

            if (ch === '{') {
                depth += 1;
            } else if (ch === '}') {
                depth -= 1;
                if (depth === 0) return i;
            }
        }

        return -1;
    },

    // 跳过顶层空白和注释，但把跳过的内容原样留在调用方的 leading 里。
    skipTrivia(css, start) {
        let i = start;

        while (i < css.length) {
            const ch = css[i];

            if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f') {
                i += 1;
                continue;
            }

            if (ch === '/' && css[i + 1] === '*') {
                const commentEnd = css.indexOf('*/', i + 2);
                if (commentEnd === -1) return css.length;
                i = commentEnd + 2;
                continue;
            }

            break;
        }

        return i;
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CustomCss;
