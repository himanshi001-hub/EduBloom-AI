// ════════════════════════════════════════════════════
// script.js — QuestionAI Application Logic
// ════════════════════════════════════════════════════
 
// ── CONFIG ──────────────────────────────────────────
// Replace with your actual Anthropic API key
const CLAUDE_API_KEY = "YOUR_API_KEY_HERE";
const CLAUDE_MODEL   = "claude-sonnet-4-20250514";
 
 
// ════════════════════════════════
// USER STORE (localStorage)
// ════════════════════════════════
let users = JSON.parse(localStorage.getItem('qai_users') || '[]');
 
// Seed demo accounts if not present
if (!users.find(u => u.email === 'teacher@demo.com')) {
  users.push({ name: 'Demo Teacher', email: 'teacher@demo.com', pass: 'demo123', role: 'teacher' });
}
if (!users.find(u => u.email === 'student@demo.com')) {
  users.push({ name: 'Demo Student', email: 'student@demo.com', pass: 'demo123', role: 'student', grade: 'Grade 10' });
}
localStorage.setItem('qai_users', JSON.stringify(users));
 
let currentUser     = null;
let savedPapers     = JSON.parse(localStorage.getItem('qai_papers')   || '[]');
let studentAttempts = JSON.parse(localStorage.getItem('qai_attempts') || '[]');
let selectedRole    = 'teacher';
 
 
// ════════════════════════════════
// LOGIN / AUTH
// ════════════════════════════════
function switchLoginTab(tab) {
  document.querySelectorAll('.ltab').forEach((t, i) =>
    t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1))
  );
  document.getElementById('loginForm').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('regClassGroup').style.display = selectedRole === 'student' ? 'block' : 'none';
}
 
function selectRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('regClassGroup').style.display = role === 'student' ? 'block' : 'none';
  document.getElementById('loginEmail').value = role === 'teacher' ? 'teacher@demo.com' : 'student@demo.com';
  document.getElementById('loginPass').value  = 'demo123';
}
 
function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const u = users.find(x => x.email === email && x.pass === pass && x.role === selectedRole);
  if (!u) { document.getElementById('loginErr').style.display = 'block'; return; }
  document.getElementById('loginErr').style.display = 'none';
  currentUser = u;
  initApp();
}
 
function doRegister() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  const grade = document.getElementById('regClass').value;
 
  if (!name || !email || !pass) {
    showRegErr('All fields required.'); return;
  }
  if (pass.length < 6) {
    showRegErr('Password too short.'); return;
  }
  if (users.find(u => u.email === email)) {
    showRegErr('Email already registered.'); return;
  }
 
  const u = { name, email, pass, role: selectedRole, grade: selectedRole === 'student' ? grade : null };
  users.push(u);
  localStorage.setItem('qai_users', JSON.stringify(users));
  currentUser = u;
  document.getElementById('regErr').style.display = 'none';
  initApp();
}
 
function showRegErr(msg) {
  const el = document.getElementById('regErr');
  el.textContent = msg;
  el.style.display = 'block';
}
 
function doLogout() {
  currentUser = null;
  document.getElementById('appShell').style.display  = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  if (examInterval) clearInterval(examInterval);
}
 
 
// ════════════════════════════════
// APP INITIALISATION
// ════════════════════════════════
function initApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appShell').style.display  = 'block';
 
  const isTeacher = currentUser.role === 'teacher';
  document.getElementById('roleBadge').textContent  = isTeacher ? '👨‍🏫 Teacher' : '🎓 Student';
  document.getElementById('roleBadge').className    = 'nav-badge ' + (isTeacher ? 'badge-teacher' : 'badge-student');
  document.getElementById('navAvatar').textContent  = currentUser.name[0].toUpperCase();
 
  const navLinks = document.getElementById('navLinks');
  if (isTeacher) {
    navLinks.innerHTML = `
      <li><button class="nav-link" onclick="showPage('tdash')">Dashboard</button></li>
      <li><button class="nav-link" onclick="showPage('tgenerate')">Generate Paper</button></li>
      <li><button class="nav-link" onclick="showPage('thistory')">My Papers</button></li>
      <li><button class="nav-link" onclick="showPage('tanalytics')">Analytics</button></li>
      <li><button class="nav-link" onclick="showPage('tabout')">About</button></li>`;
    document.getElementById('teacherName').textContent = currentUser.name.split(' ')[0];
    showPage('tdash');
    renderTeacherDash();
  } else {
    navLinks.innerHTML = `
      <li><button class="nav-link" onclick="showPage('sdash')">My Papers</button></li>
      <li><button class="nav-link" onclick="showPage('sresults')">Results</button></li>`;
    document.getElementById('studentName').textContent = currentUser.name.split(' ')[0];
    showPage('sdash');
    renderStudentDash();
  }
 
  initBloomSliders();
  initChatbot();
  renderAnalytics();
  renderHistory();
}
 
 
// ════════════════════════════════
// PAGE NAVIGATION
// ════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => {
    if (l.getAttribute('onclick')?.includes(name)) l.classList.add('active');
  });
}
 
 
// ════════════════════════════════
// TEACHER DASHBOARD
// ════════════════════════════════
function renderTeacherDash() {
  const myPapers   = savedPapers.filter(p => p.createdBy === currentUser.email);
  const allAttempts = studentAttempts.filter(a => myPapers.some(p => p.id === a.paperId));
  const avg = allAttempts.length
    ? Math.round(allAttempts.reduce((s, a) => s + a.pct, 0) / allAttempts.length)
    : 0;
 
  animCount('ts-papers',   myPapers.length  || 12);
  animCount('ts-students', users.filter(u => u.role === 'student').length || 34);
  animCount('ts-attempts', allAttempts.length || 89);
  document.getElementById('ts-avg').textContent = (avg || 76) + '%';
 
  const samplePapers = [
    { id:1001, subject:'Biology',     grade:'Grade 11', examTitle:'Unit Test 1',   totalMarks:100, date:'02 Apr 2025', diffLabel:'Medium' },
    { id:1002, subject:'Mathematics', grade:'Grade 10', examTitle:'Mid-Term',      totalMarks:80,  date:'28 Mar 2025', diffLabel:'Hard'   },
    { id:1003, subject:'Physics',     grade:'Grade 12', examTitle:'Chapter Test',  totalMarks:70,  date:'22 Mar 2025', diffLabel:'Medium' },
  ];
  const all = [...myPapers, ...samplePapers].slice(0, 5);
 
  document.getElementById('recentPapers').innerHTML = all.map(p => `
    <div class="recent-paper" onclick="showPage('thistory')">
      <div class="rp-info">
        <div class="rp-sub">${p.subject} — ${p.grade}</div>
        <div class="rp-meta">${p.examTitle} • ${p.totalMarks}M • ${p.date || 'Today'}</div>
      </div>
      <span class="rp-badge" style="color:var(--accent);border-color:var(--accent)">${p.diffLabel}</span>
    </div>`).join('');
}
 
