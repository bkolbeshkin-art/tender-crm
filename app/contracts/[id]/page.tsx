'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ContractDetail = {
  id: string
  request_id: string
  customer_id: string
  number: string | null
  amount: number | null
  currency: string | null
  status: string
  signed_date: string | null
}

type CustomerInfo = {
  name: string
}

type RequestInfo = {
  number: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  signed: 'Подписан',
  executed: 'Исполняется',
  closed: 'Закрыт',
}

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [status, setStatus] = useState('draft')

  async function loadData(showLoading: boolean) {
    if (showLoading) setLoading(true)

    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (contractError || !contractData) {
      setError(contractError?.message ?? 'Контракт не найден')
      setLoading(false)
      return
    }

    setContract(contractData)
    setNumber(contractData.number ?? '')
    setAmount(contractData.amount?.toString() ?? '')
    setSignedDate(contractData.signed_date ?? '')
    setStatus(contractData.status ?? 'draft')

    const { data: customerData } = await supabase
      .from('customers')
      .select('name')
      .eq('id', contractData.customer_id)
      .single()

    setCustomer(customerData)

    const { data: requestData } = await supabase
      .from('requests')
      .select('number')
      .eq('id', contractData.request_id)
      .single()

    setRequestInfo(requestData)

    setLoading(false)
  }

  useEffect(() => {
    loadData(true)
  }, [id])

  async function handleSave() {
    setError(null)
    setMessage('Сохраняю...')

    try {
      const { data, error } = await supabase
        .from('contracts')
        .update({
          number: number.trim() || null,
          amount: amount ? Number(amount) : null,
          signed_date: signedDate || null,
          status,
        })
        .eq('id', id)
        .select()

      if (error) {
        setMessage(null)
        setError('Ошибка базы: ' + error.message)
        return
      }

      if (!data || data.length === 0) {
        setMessage(null)
        setError('База не обновила ни одной строки (возможно, мешают права доступа)')
        return
      }

      if (status === 'signed' && contract?.request_id) {
        await supabase
          .from('requests')
          .update({ status: 'contract' })
          .eq('id', contract.request_id)
      }

      setMessage('Сохранено ✓')
      await loadData(false)
    } catch (e) {
      setMessage(null)
      setError('Нет связи с базой: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  if (loading) {
    return <main className="max-w-3xl mx-auto p-8 text-gray-500">Загрузка...</main>
  }

  if (!contract) {
    return <main className="max-w-3xl mx-auto p-8 text-red-600">{error ?? 'Контракт не найден'}</main>
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link href={`/requests/${contract.request_id}`} className="text-sm text-blue-600 hover:underline">
        ← К заявке
      </Link>

      <div className="flex justify-between items-start mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Контракт {contract.number || `#${contract.id.slice(0, 8)}`}
          </h1>
          <p className="text-gray-600">{customer?.name}</p>
          <p className="text-sm text-gray-500">Заявка: {requestInfo?.number || '—'}</p>
        </div>
        <span className="text-sm border rounded px-3 py-1">
          {STATUS_LABELS[contract.status] ?? contract.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg mb-6">
        <div>
          <label className="text-sm text-gray-500 block mb-1">Номер контракта</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Например, К-001"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">Сумма</label>
          <input
            className="border rounded px-3 py-2 w-full"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">Дата подписания</label>
          <input
            className="border rounded px-3 py-2 w-full"
            type="date"
            value={signedDate}
            onChange={(e) => setSignedDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">Статус</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">Черновик</option>
            <option value="signed">Подписан</option>
            <option value="executed">Исполняется</option>
            <option value="closed">Закрыт</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
      >
        Сохранить контракт
      </button>

      {message && <p className="text-green-600 text-sm mt-3">{message}</p>}
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </main>
  )
}