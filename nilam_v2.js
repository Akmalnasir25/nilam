// NILAM v2 — Main Application Script
'use strict';

let SCRIPT_URL = localStorage.getItem('appsScriptUrl') || "https://script.google.com/macros/s/AKfycbwD6_1wecom-rcjIrClNEilh7Z04Qq8g2iMR84r2EJ7GnD4IClMowQmQdluhIv-gRs4aA/exec";
let students = [], allTransactions = [], activeYearSession = new Date().getFullYear().toString(), editingId = null;
let currentSessionTxs = []; // used by sub-filter listeners

const MONTH_NAMES = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const CHART_COLORS = ['#1d4ed8', '#4338ca', '#ec4899', '#db2777', '#f472b6', '#c084fc', '#818cf8', '#34d399', '#f59e0b', '#3b82f6'];

let monthlyChart, categoryChart, languageChart, classChart, yearChart, starRatingChart;
let yearBreakdownCharts = [];
let compareOverallChart, compareAvgChart, compareYearChart, compareTrendChart;

const byId = id => document.getElementById(id);
const logBox = byId('debugList');
const log = (type, msg, data) => {
  const time = new Date().toLocaleTimeString();
  const row = document.createElement('div');
  row.className = `px-3 py-2 border-b ${type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700'}`;
  row.innerHTML = `<div class="font-semibold">[${time}] ${msg}</div>` + (data ? `<pre class="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">${JSON.stringify(data, null, 2)}</pre>` : '');
  if (logBox && logBox.firstElementChild?.classList.contains('text-slate-500')) logBox.innerHTML = '';
  logBox?.appendChild(row); logBox?.scrollTo({ top: logBox.scrollHeight, behavior: 'smooth' });
};

function showToast(message, isError = false) {
  const toast = byId('toast');
  toast.innerHTML = `<div class="rounded-lg ${isError ? 'bg-rose-600 shadow-rose-600/30' : 'bg-emerald-600 shadow-emerald-600/30'} text-white px-4 py-3 shadow-lg flex items-center gap-3"><span class="font-semibold">${message}</span></div>`;
  toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800);
}

function norm(str) { return (str || '').toString().trim().replace(/\s+/g, ' '); }

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, ''); const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else { if (ch === ',') { row.push(cur.trim()); cur = ''; } else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; } else if (ch === '"') inQ = true; else if (ch !== '\r') cur += ch; }
  }
  if (cur || row.length > 0) { row.push(cur.trim()); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function getStarSVG(count) {
  let r = 0; if (count >= 720) r = 5; else if (count >= 576) r = 4; else if (count >= 432) r = 3; else if (count >= 288) r = 2; else if (count >= 144) r = 1;
  if (!r) return '<span class="text-xs text-slate-400">Tiada Bintang</span>';
  return Array.from({ length: 5 }, (_, i) => `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block ${i < r ? 'text-yellow-400' : 'text-slate-300'}" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`).join('');
}
function getStarText(count) { let r = 0; if (count >= 720) r = 5; else if (count >= 576) r = 4; else if (count >= 432) r = 3; else if (count >= 288) r = 2; else if (count >= 144) r = 1; return r ? `${r} Bintang` : "Tiada Bintang"; }
function getMedalIcon(rank) { if (rank === 1) return '<span>🥇</span>'; if (rank === 2) return '<span>🥈</span>'; if (rank === 3) return '<span>🥉</span>'; return `<span class="text-sm font-semibold text-slate-600">${rank}</span>`; }
function getStarRating(count) { if (count >= 720) return '☆☆☆☆☆'; if (count >= 576) return '☆☆☆☆'; if (count >= 432) return '☆☆☆'; if (count >= 288) return '☆☆'; if (count >= 144) return '☆'; return 'Tiada Bintang'; }

// --- DATA ---
async function fetchData() {
  log('info', 'Fetching data...');
  if (!SCRIPT_URL || SCRIPT_URL === "URL_APPS_SCRIPT_ANDA_DI_SINI") { showToast("Sila masukkan URL Apps Script.", true); return false; }
  try {
    const res = await fetch(`${SCRIPT_URL}?action=readAll`);
    if (!res.ok) throw new Error(res.statusText);
    const result = await res.json();
    if (result.status === 'success') {
      students = result.data.students || [];
      allTransactions = (result.data.records || []).map(tx => ({
        ...tx,
        cat_bukanFiksyen: tx.cat_bukanfiksyen !== undefined ? tx.cat_bukanfiksyen : tx.cat_bukanFiksyen,
        cat_bukanBuku: tx.cat_bukanbuku !== undefined ? tx.cat_bukanbuku : tx.cat_bukanBuku,
        lang_BM: tx.lang_bm !== undefined ? tx.lang_bm : tx.lang_BM,
        lang_BI: tx.lang_bi !== undefined ? tx.lang_bi : tx.lang_BI,
        lang_lain: tx.lang_lain !== undefined ? tx.lang_lain : tx.lang_lain,
        createdAt: tx.createdat !== undefined ? tx.createdat : tx.createdAt
      }));
      allTransactions.forEach(tx => { if (tx.createdAt) tx.createdAtObj = new Date(tx.createdAt); });
      log('success', 'Data fetched.', { students: students.length, records: allTransactions.length });
      byId('syncStatus').textContent = "Online"; byId('syncStatus').className = "px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs";
      return true;
    } else throw new Error(result.message);
  } catch (err) {
    log('error', 'Fetch failed', { message: err.message }); showToast('Gagal memuatkan data.', true);
    byId('syncStatus').textContent = "Gagal"; byId('syncStatus').className = "px-2 py-1 rounded-md bg-rose-100 text-rose-700 text-xs";
    return false;
  }
}

async function postData(action, payload) {
  if (!SCRIPT_URL || SCRIPT_URL === "URL_APPS_SCRIPT_ANDA_DI_SINI") { showToast("Sila masukkan URL.", true); return { status: 'error' }; }
  try {
    const res = await fetch(SCRIPT_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) });
    if (!res.ok) throw new Error(res.statusText);
    const result = await res.json(); if (result.status !== 'success') throw new Error(result.message); return result;
  } catch (err) { log('error', `"${action}" failed`, { message: err.message }); showToast(`Tindakan ${action} gagal.`, true); return { status: 'error', message: err.message }; }
}

// --- TABS ---
const tabs = {
  form: { btn: byId('tabForm'), view: byId('viewForm') },
  summary: { btn: byId('tabSummary'), view: byId('viewSummary') },
  analysis: { btn: byId('tabAnalysis'), view: byId('viewAnalysis') },
  ranking: { btn: byId('tabRanking'), view: byId('viewRanking') },
  compare: { btn: byId('tabCompare'), view: byId('viewCompare') },
  settings: { btn: byId('tabSettings'), view: byId('viewSettings') }
};

function switchTab(key) {
  Object.keys(tabs).forEach(k => { const a = k === key; tabs[k].btn.classList.toggle('tab-active', a); tabs[k].btn.classList.toggle('tab-inactive', !a); tabs[k].view.classList.toggle('hidden', !a); });
  if (key === 'summary') renderSummary();
  if (key === 'analysis') renderAnalysis();
  if (key === 'ranking') renderRankings();
  if (key === 'settings') renderStudentList();
  if (key === 'compare') renderComparison();
}
Object.keys(tabs).forEach(k => tabs[k].btn.addEventListener('click', () => switchTab(k)));