// Animated number counter
function animCount(id, target) {
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 60));
  const el   = document.getElementById(id);
  if (!el) return;
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 20);
}
 
 
// ════════════════════════════════
// STUDENT DASHBOARD
// ════════════════════════════════
function renderStudentDash() {
  const allPapers  = [...savedPapers, ...getSamplePapers()];
  const published  = allPapers.filter(p => p.published !== false);
  const myAttempts = studentAttempts.filter(a => a.studentEmail === currentUser.email);
  const done = myAttempts.length;
  const avg  = done ? Math.round(myAttempts.reduce((s, a) => s + a.pct, 0) / done) : null;
  const best = done ? Math.max(...myAttempts.map(a => a.pct)) : null;
 
  animCount('ss-assigned', published.length || 6);
  animCount('ss-done', done);
  document.getElementById('ss-avg').textContent  = avg  ? avg  + '%' : '—';
  document.getElementById('ss-best').textContent = best ? best + '%' : '—';
 
  const allDisp = [...savedPapers.filter(p => p.published !== false), ...getSamplePapers()];
  document.getElementById('studentPapers').innerHTML = allDisp.map(p => {
    const attempt = myAttempts.find(a => a.paperId === p.id);
    const isDone  = !!attempt;
    return `
      <div class="paper-card">
        <div class="pc-subj">${p.subject}</div>
        <div class="pc-meta">${p.examTitle || 'Exam'} • ${p.grade} • ${p.totalMarks}M • ${p.duration}min</div>
        <div class="pc-tags">
          <span class="pctag">${p.diffLabel || 'Medium'}</span>
          <span class="pctag">${(p.questions || []).length || '~20'} Questions</span>
        </div>
        <span class="pc-status ${isDone ? 'st-done' : 'st-pending'}">
          ${isDone ? '✓ Completed — ' + attempt.pct + '%' : 'Not Attempted'}
        </span>
        <button class="attempt-btn"
          ${isDone ? 'disabled' : ''}
          onclick="${isDone ? '' : 'openExam(' + p.id + ')'}">
          ${isDone ? '✓ Completed' : '▶ Attempt Now'}
        </button>
      </div>`;
  }).join('');
 
  renderStudentResults();
}
 
// Built-in sample papers for student portal
function getSamplePapers() {
  return [
    { id:2001, subject:'Biology',         grade:'Grade 11', examTitle:'Unit Test 1',         totalMarks:50, duration:60, diffLabel:'Medium', published:true, questions: buildSampleQuestions('Biology',           'Photosynthesis and Cell Division', 50) },
    { id:2002, subject:'Mathematics',     grade:'Grade 10', examTitle:'Algebra Quiz',        totalMarks:40, duration:45, diffLabel:'Hard',   published:true, questions: buildSampleQuestions('Mathematics',       'Algebra and Equations',            40) },
    { id:2003, subject:'Computer Science',grade:'Grade 11', examTitle:'Data Structures Test',totalMarks:60, duration:90, diffLabel:'Medium', published:true, questions: buildSampleQuestions('Computer Science',  'Arrays, Linked Lists, Stacks',      60) },
  ];
}
 
function buildSampleQuestions(subject, topics, marks) {
  const pools = {
    Biology: [
      { text:'What is the main site of photosynthesis in a plant cell?',                    type:'mcq',   level:'remember',  opts:['(a) Nucleus','(b) Chloroplast','(c) Mitochondria','(d) Ribosome'], answer:'(b) Chloroplast' },
      { text:'Explain the difference between aerobic and anaerobic respiration.',            type:'short', level:'understand', answer:'Aerobic respiration uses oxygen and produces more ATP; anaerobic does not use oxygen and produces less ATP.' },
      { text:'A plant is kept in the dark for 48 hours. Predict what will happen to starch in its leaves and justify your answer.', type:'long', level:'evaluate', answer:'Starch would be depleted since no photosynthesis can occur without light to produce glucose.' },
      { text:'State True or False: Mitochondria are known as the powerhouse of the cell.',  type:'tf',    level:'remember',  answer:'True' },
      { text:'The process by which plants make food using sunlight is called ________.', type:'fill', level:'remember',   answer:'Photosynthesis' },
    ],
    Mathematics: [
      { text:'Solve for x: 2x + 5 = 13',                                                    type:'mcq',   level:'apply',     opts:['(a) x = 3','(b) x = 4','(c) x = 5','(d) x = 6'], answer:'(b) x = 4' },
      { text:'Factorize: x² + 5x + 6',                                                      type:'short', level:'apply',     answer:'(x + 2)(x + 3)' },
      { text:'A train travels 240 km in 3 hours. Another covers 300 km in 4 hours. Which is faster? Show your working.', type:'long', level:'analyze', answer:'Train 1: 80 km/h. Train 2: 75 km/h. Train 1 is faster.' },
      { text:'State True or False: The square root of 144 is 12.',                           type:'tf',    level:'remember',  answer:'True' },
      { text:'The formula for area of a circle is ________.', type:'fill', level:'remember', answer:'πr²' },
    ],
    'Computer Science': [
      { text:'Which data structure uses LIFO order?',                                         type:'mcq',   level:'remember',  opts:['(a) Queue','(b) Stack','(c) Array','(d) Tree'], answer:'(b) Stack' },
      { text:'Explain the difference between a stack and a queue.',                          type:'short', level:'understand', answer:'Stack uses LIFO (Last In First Out); Queue uses FIFO (First In First Out).' },
      { text:'Design an algorithm to reverse a linked list. Explain each step.',             type:'long',  level:'create',    answer:'Iterate through nodes, reversing next pointers. Use three pointers: prev, current, next.' },
      { text:'State True or False: An array has a fixed size once declared in most languages.', type:'tf', level:'remember',  answer:'True' },
      { text:'A queue follows ________ order.', type:'fill', level:'remember',               answer:'FIFO (First In First Out)' },
    ],
  };
  const base = pools[subject] || pools['Biology'];
  return base.map((q, i) => ({
    ...q,
    num:   i + 1,
    marks: q.type === 'mcq' || q.type === 'tf' || q.type === 'fill' ? 2
         : q.type === 'short' ? 5 : 10,
  }));
}
 
