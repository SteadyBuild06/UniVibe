/* =============================================================
   UNIVIBE — QUICK REPORT FEATURE  |  univibe-quickreport-backend.js
   
   HOW TO USE:
   Replace the entire <script> block in your index.html with
   this file's contents, OR add before </body>:
     <script src="univibe-quickreport-backend.js"></script>

   This file wires up:
     ✅ Quick Report form  — validation, localStorage, live feed
   (Other features will be added in future files)
================================================================ */


/* ============================================================
   SECTION 1 — UTILITIES
============================================================ */

const STORAGE_KEY = 'univibe_reports';

/** Load all saved reports from localStorage. Always returns an array. */
function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Persist the full reports array to localStorage. */
function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/** Sanitise user text to prevent XSS when injecting into innerHTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format an ISO timestamp into a readable string e.g. "21 Apr 2025, 03:45 PM" */
function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

/* ============================================================
   SECTION 2 — TOAST  (enhances the existing #toast element)
============================================================ */

/**
 * showToast(msg, type)
 * @param {string} msg   — message to display
 * @param {'success'|'error'|'info'} type — controls colour
 *
 * Works with the existing #toast div in index.html.
 * Adds temporary colour classes; falls back to green (default).
 */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Colour overrides keyed to your CSS variables
  const colours = {
    success: 'var(--accent3)',   // green
    error:   'var(--accent2)',   // pink/red
    info:    'var(--accent)',    // purple
  };
  toast.style.background = colours[type] || colours.success;
  toast.style.color = type === 'success' ? '#0f1117' : '#fff';

  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}


/* ============================================================
   SECTION 3 — RECENT REPORTS FEED
   Dynamically injected below the form inside #report section.
============================================================ */

/**
 * Inject the "Recent Reports" container HTML right after the
 * <form> inside the #report section (only once on page load).
 */
