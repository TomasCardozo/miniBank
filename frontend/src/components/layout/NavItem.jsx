import { NavLink } from 'react-router';
import styles from './NavItem.module.css';

export default function NavItem({ to, icon, label, end = false, onNavigate }) {
  const Icon = icon;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${styles.link} flex items-center gap-3 ${isActive ? styles.active : ''}`
      }
      onClick={onNavigate}
    >
      <span className={`${styles.icon} shrink-0`} aria-hidden="true">
        <Icon size={16} strokeWidth={1.6} />
      </span>
      <span>{label}</span>
    </NavLink>
  );
}
