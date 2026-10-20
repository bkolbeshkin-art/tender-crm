'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/requests', label: 'Заявки' },
  { href: '/customers', label: 'Заказчики' },
  { href: '/manufacturers', label: 'Производители' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-white">
      <div className="max-w-3xl mx-auto px-8 py-3 flex items-center gap-6">
        <span className="font-semibold">Тендер-CRM</span>
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                active
                  ? 'text-sm font-medium text-black'
                  : 'text-sm text-gray-500 hover:text-black'
              }
            >
              {l.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}