function renderStudentResults() {
  const myAttempts = studentAttempts.filter(a => a.studentEmail === currentUser.email);
  const el = document.getElementById('studentResults');
  if (!el) return;
  if (!myAttempts.length) {
    el.innerHTML = '<p style="color:var(--muted)">No attempts yet. Go attempt a paper!</p>';
    return;
  }
  el.innerHTML = myAttempts.map(a => `
    <div class="an-card" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div>
          <div style="font-family:var(--font-h);font-weight:700">${a.subject} — ${a.examTitle}</div>
          <div style="font-size:.8rem;color:var(--muted)">${a.date}</div>
        </div>
        <div style="font-family:var(--font-h);font-size:2rem;font-weight:800;color:${a.pct >= 75 ? 'var(--accent3)' : a.pct >= 50 ? 'var(--warn)' : 'var(--danger)'}">${a.pct}%</div>
      </div>
      <div class="result-breakdown">
        <div class="rb-item"><div class="rb-val">${a.scored}/${a.total}</div><div class="rb-lbl">Score</div></div>
        <div class="rb-item"><div class="rb-val">${a.correct}</div><div class="rb-lbl">Correct</div></div>
        <div class="rb-item"><div class="rb-val">${a.grade}</div><div class="rb-lbl">Grade</div></div>
      </div>
    </div>`).join('');
}
 
 
// ════════════════════════════════
// EXAM MODAL
// ════════════════════════════════
let examState    = { questions: [], current: 0, answers: {}, paperId: null, paper: null, timerSec: 0 };
let examInterval = null;
 
function openExam(paperId) {
  const allPapers = [...savedPapers, ...getSamplePapers()];
  const paper     = allPapers.find(p => p.id === paperId);
  if (!paper || !paper.questions?.length) { showToast('Paper not available.'); return; }
 
  examState = {
    questions: paper.questions, current: 0, answers: {},
    paperId, paper, timerSec: (paper.duration || 60) * 60,
  };
  document.getElementById('examModalTitle').textContent = paper.examTitle || paper.subject;
  document.getElementById('examModal').classList.add('open');
  renderExamQuestion();
  startExamTimer();
}
 
function startExamTimer() {
  if (examInterval) clearInterval(examInterval);
  examInterval = setInterval(() => {
    examState.timerSec--;
    const m  = String(Math.floor(examState.timerSec / 60)).padStart(2, '0');
    const s  = String(examState.timerSec % 60).padStart(2, '0');
    const el = document.getElementById('examTimer');
    el.textContent = m + ':' + s;
    el.className   = 'modal-timer' + (examState.timerSec < 300 ? ' warn' : '');
    if (examState.timerSec <= 0) { clearInterval(examInterval); submitExam(); }
  }, 1000);
}
 
function renderExamQuestion() {
  const { questions, current, answers } = examState;
  const q     = questions[current];
  const total = questions.length;
  const pct   = Math.round(((current + 1) / total) * 100);
  document.getElementById('examQCounter').textContent = `Q ${current + 1} of ${total}`;
 
  const bloomColors = {
    remember:'#ef4444', understand:'#f59e0b', apply:'#10b981',
    analyze:'#3b82f6',  evaluate:'#8b5cf6',  create:'#f43f5e',
  };
  const bc = bloomColors[q.level] || '#888';
 
  let html = `
    <div class="exam-progress">
      <div class="ep-bar"><div class="ep-fill" style="width:${pct}%"></div></div>
      <div class="ep-text">Question ${current + 1} of ${total} &nbsp;•&nbsp; ${Math.round(Object.keys(answers).length / total * 100)}% answered</div>
    </div>
    <div class="exam-q">
      <div class="eq-num">
        Q${q.num || current + 1}
        <span class="eq-bloom" style="background:${bc}22;color:${bc};border:1px solid ${bc};padding:.1rem .4rem;border-radius:99px;font-size:.65rem;font-weight:700">${cap(q.level)}</span>
        — ${cap(q.type)} [${q.marks} mark${q.marks > 1 ? 's' : ''}]
      </div>
      <div class="eq-text">${q.text}</div>`;
 
  if (q.type === 'mcq' || q.type === 'tf') {
    const opts = q.type === 'tf'
      ? ['(a) True', '(b) False']
      : (q.opts || ['(a) Option A', '(b) Option B', '(c) Option C', '(d) Option D']);
    html += `<div class="eq-opts">
      ${opts.map(o => `
        <label class="eq-opt ${answers[current] === o ? 'selected' : ''}">
          <input type="radio" name="ans" value="${o}" ${answers[current] === o ? 'checked' : ''} onchange="selectAns('${o.replace(/'/g, "\\'")}')"/>
          ${o}
        </label>`).join('')}
    </div>`;
  } else {
    html += `<textarea class="eq-textarea" placeholder="Write your answer here…" oninput="saveTextAns(this.value)">${answers[current] || ''}</textarea>`;
  }
 
  html += `</div>`;
  document.getElementById('examModalBody').innerHTML = html;
}
 
function selectAns(val) {
  examState.answers[examState.current] = val;
  renderExamQuestion();
}
function saveTextAns(val) {
  examState.answers[examState.current] = val;
}
function examNav(dir) {
  const next = examState.current + dir;
  if (next < 0 || next >= examState.questions.length) return;
  examState.current = next;
  renderExamQuestion();
}
 
