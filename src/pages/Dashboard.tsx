import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Film, Users, Ticket, Image as ImageIcon, Settings, Layers, Tag } from 'lucide-react'

interface StatCardProps {
  label: string
  count: number
  icon: React.ReactNode
  color: string
  to: string
}

function StatCard({ label, count, icon, color, to }: StatCardProps) {
  return (
    <Link to={to} className={`block rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{count}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [counts, setCounts] = useState({ movies: 0, categories: 0, genres: 0, codes: 0, users: 0, banners: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [moviesSnap, categoriesSnap, genresSnap, codesSnap, usersSnap, bannersSnap] = await Promise.all([
          getCountFromServer(collection(db, 'movies')),
          getCountFromServer(collection(db, 'categories')),
          getCountFromServer(collection(db, 'genres')),
          getCountFromServer(collection(db, 'codes')),
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'banners')),
        ])
        setCounts({
          movies: moviesSnap.data().count,
          categories: categoriesSnap.data().count,
          genres: genresSnap.data().count,
          codes: codesSnap.data().count,
          users: usersSnap.data().count,
          banners: bannersSnap.data().count,
        })
      } catch (err) {
        console.error('Failed to fetch counts:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCounts()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your MoviesForever admin panel</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Movies" count={counts.movies} icon={<Film className="w-6 h-6 text-indigo-600" />} color="bg-indigo-50" to="/movies/list" />
        <StatCard label="Categories" count={counts.categories} icon={<Layers className="w-6 h-6 text-emerald-600" />} color="bg-emerald-50" to="/categories" />
        <StatCard label="Genres" count={counts.genres} icon={<Tag className="w-6 h-6 text-amber-600" />} color="bg-amber-50" to="/genres" />
        <StatCard label="Redemption Codes" count={counts.codes} icon={<Ticket className="w-6 h-6 text-purple-600" />} color="bg-purple-50" to="/codes" />
        <StatCard label="Users" count={counts.users} icon={<Users className="w-6 h-6 text-blue-600" />} color="bg-blue-50" to="/users" />
        <StatCard label="Banners" count={counts.banners} icon={<ImageIcon className="w-6 h-6 text-pink-600" />} color="bg-pink-50" to="/banners" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/movies/upload" className="block rounded-xl border bg-indigo-600 text-white p-5 shadow-sm hover:bg-indigo-700 transition-colors">
          <div className="flex items-center gap-3">
            <Film className="w-8 h-8" />
            <div>
              <p className="font-semibold text-lg">Upload New Movie</p>
              <p className="text-indigo-200 text-sm">Add a new movie to the catalog</p>
            </div>
          </div>
        </Link>
        <Link to="/pricing" className="block rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-600" />
            <div>
              <p className="font-semibold text-lg text-gray-900">Pricing Settings</p>
              <p className="text-gray-500 text-sm">Manage pricing and referral payouts</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}