// --- DROPDOWNS ---
function fillCascadingDropdowns() {
  const tahunSel = byId('tahun'), kelasSel = byId('kelas'), namaSel = byId('namaMurid');
  const ns = (a, b) => { const sa = String(a || ''), sb = String(b || ''); const an = sa.match(/\d+/), bn = sb.match(/\d+/); if (an && bn && parseInt(an[0]) !== parseInt(bn[0])) return parseInt(an[0]) - parseInt(bn[0]); return sa.localeCompare(sb); };
  const validSesiTokens = students.filter(s => s.sesi && String(s.sesi).match(/^20\d{2}$/)).map(s => s.sesi);
  const ss = students.filter(s => s.sesi == activeYearSession);
  const tList = [...new Set(ss.map(s => s.tahun))].sort(ns);
  const curT = tahunSel.value;
  tahunSel.innerHTML = ['<option value="">Pilih Tahun</option>', ...tList.map(t => `<option value="${t}">${t}</option>`)].join('');
  if (tList.includes(curT)) tahunSel.value = curT;
  tahunSel.onchange = () => {
    const t = tahunSel.value; const kl = [...new Set(ss.filter(s => s.tahun === t).map(s => s.kelas))].sort(ns);
    kelasSel.innerHTML = ['<option value="">Pilih Kelas</option>', ...kl.map(k => `<option value="${k}">${k}</option>`)].join('');
    kelasSel.disabled = !t; namaSel.innerHTML = '<option value="">Pilih Nama</option>'; namaSel.disabled = true;
  };
  kelasSel.onchange = () => {
    const t = tahunSel.value, k = kelasSel.value; const nl = [...new Set(ss.filter(s => s.tahun === t && s.kelas === k).map(s => s.nama))].sort((a, b) => String(a).localeCompare(String(b)));
    namaSel.innerHTML = ['<option value="">Pilih Nama</option>', ...nl.map(n => `<option value="${n}">${n}</option>`)].join(''); namaSel.disabled = !k;
  };
  tahunSel.dispatchEvent(new Event('change'));
}

// --- FORM ---
const form = byId('rekodForm'), submitBtn = byId('submitBtn'), submitLabel = submitBtn?.querySelector('span');
const defaultText = submitLabel?.getAttribute('data-default') || 'Hantar Rekod';
const loadingText = submitLabel?.getAttribute('data-loading') || 'Menghantar...';
const editingText = submitLabel?.getAttribute('data-editing') || 'Simpan Perubahan';

form.addEventListener('submit', async e => {
  e.preventDefault();
  const nama = byId('namaMurid').value, tahun = norm(byId('tahun').value), kelas = norm(byId('kelas').value), bulan = norm(byId('bulan').value), pages = parseInt(byId('mukaSurat').value || '0', 10);
  const catF = parseInt(byId('countFiksyen').value || '0', 10), catBF = parseInt(byId('countBukanFiksyen').value || '0', 10), catBB = parseInt(byId('countBahan').value || '0', 10);
  const nBM = parseInt(byId('countBM').value || '0', 10), nBI = parseInt(byId('countBI').value || '0', 10), nLL = parseInt(byId('countLain').value || '0', 10);
  if (!nama || !tahun || !kelas || !bulan || !(pages > 0)) return showToast('Sila lengkapkan semua maklumat.', true);
  if (catF + catBF + catBB <= 0) return showToast('Masukkan sekurang-kurangnya 1 bahan.', true);
  if (catF + catBF + catBB !== nBM + nBI + nLL) return showToast('Jumlah kategori dan bahasa mesti sama.', true);
  submitBtn.disabled = true; submitLabel.textContent = loadingText;
  const record = { nama, tahun, kelas, sesi: activeYearSession, bulan, pages, cat: { fiksyen: catF, bukanFiksyen: catBF, bukanBuku: catBB }, lang: { BM: nBM, BI: nBI, lain: nLL } };
  let result;
  if (editingId) { record.id = editingId; result = await postData('updateRecord', record); if (result.status === 'success') showToast('Rekod berjaya dikemas kini!'); }
  else { result = await postData('addRecord', record); if (result.status === 'success') showToast('Rekod berjaya dihantar!'); }
  if (result.status === 'success') { form.reset(); resetFormState(); await fetchData(); renderSummary(); renderAnalysis(); renderRankings(); }
  submitBtn.disabled = false; if (editingId) resetFormState(); submitLabel.textContent = defaultText;
});

byId('clearForm').addEventListener('click', () => { form.reset(); resetFormState(); showToast('Borang dikosongkan.'); });
function resetFormState() { editingId = null; submitLabel.textContent = defaultText; submitBtn.classList.remove('bg-slate-700', 'hover:bg-slate-800'); submitBtn.classList.add('bg-blue-700', 'hover:bg-blue-800'); }
function updateFormForEditing(rec) {
  switchTab('form'); editingId = rec.id; byId('tahun').value = rec.tahun; byId('tahun').dispatchEvent(new Event('change'));
  setTimeout(() => { byId('kelas').value = rec.kelas; byId('kelas').dispatchEvent(new Event('change')); setTimeout(() => { byId('namaMurid').value = rec.nama; }, 50); }, 50);
  byId('bulan').value = rec.bulan; byId('countFiksyen').value = rec.cat_fiksyen; byId('countBukanFiksyen').value = rec.cat_bukanFiksyen; byId('countBahan').value = rec.cat_bukanBuku;
  byId('countBM').value = rec.lang_BM; byId('countBI').value = rec.lang_BI; byId('countLain').value = rec.lang_lain; byId('mukaSurat').value = rec.pages;
  submitLabel.textContent = editingText; submitBtn.classList.remove('bg-blue-700', 'hover:bg-blue-800'); submitBtn.classList.add('bg-slate-700', 'hover:bg-slate-800');
  showToast('Borang diisi untuk penyuntingan.');
}

// --- FILTERS ---
function populateFilters() {
  const ns = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const sesiSet = new Set(allTransactions.map(t => String(t.sesi).match(/^20\d{2}$/) ? String(t.sesi) : null).filter(Boolean));
  const tahunSet = new Set(allTransactions.map(t => t.tahun).filter(Boolean));
  const kelasSet = new Set(allTransactions.map(t => t.kelas).filter(Boolean));
  const sesiOpts = ['<option value="">Semua Sesi</option>', ...Array.from(sesiSet).sort((a, b) => String(b).localeCompare(String(a))).map(s => `<option value="${s}">${s}</option>`)].join('');
  const tahunOpts = ['<option value="">Semua Tahun</option>', ...Array.from(tahunSet).sort(ns).map(t => `<option value="${t}">${t}</option>`)].join('');
  const kelasOpts = ['<option value="">Semua Kelas</option>', ...Array.from(kelasSet).sort(ns).map(k => `<option value="${k}">${k}</option>`)].join('');
  byId('filterSesi').innerHTML = sesiOpts; byId('filterRankingSesi').innerHTML = sesiOpts;
  byId('filterTahun').innerHTML = tahunOpts; byId('filterRankingTahun').innerHTML = tahunOpts;
  byId('filterKelas').innerHTML = kelasOpts; byId('filterRankingKelas').innerHTML = kelasOpts;
}