function submitExam() {
  if (examInterval) clearInterval(examInterval);
  const { questions, answers, paper } = examState;
 
  let scored = 0, total = 0, correct = 0;
  const details = questions.map((q, i) => {
    total += q.marks;
    const given = answers[i] || '';
    let isCorrect = false;
 
    if (q.type === 'mcq' || q.type === 'tf') {
      isCorrect = given === q.answer || given.toLowerCase().includes((q.answer || '').toLowerCase());
      if (isCorrect) { scored += q.marks; correct++; }
    } else {
      const partial = given.trim().length > 10 ? Math.round(q.marks * 0.7) : 0;
      scored += partial;
      if (partial > 0) correct++;
      isCorrect = partial > 0;
    }
    return { ...q, given, isCorrect };
  });
 
  const pct   = Math.round((scored / total) * 100);
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';
 
  const attempt = {
    studentEmail: currentUser.email,
    paperId:      examState.paperId,
    subject:      paper.subject,
    examTitle:    paper.examTitle || paper.subject,
    scored, total, correct, pct, grade,
    date: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
    details,
  };
  studentAttempts.push(attempt);
  localStorage.setItem('qai_attempts', JSON.stringify(studentAttempts));
 
  // Render results inside the modal
  document.getElementById('examModalBody').innerHTML = `
    <div class="result-box">
      <div style="font-size:2rem">🎉</div>
      <h2 style="font-family:var(--font-h);font-weight:800;margin:.5rem 0">Exam Submitted!</h2>
      <div class="result-score">${pct}%</div>
      <div class="result-grade" style="color:${pct >= 75 ? 'var(--accent3)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)'}">${grade} Grade</div>
      <div class="result-breakdown">
        <div class="rb-item"><div class="rb-val">${scored}/${total}</div><div class="rb-lbl">Score</div></div>
        <div class="rb-item"><div class="rb-val">${correct}/${questions.length}</div><div class="rb-lbl">Correct</div></div>
        <div class="rb-item"><div class="rb-val">${questions.length - correct}</div><div class="rb-lbl">Wrong/Skipped</div></div>
      </div>
      <div class="result-answers">
        <h3 style="font-family:var(--font-h);margin-bottom:.85rem">Answer Review</h3>
        ${details.map((q, i) => `
          <div class="ra-item ${q.isCorrect ? 'ra-correct' : 'ra-wrong'}">
            <div class="ra-q">Q${i + 1}. ${q.text.substring(0, 80)}${q.text.length > 80 ? '…' : ''}</div>
            <div class="ra-ans">Your answer: ${q.given || 'Not answered'} ${q.isCorrect ? '✓' : '✗'} ${!q.isCorrect && q.answer ? ' | Correct: ' + q.answer : ''}</div>
          </div>`).join('')}
      </div>
    </div>`;
 
  document.getElementById('examModalTitle').textContent = 'Your Results';
  document.getElementById('examTimer').textContent      = '✓ Done';
  document.querySelector('.modal-foot').innerHTML       = `<button class="nbtn primary" onclick="closeExam()">Close & Return</button>`;
}
 
function closeExam() {
  document.getElementById('examModal').classList.remove('open');
  renderStudentDash();
}
 
 
// ════════════════════════════════
// AI PAPER GENERATION
// ════════════════════════════════
async function generatePaperAI() {
  // Gather form values
  const subject  = document.getElementById('g-subject').value  || 'General Science';
  const grade    = document.getElementById('g-grade').value;
  const topics   = document.getElementById('g-topics').value   || 'Chapter Topics';
  const marks    = parseInt(document.getElementById('g-marks').value)    || 100;
  const duration = parseInt(document.getElementById('g-duration').value) || 180;
  const syllabus = document.getElementById('g-syllabus').value;
  const school   = document.getElementById('g-school').value;
  const title    = document.getElementById('g-title').value    || 'Examination 2025';
  const incAns   = document.getElementById('opt-ans').checked;
  const incTags  = document.getElementById('opt-tags').checked;
  const incSec   = document.getElementById('opt-sec').checked;
  const publish  = document.getElementById('opt-publish').checked;
  const diff     = ['', 'Easy', 'Medium', 'Hard'][parseInt(document.getElementById('g-diff').value)];
 
  // Bloom's distribution
  const bloomDist = {};
  document.querySelectorAll('.bloom-range').forEach(s => { bloomDist[s.dataset.level] = parseInt(s.value); });
  if (Object.values(bloomDist).reduce((a, b) => a + b, 0) !== 100) {
    showToast("⚠ Bloom's must total 100%!"); return;
  }
 
  // Question types
  const qtypes = [];
  if (document.getElementById('qt-mcq').checked)   qtypes.push('MCQ');
  if (document.getElementById('qt-short').checked) qtypes.push('Short Answer');
  if (document.getElementById('qt-long').checked)  qtypes.push('Long Answer');
  if (document.getElementById('qt-tf').checked)    qtypes.push('True/False');
  if (document.getElementById('qt-fill').checked)  qtypes.push('Fill in the Blank');
  if (!qtypes.length) { showToast('Select at least one question type!'); return; }
 
  // Show loading state
  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  document.getElementById('genSpin').style.display  = 'block';
  document.getElementById('genTxt').textContent = 'AI is generating…';
 
  try {
    let questions;
    if (CLAUDE_API_KEY === 'YOUR_API_KEY_HERE') {
      // Demo / offline mode
      await new Promise(r => setTimeout(r, 1800));
      questions = generateOfflineQuestions(subject, topics, bloomDist, qtypes, marks);
    } else {
      questions = await callClaudeAPI(subject, grade, topics, syllabus, bloomDist, qtypes, marks, diff);
    }
 
    const paperHTML = buildPaperHTML({ school, title, subject, grade, topics, duration, marks, diff, incAns, incTags, incSec, questions });
    const preview   = document.getElementById('paperPreview');
    preview.className   = '';
    preview.innerHTML   = '<div class="gen-paper" id="genPaperContent">' + paperHTML + '</div>';
    document.getElementById('prevActions').classList.remove('hidden');
 
    // Auto-save paper
    const paper = {
      id: Date.now(), subject, grade, topics, duration, totalMarks: marks, diffLabel: diff,
      examTitle: title,
      date: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
      questions, bloomDist, html: paperHTML,
      createdBy: currentUser.email, published: publish,
    };
    savedPapers.unshift(paper);
    localStorage.setItem('qai_papers', JSON.stringify(savedPapers));
    showToast('✅ Paper generated successfully!');
 
  } catch (e) {
    showToast('⚠ Error: ' + e.message);
    console.error(e);
  } finally {
    btn.disabled = false;
    document.getElementById('genSpin').style.display = 'none';
    document.getElementById('genTxt').textContent    = '✨ Generate with AI';
  }
}
 
