const state = {
  courses: [],
  selectedMode: 'one-on-one',
  latestBooking: null,
  auth: { admin: null, student: null }
};

const demoCourses = [
  { id: 1, title: 'JEE Mathematics', description: 'Advanced problem-solving for competitive exam success.', one_on_one_min: 350, one_on_one_max: 500, group_min: 250, group_max: 400 },
  { id: 2, title: 'IOQM Mathematics', description: 'Olympiad-focused reasoning, number theory, and algebra.', one_on_one_min: 300, one_on_one_max: 480, group_min: 220, group_max: 380 },
  { id: 3, title: 'NMTC Mathematics', description: 'Conceptual strengthening and practice for NMTC.', one_on_one_min: 280, one_on_one_max: 420, group_min: 200, group_max: 340 },
  { id: 4, title: 'Thinking-Based Mathematics', description: 'Build mathematical intuition through puzzles and logic.', one_on_one_min: 250, one_on_one_max: 400, group_min: 180, group_max: 320 },
  { id: 5, title: 'Boards Preparation (Class 10th)', description: 'Structured board exam prep with test series.', one_on_one_min: 220, one_on_one_max: 350, group_min: 160, group_max: 280 },
  { id: 6, title: 'Boards Preparation (Class 12th)', description: 'Exam-oriented strategy for high board scores.', one_on_one_min: 240, one_on_one_max: 380, group_min: 170, group_max: 300 },
  { id: 7, title: 'Crash Courses in Mathematics', description: 'Intensive revision for fast-track performance.', one_on_one_min: 200, one_on_one_max: 330, group_min: 150, group_max: 260 }
];

const demoMeta = {
  whatsapp: 'https://wa.me/919424135055',
  upiId: '9424135055@ptyes',
  qrPaymentLink: 'upi://pay?pa=9424135055@ptyes&pn=RKJ%20Equation&cu=INR'
};

const setDemoBanner = () => {
  if (document.getElementById('demoBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'demoBanner';
  banner.textContent = 'Preview mode: backend not reachable, showing live UI demo data.';
  banner.style.cssText = 'position:sticky;top:0;z-index:20;background:#ffb020;color:#1a1a1a;padding:10px 16px;text-align:center;font-weight:700;';
  document.body.prepend(banner);
};

const request = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(err.message || 'Request failed');
    }
    return await res.json();
  } catch (error) {
    if (location.protocol === 'file:' || /Failed to fetch|NetworkError/i.test(error.message)) {
      return null;
    }
    throw error;
  }
};
const formatINR = (value) => `₹${value.toLocaleString('en-IN')}`;

const loadMeta = async () => {
  const meta = (await request('/api/meta')) || demoMeta;
  if (meta === demoMeta) setDemoBanner();
  document.getElementById('upiId').textContent = meta.upiId;
  document.getElementById('payUpi').href = meta.qrPaymentLink;
  document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(meta.qrPaymentLink)}`;
};

const renderPricingLabel = () => {
  const courseBands = state.courses.map((c) => {
    const min = state.selectedMode === 'one-on-one' ? c.one_on_one_min : c.group_min;
    const max = state.selectedMode === 'one-on-one' ? c.one_on_one_max : c.group_max;
    return `${c.title}: ${formatINR(min)} - ${formatINR(max)}/hr`;
  });

  document.getElementById('pricingLabel').textContent = courseBands.join(' | ');
};

const renderCourses = () => {
  const grid = document.getElementById('coursesGrid');
  const select = document.getElementById('courseSelect');
  grid.innerHTML = '';
  select.innerHTML = '<option value="">Select Course</option>';

  state.courses.forEach((course) => {
    const card = document.createElement('article');
    card.className = 'course-card glass';
    card.innerHTML = `
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <small>1-on-1: ${formatINR(course.one_on_one_min)} - ${formatINR(course.one_on_one_max)} / hr</small><br/>
      <small>Group: ${formatINR(course.group_min)} - ${formatINR(course.group_max)} / hr</small>
      <div class="actions">
        <a href="#booking" class="btn btn-primary">Enroll Now</a>
        <a href="https://wa.me/919424135055" target="_blank" class="btn btn-outline">Book Demo on WhatsApp</a>
      </div>
    `;
    grid.appendChild(card);

    const opt = document.createElement('option');
    opt.value = course.id;
    opt.textContent = course.title;
    select.appendChild(opt);
  });

  renderPricingLabel();
};

const loadCourses = async () => {
  state.courses = (await request('/api/courses')) || demoCourses;
  if (state.courses === demoCourses) setDemoBanner();
  renderCourses();
};

const bindPricingToggles = () => {
  const oneOnOne = document.getElementById('oneOnOneToggle');
  const group = document.getElementById('groupToggle');
  oneOnOne.addEventListener('click', () => {
    state.selectedMode = 'one-on-one';
    oneOnOne.classList.add('active');
    group.classList.remove('active');
    renderPricingLabel();
  });
  group.addEventListener('click', () => {
    state.selectedMode = 'group';
    group.classList.add('active');
    oneOnOne.classList.remove('active');
    renderPricingLabel();
  });
};

const bookingFlow = () => {
  const form = document.getElementById('bookingForm');
  const summary = document.getElementById('bookingSummary');
  const summaryBody = document.getElementById('summaryBody');
  const bookingMessage = document.getElementById('bookingMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.courseId = Number(payload.courseId);

    const booking = await request('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }) || {
      id: Date.now(),
      course_title: (state.courses.find((c) => c.id === payload.courseId) || {}).title || 'Selected Course',
      mode: payload.mode,
      pricing_per_hour: 300,
      total_cost: 300 * Number(payload.totalHours || 1)
    };
    if (!booking.id || booking.id === Date.now()) setDemoBanner();

    state.latestBooking = booking;
    summary.classList.remove('hidden');
    summaryBody.innerHTML = `
      <p><strong>Course:</strong> ${booking.course_title}</p>
      <p><strong>Mode:</strong> ${booking.mode}</p>
      <p><strong>Pricing:</strong> ${formatINR(booking.pricing_per_hour)} per hour</p>
      <p><strong>Total:</strong> ${formatINR(booking.total_cost)}</p>
      <img src="${document.getElementById('qrImage').src}" class="qr" alt="Payment QR in summary">
    `;
    bookingMessage.textContent = '';
    summary.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
    if (!state.latestBooking) return;
    const paymentProof = document.getElementById('paymentProof').value;
    const res = await request(`/api/bookings/${state.latestBooking.id}/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentProof })
    }) || { message: 'Demo mode: payment confirmation captured locally.' };
    if (res.message.includes('Demo mode')) setDemoBanner();

    bookingMessage.textContent = `${res.message} Admin will approve and generate your student code shortly.`;
  });
};