function calculateStudentAggregates(txs) {
  const m = new Map();
  for (const tx of txs) {
    const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0);
    if (!m.has(tx.nama)) m.set(tx.nama, { totalCount: 0, totalPages: 0, ids: new Set() });
    const s = m.get(tx.nama); s.totalCount += c; s.totalPages += Number(tx.pages) || 0; s.ids.add(tx.id);
  }
  return m;
}

// --- SUMMARY ---
function renderSummary() {
  const main = byId('summaryMainContent'), emptyAll = byId('summaryEmptyAll');
  if (allTransactions.length === 0) { main.classList.add('hidden'); emptyAll.classList.remove('hidden'); return; }
  main.classList.remove('hidden'); emptyAll.classList.add('hidden');
  const tbody = byId('summaryBody'), empty = byId('emptyState'); tbody.innerHTML = '';
  const sF = norm(byId('filterSesi').value), tF = norm(byId('filterTahun').value), kF = norm(byId('filterKelas').value), bF = norm(byId('filterBulan').value), nF = norm(byId('filterNama').value).toLowerCase();
  const filtered = allTransactions.filter(tx => {
    if (tx.bulan == '0') return false; // Sembunyikan rekod baki carry-forward dari jadual
    return (sF ? String(tx.sesi || '').toLowerCase() === sF.toLowerCase() : true) && (tF ? String(tx.tahun || '').toLowerCase() === tF.toLowerCase() : true)
      && (kF ? String(tx.kelas || '').toLowerCase() === kF.toLowerCase() : true) && (bF ? String(tx.bulan) === bF : true) && (nF ? tx.nama.toLowerCase().includes(nF) : true);
  }).sort((a, b) => (b.createdAtObj || 0) - (a.createdAtObj || 0));
  empty.classList.toggle('hidden', filtered.length > 0);
  for (const tx of filtered) {
    const tr = document.createElement('tr'); tr.className = 'hover:bg-slate-50';
    const d = tx.createdAtObj ? tx.createdAtObj.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
    tr.innerHTML = `<td class="px-4 py-3 text-sm">${d}</td><td class="px-4 py-3 font-semibold">${tx.nama}</td><td class="px-4 py-3">${tx.tahun}</td><td class="px-4 py-3">${tx.kelas}</td><td class="px-4 py-3 text-center">${MONTH_NAMES[tx.bulan - 1] || tx.bulan}</td><td class="px-4 py-3 text-center font-semibold">${tx.pages}</td><td class="px-4 py-3 text-center">${tx.cat_fiksyen}</td><td class="px-4 py-3 text-center">${tx.cat_bukanFiksyen}</td><td class="px-4 py-3 text-center">${tx.cat_bukanBuku}</td><td class="px-4 py-3 text-right space-x-2 whitespace-nowrap"><button class="edit-btn p-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200" data-id="${tx.id}">✏️</button><button class="delete-btn p-2 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200" data-id="${tx.id}" data-name="${tx.nama}">🗑️</button></td>`;
    tbody.appendChild(tr);
  }
  document.querySelectorAll('#viewSummary .edit-btn').forEach(b => b.addEventListener('click', e => { const rec = allTransactions.find(r => r.id == e.currentTarget.dataset.id); if (rec) updateFormForEditing(rec); }));
  document.querySelectorAll('#viewSummary .delete-btn').forEach(b => b.addEventListener('click', e => showDeleteConfirmation('nilam', [e.currentTarget.dataset.id], e.currentTarget.dataset.name, 'rekod bacaan ini untuk')));
}
byId('filterSesi').addEventListener('change', renderSummary); byId('filterTahun').addEventListener('change', renderSummary);
byId('filterKelas').addEventListener('change', renderSummary); byId('filterBulan').addEventListener('change', renderSummary);
byId('filterNama').addEventListener('input', renderSummary);
byId('resetFilter').addEventListener('click', () => { ['filterSesi', 'filterTahun', 'filterKelas', 'filterBulan', 'filterNama'].forEach(id => { const el = byId(id); if (el) el.value = ''; }); renderSummary(); });

// --- ANALYSIS SESSION FILTER ---
function populateAnalysisFilter() {
  const sel = byId('analysisSessionFilter');
  const validSesi = allTransactions.map(t => String(t.sesi).match(/^20\d{2}$/) ? String(t.sesi) : null).filter(Boolean);
  const sesiSet = new Set(validSesi);
  sel.innerHTML = [...Array.from(sesiSet).sort((a, b) => String(b).localeCompare(String(a))).map(s => `<option value="${s}">${s}</option>`)].join('');
  if ([...sesiSet].includes(activeYearSession)) sel.value = activeYearSession;
  sel.addEventListener('change', renderAnalysis);
}

// --- ANALYSIS (MAIN) ---
function renderAnalysis() {
  const session = byId('analysisSessionFilter').value;
  document.querySelectorAll('.analysis-session-label').forEach(s => s.textContent = `Sesi ${session}`);
  currentSessionTxs = allTransactions.filter(tx => tx.sesi == session);
  const sessionStudents = students.filter(s => s.sesi == session);
  populateAnalysisSubFilters(currentSessionTxs);
  renderAverageTables(currentSessionTxs, sessionStudents);
  renderYearBreakdownCharts(currentSessionTxs);
  // Main chart data (no monthly — handled by renderFilteredMonthlyChart)
  const cats = { fiksyen: 0, bukanFiksyen: 0, bukanBuku: 0 }, langs = { BM: 0, BI: 0, lain: 0 }, classes = new Map(), years = new Map();
  const starRatings = { 'Tiada Bintang': 0, '☆': 0, '☆☆': 0, '☆☆☆': 0, '☆☆☆☆': 0, '☆☆☆☆☆': 0 };
  const studentTotals = calculateStudentAggregates(allTransactions);
  studentTotals.forEach((d, name) => { const r = getStarRating(d.totalCount); if (starRatings[r] !== undefined) starRatings[r]++; });
  currentSessionTxs.forEach(tx => {
    const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0);
    cats.fiksyen += Number(tx.cat_fiksyen) || 0; cats.bukanFiksyen += Number(tx.cat_bukanFiksyen) || 0; cats.bukanBuku += Number(tx.cat_bukanBuku) || 0;
    langs.BM += Number(tx.lang_BM) || 0; langs.BI += Number(tx.lang_BI) || 0; langs.lain += Number(tx.lang_lain) || 0;
    if (tx.kelas) classes.set(tx.kelas, (classes.get(tx.kelas) || 0) + c);
    if (tx.tahun) years.set(tx.tahun, (years.get(tx.tahun) || 0) + c);
  });
  updateChartsMain({ categories: cats, languages: langs, classes, years, starRatings });
  renderFilteredMonthlyChart(currentSessionTxs);
}

