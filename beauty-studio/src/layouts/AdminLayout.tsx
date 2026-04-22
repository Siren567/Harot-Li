import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Calendar, Clock, Scissors, Users, Image, Settings, Bell } from 'lucide-react';
import { useStore } from '../store/AppStore';

const ADMIN_USERNAME = 'avishag';
const ADMIN_PASSWORD = 'Mnvc1029&@';
const ADMIN_SESSION_KEY = 'beauty-studio-admin-auth-v1';

export function AdminLayout() {
  const { notifications, settings } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok');
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const isValid = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
    if (!isValid) {
      setError('שם משתמש או סיסמה שגויים');
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
    setIsAuthenticated(true);
    setError('');
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  }

  const unread = notifications.filter(n => !n.read).length;

  if (!isAuthenticated) {
    return (
      <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
        <div className="card">
          <h1 className="mb-2">כניסת אדמין</h1>
          <p className="text-sm text-muted mb-4">הגישה לפאנל מוגנת בסיסמה</p>
          <form onSubmit={onSubmit} className="stack-md">
            <div>
              <label className="text-sm">שם משתמש</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="text-sm">סיסמה</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <div className="text-sm" style={{ color: '#b42318' }}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-block">כניסה</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link to="/" className="brand" style={{ fontSize: 20 }}>
            <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 12 }}>L</span>
            {settings.name}
          </Link>
          <div className="text-xs text-muted mt-2">לוח ניהול</div>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin" end><LayoutDashboard size={16}/> סקירה</NavLink>
          <NavLink to="/admin/appointments"><Calendar size={16}/> תורים</NavLink>
          <NavLink to="/admin/calendar"><Calendar size={16}/> יומן</NavLink>
          <NavLink to="/admin/services"><Scissors size={16}/> טיפולים</NavLink>
          <NavLink to="/admin/availability"><Clock size={16}/> זמינות</NavLink>
          <NavLink to="/admin/customers"><Users size={16}/> לקוחות</NavLink>
          <NavLink to="/admin/gallery"><Image size={16}/> גלריה</NavLink>
          <NavLink to="/admin/notifications"><Bell size={16}/> התראות {unread > 0 && <span className="badge badge-pending" style={{ marginInlineStart: 'auto' }}>{unread}</span>}</NavLink>
          <NavLink to="/admin/settings"><Settings size={16}/> הגדרות</NavLink>
        </nav>
        <button type="button" className="btn btn-ghost mt-4" onClick={logout}>התנתקות</button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