// Call Claude API for question generation
async function callClaudeAPI(subject, grade, topics, syllabus, bloomDist, qtypes, marks, diff) {
  const prompt = `You are an expert educator. Generate a complete question paper with the following specifications:
 
Subject: ${subject}
Grade: ${grade}
Topics: ${topics}
Total Marks: ${marks}
Difficulty: ${diff}
Question Types: ${qtypes.join(', ')}
${syllabus ? 'Syllabus Context: ' + syllabus : ''}
 
Bloom's Taxonomy Distribution:
${Object.entries(bloomDist).filter(([, v]) => v > 0).map(([k, v]) => `- ${cap(k)}: ${v}%`).join('\n')}
 
Generate questions distributed across these Bloom's levels as specified.
For each question provide: question text, type (mcq/short/long/tf/fill), Bloom's level, marks,
options (for MCQ/TF), and a model answer.
 
Respond ONLY with a valid JSON array — no markdown, no extra text:
[
  {
    "num": 1,
    "text": "Question text",
    "type": "mcq",
    "level": "remember",
    "marks": 2,
    "opts": ["(a) Option A","(b) Option B","(c) Option C","(d) Option D"],
    "answer": "(b) Option B"
  }
]`;
 
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
 
  if (!response.ok) throw new Error('API request failed: ' + response.status);
  const data  = await response.json();
  const text  = data.content.map(c => c.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
 
// Offline question bank used when no API key is set
function generateOfflineQuestions(subject, topics, bloomDist, qtypes, totalMarks) {
  const BANK = {
    remember: {
      mcq:  [
        { text:'What is the basic unit of life?', opts:['(a) Atom','(b) Cell','(c) Molecule','(d) Tissue'], answer:'(b) Cell' },
        { text:'Which organelle performs photosynthesis?', opts:['(a) Nucleus','(b) Mitochondria','(c) Chloroplast','(d) Ribosome'], answer:'(c) Chloroplast' },
        { text:'What is H₂O commonly known as?', opts:['(a) Salt','(b) Water','(c) Acid','(d) Base'], answer:'(b) Water' },
      ],
      tf:   [
        { text:'State True or False: The Earth revolves around the Sun.', answer:'True' },
        { text:'State True or False: Mammals are cold-blooded.', answer:'False' },
      ],
      fill: [
        { text:'The chemical symbol for Gold is ________.', answer:'Au' },
        { text:'The process of water changing to vapour is called ________.', answer:'Evaporation' },
      ],
      short:[
        { text:"List the six levels of Bloom's Taxonomy.", answer:'Remember, Understand, Apply, Analyze, Evaluate, Create' },
        { text:'Define the term photosynthesis.', answer:'Process by which green plants use sunlight to make food from CO₂ and water' },
      ],
      long: [
        { text:'Describe the structure of a plant cell with a neat diagram.', answer:'[Detailed description of plant cell components]' },
      ],
    },
    understand: {
      mcq:  [{ text:'Which statement best describes osmosis?', opts:['(a) Movement of solute','(b) Movement of water across semi-permeable membrane','(c) Active transport','(d) Diffusion of gas'], answer:'(b) Movement of water across semi-permeable membrane' }],
      tf:   [{ text:'State True or False: All living organisms perform respiration.', answer:'True' }],
      fill: [{ text:"Newton's first law is also called the law of ________.', answer:'Inertia" }],
      short:[
        { text:'Explain the difference between aerobic and anaerobic respiration.', answer:'Aerobic uses O₂ and produces more ATP; anaerobic does not use O₂' },
        { text:'Summarize the water cycle in 3-4 sentences.', answer:'Water evaporates, forms clouds, falls as precipitation, collects and evaporates again.' },
      ],
      long: [{ text:"Explain Newton's three laws of motion with examples from everyday life.", answer:'[First law: inertia; Second: F=ma; Third: action-reaction]' }],
    },
    apply: {
      mcq:  [
        { text:'A car travels 150 km in 3 hours. What is its speed?', opts:['(a) 40 km/h','(b) 50 km/h','(c) 60 km/h','(d) 70 km/h'], answer:'(b) 50 km/h' },
        { text:'If 2x + 4 = 10, what is x?', opts:['(a) 2','(b) 3','(c) 4','(d) 5'], answer:'(b) 3' },
      ],
      tf:   [{ text:'State True or False: F = ma is used to calculate force given mass and acceleration.', answer:'True' }],
      fill: [{ text:'The area of a rectangle with length 6 and width 4 is ________.', answer:'24 square units' }],
      short:[{ text:'A resistor of 10Ω is connected to a 20V battery. Calculate the current.', answer:'I = V/R = 20/10 = 2 Amperes' }],
      long: [{ text:'Solve the system of equations: 2x + 3y = 12 and x - y = 1. Show all steps.', answer:'y=2, x=3' }],
    },
    analyze: {
      mcq:  [{ text:'Which best explains why metal expands when heated?', opts:['(a) Atoms disappear','(b) Atoms vibrate more and move apart','(c) Metal melts','(d) Electrons escape'], answer:'(b) Atoms vibrate more and move apart' }],
      tf:   [{ text:'State True or False: A catalyst is consumed in a chemical reaction.', answer:'False' }],
      fill: [{ text:'The independent variable in an experiment is the one that is ________.', answer:'deliberately changed' }],
      short:[{ text:'Compare plant cells and animal cells, mentioning 3 differences.', answer:'Plant cells have cell wall, chloroplasts, and large central vacuole; animal cells lack these.' }],
      long: [{ text:'Analyze the advantages and disadvantages of renewable energy sources compared to fossil fuels.', answer:'[Advantages: clean, sustainable; Disadvantages: intermittent, costly]' }],
    },
    evaluate: {
      mcq:  [{ text:'Which experiment best supports the germ theory of disease?', opts:["(a) Mendel's pea experiment","(b) Pasteur's swan-neck flask","(c) Darwin's finches","(d) Newton's apple"], answer:"(b) Pasteur's swan-neck flask" }],
      tf:   [{ text:'State True or False: More evidence is needed before accepting a scientific hypothesis as a law.', answer:'True' }],
      fill: [{ text:'A decision based on evidence and reasoning is called an ________ decision.', answer:'informed' }],
      short:[{ text:'Justify why hand hygiene is one of the most effective ways to prevent disease spread.', answer:'Removes pathogens before they enter the body; backed by extensive research.' }],
      long: [{ text:'Critically evaluate: "Social media has done more harm than good to teenagers." Provide evidence for both sides.', answer:'[Arguments for and against, student justifies position]' }],
    },
    create: {
      mcq:  [{ text:'A student designs an experiment to test how temperature affects enzyme activity. The independent variable should be:', opts:['(a) Enzyme amount','(b) Temperature','(c) Substrate amount','(d) pH'], answer:'(b) Temperature' }],
      tf:   [{ text:'State True or False: A hypothesis must be testable to be considered scientific.', answer:'True' }],
      fill: [{ text:'A flowchart that maps out the steps of an algorithm is called a ________.', answer:'Flowchart / Pseudocode' }],
      short:[{ text:'Design a simple algorithm to find the largest number in a list of 5 numbers.', answer:'Loop through numbers, track maximum, return it.' }],
      long: [{ text:'Create a detailed plan for a mobile app to help students track their study schedule. Include features and a 2-week development timeline.', answer:'[Student-designed app with feature list and timeline]' }],
    },
  };
 
  const questions = [];
  let qNum = 1;
  const marksMap = { mcq:2, tf:1, fill:2, short:5, long:10 };
 
  Object.entries(bloomDist).forEach(([level, pct]) => {
    if (!pct) return;
    const levelMarks = Math.round((pct / 100) * totalMarks);
    const bank       = BANK[level] || BANK.remember;
    let spent = 0;
 
    const typeOrder = [];
    if (qtypes.includes('MCQ'))              typeOrder.push('mcq');
    if (qtypes.includes('True/False'))       typeOrder.push('tf');
    if (qtypes.includes('Fill in the Blank'))typeOrder.push('fill');
    if (qtypes.includes('Short Answer'))     typeOrder.push('short');
    if (qtypes.includes('Long Answer'))      typeOrder.push('long');
 
    typeOrder.forEach(t => {
      const pool  = bank[t] || [];
      if (!pool.length) return;
      const m     = marksMap[t];
      const count = t === 'long' ? 1 : (t === 'mcq' || t === 'tf') ? Math.min(2, pool.length) : 1;
      for (let i = 0; i < count && spent + m <= levelMarks; i++) {
        const q = pool[i % pool.length];
        questions.push({ num: qNum++, text: q.text, type: t, level, marks: m, opts: q.opts || null, answer: q.answer || '' });
        spent += m;
      }
    });
  });
 
  return questions;
}
 
 
// ════════════════════════════════
// BUILD PAPER HTML (white sheet)
// ════════════════════════════════
function buildPaperHTML({ school, title, subject, grade, topics, duration, marks, diff, incAns, incTags, incSec, questions }) {
  const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  let html = '';
 
  if (school) html += `<div class="gp-school">${school}</div>`;
  html += `<div style="text-align:center;font-size:.75rem;color:#555;margin-bottom:.25rem">Date: ${today}</div>`;
  html += `<div class="gp-title">${title}</div>`;
  html += `<div class="gp-meta">
    <span><b>Subject:</b> ${subject}</span>
    <span><b>Class:</b> ${grade}</span>
    <span><b>Marks:</b> ${marks}</span>
    <span><b>Time:</b> ${duration} min</span>
    <span><b>Difficulty:</b> ${diff}</span>
  </div>`;
  html += `<div style="text-align:center;font-size:.7rem;color:#888;margin-bottom:.75rem">Topics: ${topics}</div>`;
  html += `<div class="gp-instr"><b>Instructions:</b><ol>
    <li>All questions are compulsory unless stated.</li>
    <li>Read all questions carefully before answering.</li>
    <li>Start each section on a new page.</li>
    <li>Marks are indicated in brackets against each question.</li>
  </ol></div>`;
  html += `<div style="text-align:right;font-size:.65rem;color:#999;margin-bottom:1rem">🤖 Generated by QuestionAI using Claude AI</div>`;
 
  if (incSec) {
    const secs = {
      mcq:   'Section A — Multiple Choice Questions',
      tf:    'Section B — True or False',
      fill:  'Section C — Fill in the Blanks',
      short: 'Section D — Short Answer',
      long:  'Section E — Long Answer',
    };
    const grouped = {};
    questions.forEach(q => { if (!grouped[q.type]) grouped[q.type] = []; grouped[q.type].push(q); });
    Object.entries(secs).forEach(([t, stitle]) => {
      if (!grouped[t]?.length) return;
      html += `<div class="gp-sec-title">${stitle}</div>`;
      grouped[t].forEach(q => { html += renderQuestion(q, incTags); });
    });
  } else {
    questions.forEach(q => { html += renderQuestion(q, incTags); });
  }
 
  if (incAns) {
    html += `<div class="gp-ans"><h4>— Answer Key —</h4>`;
    questions.forEach(q => {
      html += `<div class="gp-ai">Q${q.num}: ${
        (q.type === 'mcq' || q.type === 'tf' || q.type === 'fill') && q.answer
          ? q.answer
          : '[See marking scheme]'
      }</div>`;
    });
    html += `</div>`;
  }
  return html;
}
 
function renderQuestion(q, incTags) {
  const tag = incTags ? `<span class="btag-i btag-${q.level}">${cap(q.level)}</span>` : '';
  let h = `<div class="gp-q"><span class="gp-qn">Q${q.num}.</span><span>${q.text}${tag} <span class="gp-m">[${q.marks}M]</span></span></div>`;
  if (q.opts) h += `<div class="gp-opts">${q.opts.join('<br/>')}</div>`;
  h += '<br/>';
  return h;
}
 
 
// ════════════════════════════════
// BLOOM'S SLIDERS
// ════════════════════════════════
function initBloomSliders() {
  document.querySelectorAll('.bloom-range').forEach(s => {
    s.addEventListener('input', () => {
      s.parentElement.querySelector('.bloom-pct').textContent = s.value + '%';
      updateBloomTotal();
    });
  });
}
 
function updateBloomTotal() {
  let t = 0;
  document.querySelectorAll('.bloom-range').forEach(s => t += parseInt(s.value));
  document.getElementById('bloomTot').textContent = t;
  document.getElementById('bwarn').classList.toggle('hidden', t === 100);
}
 
 
// ════════════════════════════════
// DOWNLOAD / PRINT PAPER
// ════════════════════════════════
const PAPER_PRINT_STYLES = `
  body{font-family:'Times New Roman',serif;padding:2rem;color:#111}
  .gp-school{text-align:center;font-weight:800}
  .gp-title{text-align:center;font-size:1.2rem;font-weight:900;margin-bottom:.5rem}
  .gp-meta{display:flex;justify-content:space-between;border-top:2px solid #111;border-bottom:2px solid #111;padding:.3rem 0;margin-bottom:.85rem;font-size:.82rem}
  .gp-sec-title{font-weight:800;background:#f3f4f6;padding:.3rem .65rem;margin:10px 0 6px;border-left:4px solid #7c3aed}
  .gp-q{display:flex;gap:.5rem;margin-bottom:.55rem;font-size:.85rem}
  .gp-qn{font-weight:800;min-width:26px}
  .gp-opts{padding-left:18px;margin-bottom:.5rem;font-size:.82rem}
  .gp-m{font-weight:800;color:#7c3aed;font-size:.72rem}
  .gp-ans{margin-top:1.25rem;border-top:2px dashed #aaa;padding-top:.75rem}
  .gp-ai{font-size:.8rem;margin-bottom:.25rem}
  .btag-i{display:inline-block;font-size:.6rem;padding:.07rem .3rem;border-radius:99px;font-weight:700;margin-left:.25rem;vertical-align:middle}
  .btag-remember{background:#fee2e2;color:#991b1b}
  .btag-understand{background:#fef3c7;color:#92400e}
  .btag-apply{background:#d1fae5;color:#065f46}
  .btag-analyze{background:#dbeafe;color:#1e40af}
  .btag-evaluate{background:#ede9fe;color:#5b21b6}
  .btag-create{background:#ffe4e6;color:#9f1239}`;
 
function dlPaper(fmt) {
  const c = document.getElementById('genPaperContent');
  if (!c) { showToast('Generate a paper first!'); return; }
 
  if (fmt === 'pdf') {
    const w = window.open('');
    w.document.write(`<!DOCTYPE html><html><head><style>${PAPER_PRINT_STYLES}</style></head><body>${c.innerHTML}</body></html>`);
    w.document.close();
    w.print();
    showToast('📄 PDF print dialog opened');
  } else {
    const blob = new Blob(
      [`<html><head><style>${PAPER_PRINT_STYLES}</style></head><body>${c.innerHTML}</body></html>`],
      { type: 'application/msword' }
    );
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'question_paper.doc';
    a.click();
    showToast('📝 DOC downloaded');
  }
}
function printPaper() { dlPaper('pdf'); }
function savePaper()  { showToast('💾 Paper already auto-saved!'); }
 
 
// ════════════════════════════════
// HISTORY PAGE
// ════════════════════════════════
const SAMPLE_HIST = [
  { id:3001, subject:'Biology',          grade:'Grade 11', topics:'Cell Biology, Genetics',       totalMarks:100, duration:180, diffLabel:'Medium', examTitle:'Unit Test 1',   date:'02 Apr 2025' },
  { id:3002, subject:'Mathematics',      grade:'Grade 10', topics:'Algebra, Trigonometry',        totalMarks:80,  duration:150, diffLabel:'Hard',   examTitle:'Mid-Term Exam', date:'28 Mar 2025' },
  { id:3003, subject:'Physics',          grade:'Grade 12', topics:'Laws of Motion',               totalMarks:70,  duration:120, diffLabel:'Medium', examTitle:'Chapter Test',  date:'22 Mar 2025' },
  { id:3004, subject:'Computer Science', grade:'Grade 11', topics:'Data Structures',              totalMarks:100, duration:180, diffLabel:'Hard',   examTitle:'Annual Exam',   date:'15 Mar 2025' },
];
 
function renderHistory() {
  const grid = document.getElementById('histGrid');
  if (!grid) return;
 
  const search   = (document.getElementById('histSearch')?.value || '').toLowerCase();
  const filt     = document.getElementById('histFilt')?.value || '';
  const allPapers = [...savedPapers.filter(p => p.createdBy === currentUser?.email), ...SAMPLE_HIST];
 
  const filtered = allPapers.filter(p =>
    (!search || (p.subject + p.topics + p.examTitle).toLowerCase().includes(search)) &&
    (!filt   || p.subject === filt)
  );
 
  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted)">No papers found.</p>';
    return;
  }
 
  grid.innerHTML = filtered.map(p => `
    <div class="hcard">
      <div class="hc-sub">${p.subject} — ${p.grade}</div>
      <div class="hc-meta">${p.examTitle} • ${p.date || 'Today'} • ${p.totalMarks}M • ${p.duration}min</div>
      <div class="hc-row">
        <span class="hctag">${p.diffLabel}</span>
        <span class="hctag">${p.topics?.split(',').length || 1} topic(s)</span>
      </div>
      <div class="hc-actions">
        <button class="btn-sm" onclick="viewPaperPreview(${p.id})">👁 View</button>
        <button class="btn-sm" onclick="reusePaper(${p.id})">🔄 Reuse</button>
        <button class="btn-sm" onclick="delPaper(${p.id})">🗑 Delete</button>
      </div>
    </div>`).join('');
}
 
