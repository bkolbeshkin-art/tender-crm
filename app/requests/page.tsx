'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: string
  name: string
}

type Request = {
  id: string
  number: string | null
  status: string
  description: string | null
  deadline: string | null
  customers: { name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  quote_sent: 'КП отправлено',
  won: 'Выиграна',
  lost: 'Проиграна',
  contract: 'Контракт',
}

export default function RequestsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [number, setNumber] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name')
      .order('name')

    const { data: requestsData, error } = await supabase
      .from('requests')
      .select('id, number, status, description, deadline, customers(name)')
      .order('created_at', { ascending: false })

    setCustomers(customersData ?? [])
    if (error) {
      setError(error.message)
    } else {
      setRequests((requestsData as unknown as Request[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!customerId) {
      setError('Выберите заказчика')
      return
    }

    const { error } = await supabase.from('requests').insert({
      customer_id: customerId,
      number: number.trim() || null,
      description: description.trim() || null,
      deadline: deadline || null,
      status: 'new',
    })

    if (error) {
      setError(error.message)
      return
    }

    setNumber('')
    setDescription('')
    setDeadline('')
    setCustomerId('')
    loadData()
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Заявки</h1>
        <Link href="/customers" className="text-sm text-blue-600 hover:underline">
          К заказчикам
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-8 p-4 border rounded-lg">
        <select
          className="border rounded px-3 py-2 col-span-2"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">Выберите заказчика *</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="border rounded px-3 py-2"
          placeholder="Номер заявки"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <textarea
          className="border rounded px-3 py-2 col-span-2"
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="submit"
          className="col-span-2 bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Создать заявку
        </button>
        {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
      </form>

      <h2 className="text-lg font-medium mb-3">Список заявок</h2>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">Пока нет ни одной заявки</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="block border rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {r.number || 'Без номера'} — {r.customers?.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                {r.deadline && (
                  <div className="text-sm text-gray-500">Срок: {r.deadline}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
