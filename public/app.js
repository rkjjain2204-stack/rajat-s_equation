const state = {
  courses: [],
  selectedMode: 'one-on-one',
  latestBooking: null,
  auth: { admin: null, student: null }
};

const formatINR = (value) => `₹${value.toLocaleString('en-IN')}`;

const loadMeta = async () => {
  const meta = await fetch('/api/meta').then((r) => r.json());
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
  state.courses = await fetch('/api/courses').then((r) => r.json());
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

    const booking = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then((r) => r.json());

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
    const res = await fetch(`/api/bookings/${state.latestBooking.id}/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentProof })
    }).then((r) => r.json());

    bookingMessage.textContent = `${res.message} Admin will approve and generate your student code shortly.`;
  });
};

const renderStudentDashboard = async (token) => {
  const dashboard = document.getElementById('studentDashboard');
  const data = await fetch('/api/student/dashboard', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

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
  const bookings = await fetch('/api/admin/bookings', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

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
      const result = await fetch(`/api/admin/bookings/${btn.dataset.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).then((r) => r.json());
      alert(`Approved. Student Code: ${result.studentCode}\nStudent Email: ${result.studentEmail}`);
      renderAdminDashboard(token);
    });
  });
};

const bindAuth = () => {
  document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then((r) => r.json());

    if (res.token && res.role === 'student') {
      state.auth.student = res.token;
      renderStudentDashboard(res.token);
    } else alert(res.message || 'Login failed');
  });

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then((r) => r.json());

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