function filterHist() { renderHistory(); }
 
function viewPaperPreview(id) {
  const p = savedPapers.find(x => x.id === id);
  if (p?.html) {
    showPage('tgenerate');
    setTimeout(() => {
      const preview = document.getElementById('paperPreview');
      preview.className = '';
      preview.innerHTML = '<div class="gen-paper" id="genPaperContent">' + p.html + '</div>';
      document.getElementById('prevActions').classList.remove('hidden');
    }, 100);
  } else {
    showToast('Preview not available for sample papers.');
  }
}
 
function reusePaper(id) {
  const all = [...savedPapers, ...SAMPLE_HIST];
  const p   = all.find(x => x.id === id);
  if (!p) return;
  showPage('tgenerate');
  setTimeout(() => {
    document.getElementById('g-subject').value  = p.subject;
    document.getElementById('g-grade').value    = p.grade;
    document.getElementById('g-topics').value   = p.topics || '';
    document.getElementById('g-marks').value    = p.totalMarks;
    document.getElementById('g-duration').value = p.duration;
    document.getElementById('g-title').value    = p.examTitle || '';
    showToast('📋 Form pre-filled!');
  }, 200);
}
 
function delPaper(id) {
  savedPapers = savedPapers.filter(p => p.id !== id);
  localStorage.setItem('qai_papers', JSON.stringify(savedPapers));
  renderHistory();
  showToast('🗑 Deleted.');
}
 
 
// ════════════════════════════════
// ANALYTICS PAGE
// ════════════════════════════════
function renderAnalytics() {
  renderBloomChart();
  renderLineChart();
  renderSBList();
}
 