function injectReportFeedContainer() {
  const reportSection = document.getElementById('report');
  if (!reportSection || document.getElementById('report-feed-wrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'report-feed-wrap';
  wrap.style.marginTop = '1.75rem';
  wrap.style.borderTop = '1px solid var(--border)';
  wrap.style.paddingTop = '1.25rem';

  wrap.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
      <h3 style="font-family:var(--font-head); font-size:0.95rem; font-weight:700; color:var(--text);">
        🗂️ Recent Reports
      </h3>
      <span id="report-feed-count"
        style="font-size:0.72rem; font-weight:600; color:var(--accent);
               background:rgba(108,99,255,0.12); border:1px solid rgba(108,99,255,0.3);
               padding:2px 10px; border-radius:999px; letter-spacing:0.06em;">
        0 filed
      </span>
    </div>

    <!-- Empty state -->
    <div id="report-feed-empty"
      style="text-align:center; padding:2rem 1rem; color:var(--muted); font-size:0.85rem;">
      <div style="font-size:1.8rem; margin-bottom:0.5rem;">📭</div>
      No reports yet. Submit one above!
    </div>

    <!-- Report cards list -->
    <div id="report-feed-list"
      style="display:flex; flex-direction:column; gap:0.75rem; max-height:320px; overflow-y:auto;">
    </div>
  `;

  reportSection.appendChild(wrap);
}

/**
 * Category → colour mapping matching index.html's tag classes.
 * Returns inline-style colour strings.
 */
const CATEGORY_COLOURS = {
  'Broken Furniture':        { bg: 'rgba(255,101,132,0.12)', color: 'var(--accent2)' },
  'Electricity / Power Issue':{ bg: 'rgba(255,213,79,0.12)',  color: '#ffd54f'        },
  'Water / Plumbing':        { bg: 'rgba(56,189,248,0.12)',  color: '#38bdf8'        },
  'Internet / Wi-Fi':        { bg: 'rgba(108,99,255,0.12)',  color: 'var(--accent)'  },
  'Cleanliness':             { bg: 'rgba(67,233,123,0.12)',  color: 'var(--accent3)' },
  'Other':                   { bg: 'rgba(255,255,255,0.07)', color: 'var(--muted)'   },
};

/**
 * Build and return one report card DOM element.
 * Matches index.html's .notice-card visual language.
 */
function buildReportCard(report) {
  const colours = CATEGORY_COLOURS[report.category] || CATEGORY_COLOURS['Other'];

  const card = document.createElement('div');
  // Reuse .notice-card styles already defined in index.html
  card.className = 'notice-card';
  card.style.animation = 'reportCardIn 0.3s ease both';
  card.innerHTML = `
    <span class="notice-tag"
      style="background:${colours.bg}; color:${colours.color};
             white-space:nowrap; border-radius:6px;">
      ${escapeHtml(report.category)}
    </span>
    <div class="notice-body" style="flex:1;">
      <strong>${escapeHtml(report.title)}</strong>
      <span style="display:block; margin-top:3px; font-size:0.82rem; color:var(--muted); line-height:1.5;">
        ${escapeHtml(report.description)}
      </span>
      <span style="display:block; margin-top:6px; font-size:0.75rem; color:var(--muted); opacity:0.7;">
        👤 ${escapeHtml(report.name)}
        ${report.email ? ' &nbsp;·&nbsp; ✉️ ' + escapeHtml(report.email) : ''}
        &nbsp;·&nbsp; 🕐 ${formatTimestamp(report.timestamp)}
      </span>
    </div>
  `;
  return card;
}

/**
 * renderReportFeed()
 * Reads localStorage and re-renders the entire recent-reports list.
 * Called after every new submission and once on page load.
 */
function renderReportFeed() {
  const list      = document.getElementById('report-feed-list');
  const empty     = document.getElementById('report-feed-empty');
  const countBadge = document.getElementById('report-feed-count');

  if (!list) return; // feed container not injected yet

  const reports = loadReports();
  list.innerHTML = '';
  countBadge.textContent = `${reports.length} filed`;

  if (reports.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  // Show newest first
  [...reports].reverse().forEach(r => list.appendChild(buildReportCard(r)));
}


/* ============================================================
   SECTION 4 — FORM VALIDATION & SUBMISSION
   Replaces the stub submitReport() in index.html.
============================================================ */

/**
 * validateReportForm()
 * Returns { valid: bool, data: object|null, errorMsg: string }
 * Reads directly from the form fields defined in index.html.
 */
function validateReportForm() {
  const name     = document.getElementById('studentName')?.value.trim();
  const email    = document.getElementById('studentEmail')?.value.trim();
  const category = document.getElementById('issueType')?.value;
  const desc     = document.getElementById('issueDesc')?.value.trim();

  if (!name)     return { valid: false, errorMsg: '⚠️ Please enter your name.' };
  if (!category) return { valid: false, errorMsg: '⚠️ Please select an issue category.' };
  if (!desc)     return { valid: false, errorMsg: '⚠️ Please describe the issue.' };

  // Optional: basic email format check if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, errorMsg: '⚠️ Please enter a valid email address.' };
  }

  return {
    valid: true,
    data: { name, email, category, description: desc }
  };
}

/**
 * submitReport(event)
 * This function is already called by the form's onsubmit in index.html.
 * We OVERRIDE the old stub version here with the full implementation.
 *
 * Flow:
 *   1. Prevent default page refresh
 *   2. Validate fields
 *   3. Build report object
 *   4. Save to localStorage
 *   5. Re-render feed
 *   6. Reset form + show toast
 */
function submitReport(e) {
  e.preventDefault();

  const { valid, data, errorMsg } = validateReportForm();

  if (!valid) {
    showToast(errorMsg, 'error');
    return;
  }

  // Build the report object
  const report = {
    id:          Date.now(),                   // unique numeric ID
    name:        data.name,
    email:       data.email || '',
    category:    data.category,
    title:       data.category,               // title = category for display in feed
    description: data.description,
    timestamp:   new Date().toISOString(),
  };

  // Persist
  const reports = loadReports();
  reports.push(report);
  saveReports(reports);

  // Update the live feed
  renderReportFeed();

  // Reset form fields
  e.target.reset();

  // Feedback
  showToast('✅ Report submitted! We\'ll look into it.', 'success');
}


/* ============================================================
   SECTION 5 — NAV SCROLL HIGHLIGHT
   (preserves the original behaviour from index.html)
============================================================ */
function initNavHighlight() {
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('nav a');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    navLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  });
}


/* ============================================================
   SECTION 6 — CARD ENTRANCE ANIMATION
   Injected once into <head> so buildReportCard() can use it.
============================================================ */
function injectCardAnimation() {
  if (document.getElementById('univibe-report-styles')) return;
  const style = document.createElement('style');
  style.id = 'univibe-report-styles';
  style.textContent = `
    @keyframes reportCardIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #report-feed-list::-webkit-scrollbar { width: 4px; }
    #report-feed-list::-webkit-scrollbar-thumb {
      background: rgba(108,99,255,0.3); border-radius: 99px;
    }
  `;
  document.head.appendChild(style);
}


/* ============================================================
   SECTION 7 — INIT  (runs on DOMContentLoaded)
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  injectCardAnimation();       // add keyframe CSS
  injectReportFeedContainer(); // add Recent Reports UI below the form
  renderReportFeed();          // populate from localStorage on load
  initNavHighlight();          // scroll-aware nav (was inline in index.html)
});