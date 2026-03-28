'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface DistributorNavProps {
  userName?: string | null
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/orders/shipment-requests', label: 'Shipment Requests' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
]

export function DistributorNav({ userName }: DistributorNavProps) {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-0 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/dashboard" className="text-xl font-bold text-blue-700">
          Orderqueen
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