function renderBloomChart() {
  const el = document.getElementById('bloomChart');
  if (!el) return;
  const papers = [
    { name:'Bio Test',  remember:20, understand:20, apply:20, analyze:15, evaluate:15, create:10 },
    { name:'Math Mid',  remember:15, understand:15, apply:30, analyze:20, evaluate:10, create:10 },
    { name:'Phy Ch',    remember:10, understand:20, apply:30, analyze:20, evaluate:10, create:10 },
    { name:'CS Ann',    remember:10, understand:15, apply:25, analyze:25, evaluate:15, create:10 },
    { name:'Chem Qz',   remember:30, understand:25, apply:20, analyze:10, evaluate:10, create:5  },
  ];
  const colors = { remember:'#ef4444', understand:'#f59e0b', apply:'#10b981', analyze:'#3b82f6', evaluate:'#8b5cf6', create:'#f43f5e' };
 
  el.innerHTML = papers.map(p => `
    <div class="bc-group">
      <div class="bc-stack" style="height:140px">
        ${['create','evaluate','analyze','apply','understand','remember'].map(l =>
          `<div class="bc-seg" style="height:${(p[l]/100)*140}px;background:${colors[l]};opacity:.85" title="${cap(l)}: ${p[l]}%"></div>`
        ).join('')}
      </div>
      <div class="bc-lbl">${p.name}</div>
    </div>`).join('');
}
 