const renderStudentDashboard = async (token) => {
  const dashboard = document.getElementById('studentDashboard');
  const data = await request('/api/student/dashboard', { headers: { Authorization: `Bearer ${token}` } }) || {
    user: { name: 'Demo Student', student_code: 'EQ-DEMO123', class_name: '11' },
    progress: 40,
    upcoming: [{ session_date: new Date().toISOString(), topic: 'Quadratic Equations', meet_link: 'https://meet.google.com/new' }],
    materials: [{ title: 'Demo Worksheet', url: 'https://drive.google.com/' }],
    attendance: [{ topic: 'Algebra', status: 'present' }],
    history: [{ topic: 'Number Theory', status: 'completed' }],
    notifications: [{ message: 'Demo mode is active.' }]
  };
  if (data.user.name === 'Demo Student') setDemoBanner();

  dashboard.classList.remove('hidden');
  dashboard.innerHTML = `
    <p><strong>${data.user.name}</strong> (${data.user.student_code})</p>
    <p>Class: ${data.user.class_name || '-'}</p>
    <p>Course Progress: ${data.progress}%</p>
    <h4>Upcoming Sessions</h4>
    <ul>${data.upcoming.map((s) => `<li>${new Date(s.session_date).toLocaleString()} | ${s.topic} | <a href="${s.meet_link}" target="_blank">Meet Link</a></li>`).join('') || '<li>No sessions yet</li>'}</ul>
    <h4>Study Materials</h4>
    <ul>${data.materials.map((m) => `<li><a href="${m.url}" target="_blank">${m.title}</a></li>`).join('') || '<li>No materials uploaded</li>'}</ul>
    <h4>Attendance</h4>
    <ul>${data.attendance.map((a) => `<li>${a.topic}: ${a.status}</li>`).join('') || '<li>No attendance records</li>'}</ul>
    <h4>Session History</h4>
    <ul>${data.history.map((h) => `<li>${h.topic} (${h.status})</li>`).join('') || '<li>No completed sessions</li>'}</ul>
    <h4>Notifications</h4>
    <ul>${data.notifications.map((n) => `<li>${n.message}</li>`).join('') || '<li>No notifications</li>'}</ul>
  `;
};

const renderAdminDashboard = async (token) => {
  const dashboard = document.getElementById('adminDashboard');
  const bookings = await request('/api/admin/bookings', { headers: { Authorization: `Bearer ${token}` } }) || [{ id: 1, student_name: 'Demo Learner', course_title: 'JEE Mathematics', mode: 'one-on-one', total_cost: 800, payment_status: 'submitted' }];
  if (bookings[0] && bookings[0].student_name === 'Demo Learner') setDemoBanner();

  dashboard.classList.remove('hidden');
  dashboard.innerHTML = `
    <p><strong>Bookings</strong></p>
    <ul>${bookings.map((b) => `
      <li>
        ${b.student_name} | ${b.course_title} | ${b.mode} | ${formatINR(b.total_cost)} | <strong>${b.payment_status}</strong>
        <button data-id="${b.id}" class="approve-btn">Approve Payment</button>
      </li>
    `).join('') || '<li>No bookings available</li>'}</ul>
    <h4>Default Admin Login</h4>
    <p>Email: rkj.jain2204@gmail.com | Password: admin123</p>
  `;

  dashboard.querySelectorAll('.approve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await request(`/api/admin/bookings/${btn.dataset.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }) || { studentCode: 'EQ-DEMO123', studentEmail: 'demo@student.com' };
      alert(`Approved. Student Code: ${result.studentCode}\nStudent Email: ${result.studentEmail}`);
      renderAdminDashboard(token);
    });
  });
};

const bindAuth = () => {
  document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }) || { token: 'demo-student-token', role: 'student', name: 'Demo Student' };
    if (res.token === 'demo-student-token') setDemoBanner();

    if (res.token && res.role === 'student') {
      state.auth.student = res.token;
      renderStudentDashboard(res.token);
    } else alert(res.message || 'Login failed');
  });

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }) || { token: 'demo-admin-token', role: 'admin', name: 'Demo Admin' };
    if (res.token === 'demo-admin-token') setDemoBanner();

    if (res.token && res.role === 'admin') {
      state.auth.admin = res.token;
      renderAdminDashboard(res.token);
    } else alert(res.message || 'Login failed');
  });
};

(async function init() {
  await loadMeta();
  await loadCourses();
  bindPricingToggles();
  bookingFlow();
  bindAuth();
})();
