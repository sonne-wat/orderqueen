'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface AdminNavProps {
  userName?: string | null
  pendingRequestCount?: number
}

const navLinks = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/shipment-requests', label: 'Shipment Requests' },
  { href: '/admin/distributors', label: 'Distributors' },
  { href: '/admin/products', label: 'Products' },
]

export function AdminNav({ userName, pendingRequestCount = 0 }: AdminNavProps) {
  const pathname = usePathname()

  return (
    <header className="bg-gray-900 text-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/admin/dashboard" className="text-xl font-bold text-white">
          Orderqueen <span className="text-xs font-normal text-gray-400 ml-1">Admin</span>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
            const isPendingNav = href === '/admin/shipment-requests'
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                {label}
                {isPendingNav && pendingRequestCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