function renderLineChart() {
  const el = document.getElementById('lineChart');
  if (!el) return;
  const d  = [3, 6, 5, 8, 12, 9, 11, 14, 10, 13, 15, 9];
  const ms = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const mx = Math.max(...d);
  el.innerHTML = d.map((v, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">
      <div class="lbar" style="height:${Math.round(v/mx*80)}px" title="${ms[i]}: ${v}"></div>
      <span style="font-size:.6rem;color:var(--muted)">${ms[i]}</span>
    </div>`).join('');
}
 
function renderSBList() {
  const el = document.getElementById('sbList');
  if (!el) return;
  const data = [
    { l:'Mathematics', p:28 },
    { l:'Physics',     p:22 },
    { l:'Chemistry',   p:18 },
    { l:'Biology',     p:17 },
    { l:'CS',          p:15 },
  ];
  el.innerHTML = data.map(d => `
    <div class="sb-row">
      <span class="sb-lbl">${d.l}</span>
      <div class="sb-bg"><div class="sb-fill" style="width:${d.p}%"></div></div>
      <span class="sb-pct">${d.p}%</span>
    </div>`).join('');
}
 
 
// ════════════════════════════════
// CHATBOT (Claude AI powered)
// ════════════════════════════════
let chatHistory = [];
let chatOpen    = false;
 
function initChatbot() {
  chatHistory = [];
  document.getElementById('chatMsgs').innerHTML = '';
  addBotMsg(
    "Hi! I'm your QuestionAI Assistant 🤖\n\n" +
    "I can help you with:\n" +
    "• Explaining Bloom's Taxonomy levels\n" +
    "• Answering subject doubts\n" +
    "• Exam tips and strategies\n" +
    "• Questions about how the platform works\n\n" +
    "What would you like to know?"
  );
}
 
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatPanel').classList.toggle('open', chatOpen);
  document.getElementById('chatNotif').style.display = 'none';
  if (chatOpen) document.getElementById('chatInput').focus();
}
 
function addBotMsg(text) {
  const msgs = document.getElementById('chatMsgs');
  const time = new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' });
  const div  = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-bubble">${text.replace(/\n/g, '<br/>')}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
 
function addUserMsg(text) {
  const msgs = document.getElementById('chatMsgs');
  const time = new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' });
  const div  = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
 
function showTyping() {
  const msgs = document.getElementById('chatMsgs');
  const div  = document.createElement('div');
  div.className = 'msg bot';
  div.id        = 'typingIndicator';
  div.innerHTML = `<div class="chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
 
function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}
 
function sendSug(el) {
  document.getElementById('chatInput').value = el.textContent;
  sendChat();
}
 
function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}
 
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';
 
  addUserMsg(msg);
  chatHistory.push({ role: 'user', content: msg });
  showTyping();
 
  try {
    let reply;
    if (CLAUDE_API_KEY === 'YOUR_API_KEY_HERE') {
      await new Promise(r => setTimeout(r, 1200));
      reply = getOfflineChatReply(msg);
    } else {
      reply = await callClaudeChat(msg);
    }
    hideTyping();
    addBotMsg(reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    hideTyping();
    addBotMsg("Sorry, I had trouble connecting. Please check your API key or try again.");
  }
}
 
async function callClaudeChat(msg) {
  const system = `You are a helpful educational assistant for QuestionAI, an AI-powered exam platform. 
You help teachers generate question papers aligned with Bloom's Taxonomy and help students with subject doubts.
Keep responses concise, friendly, and educational. Format with line breaks for readability.
Current user: ${currentUser?.name}, role: ${currentUser?.role}.`;
 
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 600, system, messages: chatHistory.slice(-10) }),
  });
  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  return data.content.map(c => c.text || '').join('');
}
 
// Offline fallback replies (no API key)
function getOfflineChatReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('bloom'))
    return "Bloom's Taxonomy has 6 levels:\n\n1️⃣ Remember — Recall facts\n2️⃣ Understand — Explain concepts\n3️⃣ Apply — Use in new situations\n4️⃣ Analyze — Break into parts\n5️⃣ Evaluate — Judge and justify\n6️⃣ Create — Produce new work\n\nHigher levels require deeper thinking!";
  if (m.includes('photosynthesis'))
    return "Photosynthesis 🌱\n\n📍 Location: Chloroplasts\n⚗️ Equation: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\n\n2 stages:\n• Light-dependent (thylakoid) — ATP production\n• Calvin Cycle (stroma) — CO₂ fixation into glucose\n\nKey factors: light, CO₂, temperature, water!";
  if (m.includes('exam') || m.includes('tip') || m.includes('prep'))
    return "📚 Top Exam Tips:\n\n✅ Start with topics you know well\n✅ Use Pomodoro: 25min study → 5min break\n✅ Write summary notes — don't just re-read\n✅ Practice past papers\n✅ Teach concepts to someone else\n✅ Sleep well the night before!";
  if (m.includes('newton') || m.includes('motion'))
    return "Newton's Laws of Motion 🚀\n\n1st Law (Inertia): Object stays at rest unless acted upon.\n\n2nd Law: F = ma\n\n3rd Law: Every action has an equal and opposite reaction.\nEx: Rocket expels gas downward → moves upward!";
  if (m.includes('generate') || m.includes('paper'))
    return "To generate a paper:\n\n1. Go to 'Generate Paper'\n2. Select subject, grade, topics\n3. Set marks & duration\n4. Choose question types\n5. Adjust Bloom's % sliders (total = 100%)\n6. Click ✨ Generate with AI\n\nExport as PDF or DOC, or publish for students!";
  if (m.includes('hello') || m.includes('hi') || m.includes('hey'))
    return `Hello, ${currentUser?.name?.split(' ')[0] || 'there'}! 👋\n\nHow can I help you today? Ask me about:\n• Subject topics\n• Bloom's Taxonomy\n• How to use QuestionAI\n• Exam prep tips`;
  return `Great question! I'm QuestionAI's assistant, powered by Claude AI.\n\nI can help with:\n• Bloom's Taxonomy explanations\n• Basic subject concepts\n• Platform usage tips\n• Study strategies\n\nWhat else would you like to know? 😊`;
}
 
 
// ════════════════════════════════
// UTILITY HELPERS
// ════════════════════════════════
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
 
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
 