/**
 * zMenu 菜单编辑器 — Actions UI 增强
 * 参考 https://minecraft-inventory-builder.com/builder/inventory/5470#builder 的交互
 * 
 * 功能：
 *   1) 将 "Actions 标题 + 下拉 + 添加操作按钮" 替换为 "Actions (N) + 蓝色渐变 + ADD AN ACTION 按钮"
 *   2) 点击 "+ ADD AN ACTION" 按钮弹出 ActionTypePicker（可搜索 + 类型卡片 + 描述）
 *   3) 把已添加的每个 action 条目升级为：彩色类型标签 + 折叠/展开 + 复制/上移/下移/删除按钮
 *   4) 通过模拟 DOM 事件（select + click）与原 React 组件交互，保持 state 不变
 */
(function () {
  'use strict';

  // ---------- 工具函数 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function waitFor(selector, timeout = 15000, interval = 200) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const el = $(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject(new Error('waitFor timeout: ' + selector));
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  // 向 DOM 元素派发原生事件（React 会从 root 捕获这些合成事件）
  function nativeDispatch(el, type, extra) {
    let ev;
    try {
      if (type === 'input' || type === 'change') {
        ev = new Event(type, { bubbles: true, cancelable: true });
      } else {
        ev = new Event(type, { bubbles: true, cancelable: true });
      }
    } catch (e) {
      ev = document.createEvent('Event');
      ev.initEvent(type, true, true);
    }
    if (extra && typeof extra === 'object') {
      for (const k in extra) {
        try { Object.defineProperty(ev, k, { value: extra[k], writable: true, configurable: true }); } catch (e) {}
      }
    }
    // 不要覆盖 target —— 浏览器原生会设置正确的 target
    if (el.dispatchEvent) el.dispatchEvent(ev);
    return ev;
  }

  // 设置 React 受控 <select> 为指定 value，并触发 React 正确接受的原生 change
  function setReactSelect(selectEl, value) {
    // 找到对应 option
    let opt = null;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === value) { opt = selectEl.options[i]; break; }
    }
    if (!opt) return false;

    // React 16+：用 HTMLSelectElement 的原生 setter
    const protoSel = HTMLSelectElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(protoSel, 'value').set;
    nativeValueSetter.call(selectEl, value);

    // 派发 change
    // React onChange 实际监听的是 change 事件（在 select 上），在 root 级捕获
    // 为了兼容老 React，也派发到 select 自身与 document 分别
    const ev1 = document.createEvent('HTMLEvents');
    ev1.initEvent('change', true, true);
    try { selectEl.dispatchEvent(ev1); } catch (e) {}

    const ev2 = document.createEvent('HTMLEvents');
    ev2.initEvent('input', true, true);
    try { selectEl.dispatchEvent(ev2); } catch (e) {}
    return true;
  }

  // ---------- 操作类型缓存（从下拉 option 中提取）----------
  function collectActionTypesFromSelect(selectEl) {
    const list = [];
    $$('option', selectEl).forEach(opt => {
      const name = (opt.value || '').trim();
      if (!name) return;
      list.push(name);
    });
    return list;
  }

  // 每种操作的颜色映射（参考网站的彩色标签风格）
  const TYPE_COLORS = {
    COMMAND: '#5865F2',              // 紫蓝
    CONSOLE_COMMAND: '#7C3AED',       // 深紫
    PLAYER_COMMAND_AS_OP: '#6D28D9',
    MESSAGE: '#10B981',                // 绿
    BROADCAST: '#059669',
    ACTIONBAR: '#34D399',
    TITLE: '#F59E0B',
    CHANGE_TITLE: '#D97706',
    TOAST: '#FBBF24',
    SOUND: '#EC4899',
    BROADCAST_SOUND: '#BE185D',
    TELEPORT: '#8B5CF6',
    OPEN_URL: '#3B82F6',
    OPEN_URL_PROMPT: '#2563EB',
    CONNECT: '#06B6D4',
    CLOSE: '#EF4444',
    BACK: '#F97316',
    INVENTORY: '#6366F1',
    REFRESH: '#0EA5E9',
    REFRESH_INVENTORY: '#0284C7',
    REFRESH_SLOT: '#475569',
    DATA: '#A855F7',
    RANDOM_PLAYER_COMMAND: '#8B5CF6',
    RANDOM_CONSOLE_COMMAND: '#7C3AED',
    CHAT: '#0D9488',
    SHOPKEEPER: '#14B8A6',
    BOOK: '#F472B6',
    DEPOSIT: '#22C55E',
    WITHDRAW: '#DC2626',
    MONEY_DEPOSIT: '#22C55E',
    MONEY_WITHDRAW: '#DC2626',
    ACTIONBAR__DUP1: '#34D399',
    DISCORD: '#5865F2',
    DISCORD_COMPONENT: '#4F46E5',
    SET_ITEM: '#84CC16',
    TAKE_ITEM: '#CA8A04',
    LUCKPERM_SET: '#0EA5E9',
    DIALOG: '#E11D48',
    BEDROCK: '#22D3EE',
  };

  function colorOf(type) {
    if (TYPE_COLORS[type]) return TYPE_COLORS[type];
    // 哈希兜底
    let hash = 0;
    for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
  }

  // ---------- 构建 ActionTypePicker ----------
  function buildTypePicker(actionNames, onPick) {
    // 已有的描述映射（本地硬编码一份简短的英中混显，参考网站的描述风格）
    const DESCS = {
      COMMAND: '以玩家身份执行命令（可含占位符）。',
      CONSOLE_COMMAND: '以后台控制台身份执行命令。',
      PLAYER_COMMAND_AS_OP: '以 OP 管理员身份为玩家执行命令。',
      MESSAGE: '向玩家发送消息（支持 MiniMessage / 颜色代码）。',
      BROADCAST: '向全服所有玩家广播消息。',
      ACTIONBAR: '向玩家发送动作栏（ActionBar）消息。',
      TITLE: '向玩家发送大标题 + 副标题。',
      CHANGE_TITLE: '在玩家当前标题基础上叠加修改。',
      TOAST: '向玩家弹出成就/吐司（Toast）弹窗。',
      SOUND: '为点击玩家播放声音。',
      BROADCAST_SOUND: '为全服所有在线玩家播放声音。',
      TELEPORT: '传送玩家到指定世界与坐标。',
      OPEN_URL: '提示玩家打开一个 URL 链接。',
      OPEN_URL_PROMPT: '带自定义文本的 URL 确认提示。',
      CONNECT: '将玩家送到 BungeeCord/Velocity 子服。',
      CLOSE: '直接关闭当前菜单。',
      BACK: '返回到上一个打开的菜单。',
      INVENTORY: '打开另一个 zMenu 菜单（可跨插件、指定页码/参数）。',
      REFRESH: '刷新当前按钮（在点击需求中常用）。',
      REFRESH_INVENTORY: '重绘并刷新整个当前菜单。',
      REFRESH_SLOT: '仅刷新当前菜单的指定槽位。',
      DATA: '写入 / 修改玩家持久化数据（Player Data）。',
      RANDOM_PLAYER_COMMAND: '从候选池中随机挑一条，以玩家身份执行。',
      RANDOM_CONSOLE_COMMAND: '从候选池中随机挑一条，以控制台身份执行。',
      CHAT: '以玩家名义在聊天频道发送消息。',
      SHOPKEEPER: '打开 Shopkeepers 插件的交易界面。',
      BOOK: '给玩家打开一本成书（Book GUI）。',
      DEPOSIT: '向玩家账户存入经济货币（Vault）。',
      WITHDRAW: '从玩家账户扣除经济货币（Vault）。',
      MONEY_DEPOSIT: '向玩家账户存入货币（Vault 兼容）。',
      MONEY_WITHDRAW: '从玩家账户扣除货币（Vault 兼容）。',
      DISCORD: '发送 Discord Webhook 消息。',
      DISCORD_COMPONENT: '发送带按钮/下拉组件的 Discord Webhook。',
      SET_ITEM: '向玩家背包中添加指定物品。',
      TAKE_ITEM: '从玩家背包中移除指定物品。',
      LUCKPERM_SET: '通过 LuckPerms 设置权限、权限组。',
      DIALOG: '向玩家弹出交互式对话框（Floodgate/Geyser 可用）。',
      BEDROCK: '向基岩版（Geyser/Floodgate）玩家发送表单。',
    };

    // 遮罩
    const mask = document.createElement('div');
    mask.className = 'zm-popup-mask';
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

    // 容器
    const box = document.createElement('div');
    box.className = 'zm-picker';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '选择操作类型');

    box.innerHTML = `
      <div class="zm-picker-header">
        <div class="zm-picker-title">
          <span class="zm-picker-title-icon">＋</span>
          <span>添加操作（Add an action）</span>
        </div>
        <button class="zm-picker-close" title="关闭（Esc）" aria-label="关闭">&times;</button>
      </div>
      <div class="zm-picker-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="搜索操作类型或关键字（command / message / sound ...）" spellcheck="false"/>
      </div>
      <div class="zm-picker-grid" role="listbox"></div>
      <div class="zm-picker-footer">
        <span class="zm-picker-hint">共 <b class="zm-count">0</b> 种操作。单击卡片即可添加到当前按钮。</span>
      </div>
    `;
    mask.appendChild(box);

    const grid = $('.zm-picker-grid', box);
    const countBadge = $('.zm-count', box);
    const searchInput = $('input', box);
    const closeBtn = $('.zm-picker-close', box);

    function render() {
      const q = searchInput.value.trim().toLowerCase();
      const list = actionNames.filter(n => !q || n.toLowerCase().includes(q) || (DESCS[n] && DESCS[n].toLowerCase().includes(q)));
      grid.innerHTML = '';
      countBadge.textContent = list.length;
      if (list.length === 0) {
        grid.innerHTML = `<div class="zm-picker-empty">没有匹配的操作类型，试试其他关键字？</div>`;
        return;
      }
      const frag = document.createDocumentFragment();
      list.forEach(name => {
        const c = colorOf(name);
        const card = document.createElement('div');
        card.className = 'zm-picker-card';
        card.setAttribute('role', 'option');
        card.tabIndex = 0;
        card.innerHTML = `
          <div class="zm-picker-card-head">
            <span class="zm-type-pill" style="background:${c}">${name}</span>
            <a class="zm-picker-card-doc" href="https://docs.groupez.dev/zmenu/configurations/buttons/actions" target="_blank" title="打开官方文档" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </a>
          </div>
          <div class="zm-picker-card-desc">${DESCS[name] || ''}</div>
        `;
        card.addEventListener('click', (e) => {
          e.preventDefault();
          onPick(name);
          close();
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(name); close(); }
        });
        frag.appendChild(card);
      });
      grid.appendChild(frag);
    }
    render();
    searchInput.addEventListener('input', render);

    function close() {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    document.body.appendChild(mask);
    // 聚焦搜索框
    setTimeout(() => searchInput.focus(), 30);

    return { close };
  }

  // ---------- 注入的组件：标题与 "+ 添加操作" 按钮 ----------
  function buildActionsHeader(count, origSelect, origAddBtn, actionNames) {
    const header = document.createElement('div');
    header.className = 'zm-actions-header';
    const refreshAddedActionCards = () => {
      [0, 120, 420].forEach(delay => setTimeout(() => {
        document.dispatchEvent(new CustomEvent('zmenu-actions-refresh'));
      }, delay));
    };

    const pickAction = (typeName) => {
      // 1) 在原 select 中选择对应 value（用 React 受控组件兼容方案）
      const opts = $$('option', origSelect);
      let matched = null;
      for (const o of opts) {
        if ((o.value || '').toUpperCase() === String(typeName).toUpperCase()) { matched = o; break; }
      }
      if (!matched) {
        alert('当前编辑器不支持操作类型：' + typeName);
        return;
      }
      const val = matched.value;
      const ok = setReactSelect(origSelect, val);
      if (!ok) return;

      // 2) 点击原添加操作按钮
      // React state 更新在微任务或渲染 commit 中，需要重试
      const tryClick = (attempt = 0) => {
        // 每轮确保 value 没被 React 重置
        if (origSelect.value !== val) {
          setReactSelect(origSelect, val);
        }
        if (origAddBtn.disabled || origAddBtn.getAttribute('aria-disabled') === 'true') {
          if (attempt < 30) {
            setTimeout(() => tryClick(attempt + 1), 40);
          } else {
            // 强制 fallback：解除 disabled 再 click（此时 React 内部 d 仍是空可能会导致不添加，但总比失败好）
            try {
              const saveDisabled = origAddBtn.disabled;
              origAddBtn.disabled = false;
              origAddBtn.removeAttribute('aria-disabled');
              origAddBtn.click();
              origAddBtn.disabled = saveDisabled;
              refreshAddedActionCards();
            } catch (e) {}
          }
          return;
        }
        origAddBtn.click();
        refreshAddedActionCards();
      };
      setTimeout(tryClick, 20);
    };

    header.innerHTML = `
      <label class="zm-actions-title">
        Actions <span class="zm-actions-count">(${count})</span>
        <a class="zm-actions-doc" href="https://docs.groupez.dev/zmenu/configurations/buttons/actions" target="_blank" title="官方文档（Actions）" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </a>
      </label>
      <button class="zm-add-btn" type="button">
        <span class="zm-add-plus">+</span>
        <span class="zm-add-text">ADD AN ACTION</span>
      </button>
    `;

    const btn = header.querySelector('.zm-add-btn');
    btn.addEventListener('click', () => {
      buildTypePicker(actionNames, (typeName) => pickAction(typeName));
    });

    return header;
  }

  // ---------- 改造单个 action 卡片 ----------
  function enhanceActionCard(card, index, allCards) {
    card.classList.add('zm-card-enhanced');

    const strong = $('strong', card);
    const existingPill = $('.zm-type-pill', card);
    const typeName = strong ? strong.textContent.trim() : (existingPill ? existingPill.textContent.trim() : ('ACTION_' + (index+1)));
    const color = colorOf(typeName);

    // 原有的删除按钮
    const delBtn = $('button', card.querySelector('.d-flex') || card);
    const header = card.querySelector('.d-flex.justify-content-between.align-items-center');

    // 构造新 header
    if (header) {
      header.classList.add('zm-card-header');
      // 在原 strong 位置替换成彩色 pill + 折叠按钮
      if (strong) {
        const pill = document.createElement('span');
        pill.className = 'zm-type-pill';
        pill.style.background = color;
        pill.textContent = typeName;
        strong.replaceWith(pill);
      }

      // 折叠按钮可能在 React 重渲染时被替换，需要按需重新挂回。
      if (!header.querySelector('.zm-card-collapse')) {
        // 折叠按钮
        const collapse = document.createElement('button');
        collapse.type = 'button';
        collapse.className = 'zm-card-collapse';
        collapse.innerHTML = '';
        const setCollapsed = (collapsed) => {
          card.classList.toggle('zm-card-collapsed', collapsed);
          collapse.title = collapsed ? '展开操作' : '折叠操作';
          collapse.setAttribute('aria-label', collapse.title);
          collapse.setAttribute('aria-expanded', String(!collapsed));
        };
        setCollapsed(card.classList.contains('zm-card-collapsed'));
        collapse.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setCollapsed(!card.classList.contains('zm-card-collapsed'));
        });
        header.insertBefore(collapse, header.firstChild);
      }

      // 在删除按钮旁边加 上移/下移/复制
      const actionsWrap = header.children[header.children.length - 1].classList ? header.children[header.children.length - 1] : null;
      if (!header.querySelector('.zm-card-toolbar')) {
        const bar = document.createElement('div');
        bar.className = 'zm-card-toolbar';
        bar.innerHTML = `
          <button type="button" class="zm-card-btn zm-up"   title="上移">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
          <button type="button" class="zm-card-btn zm-down" title="下移">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </button>
          <button type="button" class="zm-card-btn zm-copy" title="复制操作">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        `;
        const del = header.querySelector('button.btn-danger, button[class*="danger"], .btn-danger')
          || Array.from(header.querySelectorAll('button')).find(button => /删除|delete|trash/i.test(
            `${button.title || ''} ${button.getAttribute('aria-label') || ''} ${button.className || ''}`
          ))
          || header.querySelector('button:last-child');
        const dest = del ? del.parentNode : header;
        dest.insertBefore(bar, del);
        if (del) {
          del.classList.add('zm-card-btn', 'zm-del');
          del.title = '删除';
          if (del.querySelector('i')) {
            del.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
          }
        }

        // 功能：上移下移复制
        bar.querySelector('.zm-up').addEventListener('click', () => moveCard(index, -1));
        bar.querySelector('.zm-down').addEventListener('click', () => moveCard(index, +1));
        bar.querySelector('.zm-copy').addEventListener('click', () => duplicateCard(card, index));
      }
    }

    // 增加彩色侧边条
    if (!card.querySelector('.zm-card-side')) {
      const side = document.createElement('div');
      side.className = 'zm-card-side';
      side.style.background = color;
      card.insertBefore(side, card.firstChild);
    }

    // 给字段 label 加上 (?) 文档图标的增强（已在 rB 组件中由 element.documentation_url 提供样式）
    // 把 label text key 转成更清晰的 Label（首字母大写）
    $$('label', card).forEach(lab => {
      if (lab.classList.contains('zm-key-upgraded')) return;
      const orig = lab.textContent.replace(/\(\?\)/g, '').trim();
      if (!orig) return;
      lab.classList.add('zm-key-upgraded');
    });
  }

  // 排序与复制必须由 React 状态层完成，避免显示顺序和 YAML 导出顺序分离。
  function moveCard(index, delta) {
    const cards = $$('.zm-card-enhanced');
    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= cards.length) return;
    document.dispatchEvent(new CustomEvent('zmenu-actions-change', {
      detail: { operation: 'move', index, toIndex: newIdx }
    }));
    showToastReflow();
  }

  function duplicateCard(card, index) {
    document.dispatchEvent(new CustomEvent('zmenu-actions-change', {
      detail: { operation: 'duplicate', index }
    }));
    showToastReflow();
  }

  let toastTimer = null;
  function showToastReflow() {
    let t = $('.zm-global-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'zm-global-toast';
      t.textContent = '操作已更新，导出 YAML 将使用当前显示的顺序和内容。';
      document.body.appendChild(t);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- 主循环：观察并接管 Actions 区域 ----------
  async function main() {
    // 等界面出现原始下拉框（"选择操作类型..."）
    // bootstrap select 通常是 <select class="form-select"> 或 Xe.Select => select
    let selectEl = null;
    try {
      await waitFor('select');
    } catch (e) {}
    // 遍历所有 select 找到包含 "选择操作类型" option 的
    $$('select').forEach(sel => {
      const first = sel.options && sel.options[0];
      if (first && /选择操作类型|Add an action|action type/i.test(first.textContent || '')) selectEl = sel;
    });
    if (!selectEl) {
      // fallback: 找有 COMMAND / MESSAGE / CONSOLE_COMMAND 等 action 的 select
      $$('select').forEach(sel => {
        const txt = sel.textContent || '';
        if (/COMMAND\b/.test(txt) && /MESSAGE\b/.test(txt) && /CLOSE\b/.test(txt)) selectEl = sel;
      });
    }
    if (!selectEl) {
      // 还没加载到就再延迟重试
      return setTimeout(main, 1000);
    }

    // 对应的添加操作按钮（和 select 在同一父 div.mb-2 下）
    const mb2 = selectEl.closest('div.mb-2');
    let addBtn = null;
    if (mb2) addBtn = mb2.querySelector('button');
    if (!addBtn) {
      // 找所有含"添加操作"文本的按钮
      $$('button').forEach(b => {
        if (/添加操作|Add.*action/i.test(b.textContent || '')) addBtn = b;
      });
    }
    if (!addBtn) return setTimeout(main, 1000);

    selectEl.classList.add('zm-original-select-ref');
    addBtn.classList.add('zm-original-add-btn');

    // 隐藏原生的 select + 添加操作按钮（仍保留在 DOM，供我们的 picker 触发）
    mb2.classList.add('zm-native-action-controls');
    mb2.setAttribute('aria-hidden', 'true');
    mb2.style.display = 'none';
    // 用 visibility 隐藏 select 但保留其结构
    // 但我们把整个 mb-2 换成我们的 header + 注入
    const actionsContainer = mb2.parentElement; // 即外层 div.mb-3

    // 1) 把标题行(Xe.Label)换成 Actions (#) 标题
    const labelEl = actionsContainer.querySelector('label, .form-label, .form-check-label, [class*="Label"]');
    let titleRow = null;
    // label 是 "Actions (?)"
    $$('label', actionsContainer).forEach(l => {
      if (/Actions/i.test(l.textContent)) titleRow = l;
    });
    // 没找到 label，就找包含 Actions text 的 Xe.Label 元素（通常是 label 或 div.form-label）
    if (!titleRow) {
      actionsContainer.querySelectorAll('*').forEach(el => {
        const t = (el.innerText || el.textContent || '').trim();
        if (/^Actions/.test(t) && el.children.length <= 3 && !titleRow) titleRow = el;
      });
    }

    // 观察 actions 数量变化
    // 结构：DIV.mb-3 > HR + label + header + mb-2(hidden) + DIV(无className) { > DIV.border * N }
    function currentCount() {
      const inner = actionsContainer.querySelector(':scope > div:not(.zm-actions-header):not(.mb-2):not(.mb-3)');
      if (inner) {
        const cs = inner.querySelectorAll(':scope > div.border').length;
        if (cs > 0) return cs;
      }
      return actionsContainer.querySelectorAll('div.border').length;
    }

    function renderHeader() {
      const cnt = currentCount();
      const names = collectActionTypesFromSelect(selectEl);
      const old = actionsContainer.querySelector('.zm-actions-header');
      if (old && Number(old.dataset.actionCount) === cnt) return;
      if (old) old.remove();
      const header = buildActionsHeader(cnt, selectEl, addBtn, names);
      header.dataset.actionCount = String(cnt);
      if (titleRow && titleRow.parentNode === actionsContainer) {
        actionsContainer.insertBefore(header, titleRow.nextSibling);
      } else {
        actionsContainer.insertBefore(header, mb2);
      }
    }
    renderHeader();

    // 处理已有的 action 卡片
    function getCardContainer() {
      // 优先找内层无class div，若里面有border children
      const inner = actionsContainer.querySelector(':scope > div:not(.zm-actions-header):not(.mb-2):not(.mb-3)');
      if (inner && inner.querySelector(':scope > div.border')) return inner;
      return actionsContainer;
    }
    let _refreshTimer = null;
    function refreshCards() {
      if (_refreshTimer) return;
      _refreshTimer = setTimeout(() => {
        _refreshTimer = null;
        const container = getCardContainer();
        const cards = container.querySelectorAll(':scope > div.border');
        cards.forEach((c, i) => enhanceActionCard(c, i, cards));
        renderHeader(); // 刷新数量
      }, 60);
    }
    refreshCards();
    const onActionsRefresh = () => refreshCards();
    document.addEventListener('zmenu-actions-refresh', onActionsRefresh);

    // 全局接 zm-pick-action（duplicateCard 派发）
    const onPickAction = (e) => {
      const type = (e.detail || {}).type;
      if (!type) return;
      setReactSelect(selectEl, type);
      const tryClick = (n=0) => {
        if (selectEl.value !== type) setReactSelect(selectEl, type);
        if (addBtn.disabled && n < 30) return setTimeout(()=>tryClick(n+1), 40);
        try {
          if (addBtn.disabled) { const s = addBtn.disabled; addBtn.disabled = false; addBtn.click(); addBtn.disabled = s; }
          else addBtn.click();
        } catch (err) {}
      };
      setTimeout(tryClick, 20);
    };
    document.addEventListener('zm-pick-action', onPickAction);

    // 观察 Action 卡片内部的 React 重渲染。增强逻辑是幂等的，只会补回缺失控件。
    let _moTimer = null;
    const mo = new MutationObserver((records) => {
      const needsRefresh = records.some(record => Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node => {
        if (node.nodeType !== 1) return false;
        return node.matches('strong, .zm-card-collapse, .zm-card-toolbar')
          || Boolean(node.querySelector('strong, .zm-card-collapse, .zm-card-toolbar'));
      }));
      if (!needsRefresh) return;
      if (_moTimer) clearTimeout(_moTimer);
      _moTimer = setTimeout(() => { _moTimer = null; refreshCards(); }, 80);
    });
    const cardContainer = getCardContainer();
    try { mo.observe(cardContainer, { childList: true, subtree: true }); } catch(e) {}

    // 观察：当选中某个按钮切换，整页的右侧面板会重建（actionsContainer 失效），需要再接管。
    // 用轮询检查（每 350ms），比 subtree:true 的 MutationObserver 更安全，不会因高频 DOM 改动而卡死。
    let _pollStopped = false;
    function pollContainer() {
      if (_pollStopped) return;
      if (!document.body.contains(actionsContainer) || !document.body.contains(selectEl)) {
        _pollStopped = true;
        mo.disconnect();
        document.removeEventListener('zm-pick-action', onPickAction);
        document.removeEventListener('zmenu-actions-refresh', onActionsRefresh);
        setTimeout(main, 300);
        return;
      }
      const cards = getCardContainer().querySelectorAll(':scope > div.border');
      if (Array.from(cards).some(card => !card.querySelector('.zm-card-collapse, .zm-card-toolbar'))) {
        refreshCards();
      }
      setTimeout(pollContainer, 350);
    }
    pollContainer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(main, 500));
  } else {
    setTimeout(main, 600);
  }
})();
