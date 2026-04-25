// かけいちょ — simple monthly budget tracker
(() => {
  'use strict';

  const STORAGE_KEY = 'kakeibo_v1';
  const SHARE_URL = 'https://maxtakaharu34-cmd.github.io/kakeibo-jp/';

  // Categories with emoji + color (used for chart bars and record icon).
  const CATEGORIES = {
    expense: [
      { id: 'food',     label: '食費',   emoji: '🍚', color: '#e35457' },
      { id: 'transit',  label: '交通',   emoji: '🚃', color: '#4a94e0' },
      { id: 'fun',      label: '娯楽',   emoji: '🎮', color: '#a874e0' },
      { id: 'daily',    label: '日用品', emoji: '🧴', color: '#4fb56a' },
      { id: 'rent',     label: '家賃',   emoji: '🏠', color: '#ff8a3a' },
      { id: 'utility',  label: '通信光熱', emoji: '⚡', color: '#f5b733' },
      { id: 'medical',  label: '医療',   emoji: '💊', color: '#ff6ec7' },
      { id: 'other-e',  label: 'その他', emoji: '📦', color: '#9aa0a6' }
    ],
    income: [
      { id: 'salary',   label: '給料',   emoji: '💼', color: '#4fb56a' },
      { id: 'side',     label: '副業',   emoji: '💻', color: '#4a94e0' },
      { id: 'gift',     label: 'お小遣い', emoji: '🎁', color: '#ff6ec7' },
      { id: 'other-i',  label: 'その他', emoji: '✨', color: '#9aa0a6' }
    ]
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const ymEl = $('ym');
  const btnPrev = $('btn-prev'), btnNext = $('btn-next');
  const sumIncomeEl = $('sum-income'), sumExpenseEl = $('sum-expense'), sumBalanceEl = $('sum-balance');
  const catListEl = $('cat-list');
  const recListEl = $('rec-list'), recCountEl = $('rec-count');
  const btnAdd = $('btn-add');
  const modal = $('add-modal');
  const kindBtns = document.querySelectorAll('.kind-btn');
  const catGridEl = $('cat-grid');
  const fAmount = $('f-amount'), fDate = $('f-date'), fNote = $('f-note');
  const formError = $('form-error');
  const btnCancel = $('btn-cancel'), btnSave = $('btn-save');
  const btnShare = $('btn-share'), btnReset = $('btn-reset');
  const toastEl = $('toast');

  // ---------- State ----------
  const state = {
    records: loadRecords(),
    cursor: monthKeyFromDate(new Date()),
    draft: { kind: 'expense', categoryId: 'food' }
  };

  function loadRecords() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return [];
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  }

  // ---------- Helpers ----------
  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function el(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'style') Object.assign(e.style, props[k]);
      else if (k === 'text') e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    return e;
  }
  function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return monthKeyFromDate(d);
  }
  function formatYen(n) {
    return '¥' + Math.round(n).toLocaleString('ja-JP');
  }
  function categoryById(id) {
    for (const arr of [CATEGORIES.expense, CATEGORIES.income]) {
      const c = arr.find((x) => x.id === id);
      if (c) return c;
    }
    return null;
  }
  function recordsForCurrentMonth() {
    return state.records
      .filter((r) => r.date.slice(0, 7) === state.cursor)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  // ---------- Render ----------
  function render() {
    const [y, m] = state.cursor.split('-');
    ymEl.textContent = `${y}年${m}月`;

    const recs = recordsForCurrentMonth();

    let inc = 0, exp = 0;
    for (const r of recs) {
      if (r.kind === 'income') inc += r.amount;
      else exp += r.amount;
    }
    sumIncomeEl.textContent = formatYen(inc);
    sumExpenseEl.textContent = formatYen(exp);
    const bal = inc - exp;
    sumBalanceEl.textContent = (bal >= 0 ? '+' : '−') + formatYen(Math.abs(bal));
    sumBalanceEl.style.color = bal >= 0 ? 'var(--blue)' : 'var(--red)';

    // Category breakdown (expenses only)
    const byCat = new Map();
    for (const r of recs) {
      if (r.kind !== 'expense') continue;
      byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + r.amount);
    }
    clearChildren(catListEl);
    if (byCat.size === 0) {
      catListEl.appendChild(el('div', { class: 'cat-empty', text: '今月はまだ支出なし' }));
    } else {
      const max = Math.max(...byCat.values());
      const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
      for (const [id, amt] of sorted) {
        const c = categoryById(id);
        if (!c) continue;
        const row = el('div', { class: 'cat-row' });
        const lbl = el('div', { class: 'label' });
        const dot = el('span', { class: 'dot', style: { background: c.color } });
        const txt = el('span', { text: c.emoji + ' ' + c.label });
        lbl.appendChild(dot);
        lbl.appendChild(txt);
        const barWrap = el('div', { class: 'bar-wrap' });
        const bar = el('div', { class: 'bar', style: { background: c.color, width: (amt / max) * 100 + '%' } });
        barWrap.appendChild(bar);
        row.appendChild(lbl);
        row.appendChild(barWrap);
        row.appendChild(el('div', { class: 'amt', text: formatYen(amt) }));
        catListEl.appendChild(row);
      }
    }

    // Records list
    recCountEl.textContent = `(${recs.length})`;
    clearChildren(recListEl);
    if (recs.length === 0) {
      const e = el('div', { class: 'list-empty' });
      e.style.whiteSpace = 'pre-line';
      e.textContent = 'まだ記録がありません。\n右下の「＋」から追加してね';
      recListEl.appendChild(e);
    } else {
      for (const r of recs) {
        const row = el('div', { class: 'rec ' + r.kind });
        const c = categoryById(r.categoryId);
        const ic = el('div', { class: 'icon', text: c?.emoji || '?' });
        ic.style.background = (c?.color || '#ddd') + '33';
        const meta = el('div', { class: 'meta' });
        meta.appendChild(el('div', { class: 'cat', text: c?.label || r.categoryId }));
        if (r.note) meta.appendChild(el('div', { class: 'note', text: r.note }));
        const dt = el('div', { class: 'date', text: r.date.slice(5).replace('-', '/') });
        const am = el('div', { class: 'amt', text: (r.kind === 'income' ? '+' : '-') + formatYen(r.amount) });
        const del = el('button', { class: 'del', text: '✕', title: '削除' });
        del.addEventListener('click', () => {
          if (!confirm('この記録を削除しますか？')) return;
          state.records = state.records.filter((x) => x.id !== r.id);
          saveRecords();
          render();
        });
        row.appendChild(ic);
        row.appendChild(meta);
        row.appendChild(dt);
        row.appendChild(am);
        row.appendChild(del);
        recListEl.appendChild(row);
      }
    }
  }

  // ---------- Modal ----------
  function openModal() {
    formError.style.display = 'none';
    state.draft = { kind: 'expense', categoryId: CATEGORIES.expense[0].id };
    fAmount.value = '';
    fDate.value = todayStr();
    fNote.value = '';
    setKindButtons('expense');
    rebuildCategoryGrid();
    modal.classList.add('show');
    setTimeout(() => fAmount.focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('show');
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function setKindButtons(kind) {
    kindBtns.forEach((b) => {
      b.classList.toggle('on', b.dataset.kind === kind);
    });
    state.draft.kind = kind;
    state.draft.categoryId = CATEGORIES[kind][0].id;
    rebuildCategoryGrid();
  }
  function rebuildCategoryGrid() {
    clearChildren(catGridEl);
    for (const c of CATEGORIES[state.draft.kind]) {
      const b = el('button', { class: 'cat-btn' + (c.id === state.draft.categoryId ? ' on' : '') });
      b.appendChild(el('div', { class: 'emoji', text: c.emoji }));
      b.appendChild(el('div', { text: c.label }));
      b.addEventListener('click', () => {
        state.draft.categoryId = c.id;
        rebuildCategoryGrid();
      });
      catGridEl.appendChild(b);
    }
  }

  function save() {
    const amount = Math.floor(Number(fAmount.value) || 0);
    if (!amount || amount <= 0) {
      formError.textContent = '金額を1円以上で入力してください';
      formError.style.display = '';
      return;
    }
    const date = fDate.value || todayStr();
    const rec = {
      id: Date.now(),
      kind: state.draft.kind,
      categoryId: state.draft.categoryId,
      amount,
      date,
      note: fNote.value.trim() || ''
    };
    state.records.push(rec);
    saveRecords();
    state.cursor = date.slice(0, 7);
    closeModal();
    render();
    showToast(rec.kind === 'income' ? '収入を記録しました' : '支出を記録しました');
  }

  // ---------- Wire up ----------
  btnPrev.addEventListener('click', () => { state.cursor = shiftMonth(state.cursor, -1); render(); });
  btnNext.addEventListener('click', () => { state.cursor = shiftMonth(state.cursor, 1); render(); });
  btnAdd.addEventListener('click', openModal);
  btnCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  btnSave.addEventListener('click', save);
  fAmount.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  kindBtns.forEach((b) => b.addEventListener('click', () => setKindButtons(b.dataset.kind)));

  btnReset.addEventListener('click', () => {
    if (!confirm('全ての記録を消去します。本当に？')) return;
    state.records = [];
    saveRecords();
    render();
    showToast('リセットしました');
  });
  btnShare.addEventListener('click', () => {
    const recs = recordsForCurrentMonth();
    let inc = 0, exp = 0;
    for (const r of recs) (r.kind === 'income' ? (inc += r.amount) : (exp += r.amount));
    const bal = inc - exp;
    const [y, m] = state.cursor.split('-');
    const txt = `${y}年${m}月の家計：収入 ${formatYen(inc)} / 支出 ${formatYen(exp)} / 差引 ${bal >= 0 ? '+' : '-'}${formatYen(Math.abs(bal))}  #かけいちょ`;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  render();
})();
