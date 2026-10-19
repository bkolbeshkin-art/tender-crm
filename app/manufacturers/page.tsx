'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Manufacturer = {
  id: string
  name: string
  country: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
}

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadManufacturers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setManufacturers(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadManufacturers()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Название завода обязательно')
      return
    }

    const { error } = await supabase.from('manufacturers').insert({
      name: name.trim(),
      country: country.trim() || null,
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    })

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setCountry('')
    setContactPerson('')
    setPhone('')
    setEmail('')
    loadManufacturers()
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Производители</h1>
        <Link href="/requests" className="text-sm text-blue-600 hover:underline">
          К заявкам
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-8 p-4 border rounded-lg">
        <input
          className="border rounded px-3 py-2 col-span-2"
          placeholder="Название завода *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Страна"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Контактное лицо"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="col-span-2 bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Добавить производителя
        </button>
        {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
      </form>

      <h2 className="text-lg font-medium mb-3">Список производителей</h2>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : manufacturers.length === 0 ? (
        <p className="text-gray-500">Пока нет ни одного производителя</p>
      ) : (
        <ul className="space-y-2">
          {manufacturers.map((m) => (
            <li key={m.id} className="border rounded-lg p-3">
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-gray-500">
                {[m.country, m.contact_person, m.phone, m.email].filter(Boolean).join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
