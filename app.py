import base64
import hashlib
import hmac
import json
import os
import sqlite3
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
PUBLIC = ROOT / 'public'
DB_PATH = ROOT / 'equation.db'
SECRET = b'equation-secret-key'


def conn():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    db = conn()
    cur = db.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          student_code TEXT UNIQUE,
          class_name TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          one_on_one_min INTEGER NOT NULL,
          one_on_one_max INTEGER NOT NULL,
          group_min INTEGER NOT NULL,
          group_max INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_name TEXT NOT NULL,
          parent_name TEXT,
          phone TEXT NOT NULL,
          email TEXT NOT NULL,
          class_name TEXT NOT NULL,
          course_id INTEGER NOT NULL,
          mode TEXT NOT NULL,
          preferred_slots TEXT,
          notes TEXT,
          pricing_per_hour INTEGER NOT NULL,
          total_cost INTEGER NOT NULL,
          payment_status TEXT DEFAULT 'pending',
          payment_proof TEXT,
          user_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          session_date TEXT NOT NULL,
          meet_link TEXT NOT NULL,
          topic TEXT,
          status TEXT DEFAULT 'upcoming'
        );
        CREATE TABLE IF NOT EXISTS materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          session_id INTEGER NOT NULL,
          status TEXT DEFAULT 'present'
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    admin = cur.execute("SELECT id FROM users WHERE role='admin' LIMIT 1").fetchone()
    if not admin:
        cur.execute(
            "INSERT INTO users(name,email,phone,password_hash,role) VALUES (?,?,?,?,?)",
            ('Admin', 'admin@equation.com', '9424135055', hash_password('admin123'), 'admin')
        )

    requested_admin = cur.execute('SELECT id FROM users WHERE email=?', ('rkj.jain2204@gmail.com',)).fetchone()
    if not requested_admin:
        cur.execute(
            "INSERT INTO users(name,email,phone,password_hash,role) VALUES (?,?,?,?,?)",
            ('RKJ Admin', 'rkj.jain2204@gmail.com', '9424135055', hash_password('admin123'), 'admin')
        )

    count = cur.execute('SELECT COUNT(*) c FROM courses').fetchone()['c']
    if count == 0:
        courses = [
            ('JEE Mathematics', 'Advanced problem-solving for competitive exam success.', 350, 500, 250, 400),
            ('IOQM Mathematics', 'Olympiad-focused reasoning, number theory, and algebra.', 300, 480, 220, 380),
            ('NMTC Mathematics', 'Conceptual strengthening and practice for NMTC.', 280, 420, 200, 340),
            ('Thinking-Based Mathematics', 'Build intuition through puzzles and logic.', 250, 400, 180, 320),
            ('Boards Preparation (Class 10th)', 'Structured board exam prep with test series.', 220, 350, 160, 280),
            ('Boards Preparation (Class 12th)', 'Exam-oriented strategy for high board scores.', 240, 380, 170, 300),
            ('Crash Courses in Mathematics', 'Intensive revision for fast-track performance.', 200, 330, 150, 260)
        ]
        cur.executemany(
            "INSERT INTO courses(title,description,one_on_one_min,one_on_one_max,group_min,group_max) VALUES (?,?,?,?,?,?)",
            courses
        )
    db.commit()
    db.close()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(user):
    payload = f"{user['id']}|{user['role']}|{int(datetime.utcnow().timestamp()) + 28800}"
    sig = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def decode_token(token):
    try:
        raw = base64.urlsafe_b64decode(token).decode()
        uid, role, exp, sig = raw.split('|')
        payload = f"{uid}|{role}|{exp}"
        expected = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        if int(exp) < int(datetime.utcnow().timestamp()):
            return None
        return {'id': int(uid), 'role': role}
    except Exception:
        return None


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode())

    def _auth(self):
        header = self.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        return decode_token(header.split(' ', 1)[1])

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith('/api/'):
            return self.api_get(path)
        return self.serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        return self.api_post(path)

    def do_PUT(self):
        path = urlparse(self.path).path
        return self.api_put(path)

    def api_get(self, path):
        db = conn()
        cur = db.cursor()
        if path == '/api/meta':
            return self._json(200, {
                'whatsapp': 'https://wa.me/919424135055',
                'upiId': '9424135055@ptyes',
                'qrPaymentLink': 'upi://pay?pa=9424135055@ptyes&pn=RKJ%20Equation&cu=INR'
            })
        if path == '/api/courses':
            rows = [dict(r) for r in cur.execute('SELECT * FROM courses').fetchall()]
            return self._json(200, rows)
        if path == '/api/student/dashboard':
            user = self._auth()
            if not user or user['role'] != 'student':
                return self._json(401, {'message': 'Unauthorized'})
            u = dict(cur.execute('SELECT id,name,email,student_code,class_name FROM users WHERE id=?', (user['id'],)).fetchone())
            sessions = [dict(r) for r in cur.execute('SELECT s.*, c.title course_title FROM sessions s JOIN courses c ON c.id=s.course_id WHERE s.user_id=?', (user['id'],)).fetchall()]
            mats = [dict(r) for r in cur.execute('SELECT title,url FROM materials WHERE user_id=?', (user['id'],)).fetchall()]
            attendance = [dict(r) for r in cur.execute('SELECT a.status,s.topic FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.user_id=?', (user['id'],)).fetchall()]
            notifications = [dict(r) for r in cur.execute('SELECT message FROM notifications WHERE user_id=?', (user['id'],)).fetchall()]
            history = [s for s in sessions if s['status'] == 'completed']
            upcoming = [s for s in sessions if s['status'] != 'completed']
            progress = round((len(history) / len(sessions)) * 100) if sessions else 0
            return self._json(200, {'user': u, 'upcoming': upcoming, 'materials': mats, 'attendance': attendance, 'history': history, 'notifications': notifications, 'progress': progress})
        if path == '/api/admin/bookings':
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            rows = [dict(r) for r in cur.execute('SELECT b.*, c.title course_title FROM bookings b JOIN courses c ON c.id=b.course_id ORDER BY b.id DESC').fetchall()]
            return self._json(200, rows)
        return self._json(404, {'message': 'Not found'})

    def api_post(self, path):
        body = self._body()
        db = conn()
        cur = db.cursor()
        if path == '/api/bookings':
            required = ['studentName', 'phone', 'email', 'className', 'courseId', 'mode']
            if any(not body.get(k) for k in required):
                return self._json(400, {'message': 'Missing required fields'})
            course = cur.execute('SELECT * FROM courses WHERE id=?', (body['courseId'],)).fetchone()
            if not course:
                return self._json(404, {'message': 'Course not found'})
            if body['mode'] == 'one-on-one':
                min_p, max_p = course['one_on_one_min'], course['one_on_one_max']
            else:
                min_p, max_p = course['group_min'], course['group_max']
            price = (min_p + max_p) // 2
            hours = int(body.get('totalHours', 1))
            total = price * hours
            cur.execute(
                """INSERT INTO bookings(student_name,parent_name,phone,email,class_name,course_id,mode,preferred_slots,notes,pricing_per_hour,total_cost)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (body['studentName'], body.get('parentName', ''), body['phone'], body['email'], body['className'], body['courseId'], body['mode'], body.get('preferredSlots', ''), body.get('notes', ''), price, total)
            )
            bid = cur.lastrowid
            db.commit()
            booking = dict(cur.execute('SELECT b.*, c.title course_title FROM bookings b JOIN courses c ON c.id=b.course_id WHERE b.id=?', (bid,)).fetchone())
            return self._json(201, booking)
        if path.endswith('/confirm') and path.startswith('/api/bookings/'):
            bid = int(path.split('/')[3])
            cur.execute('UPDATE bookings SET payment_status=?, payment_proof=? WHERE id=?', ('submitted', body.get('paymentProof', ''), bid))
            db.commit()
            return self._json(200, {'message': 'Payment submitted for verification.'})
        if path == '/api/auth/login':
            user = cur.execute('SELECT * FROM users WHERE email=?', (body.get('email', ''),)).fetchone()
            if not user or user['password_hash'] != hash_password(body.get('password', '')):
                return self._json(401, {'message': 'Invalid credentials'})
            token = create_token(user)
            return self._json(200, {'token': token, 'role': user['role'], 'name': user['name'], 'studentCode': user['student_code']})
        if path.endswith('/approve') and path.startswith('/api/admin/bookings/'):
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            bid = int(path.split('/')[4])
            booking = cur.execute('SELECT * FROM bookings WHERE id=?', (bid,)).fetchone()
            if not booking:
                return self._json(404, {'message': 'Not found'})
            student = cur.execute('SELECT * FROM users WHERE email=?', (booking['email'],)).fetchone()
            if not student:
                student_code = 'EQ-' + hashlib.md5(f"{booking['email']}{datetime.utcnow()}".encode()).hexdigest()[:8].upper()
                temp_pw = 'Eqn@1234'
                cur.execute(
                    'INSERT INTO users(name,email,phone,password_hash,role,student_code,class_name) VALUES(?,?,?,?,?,?,?)',
                    (booking['student_name'], booking['email'], booking['phone'], hash_password(temp_pw), 'student', student_code, booking['class_name'])
                )
                student_id = cur.lastrowid
                student_email = booking['email']
            else:
                student_id = student['id']
                student_code = student['student_code']
                student_email = student['email']
            cur.execute('UPDATE bookings SET payment_status=?, user_id=? WHERE id=?', ('approved', student_id, bid))
            course = cur.execute('SELECT * FROM courses WHERE id=?', (booking['course_id'],)).fetchone()
            when = (datetime.utcnow() + timedelta(days=1)).isoformat()
            cur.execute('INSERT INTO sessions(user_id,course_id,session_date,meet_link,topic,status) VALUES(?,?,?,?,?,?)', (student_id, booking['course_id'], when, 'https://meet.google.com/new', f"{course['title']} - Intro Session", 'upcoming'))
            cur.execute('INSERT INTO materials(user_id,title,url) VALUES(?,?,?)', (student_id, f"{course['title']} Starter Pack", 'https://drive.google.com/'))
            cur.execute('INSERT INTO notifications(user_id,message) VALUES(?,?)', (student_id, 'Your payment has been approved. Welcome to RKJ Equation!'))
            db.commit()
            return self._json(200, {'message': 'Booking approved', 'studentCode': student_code, 'studentEmail': student_email})
        if path == '/api/admin/sessions':
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            cur.execute('INSERT INTO sessions(user_id,course_id,session_date,meet_link,topic,status) VALUES(?,?,?,?,?,?)',
                        (body['userId'], body['courseId'], body['sessionDate'], body['meetLink'], body.get('topic', ''), body.get('status', 'upcoming')))
            db.commit()
            return self._json(200, {'message': 'Session added'})
        if path == '/api/admin/attendance':
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            cur.execute('INSERT INTO attendance(user_id,session_id,status) VALUES(?,?,?)', (body['userId'], body['sessionId'], body['status']))
            db.commit()
            return self._json(200, {'message': 'Attendance updated'})
        if path == '/api/admin/notify-whatsapp':
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            msg = (body.get('message') or 'Your class update from RKJ Equation').replace(' ', '%20')
            return self._json(200, {'link': f"https://wa.me/{body['phone']}?text={msg}"})
        return self._json(404, {'message': 'Not found'})

    def api_put(self, path):
        body = self._body()
        if path.startswith('/api/admin/pricing/'):
            user = self._auth()
            if not user or user['role'] != 'admin':
                return self._json(401, {'message': 'Unauthorized'})
            cid = int(path.split('/')[-1])
            db = conn()
            db.execute('UPDATE courses SET one_on_one_min=?,one_on_one_max=?,group_min=?,group_max=? WHERE id=?',
                       (body['oneOnOneMin'], body['oneOnOneMax'], body['groupMin'], body['groupMax'], cid))
            db.commit()
            db.close()
            return self._json(200, {'message': 'Pricing updated'})
        return self._json(404, {'message': 'Not found'})

    def serve_static(self, path):
        if path == '/':
            path = '/index.html'
        file_path = PUBLIC / path.lstrip('/')
        if not file_path.exists() or not file_path.is_file():
            file_path = PUBLIC / 'index.html'
        content_type = 'text/plain'
        if file_path.suffix == '.html':
            content_type = 'text/html; charset=utf-8'
        elif file_path.suffix == '.css':
            content_type = 'text/css'
        elif file_path.suffix == '.js':
            content_type = 'application/javascript'
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', '3000'))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'Server running on http://localhost:{port}')
    server.serve_forever()
