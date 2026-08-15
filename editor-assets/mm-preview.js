/* MiniMessage preview layer for the inventory-content tooltip. */
(function () {
  'use strict';

  const COLORS = {
    black: '#000000', dark_blue: '#0000aa', dark_green: '#00aa00', dark_aqua: '#00aaaa',
    dark_red: '#aa0000', dark_purple: '#aa00aa', gold: '#ffaa00', gray: '#aaaaaa',
    dark_gray: '#555555', blue: '#5555ff', green: '#55ff55', aqua: '#55ffff',
    red: '#ff5555', light_purple: '#ff55ff', yellow: '#ffff55', white: '#ffffff'
  };
  const LEGACY = {
    '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua', '4': 'dark_red',
    '5': 'dark_purple', '6': 'gold', '7': 'gray', '8': 'dark_gray', '9': 'blue',
    a: 'green', b: 'aqua', c: 'red', d: 'light_purple', e: 'yellow', f: 'white'
  };

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function styleForTag(tag) {
    const name = tag.toLowerCase().split(':')[0];
    if (COLORS[name]) return 'color:' + COLORS[name] + ';';
    if (/^#[0-9a-f]{6}$/i.test(name)) return 'color:' + name + ';';
    if (name === 'bold' || name === 'strong') return 'font-weight:700;';
    if (name === 'italic' || name === 'em') return 'font-style:italic;';
    if (name === 'underlined' || name === 'underline') return 'text-decoration:underline;';
    if (name === 'strikethrough') return 'text-decoration:line-through;';
    if (name === 'obfuscated') return 'filter:blur(2px);';
    if (name === 'rainbow' || name === 'pride') return 'background:linear-gradient(90deg,#ff5555,#ffaa00,#ffff55,#55ff55,#55ffff,#5555ff,#ff55ff);background-clip:text;-webkit-background-clip:text;color:transparent;';
    if (name === 'gradient') return 'background:linear-gradient(90deg,#55ffff,#55ff55);background-clip:text;-webkit-background-clip:text;color:transparent;';
    return '';
  }

  function renderMiniMessage(value) {
    let text = String(value || '');
    const parts = [];
    let cursor = 0;
    const tokenPattern = /<([^>]+)>|&([0-9a-fk-or])/gi;
    const stack = [];
    let match;
    const closeOne = function () { if (stack.length) parts.push('</span>'), stack.pop(); };
    const closeAll = function () { while (stack.length) closeOne(); };
    while ((match = tokenPattern.exec(text))) {
      if (match.index > cursor) parts.push(escapeHtml(text.slice(cursor, match.index)));
      if (match[2]) {
        const legacyName = LEGACY[match[2].toLowerCase()];
        if (match[2].toLowerCase() === 'r' || match[2].toLowerCase() === 'o') closeAll();
        if (legacyName) {
          parts.push('<span class="zmm-preview-legacy" style="color:' + COLORS[legacyName] + ';">');
          stack.push('legacy');
        }
      } else {
        const raw = match[1].trim();
        const closing = raw.charAt(0) === '/';
        const tag = closing ? raw.slice(1) : raw;
        const name = tag.toLowerCase().split(':')[0];
        if (name === 'reset') {
          closeAll();
        } else if (closing) {
          closeOne();
        } else if (name === 'newline') {
          parts.push('<br>');
        } else if (name === 'click' || name === 'hover' || name === 'transition' || name === 'head' || name === 'sprite') {
          // These tags affect the game component but do not add visible markup in the preview.
        } else {
          const style = styleForTag(tag);
          if (style) {
            parts.push('<span style="' + style + '">');
            stack.push(name);
          }
        }
      }
      cursor = tokenPattern.lastIndex;
    }
    if (cursor < text.length) parts.push(escapeHtml(text.slice(cursor)));
    closeAll();
    return parts.join('').replace(/\n/g, '<br>');
  }

  function selectedRawValue(name) {
    const enhanced = document.querySelector('.zmm-editor .zmm-textarea');
    const source = document.querySelector('[name="' + name + '"]');
    if (enhanced && name === 'display_name') return enhanced.value;
    if (source) return source.value || '';
    return '';
  }

  function tooltipBelongsToSelectedSlot(tooltip) {
    const item = tooltip.closest('.item');
    const selected = item && item.closest('.slot.slot-select');
    return Boolean(selected);
  }

  function upgradeTooltip(tooltip) {
    if (!tooltip || tooltip.dataset.zmmPreview === 'true') return;
    if (!tooltipBelongsToSelectedSlot(tooltip)) return;
    const displayName = selectedRawValue('display_name');
    const lore = selectedRawValue('lore');
    if (!displayName && !lore) return;
    tooltip.dataset.zmmPreview = 'true';
    tooltip.classList.add('zmm-mc-preview-tooltip');
    tooltip.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'zmm-preview-title';
    title.innerHTML = renderMiniMessage(displayName || '物品');
    tooltip.appendChild(title);
    if (lore) {
      const description = document.createElement('pre');
      description.className = 'zmm-preview-lore';
      description.innerHTML = renderMiniMessage(lore);
      tooltip.appendChild(description);
    }
  }

  function refreshTooltips() {
    document.querySelectorAll('.minecraft-tooltip').forEach(function (tooltip) {
      tooltip.dataset.zmmPreview = '';
      upgradeTooltip(tooltip);
    });
  }

  window.zMenuMiniMessagePreview = renderMiniMessage;

  const observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      Array.from(record.addedNodes).forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('.minecraft-tooltip')) upgradeTooltip(node);
        if (node.querySelectorAll) node.querySelectorAll('.minecraft-tooltip').forEach(upgradeTooltip);
      });
    });
  });

  function start() {
    const slots = document.querySelector('#slots') || document.body;
    observer.observe(slots, { childList: true, subtree: true });
    document.addEventListener('input', function (event) {
      if (event.target.matches && event.target.matches('.zmm-textarea, [name="display_name"], [name="lore"]')) {
        setTimeout(refreshTooltips, 0);
      }
    });
    refreshTooltips();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