// --- SUB-FILTERS ---
function populateAnalysisSubFilters(txs) {
  const ns = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const tSel = byId('subFilterTahun'), kSel = byId('subFilterKelas');
  const pT = tSel.value, pK = kSel.value;
  const tSet = [...new Set(txs.map(t => t.tahun).filter(Boolean))].sort(ns);
  const kSet = [...new Set(txs.map(t => t.kelas).filter(Boolean))].sort(ns);
  tSel.innerHTML = '<option value="">Semua Tahun</option>' + tSet.map(t => `<option value="${t}">${t}</option>`).join('');
  kSel.innerHTML = '<option value="">Semua Kelas</option>' + kSet.map(k => `<option value="${k}">${k}</option>`).join('');
  if (tSet.includes(pT)) tSel.value = pT; if (kSet.includes(pK)) kSel.value = pK;
}

function renderFilteredMonthlyChart(txs) {
  const tF = byId('subFilterTahun')?.value || '', kF = byId('subFilterKelas')?.value || '';
  const filtered = txs.filter(tx => (tF ? tx.tahun === tF : true) && (kF ? tx.kelas === kF : true));
  const raw = Array(12).fill(0);
  let baseOffset = 0;
  filtered.forEach(tx => {
    const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0);
    if (tx.bulan == '0') { baseOffset += c; return; }
    const i = parseInt(tx.bulan, 10) - 1;
    if (!isNaN(i) && i >= 0 && i < 12) raw[i] += c;
  });
  let c = baseOffset; const cumulData = raw.map(v => { c += v; return c; });
  const label = [tF, kF].filter(Boolean).join(' — ') || 'Semua';
  const subLabel = byId('monthlyChartSubLabel'); if (subLabel) subLabel.textContent = label;
  if (monthlyChart) monthlyChart.destroy();
  Chart.register(ChartDataLabels);
  monthlyChart = new Chart(byId('monthlyChart').getContext('2d'), {
    type: 'line',
    data: { labels: MONTH_NAMES, datasets: [{ label: 'Bacaan Terkumpul', data: cumulData, backgroundColor: 'rgba(29,78,216,0.12)', borderColor: '#1d4ed8', borderWidth: 2.5, pointBackgroundColor: '#1d4ed8', fill: true, tension: 0.35 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 700 }, plugins: { legend: { position: 'bottom', labels: { font: { family: "'Inter',sans-serif" } } }, datalabels: { color: '#1d4ed8', font: { weight: 'bold', size: 10 }, formatter: v => v > 0 ? v : '' }, tooltip: { callbacks: { label: ctx => `Terkumpul: ${ctx.raw} bahan` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { family: "'Inter',sans-serif" } } } } }
  });
}

byId('subFilterTahun')?.addEventListener('change', () => renderFilteredMonthlyChart(currentSessionTxs));
byId('subFilterKelas')?.addEventListener('change', () => renderFilteredMonthlyChart(currentSessionTxs));
byId('resetSubFilters')?.addEventListener('click', () => { if (byId('subFilterTahun')) byId('subFilterTahun').value = ''; if (byId('subFilterKelas')) byId('subFilterKelas').value = ''; renderFilteredMonthlyChart(currentSessionTxs); });

// --- CHARTS MAIN (no monthly) ---
function updateChartsMain(d) {
  if (categoryChart) categoryChart.destroy(); if (languageChart) languageChart.destroy();
  if (classChart) classChart.destroy(); if (yearChart) yearChart.destroy(); if (starRatingChart) starRatingChart.destroy();
  Chart.register(ChartDataLabels);
  const baseOpts = { responsive: true, maintainAspectRatio: false, animation: { duration: 800 }, plugins: { legend: { position: 'bottom', labels: { font: { family: "'Inter',sans-serif" } } }, datalabels: { color: '#fff', font: { weight: 'bold' }, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { family: "'Inter',sans-serif" } } }, x: { ticks: { font: { family: "'Inter',sans-serif" } } } } };
  const hOpts = { ...baseOpts, indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { precision: 0, font: { family: "'Inter',sans-serif" } } }, y: { ticks: { font: { family: "'Inter',sans-serif" } } } } };
  categoryChart = new Chart(byId('categoryChart').getContext('2d'), { type: 'bar', data: { labels: ['Fiksyen', 'Bukan Fiksyen', 'Bukan Buku'], datasets: [{ label: 'Jumlah', data: [d.categories.fiksyen, d.categories.bukanFiksyen, d.categories.bukanBuku], backgroundColor: CHART_COLORS.slice(0, 3) }] }, options: hOpts });
  languageChart = new Chart(byId('languageChart').getContext('2d'), { type: 'bar', data: { labels: ['BM', 'BI', 'Lain-lain'], datasets: [{ label: 'Jumlah', data: [d.languages.BM, d.languages.BI, d.languages.lain], backgroundColor: CHART_COLORS.slice(3, 6) }] }, options: hOpts });
  const cLbls = [...d.classes.keys()].sort(); classChart = new Chart(byId('classChart').getContext('2d'), { type: 'bar', data: { labels: cLbls, datasets: [{ label: 'Jumlah Bahan', data: cLbls.map(l => d.classes.get(l)), backgroundColor: CHART_COLORS }] }, options: baseOpts });
  const yLbls = [...d.years.keys()].sort(); yearChart = new Chart(byId('yearChart').getContext('2d'), { type: 'bar', data: { labels: yLbls, datasets: [{ label: 'Jumlah Bahan', data: yLbls.map(l => d.years.get(l)), backgroundColor: CHART_COLORS }] }, options: baseOpts });
  const sLbls = Object.keys(d.starRatings); starRatingChart = new Chart(byId('starRatingChart').getContext('2d'), { type: 'bar', data: { labels: sLbls, datasets: [{ label: 'Bilangan Pelajar', data: Object.values(d.starRatings), backgroundColor: ['#9ca3af', '#facc15', '#f59e0b', '#d97706', '#ef4444', '#dc2626'] }] }, options: { ...hOpts, plugins: { ...hOpts.plugins, datalabels: { color: '#334155', anchor: 'end', align: 'end', font: { weight: 'bold' }, formatter: v => v > 0 ? v : '' } } } });
}

// --- AVERAGE TABLES ---
function renderAverageTables(txs, sessionStudents) {
  const ns = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const tMap = new Map(), kMap = new Map();
  txs.forEach(tx => {
    const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0);
    if (tx.tahun) { if (!tMap.has(tx.tahun)) tMap.set(tx.tahun, 0); tMap.set(tx.tahun, tMap.get(tx.tahun) + c); }
    if (tx.kelas) { if (!kMap.has(tx.kelas)) kMap.set(tx.kelas, 0); kMap.set(tx.kelas, kMap.get(tx.kelas) + c); }
  });
  const row = (label, sc, total) => `<tr class="hover:bg-slate-50"><td class="px-4 py-2.5 font-medium">${label}</td><td class="px-4 py-2.5 text-center">${sc}</td><td class="px-4 py-2.5 text-center font-semibold text-blue-700">${total}</td><td class="px-4 py-2.5 text-center font-semibold text-slate-700">${sc > 0 ? (total / sc).toFixed(1) : '–'}</td></tr>`;
  const tBody = byId('avgTahunBody'); if (tBody) { tBody.innerHTML = [...tMap.keys()].sort(ns).map(t => row(t, sessionStudents.filter(s => s.tahun === t).length, tMap.get(t))).join(''); }
  const kBody = byId('avgKelasBody'); if (kBody) { kBody.innerHTML = [...kMap.keys()].sort(ns).map(k => row(k, sessionStudents.filter(s => s.kelas === k).length, kMap.get(k))).join(''); }
}

