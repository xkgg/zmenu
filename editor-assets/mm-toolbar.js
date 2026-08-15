/* MiniMessage field enhancement for the bundled zMenu editor. */
(function () {
  'use strict';

  const CUSTOM_TAGS_KEY = 'zmenu-mm-custom-tags';
  const PLACEHOLDERS = [
    'player_name', 'player_displayname', 'player_uuid', 'player_world',
    'player_x', 'player_y', 'player_z', 'player_level', 'player_health',
    'player_food_level', 'server_online', 'server_max_players', 'server_tps'
  ];
  const COLORS = [
    ['black', '#000000'], ['dark_blue', '#0000aa'], ['dark_green', '#00aa00'], ['dark_aqua', '#00aaaa'],
    ['dark_red', '#aa0000'], ['dark_purple', '#aa00aa'], ['gold', '#ffaa00'], ['gray', '#aaaaaa'],
    ['dark_gray', '#555555'], ['blue', '#5555ff'], ['green', '#55ff55'], ['aqua', '#55ffff'],
    ['red', '#ff5555'], ['light_purple', '#ff55ff'], ['yellow', '#ffff55'], ['white', '#ffffff']
  ];
  const SYMBOLS = ['❤', '✔', '✘', '★', '☆', '❄', '✂', 'ℹ', '⚑', '⚠', '⚔', '♪', '♫', '♠', '♯', '♡', '♢', '♣', '♥', '♦', '☯', '☮', '☠', '☑', '▲', '▼', '✉', '☁', '✎', '©', '®', 'Σ', '←', '→', '↑', '↓', '«', '»', '±', '×', '÷', '≠', 'π', '¥', '€', '●', '•', 'Ω', '☀', '◆', '◇', '○', '◎', '■', '□', '◀', '▶'];
  const SPRITES = ['diamond', 'nether_star', 'emerald', 'gold_ingot', 'iron_ingot', 'redstone', 'lapis_lazuli', 'amethyst_shard', 'experience_bottle', 'ender_pearl', 'blaze_rod', 'book', 'enchanted_book', 'chest', 'barrel', 'anvil', 'beacon', 'crafting_table', 'furnace', 'diamond_sword', 'diamond_pickaxe', 'shield', 'player_head', 'totem_of_undying', 'apple', 'golden_apple', 'cake', 'arrow', 'firework_rocket', 'clock'];

  const $ = (selector, root) => (root || document).querySelector(selector);

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(value) {
    let html = escapeHtml(value);
    html = html.replace(/(&lt;\/?)(#[0-9a-fA-F]{6}|[a-zA-Z_]+)(?::([^&]*?))?(&gt;)/g, function (_, open, name, args, close) {
      const kind = /^(black|dark_blue|dark_green|dark_aqua|dark_red|dark_purple|gold|gray|dark_gray|blue|green|aqua|red|light_purple|yellow|white|color)$/i.test(name) ? 'color' : /^(bold|italic|underlined|strikethrough|obfuscated)$/i.test(name) ? 'deco' : /^(hover|click)$/i.test(name) ? 'event' : 'tag';
      return '<span class="zmm-sh-bracket">' + open + '</span><span class="zmm-sh-' + kind + '">' + name + (args ? ':' + args : '') + '</span><span class="zmm-sh-bracket">' + close + '</span>';
    });
    return html + '\n';
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getCustomTags() {
    try {
      const tags = JSON.parse(localStorage.getItem(CUSTOM_TAGS_KEY) || '[]');
      return Array.isArray(tags) ? tags : [];
    } catch (error) {
      return [];
    }
  }

  function setCustomTags(tags) {
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
  }

  function createButton(icon, tooltip, onClick, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zmm-toolbar-btn' + (className ? ' ' + className : '');
    button.dataset.tooltip = tooltip;
    button.setAttribute('aria-label', tooltip);
    button.innerHTML = icon;
    button.addEventListener('click', onClick);
    return button;
  }

  function closeOpenPanels(except) {
    document.querySelectorAll('.zmm-popover, .zmm-modal-overlay').forEach(function (panel) {
      if (panel !== except && (!except || !panel.contains(except))) panel.remove();
    });
  }

  function insertText(editor, before, after, sample) {
    const input = editor.input;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    const content = selected || sample || '';
    const value = input.value.slice(0, start) + before + content + after + input.value.slice(end);
    editor.update(value);
    const cursorStart = start + before.length;
    const cursorEnd = cursorStart + content.length;
    requestAnimationFrame(function () {
      input.focus();
      input.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function insertAtCursor(editor, value) {
    const input = editor.input;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    editor.update(input.value.slice(0, start) + value + input.value.slice(end));
    requestAnimationFrame(function () {
      input.focus();
      input.setSelectionRange(start + value.length, start + value.length);
    });
  }

  function replaceSelection(editor, value) {
    const input = editor.input;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    editor.update(input.value.slice(0, start) + value + input.value.slice(end));
    requestAnimationFrame(function () {
      input.focus();
      input.setSelectionRange(start, start + value.length);
    });
  }

  function openPopover(anchor, body) {
    closeOpenPanels();
    const popover = document.createElement('div');
    popover.className = 'zmm-popover';
    popover.appendChild(body);
    document.body.appendChild(popover);
    const rect = anchor.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - popover.offsetWidth - 8);
    popover.style.top = Math.min(window.innerHeight - popover.offsetHeight - 8, rect.bottom + 7) + 'px';
    popover.style.left = Math.max(8, Math.min(maxLeft, rect.left)) + 'px';
    return popover;
  }

  function openDialog(title, fields, onConfirm) {
    closeOpenPanels();
    const overlay = document.createElement('div');
    overlay.className = 'zmm-modal-overlay';
    const modal = document.createElement('form');
    modal.className = 'zmm-modal';
    modal.innerHTML = '<div class="zmm-modal-title"><strong></strong><button type="button" class="zmm-modal-close" aria-label="关闭">&times;</button></div><div class="zmm-modal-fields"></div><div class="zmm-modal-actions"><button type="button" class="zmm-cancel">取消</button><button type="submit" class="zmm-confirm">插入</button></div>';
    $('strong', modal).textContent = title;
    const fieldBox = $('.zmm-modal-fields', modal);
    const inputs = {};
    fields.forEach(function (field) {
      const label = document.createElement('label');
      label.className = 'zmm-modal-label';
      label.textContent = field.label;
      const input = document.createElement(field.multiline ? 'textarea' : 'input');
      input.className = 'zmm-modal-input';
      input.name = field.name;
      input.placeholder = field.placeholder || '';
      input.value = field.value || '';
      if (!field.multiline) input.type = field.type || 'text';
      if (field.required) input.required = true;
      label.appendChild(input);
      fieldBox.appendChild(label);
      inputs[field.name] = input;
    });
    const close = function () { overlay.remove(); };
    $('.zmm-modal-close', modal).addEventListener('click', close);
    $('.zmm-cancel', modal).addEventListener('click', close);
    overlay.addEventListener('mousedown', function (event) { if (event.target === overlay) close(); });
    modal.addEventListener('submit', function (event) {
      event.preventDefault();
      const values = {};
      Object.keys(inputs).forEach(function (name) { values[name] = inputs[name].value.trim(); });
      onConfirm(values, close);
    });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { (inputs[fields[0].name] || modal).focus(); });
  }

  function createColorPicker(editor, button) {
    const body = document.createElement('div');
    body.className = 'zmm-color-popover';
    body.innerHTML = '<div class="zmm-popover-label">Minecraft 颜色</div><div class="zmm-colors"></div><div class="zmm-popover-label">十六进制颜色</div><div class="zmm-hex-row"><input type="color" value="#ff5555"><input type="text" value="#ff5555" maxlength="7"><button type="button">插入</button></div>';
    const grid = $('.zmm-colors', body);
    COLORS.forEach(function (entry) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'zmm-swatch';
      swatch.style.background = entry[1];
      swatch.title = entry[0];
      swatch.addEventListener('click', function () { insertText(editor, '<' + entry[0] + '>', '</' + entry[0] + '>', 'text'); closeOpenPanels(); });
      grid.appendChild(swatch);
    });
    const color = $('input[type="color"]', body);
    const hex = $('input[type="text"]', body);
    color.addEventListener('input', function () { hex.value = color.value; });
    hex.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(hex.value)) color.value = hex.value; });
    $('button', $('.zmm-hex-row', body)).addEventListener('click', function () {
      const value = /^#[0-9a-f]{6}$/i.test(hex.value) ? hex.value.toLowerCase() : '#ffffff';
      insertText(editor, '<' + value + '>', '</color>', 'text');
      closeOpenPanels();
    });
    openPopover(button, body);
  }

  function createSymbolsPicker(editor, button) {
    const body = document.createElement('div');
    body.className = 'zmm-symbol-popover';
    body.innerHTML = '<div class="zmm-popover-label">Minecraft 符号</div><div class="zmm-symbols"></div>';
    const grid = $('.zmm-symbols', body);
    SYMBOLS.forEach(function (symbol) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.textContent = symbol;
      cell.addEventListener('click', function () { insertAtCursor(editor, symbol); closeOpenPanels(); });
      grid.appendChild(cell);
    });
    openPopover(button, body);
  }

  function createSpritesPicker(editor, button) {
    const body = document.createElement('div');
    body.className = 'zmm-sprite-popover';
    body.innerHTML = '<div class="zmm-popover-label">物品 Sprite</div><input class="zmm-sprite-search" type="search" placeholder="搜索物品..."><div class="zmm-sprites"></div>';
    const search = $('.zmm-sprite-search', body);
    const grid = $('.zmm-sprites', body);
    const render = function () {
      const query = search.value.toLowerCase().trim();
      grid.innerHTML = '';
      SPRITES.filter(function (sprite) { return !query || sprite.includes(query); }).forEach(function (sprite) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.textContent = sprite.replace(/_/g, ' ');
        cell.title = sprite;
        cell.addEventListener('click', function () { insertAtCursor(editor, '<sprite:minecraft:' + sprite + '>'); closeOpenPanels(); });
        grid.appendChild(cell);
      });
    };
    search.addEventListener('input', render);
    render();
    openPopover(button, body);
    requestAnimationFrame(function () { search.focus(); });
  }

  function smallText(value) {
    const map = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ѕ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
    return Array.from(value).map(function (character) { return map[character.toLowerCase()] || character; }).join('');
  }

  function addAutocomplete(editor) {
    const input = editor.input;
    const list = document.createElement('div');
    list.className = 'zmm-autocomplete';
    editor.shell.appendChild(list);
    let matches = [];
    let active = 0;

    const hide = function () { list.hidden = true; matches = []; };
    const accept = function () {
      const item = matches[active];
      if (!item) return;
      const before = input.value.slice(0, input.selectionStart);
      const start = before.lastIndexOf('%');
      const value = input.value.slice(0, start) + '%' + item + '%' + input.value.slice(input.selectionEnd);
      editor.update(value);
      requestAnimationFrame(function () { input.focus(); input.setSelectionRange(start + item.length + 2, start + item.length + 2); });
      hide();
    };
    const render = function () {
      const before = input.value.slice(0, input.selectionStart);
      const match = before.match(/%([a-zA-Z0-9_:-]*)$/);
      if (!match) return hide();
      matches = PLACEHOLDERS.filter(function (name) { return name.indexOf(match[1].toLowerCase()) !== -1; }).slice(0, 6);
      if (!matches.length) return hide();
      active = 0;
      list.innerHTML = '';
      matches.forEach(function (name, index) {
        const option = document.createElement('button');
        option.type = 'button';
        option.innerHTML = '<code>%' + name + '%</code><span>PlaceholderAPI</span>';
        option.className = index === active ? 'is-active' : '';
        option.addEventListener('mousedown', function (event) { event.preventDefault(); active = index; accept(); });
        list.appendChild(option);
      });
      list.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('click', render);
    input.addEventListener('blur', function () { setTimeout(hide, 120); });
    input.addEventListener('keydown', function (event) {
      if (list.hidden) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        Array.from(list.children).forEach(function (child, index) { child.classList.toggle('is-active', index === active); });
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        accept();
      } else if (event.key === 'Escape') {
        hide();
      }
    });
  }

  function buildToolbar(editor) {
    const toolbar = document.createElement('div');
    toolbar.className = 'zmm-toolbar';
    const left = document.createElement('div');
    left.className = 'zmm-toolbar-left';
    const add = function (icon, label, action, extra) { left.appendChild(createButton(icon, label, action, extra)); };
    const wrap = function (tag, sample) { return function () { insertText(editor, '<' + tag + '>', '</' + tag + '>', sample || 'text'); }; };

    add('<i class="bi bi-type-bold"></i>', '加粗 (Ctrl+B)', wrap('bold'));
    add('<i class="bi bi-type-italic"></i>', '斜体 (Ctrl+I)', wrap('italic'));
    add('<i class="bi bi-type-underline"></i>', '下划线 (Ctrl+U)', wrap('underlined'));
    add('<i class="bi bi-type-strikethrough"></i>', '删除线 (Ctrl+S)', wrap('strikethrough'));
    add('<i class="bi bi-eye-slash"></i>', '混淆 (Ctrl+Shift+O)', wrap('obfuscated'));
    const colorButton = createButton('<i class="bi bi-palette-fill"></i>', '插入颜色 (Ctrl+Shift+C)', function () { createColorPicker(editor, colorButton); });
    left.appendChild(colorButton);
    add('<i class="bi bi-magic"></i>', '渐变 (Ctrl+G)', function () { openDialog('渐变', [{ name: 'from', label: '起始颜色', value: '#288fc3', required: true }, { name: 'to', label: '结束颜色', value: '#10ea64', required: true }], function (values, close) { insertText(editor, '<gradient:' + values.from + ':' + values.to + '>', '</gradient>', 'text'); close(); }); });
    add('<i class="bi bi-rainbow"></i>', '彩虹 (Ctrl+R)', wrap('rainbow'));
    add('<i class="bi bi-flag-fill"></i>', 'Pride', wrap('pride:trans'));
    add('<i class="bi bi-chat-square-text-fill"></i>', '悬停说明 (Ctrl+H)', function () { openDialog('悬停说明', [{ name: 'text', label: '鼠标悬停时显示的文本', value: 'Tooltip here', required: true }], function (values, close) { insertText(editor, "<hover:show_text:'" + values.text.replace(/'/g, "\\'") + "'>", '</hover>', 'Hover me'); close(); }); });
    add('<i class="bi bi-link-45deg"></i>', '点击链接 (Ctrl+K)', function () { openDialog('点击链接', [{ name: 'url', label: 'URL', value: 'https://example.com', required: true }], function (values, close) { insertText(editor, "<click:open_url:'" + values.url.replace(/'/g, "\\'") + "'>", '</click>', 'Click me'); close(); }); });
    add('<i class="bi bi-star-fill"></i>', '加粗 + 金色', function () { insertText(editor, '<bold><gold>', '</gold></bold>', 'text'); });
    add('<i class="bi bi-sliders2"></i>', 'Transition', function () { insertAtCursor(editor, '<transition:#ff0000:#00ff00:#0000ff:0.5/>'); });
    add('<i class="bi bi-person-circle"></i>', '玩家头颅', function () { openDialog('玩家头颅', [{ name: 'player', label: '玩家名称或 UUID', placeholder: 'Notch', required: true }], function (values, close) { insertAtCursor(editor, '<head:' + values.player + '>'); close(); }); });
    add('<i class="bi bi-terminal-fill"></i>', '点击命令', function () { openDialog('点击命令', [{ name: 'command', label: '执行命令', value: '/', required: true }, { name: 'text', label: '显示文本', value: 'Click me', required: true }], function (values, close) { const command = values.command.charAt(0) === '/' ? values.command : '/' + values.command; insertText(editor, "<click:run_command:'" + command.replace(/'/g, "\\'") + "'>", '</click>', values.text); close(); }); });
    add('<i class="bi bi-tags-fill"></i>', '自定义标签', function () { openDialog('自定义标签', [{ name: 'name', label: '标签名称', placeholder: 'example', required: true }, { name: 'value', label: '替换内容', placeholder: '<gold>Example</gold>', required: true, multiline: true }], function (values, close) { if (!/^[a-z0-9_-]+$/i.test(values.name)) return; const tags = getCustomTags().filter(function (tag) { return tag.name !== values.name; }); tags.push(values); setCustomTags(tags); insertAtCursor(editor, '<' + values.name + '>'); close(); }); });
    add('<i class="bi bi-type-h1"></i>', '小字 (Ctrl+L)', function () { const input = editor.input; const selected = input.value.slice(input.selectionStart, input.selectionEnd); if (selected) replaceSelection(editor, smallText(selected)); });
    const symbolsButton = createButton('<span class="zmm-sword">⚔</span>', 'Minecraft 符号', function () { createSymbolsPicker(editor, symbolsButton); });
    left.appendChild(symbolsButton);
    const spritesButton = createButton('<i class="bi bi-boxes"></i>', 'Sprites', function () { createSpritesPicker(editor, spritesButton); });
    left.appendChild(spritesButton);

    toolbar.appendChild(left);
    return toolbar;
  }

  function attachField(source) {
    if (source.dataset.zmmBound === 'true') return;
    const group = source.closest('.mb-3') || source.parentElement;
    if (!group || group.querySelector('.zmm-editor')) return;
    source.dataset.zmmBound = 'true';
    source.classList.add('zmm-source-field');
    source.setAttribute('aria-hidden', 'true');

    const editor = document.createElement('div');
    editor.className = 'zmm-editor';
    const shell = document.createElement('div');
    shell.className = 'zmm-editor-area';
    const highlightLayer = document.createElement('pre');
    highlightLayer.className = 'zmm-highlight';
    highlightLayer.setAttribute('aria-hidden', 'true');
    const input = document.createElement('textarea');
    input.className = 'zmm-textarea';
    input.rows = source.name === 'lore' ? 8 : 2;
    input.value = source.value || '';
    input.placeholder = source.name === 'lore' ? '输入物品描述，使用 MiniMessage 标签...' : '输入显示名称，使用 MiniMessage 标签...';
    input.spellcheck = false;
    shell.appendChild(highlightLayer);
    shell.appendChild(input);
    editor.appendChild(buildToolbar({ input: input, shell: shell, update: update }));
    editor.appendChild(shell);
    group.insertBefore(editor, source);

    function render(value) { highlightLayer.innerHTML = highlight(value); }
    function update(value) { input.value = value; render(value); setNativeValue(source, value); }
    render(input.value);
    input.addEventListener('input', function () { update(input.value); });
    input.addEventListener('scroll', function () { highlightLayer.scrollTop = input.scrollTop; highlightLayer.scrollLeft = input.scrollLeft; });
    input.addEventListener('keydown', function (event) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      const shortcut = { b: ['bold', 'text'], i: ['italic', 'text'], u: ['underlined', 'text'], s: ['strikethrough', 'text'], g: ['gradient:#288fc3:#10ea64', 'text'], r: ['rainbow', 'text'], h: ["hover:show_text:'Tooltip here'", 'Hover me'], k: ["click:open_url:'https://example.com'", 'Click me'] };
      if (key === 'l' && !event.shiftKey) {
        const selected = input.value.slice(input.selectionStart, input.selectionEnd);
        if (selected) { event.preventDefault(); replaceSelection({ input: input, update: update }, smallText(selected)); }
        return;
      }
      if (key === 'o' && event.shiftKey) { event.preventDefault(); insertText({ input: input, update: update }, '<obfuscated>', '</obfuscated>', 'text'); return; }
      if (key === 'c' && event.shiftKey) { event.preventDefault(); const first = editor.querySelector('.zmm-toolbar-btn[data-tooltip^="插入颜色"]'); if (first) createColorPicker({ input: input, update: update }, first); return; }
      if (shortcut[key] && !event.shiftKey) { event.preventDefault(); insertText({ input: input, update: update }, '<' + shortcut[key][0] + '>', '</' + shortcut[key][0].split(':')[0] + '>', shortcut[key][1]); }
    });
    addAutocomplete({ input: input, shell: shell, update: update });
  }

  function enhanceFields() {
    document.querySelectorAll('input[name="display_name"], textarea[name="lore"]').forEach(attachField);
  }

  document.addEventListener('mousedown', function (event) {
    if (!event.target.closest('.zmm-popover, .zmm-toolbar-btn')) closeOpenPanels();
  });
  const observer = new MutationObserver(function () { enhanceFields(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceFields);
  else enhanceFields();
})();
