import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Film,
  FolderOpen,
  Tag,
  Ticket,
  CreditCard,
  Users,
  Image as ImageIcon,
  Settings,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', group: 'Main' },
  { to: '/movies/upload', icon: Film, label: 'Upload Movie', group: 'Content' },
  { to: '/movies/list', icon: FolderOpen, label: 'All Movies', group: 'Content' },
  { to: '/categories', icon: FolderOpen, label: 'Categories', group: 'Content' },
  { to: '/genres', icon: Tag, label: 'Genres', group: 'Content' },
  { to: '/banners', icon: ImageIcon, label: 'Banners', group: 'Content' },
  { to: '/codes', icon: Ticket, label: 'Code Generator', group: 'Users & Codes' },
  { to: '/payments', icon: CreditCard, label: 'Payment Verify', group: 'Users & Codes' },
  { to: '/referrals', icon: Users, label: 'Referrals', group: 'Users & Codes' },
  { to: '/users', icon: Users, label: 'User Management', group: 'Users & Codes' },
  { to: '/pricing', icon: Settings, label: 'Pricing Settings', group: 'Settings' },
]

const groupOrder = ['Main', 'Content', 'Users & Codes', 'Settings']

export default function Sidebar() {
  const grouped = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-indigo-600">MoviesForever</h1>
        <p className="text-xs text-gray-400">Admin Panel</p>
      </div>
      <nav className="flex-1 px-2 pb-4">
        {groupOrder.map(group => {
          const items = grouped[group]
          if (!items) return null
          return (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 pt-4 pb-1">{group}</p>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}