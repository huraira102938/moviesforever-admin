import { useEffect, useMemo, useRef, useState } from 'react'
import type { Movie } from '../lib/types'
import { cn } from './cn'

interface MovieSearchSelectProps {
  movies: Movie[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function MovieSearchSelect({ movies, value, onChange, placeholder = 'Search and select a movie' }: MovieSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = movies.find(m => m.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return movies
    return movies.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.year && String(m.year).includes(q))
    )
  }, [movies, query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => { setHighlighted(0) }, [query, open])

  function selectMovie(id: string) {
    onChange(id)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setHighlighted(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHighlighted(h => Math.max(h - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter') { if (filtered[highlighted]) selectMovie(filtered[highlighted].id) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : (selected ? selected.title : '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={handleKeyDown}
        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-400">No movies found</div>
          )}
          {filtered.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectMovie(m.id)}
              onMouseEnter={() => setHighlighted(idx)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-100',
                highlighted === idx && 'bg-gray-100',
                m.id === value && 'text-indigo-600 font-medium'
              )}
            >
              <span className="truncate">{m.title}</span>
              {m.year && <span className="text-xs text-gray-400 shrink-0">{m.year}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