// --- YEAR BREAKDOWN CHARTS ---
function renderYearBreakdownCharts(txs) {
  yearBreakdownCharts.forEach(c => c && c.destroy()); yearBreakdownCharts = [];
  const container = byId('yearBreakdownContainer'); if (!container) return; container.innerHTML = '';
  const YEARS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']; let hasAny = false;
  YEARS.forEach((tahun, i) => {
    const tTxs = txs.filter(tx => tx.tahun === tahun); if (!tTxs.length) return; hasAny = true;
    const kM = new Map(); tTxs.forEach(tx => { if (!tx.kelas) return; const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0); kM.set(tx.kelas, (kM.get(tx.kelas) || 0) + c); });
    const kL = [...kM.keys()].sort(), kD = kL.map(k => kM.get(k));
    const card = document.createElement('div'); card.className = 'glass p-4 rounded-lg shadow border border-slate-200';
    const cid = `ybc_${i}`; card.innerHTML = `<h5 class="font-semibold text-sm mb-3 text-slate-700">${tahun} — Bacaan Per Kelas</h5><div style="height:180px"><canvas id="${cid}"></canvas></div>`;
    container.appendChild(card); Chart.register(ChartDataLabels);
    const ch = new Chart(document.getElementById(cid).getContext('2d'), { type: 'bar', data: { labels: kL, datasets: [{ label: 'Bacaan', data: kD, backgroundColor: CHART_COLORS }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#fff', font: { weight: 'bold', size: 10 }, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { family: "'Inter',sans-serif" } } } } } });
    yearBreakdownCharts.push(ch);
  });
  const emp = byId('yearBreakdownEmpty'); if (emp) emp.classList.toggle('hidden', hasAny);
}

// --- RANKINGS ---
function renderRankings() {
  const tbody = byId('overallRankingBody'), empty = byId('overallRankingEmpty'); tbody.innerHTML = '';
  const sF = byId('filterRankingSesi').value, tF = byId('filterRankingTahun').value, kF = byId('filterRankingKelas').value, nF = byId('filterRankingNama').value.toLowerCase().trim();

  // Jika 'Semua Sesi' dipilih, kira guna rekod sebenar (bukan 0). Jika Sesi spesifik diletakkan, masukkan bulan 0 (carry-forward) untuk sesi itu sahaja.
  const rankingTxs = allTransactions.filter(tx => sF ? tx.sesi == sF : tx.bulan != '0');
  const agg = calculateStudentAggregates(rankingTxs);
  const det = new Map(); students.forEach(s => { if (String(s.sesi).match(/^20\d{2}$/)) { if (!det.has(s.nama) || s.sesi >= (det.get(s.nama).sesi || 0)) det.set(s.nama, { kelas: s.kelas, sesi: s.sesi, tahun: s.tahun }); } });
  let list = Array.from(agg.entries()).map(([name, d]) => ({ name, ...d, details: det.get(name) || { kelas: 'N/A', tahun: 'N/A', sesi: '' } })).sort((a, b) => b.totalCount - a.totalCount);

  if (sF || kF || nF || tF) { list = list.filter(s => { const si = students.find(st => String(st.nama).trim().toLowerCase() === String(s.name).trim().toLowerCase() && String(st.sesi) === String(sF || s.details.sesi)); return (nF ? s.name.toLowerCase().includes(nF) : true) && (sF ? si : true) && (tF ? si && String(si.tahun) === String(tF) : true) && (kF ? si && String(si.kelas).trim().toLowerCase() === String(kF).trim().toLowerCase() : true); }); }
  empty.classList.toggle('hidden', list.length > 0);
  list.forEach((s, i) => { const tr = document.createElement('tr'); tr.className = `hover:bg-slate-50 ${i < 3 ? 'font-bold' : ''}`; tr.innerHTML = `<td class="px-4 py-3 text-center" data-pdf-text="${i + 1}">${getMedalIcon(i + 1)}</td><td class="px-4 py-3">${s.name}</td><td class="px-4 py-3">${s.details.tahun}</td><td class="px-4 py-3">${s.details.kelas} (${s.details.sesi})</td><td class="px-4 py-3 font-semibold">${s.totalCount}</td><td class="px-4 py-3" data-pdf-text="${getStarText(s.totalCount)}">${getStarSVG(s.totalCount)}</td>`; tbody.appendChild(tr); });
}
byId('filterRankingSesi').addEventListener('change', renderRankings); byId('filterRankingTahun').addEventListener('change', renderRankings);
byId('filterRankingKelas').addEventListener('change', renderRankings); byId('filterRankingNama').addEventListener('input', renderRankings);
byId('resetRankingFilter').addEventListener('click', () => { ['filterRankingSesi', 'filterRankingTahun', 'filterRankingKelas', 'filterRankingNama'].forEach(id => { const el = byId(id); if (el) el.value = ''; }); renderRankings(); });

// --- SESSION YEAR ---
function initializeYearSession() {
  const sel = byId('activeYearSession'); const cur = new Date().getFullYear(); let saved = localStorage.getItem('activeYearSession') || cur.toString();
  const years = []; for (let y = 2024; y <= 2030; y++)years.push(y); if (!years.includes(parseInt(saved))) { years.push(parseInt(saved)); years.sort((a, b) => a - b); }
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = years.includes(parseInt(saved)) ? saved : cur.toString(); activeYearSession = sel.value; updateSessionDisplays(activeYearSession);
  sel.addEventListener('change', e => { activeYearSession = e.target.value; localStorage.setItem('activeYearSession', activeYearSession); updateSessionDisplays(activeYearSession); fillCascadingDropdowns(); renderStudentList(); });
}
function updateSessionDisplays(y) { byId('currentSessionYear').textContent = y; byId('csvSessionYear').textContent = y; byId('studentListSessionYear').textContent = y; byId('deleteAllStudentsSessionYear').textContent = y; }

// --- STUDENT LIST ---
function renderStudentList() {
  const tbody = byId('studentListBody'), empty = byId('studentListEmpty');
  const ss = students.filter(s => s.sesi == activeYearSession); populateStudentFilters(ss);
  const yF = byId('filterStudentYear').value, cF = byId('filterStudentClass').value, nF = byId('filterStudentName').value.toLowerCase().trim();
  const filtered = ss.filter(s => (yF ? s.tahun === yF : true) && (cF ? s.kelas === cF : true) && (nF ? s.nama.toLowerCase().includes(nF) : true)).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  tbody.innerHTML = ''; empty.classList.toggle('hidden', filtered.length > 0);
  filtered.forEach((s, i) => { const tr = document.createElement('tr'); tr.className = 'hover:bg-slate-50'; tr.innerHTML = `<td class="px-4 py-3 text-slate-500">${i + 1}.</td><td class="px-4 py-3 font-semibold">${s.nama}</td><td class="px-4 py-3">${s.tahun}</td><td class="px-4 py-3">${s.kelas}</td><td class="px-4 py-3 text-right space-x-2 whitespace-nowrap"><button class="student-edit-btn p-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200" data-id="${s.id}">✏️</button><button class="student-delete-btn p-2 rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200" data-id="${s.id}" data-name="${s.nama}">🗑️</button></td>`; tbody.appendChild(tr); });
  document.querySelectorAll('.student-edit-btn').forEach(b => b.addEventListener('click', e => { const s = students.find(st => st.id == e.currentTarget.dataset.id); if (s) { byId('editStudentId').value = s.id; byId('editStudentName').value = s.nama; byId('editStudentYear').value = s.tahun; byId('editStudentClass').value = s.kelas; byId('editStudentModal').style.display = 'flex'; } }));
  document.querySelectorAll('.student-delete-btn').forEach(b => b.addEventListener('click', e => showDeleteConfirmation('student', [e.currentTarget.dataset.id], e.currentTarget.dataset.name, 'murid ini. Semua rekod bacaannya juga akan dipadam')));
}
function populateStudentFilters(ss) {
  const ns = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const yF = byId('filterStudentYear'), cF = byId('filterStudentClass'), pY = yF.value, pC = cF.value;
  yF.innerHTML = '<option value="">Semua Tahun</option>' + [...new Set(ss.map(s => s.tahun))].sort(ns).map(y => `<option value="${y}">${y}</option>`).join('');
  cF.innerHTML = '<option value="">Semua Kelas</option>' + [...new Set(ss.map(s => s.kelas))].sort(ns).map(c => `<option value="${c}">${c}</option>`).join('');
  yF.value = pY; cF.value = pC;
}
byId('filterStudentYear').addEventListener('change', renderStudentList); byId('filterStudentClass').addEventListener('change', renderStudentList);
byId('filterStudentName').addEventListener('input', renderStudentList);
byId('resetStudentFilters').addEventListener('click', () => { ['filterStudentYear', 'filterStudentClass', 'filterStudentName'].forEach(id => { const el = byId(id); if (el) el.value = ''; }); renderStudentList(); });
byId('editStudentForm').addEventListener('submit', async e => { e.preventDefault(); const id = byId('editStudentId').value; const s = students.find(st => st.id == id); const res = await postData('updateStudent', { id, sesi: s.sesi, nama: byId('editStudentName').value, tahun: byId('editStudentYear').value, kelas: byId('editStudentClass').value }); if (res.status === 'success') { showToast('Data murid dikemas kini.'); byId('editStudentModal').style.display = 'none'; await fetchData(); renderStudentList(); } });
byId('editStudentCancelBtn').addEventListener('click', () => { byId('editStudentModal').style.display = 'none'; });

// --- CSV UPLOAD ---
byId('uploadCsvBtn').addEventListener('click', async () => {
  const fi = byId('csvUploader'), st = byId('uploadStatus'); if (!fi.files.length) return showToast('Sila pilih fail CSV dahulu.', true);
  const file = fi.files[0]; st.textContent = `Memproses: ${file.name}...`;
  const reader = new FileReader(); reader.onload = async ev => {
    try {
      const matrix = parseCSV(ev.target.result); if (matrix.length < 2) throw new Error('CSV tidak sah.');
      const hdr = matrix.shift().map(h => String(h).trim().toLowerCase());
      const fi2 = (hdrs, names) => { for (const n of names) { const i = hdrs.indexOf(n); if (i > -1) return i; } return -1; };
      const iT = fi2(hdr, ['tahun', 'year']), iK = fi2(hdr, ['kelas terkini', 'kelas terkni', 'kelas', 'class']), iN = fi2(hdr, ['nama', 'name', 'nama murid']);
      if (iT < 0 || iK < 0 || iN < 0) throw new Error('Lajur "tahun", "kelas" dan "nama" diperlukan.');
      const ns2 = matrix.map(r => { let t = (r[iT] || '').toString().trim(); if (/^\d+$/.test(t)) t = `D${t}`; return { sesi: activeYearSession, tahun: t, kelas: (r[iK] || '').toString().trim().toUpperCase(), nama: norm((r[iN] || '').toString()) }; }).filter(s => s.tahun && s.kelas && s.nama);
      if (!ns2.length) throw new Error('Tiada data murid sah ditemui.');
      st.textContent = 'Menyimpan...'; const res = await postData('uploadStudents', { students: ns2 });
      if (res.status === 'success') { st.textContent = `${ns2.length} rekod berjaya dimuat naik.`; showToast('Data murid disimpan!'); fi.value = ''; await fetchData(); renderStudentList(); }
      else st.textContent = `Ralat: ${res.message}`;
    } catch (err) { log('error', 'CSV gagal', { message: err.message }); showToast(err.message, true); st.textContent = `Ralat: ${err.message}`; }
  };
  reader.readAsText(file);
});

// --- DELETE CONFIRMATION ---
function showDeleteConfirmation(type, ids, name, ctx) {
  const modal = byId('confirmationModal');
  byId('modalTitle').textContent = type === 'student' ? 'Padam Murid' : type === 'session-students' ? 'Padam Senarai Murid' : 'Padam Rekod';
  byId('modalMessage').textContent = type === 'session-students' ? `Padam ${ctx}? Rekod bacaan NILAM tidak akan dipadam.` : `Padam ${ctx} "${name}"? Tindakan ini tidak boleh diundurkan.`;
  modal.style.display = 'flex';
  byId('modalConfirmBtn').onclick = async () => {
    modal.style.display = 'none'; let res;
    if (type === 'student') res = await postData('deleteStudent', { id: ids[0], name });
    else if (type === 'nilam') res = await postData('deleteNilamRecords', { ids });
    else if (type === 'session-students') res = await postData('deleteAllSessionStudents', { sessionYear: ids[0] });
    else if (type === 'all-nilam') res = await postData('deleteAllNilam', {});
    if (res && res.status === 'success') { showToast('Data berjaya dipadam.'); await fetchData(); if (type === 'student' || type === 'session-students') renderStudentList(); renderSummary(); renderAnalysis(); renderRankings(); }
  };
  byId('modalCancelBtn').onclick = () => { modal.style.display = 'none'; };
}

// --- CARRY-FORWARD ---
function initCarryForwardPanel() {
  const fromSel = byId('cfFromSesi'), toSel = byId('cfToSesi'); if (!fromSel || !toSel) return;
  const validSesi = students.map(s => String(s.sesi).match(/^20\d{2}$/) ? String(s.sesi) : null).filter(Boolean);
  const sesiSet = [...new Set(validSesi)].sort((a, b) => String(b).localeCompare(String(a)));
  fromSel.innerHTML = sesiSet.length ? sesiSet.map(s => `<option value="${s}">${s}</option>`).join('') : '<option value="">Tiada sesi</option>';
  const cur = new Date().getFullYear(); const yrs = []; for (let y = 2024; y <= 2033; y++)yrs.push(y);
  toSel.innerHTML = yrs.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}</option>`).join('');
  byId('cfPreviewBtn').onclick = () => { const f = fromSel.value, t = toSel.value; if (!f || !t || f === t) return showToast('Pilih sesi yang berbeza.', true); generateMigrationPreview(f, t); };
  byId('cfExecuteBtn').onclick = () => {
    const rows = document.querySelectorAll('#cfPreviewBody tr'); if (!rows.length) return showToast('Jana pratonton dahulu.', true);
    const mapped = []; rows.forEach(r => { const n = r.dataset.nama, tB = r.dataset.tahunBaru, k = r.querySelector('.cf-kelas-input')?.value || ''; if (n && tB && k) mapped.push({ nama: n, tahun: tB, kelas: k }); });
    showCfConfirmModal(fromSel.value, toSel.value, mapped);
  };
}
function generateMigrationPreview(fromSesi, toSesi) {
  const TO = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
  const up = t => { const i = TO.indexOf(t); if (i >= 0 && i < 5) return TO[i + 1]; const m = String(t || '').match(/D(\d+)/); return m ? `D${parseInt(m[1]) + 1}` : t; };
  const fromS = students.filter(s => s.sesi == fromSesi);
  const eligible = fromS.filter(s => TO.indexOf(s.tahun) < 5);
  const excluded = fromS.filter(s => TO.indexOf(s.tahun) === 5);
  const totals = new Map(); allTransactions.filter(tx => tx.sesi == fromSesi).forEach(tx => { const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0); totals.set(tx.nama, (totals.get(tx.nama) || 0) + c); });
  const body = byId('cfPreviewBody'); if (!body) return;
  body.innerHTML = eligible.sort((a, b) => String(a.nama).localeCompare(String(b.nama))).map((s, i) => `<tr data-nama="${s.nama}" data-tahun-baru="${up(s.tahun)}"><td class="px-3 py-2 text-sm text-slate-500">${i + 1}</td><td class="px-3 py-2 text-sm font-medium">${s.nama}</td><td class="px-3 py-2 text-sm text-slate-600">${s.tahun} → ${up(s.tahun)}</td><td class="px-3 py-2 text-sm text-center font-semibold text-blue-700">${totals.get(s.nama) || 0}</td><td class="px-3 py-2"><input type="text" class="cf-kelas-input w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white" value="${s.kelas}"></td></tr>`).join('');
  const info = byId('cfPreviewInfo'); if (info) info.innerHTML = `<span class="text-emerald-700">${eligible.length} murid layak → Sesi ${toSesi}.</span>${excluded.length ? ` <span class="text-amber-600 font-semibold">${excluded.length} murid D6 dikecualikan.</span>` : ''}`;
  byId('cfPreviewSection').classList.remove('hidden'); byId('cfExecuteBtn').disabled = eligible.length === 0;
}
function showCfConfirmModal(fromSesi, toSesi, mapped) {
  const modal = byId('confirmationModal');
  const btn = byId('modalConfirmBtn');
  const oTxt = btn.textContent;
  const oCls = btn.className;

  byId('modalTitle').textContent = 'Sahkan Migrasi Sesi';
  byId('modalMessage').textContent = `Salin ${mapped.length} murid dari sesi ${fromSesi} ke ${toSesi}? Rekod baki terkumpul akan disimpan. Tindakan tidak boleh diundurkan.`;

  btn.textContent = 'Jalankan';
  btn.className = 'px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold';

  modal.style.display = 'flex';

  btn.onclick = async () => {
    modal.style.display = 'none';
    btn.textContent = oTxt; btn.className = oCls;
    await executeCarryForward(fromSesi, toSesi, mapped);
  };
  byId('modalCancelBtn').onclick = () => {
    modal.style.display = 'none';
    btn.textContent = oTxt; btn.className = oCls;
  };
}
async function executeCarryForward(fromSesi, toSesi, mapped) {
  showToast('Menjalankan migrasi...');
  const records = mapped.map(s => {
    const p = [...allTransactions].filter(tx => tx.sesi == fromSesi && tx.nama === s.nama);
    const sumPages = p.reduce((sum, tx) => sum + (Number(tx.pages) || 0), 0);
    const sumF = p.reduce((sum, tx) => sum + (Number(tx.cat_fiksyen) || 0), 0);
    const sumBF = p.reduce((sum, tx) => sum + (Number(tx.cat_bukanFiksyen) || 0), 0);
    const sumBB = p.reduce((sum, tx) => sum + (Number(tx.cat_bukanBuku) || 0), 0);
    const sumBM = p.reduce((sum, tx) => sum + (Number(tx.lang_BM) || 0), 0);
    const sumBI = p.reduce((sum, tx) => sum + (Number(tx.lang_BI) || 0), 0);
    const sumLain = p.reduce((sum, tx) => sum + (Number(tx.lang_lain) || 0), 0);
    return { nama: s.nama, tahun: s.tahun, kelas: s.kelas, sesi: toSesi, bulan: '0', pages: sumPages, cat: { fiksyen: sumF, bukanFiksyen: sumBF, bukanBuku: sumBB }, lang: { BM: sumBM, BI: sumBI, lain: sumLain } };
  });
  const res = await postData('carryForwardSession', { students: mapped.map(s => ({ ...s, sesi: toSesi })), records });
  if (res.status === 'success') {
    showToast(`Migrasi berjaya! ${mapped.length} murid disalin ke ${toSesi}.`);
    await fetchData();
    const sel = byId('activeYearSession');
    if (sel) { sel.value = toSesi; sel.dispatchEvent(new Event('change')); } else { renderStudentList(); }
    byId('cfPreviewSection').classList.add('hidden');
  } else {
    alert(`MIGRASI GAGAL:\n${res.message || 'Ralat pelayan.'}\n\nSila tekan butang 'Lihat Log' di penjuru bawah kanan.`);
  }
}

// --- COMPARISON TAB ---
function renderComparison() {
  const allSessions = [...new Set(allTransactions.map(tx => tx.sesi).filter(Boolean))].sort((a, b) => String(b).localeCompare(String(a)));
  const container = byId('compareSessionCheckboxes'), empty = byId('compareEmpty'); if (!container) return;
  if (!allSessions.length) { container.innerHTML = '<p class="text-slate-500 text-sm">Tiada data sesi.</p>'; empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');
  const existing = new Set([...container.querySelectorAll('input:checked')].map(el => el.value));
  container.innerHTML = allSessions.map((s, i) => `<label class="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border ${i < 2 || existing.has(s) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} hover:border-blue-400 transition"><input type="checkbox" value="${s}" ${i < 2 || existing.has(s) ? 'checked' : ''} class="compare-cb"><span class="font-semibold text-sm">${s}</span></label>`).join('');
  const redraw = () => { const sel = [...container.querySelectorAll('.compare-cb:checked')].map(el => el.value); updateCompareCharts(sel); };
  container.querySelectorAll('.compare-cb').forEach(cb => cb.addEventListener('change', redraw)); redraw();
}
function updateCompareCharts(sel) {
  [compareOverallChart, compareAvgChart, compareYearChart, compareTrendChart].forEach(c => c && c.destroy()); if (!sel.length) return;
  const C = ['#1d4ed8', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  const YEARS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
  const sumTx = txs => txs.reduce((s, tx) => s + (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0), 0);
  const bO = { responsive: true, maintainAspectRatio: false, animation: { duration: 700 }, plugins: { legend: { position: 'bottom', labels: { font: { family: "'Inter',sans-serif" } } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 10 }, formatter: v => v > 0 ? v : '' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { family: "'Inter',sans-serif" } } } } };
  Chart.register(ChartDataLabels);
  compareOverallChart = new Chart(byId('compareOverallChart').getContext('2d'), { type: 'bar', data: { labels: sel, datasets: [{ label: 'Jumlah Bacaan', data: sel.map(s => sumTx(allTransactions.filter(tx => tx.sesi == s))), backgroundColor: C }] }, options: bO });
  compareAvgChart = new Chart(byId('compareAvgChart').getContext('2d'), { type: 'bar', data: { labels: sel, datasets: [{ label: 'Purata Per Murid', data: sel.map(s => { const sc = students.filter(st => st.sesi == s).length; const t = sumTx(allTransactions.filter(tx => tx.sesi == s)); return sc > 0 ? parseFloat((t / sc).toFixed(1)) : 0; }), backgroundColor: C }] }, options: { ...bO, plugins: { ...bO.plugins, datalabels: { ...bO.plugins.datalabels, formatter: v => v > 0 ? v.toFixed(1) : '' } } } });
  compareYearChart = new Chart(byId('compareYearChart').getContext('2d'), { type: 'bar', data: { labels: YEARS, datasets: sel.map((s, i) => ({ label: `Sesi ${s}`, data: YEARS.map(t => sumTx(allTransactions.filter(tx => tx.sesi == s && tx.tahun === t))), backgroundColor: C[i % C.length] })) }, options: bO });
  compareTrendChart = new Chart(byId('compareTrendChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: MONTH_NAMES, datasets: sel.map((s, i) => {
        const raw = Array(12).fill(0); let baseOffset = 0;
        allTransactions.filter(tx => tx.sesi == s).forEach(tx => {
          const c = (Number(tx.cat_fiksyen) || 0) + (Number(tx.cat_bukanFiksyen) || 0) + (Number(tx.cat_bukanBuku) || 0);
          if (tx.bulan == '0') { baseOffset += c; return; }
          const idx = parseInt(tx.bulan, 10) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < 12) raw[idx] += c;
        });
        let c2 = baseOffset; return { label: `Sesi ${s}`, data: raw.map(v => { c2 += v; return c2; }), borderColor: C[i % C.length], backgroundColor: C[i % C.length] + '20', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 4 };
      })
    },
    options: { ...bO, plugins: { ...bO.plugins, datalabels: { display: false } } }
  });
}

// --- PDF ---
async function handleDownloadPDF(elementId, fileName, button) {
  const orig = button.innerText; button.innerText = 'Menjana PDF...'; button.disabled = true;
  try {
    const el = document.getElementById(elementId), tbl = el.querySelector('table');
    if (tbl) {
      const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217); doc.text('Laporan Sistem Rekod Bacaan NILAM', 14, 20); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text('Tarikh: ' + new Date().toLocaleDateString('ms-MY'), 14, 27);
      const hdrs = []; const hRow = tbl.querySelector('thead tr'); if (hRow) { const hd = []; hRow.querySelectorAll('th').forEach(th => { if (th.innerText.trim() !== 'Tindakan') hd.push(th.innerText.trim()); }); hdrs.push(hd); }
      const body = []; tbl.querySelectorAll('tbody tr').forEach(tr => { if (tr.style.display !== 'none') { const rd = []; tr.querySelectorAll('td').forEach((td, i) => { if (i < hdrs[0].length) rd.push(td.getAttribute('data-pdf-text') || td.innerText.trim()); }); body.push(rd); } });
      doc.autoTable({ head: hdrs, body, startY: 32, theme: 'grid', headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 9, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 243, 255] }, margin: { top: 30 } }); doc.save(fileName);
    } else { const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, logging: false }); const img = canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const w = 210, h = (canvas.height * w) / canvas.width; const pdf = new jsPDF('p', 'mm', [w, h]); pdf.addImage(img, 'PNG', 0, 0, w, h); pdf.save(fileName); }
  } catch (err) { console.error(err); showToast('Gagal menjana PDF.', true); } finally { button.innerText = orig; button.disabled = false; }
}

// --- SETUP ACTION BUTTONS ---
function setupActionButtons() {
  byId('printSummaryBtn').addEventListener('click', () => window.print());
  byId('downloadPdfSummaryBtn').addEventListener('click', e => handleDownloadPDF('summaryContent', 'Rumusan_NILAM.pdf', e.currentTarget));
  byId('printAnalysisBtn').addEventListener('click', () => window.print());
  byId('downloadPdfAnalysisBtn').addEventListener('click', e => handleDownloadPDF('analysisContent', 'Analisis_NILAM.pdf', e.currentTarget));
  byId('printRankingBtn').addEventListener('click', () => window.print());
  byId('downloadPdfRankingBtn').addEventListener('click', e => handleDownloadPDF('rankingContent', 'Ranking_NILAM.pdf', e.currentTarget));
  byId('toggleUrlUpdateBtn').addEventListener('click', () => byId('urlUpdateContainer').classList.toggle('hidden'));
  byId('saveUrlBtn').addEventListener('click', () => { const u = byId('appsScriptUrlInput').value.trim(); if (u && u.startsWith('https://script.google.com/macros/s/')) { localStorage.setItem('appsScriptUrl', u); SCRIPT_URL = u; showToast('URL disimpan. Muat semula halaman.'); } else showToast('URL tidak sah.', true); });
  byId('deleteAllStudentsBtn').addEventListener('click', () => { const c = students.filter(s => s.sesi == activeYearSession).length; if (!c) return showToast('Tiada murid untuk dipadam.', true); showDeleteConfirmation('session-students', [activeYearSession], '', `${c} murid sesi ${activeYearSession}`); });
  byId('deleteAllNilamBtn').addEventListener('click', () => { if (!allTransactions.length) return showToast('Tiada rekod untuk dipadam.', true); showDeleteConfirmation('all-nilam', [], `SEMUA ${allTransactions.length} rekod`, 'semua rekod NILAM dari semua sesi'); });
}

// Debug
byId('debugToggle').addEventListener('click', () => byId('debugPanel').classList.toggle('hidden'));
byId('debugClose').addEventListener('click', () => byId('debugPanel').classList.add('hidden'));
byId('debugClear').addEventListener('click', () => { logBox.innerHTML = '<div class="px-3 py-2 text-slate-500">Tiada log lagi.</div>'; });

// --- INIT ---
async function initializeApp() {
  byId('appsScriptUrlInput').value = SCRIPT_URL; initializeYearSession();
  const ok = await fetchData();
  if (ok) {
    let ss = students.filter(s => s.sesi == activeYearSession);
    if (!ss.length && students.length > 0) { const latest = [...new Set(students.map(s => s.sesi))].sort((a, b) => String(b).localeCompare(String(a)))[0]; if (latest) { activeYearSession = latest; const sel = byId('activeYearSession'); if (sel) sel.value = latest; localStorage.setItem('activeYearSession', latest); updateSessionDisplays(latest); } }
    byId('studentDataLoading').classList.add('hidden'); byId('rekodForm').classList.remove('hidden');
    fillCascadingDropdowns(); renderSummary(); populateFilters(); populateAnalysisFilter(); renderAnalysis(); initCarryForwardPanel();
  }
  setupActionButtons();
}
initializeApp();
