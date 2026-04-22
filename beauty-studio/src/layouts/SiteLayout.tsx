import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Instagram, MessageCircle, MapPin, Phone, Clock } from 'lucide-react';
import { useStore } from '../store/AppStore';

export function SiteLayout() {
  const { settings } = useStore();
  const loc = useLocation();
  const showMobileCta = !loc.pathname.startsWith('/book') && loc.pathname !== '/booking-success';
  return (
    <div>
      {settings.campaignBanner && (
        <div style={{ background: 'var(--charcoal)', color: 'var(--cream)', textAlign: 'center', padding: '8px 16px', fontSize: 13 }}>
          {settings.campaignBanner}
        </div>
      )}
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">L</span>
            Lumière
          </Link>
          <nav className="site-nav">
            <NavLink to="/">בית</NavLink>
            <NavLink to="/services">טיפולים</NavLink>
            <NavLink to="/gallery">גלריה</NavLink>
            <Link to="/book" className="btn btn-primary btn-sm">לקביעת תור</Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="brand mb-3"><span className="brand-mark">L</span>{settings.name}</div>
            <p className="text-sm text-muted" style={{ maxWidth: 320 }}>{settings.tagline}</p>
            <div className="flex gap-3 mt-4">
              <a href={`https://instagram.com/${settings.instagram}`} aria-label="אינסטגרם"><Instagram size={18} /></a>
              <a href={`https://wa.me/${settings.whatsapp}`} aria-label="וואטסאפ"><MessageCircle size={18} /></a>
              <a href={`tel:${settings.phone}`} aria-label="טלפון"><Phone size={18} /></a>
            </div>
          </div>
          <div className="footer-col">
            <h4>ניווט</h4>
            <Link to="/">בית</Link>
            <Link to="/services">טיפולים</Link>
            <Link to="/gallery">גלריה</Link>
            <Link to="/book">קביעת תור</Link>
          </div>
          <div className="footer-col">
            <h4>יצירת קשר</h4>
            <a className="flex items-center gap-2"><MapPin size={14} /> {settings.address}</a>
            <a className="flex items-center gap-2" href={`tel:${settings.phone}`}><Phone size={14} /> {settings.phone}</a>
            <a className="flex items-center gap-2"><MessageCircle size={14} /> {settings.email}</a>
          </div>
          <div className="footer-col">
            <h4>שעות פעילות</h4>
            <div className="text-sm text-muted flex items-center gap-2"><Clock size={14}/> א׳–ה׳ · 09:00–20:00</div>
            <div className="text-sm text-muted">ו׳–ש׳ · סגור</div>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} {settings.name} · כל הזכויות שמורות</div>
      </footer>

      {showMobileCta && (
        <div className="mobile-cta">
          <Link to="/book" className="btn btn-primary btn-block btn-lg" style={{ boxShadow: 'var(--shadow-lg)' }}>לקביעת תור</Link>
        </div>
      )}
    </div>
  );
}
