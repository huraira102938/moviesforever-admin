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
  Share2,
  Bell,
  Flame,
  FileJson,
  ShieldAlert,
  Download,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', group: 'Main' },
  { to: '/installs', icon: Download, label: 'Installs', group: 'Main' },
  { to: '/movies/upload', icon: Film, label: 'Upload Movie', group: 'Content' },
  { to: '/movies/list', icon: FolderOpen, label: 'All Movies', group: 'Content' },
  { to: '/categories', icon: FolderOpen, label: 'Categories', group: 'Content' },
  { to: '/genres', icon: Tag, label: 'Genres', group: 'Content' },
  { to: '/banners', icon: ImageIcon, label: 'Banners', group: 'Content' },
  { to: '/trending', icon: Flame, label: 'Trending', group: 'Content' },
  { to: '/json-data', icon: FileJson, label: 'Movie Data (JSON)', group: 'Content' },
  { to: '/codes', icon: Ticket, label: 'Code Generator', group: 'Users & Codes' },
  { to: '/payments', icon: CreditCard, label: 'Payment Verify', group: 'Users & Codes' },
  { to: '/referrals', icon: Users, label: 'Referrals', group: 'Users & Codes' },
  { to: '/users', icon: Users, label: 'User Management', group: 'Users & Codes' },
  { to: '/app-sharing', icon: Share2, label: 'App Sharing', group: 'Settings' },
  { to: '/notifications', icon: Bell, label: 'Notifications', group: 'Settings' },
  { to: '/payment-details', icon: CreditCard, label: 'Payment Details', group: 'Settings' },
  { to: '/contact-details', icon: CreditCard, label: 'Contact Details', group: 'Settings' },
  { to: '/force-update', icon: ShieldAlert, label: 'Force Update', group: 'App Control' },
  { to: '/pricing', icon: Settings, label: 'Pricing Settings', group: 'Settings' },
]

const groupOrder = ['Main', 'Content', 'Users & Codes', 'App Control', 'Settings']

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const grouped = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 flex flex-col overflow-y-auto transition-transform duration-300 lg:translate-x-0 lg:static ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-indigo-600">MoviesForever</h1>
          <p className="text-xs text-gray-400">Admin Panel</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="hidden lg:block p-4 border-b border-gray-200">
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
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}