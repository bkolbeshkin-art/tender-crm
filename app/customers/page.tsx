'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: string
  name: string
  inn: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [inn, setInn] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setCustomers(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Название заказчика обязательно')
      return
    }

    const { error } = await supabase.from('customers').insert({
      name: name.trim(),
      inn: inn.trim() || null,
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    })

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setInn('')
    setContactPerson('')
    setPhone('')
    setEmail('')
    loadCustomers()
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Заказчики</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-8 p-4 border rounded-lg">
        <input
          className="border rounded px-3 py-2 col-span-2"
          placeholder="Название организации *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="ИНН"
          value={inn}
          onChange={(e) => setInn(e.target.value)}
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
          Добавить заказчика
        </button>
        {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
      </form>

      <h2 className="text-lg font-medium mb-3">Список заказчиков</h2>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : customers.length === 0 ? (
        <p className="text-gray-500">Пока нет ни одного заказчика</p>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id} className="border rounded-lg p-3">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-500">
                {[c.inn, c.contact_person, c.phone, c.email].filter(Boolean).join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
