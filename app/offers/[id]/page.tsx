'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type OfferDetail = {
  id: string
  request_id: string
  number: string | null
  status: string
  total_amount: number | null
  currency: string | null
}

type RequestInfo = {
  id: string
  number: string | null
  customer_id: string
  status: string
  customers: { name: string } | null
}

type RequestItem = {
  id: string
  product_name: string
  unit: string | null
  quantity: number | null
}

type FactoryOption = {
  id: string
  request_item_id: string
  response_price: number | null
  response_currency: string | null
  response_lead_time_days: number | null
  factory_requests: {
    manufacturers: { name: string } | null
  } | null
}

type ExistingOfferItem = {
  request_item_id: string
  cost_price: number | null
  markup_percent: number | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлено',
  accepted: 'Принято',
  rejected: 'Отклонено',
}

export default function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [offer, setOffer] = useState<OfferDetail | null>(null)
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null)
  const [items, setItems] = useState<RequestItem[]>([])
  const [options, setOptions] = useState<FactoryOption[]>([])
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({})
  const [markup, setMarkup] = useState<Record<string, string>>({})
  const [contractId, setContractId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function loadData() {
    setLoading(true)

    const { data: offerData, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single()

    if (offerError || !offerData) {
      setError(offerError?.message ?? 'КП не найдено')
      setLoading(false)
      return
    }

    setOffer(offerData)

    const { data: requestData } = await supabase
      .from('requests')
      .select('id, number, customer_id, status, customers(name)')
      .eq('id', offerData.request_id)
      .single()

    setRequestInfo(requestData as unknown as RequestInfo)

    const { data: itemsData } = await supabase
      .from('request_items')
      .select('id, product_name, unit, quantity')
      .eq('request_id', offerData.request_id)
      .order('position_no', { ascending: true })

    setItems(itemsData ?? [])

    const { data: optionsData } = await supabase
      .from('factory_request_items')
      .select(
        'id, request_item_id, response_price, response_currency, response_lead_time_days, factory_requests!inner(request_id, manufacturers(name))'
      )
      .eq('factory_requests.request_id', offerData.request_id)

    setOptions((optionsData as unknown as FactoryOption[]) ?? [])

    const { data: existingItems } = await supabase
      .from('offer_items')
      .select('request_item_id, cost_price, markup_percent')
      .eq('offer_id', id)

    const initialMarkup: Record<string, string> = {}
    const initialSelected: Record<string, string> = {}
    ;(existingItems as ExistingOfferItem[] | null)?.forEach((ei) => {
      initialMarkup[ei.request_item_id] = ei.markup_percent?.toString() ?? '20'
      const match = (optionsData as unknown as FactoryOption[] | null)?.find(
        (o) => o.request_item_id === ei.request_item_id && o.response_price === ei.cost_price
      )
      if (match) initialSelected[ei.request_item_id] = match.id
    })

    ;(optionsData as unknown as FactoryOption[] | null)?.forEach((o) => {
      if (!initialSelected[o.request_item_id]) {
        const optionsForItem = (optionsData as unknown as FactoryOption[]).filter(
          (x) => x.request_item_id === o.request_item_id
        )
        const cheapest = optionsForItem.reduce((min, cur) =>
          (cur.response_price ?? Infinity) < (min.response_price ?? Infinity) ? cur : min
        )
        initialSelected[o.request_item_id] = cheapest.id
      }
      if (!initialMarkup[o.request_item_id]) {
        initialMarkup[o.request_item_id] = '20'
      }
    })

    setSelectedOption(initialSelected)
    setMarkup(initialMarkup)

    const { data: contractData } = await supabase
      .from('contracts')
      .select('id')
      .eq('request_id', offerData.request_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setContractId(contractData?.id ?? null)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  function optionsForItem(itemId: string) {
    return options.filter((o) => o.request_item_id === itemId)
  }

  function calcRow(item: RequestItem) {
    const optId = selectedOption[item.id]
    const option = options.find((o) => o.id === optId)
    const costPrice = option?.response_price ?? 0
    const markupPercent = Number(markup[item.id] ?? 0)
    const unitPrice = costPrice * (1 + markupPercent / 100)
    const totalPrice = unitPrice * (item.quantity ?? 0)
    return { option, costPrice, unitPrice, totalPrice }
  }

  const grandTotal = items.reduce((sum, item) => sum + calcRow(item).totalPrice, 0)

  async function handleSave() {
    setError(null)
    setSaved(false)

    await supabase.from('offer_items').delete().eq('offer_id', id)

    const rows = items
      .filter((item) => selectedOption[item.id])
      .map((item) => {
        const { costPrice, unitPrice, totalPrice } = calcRow(item)
        return {
          offer_id: id,
          request_item_id: item.id,
          quantity: item.quantity,
          cost_price: costPrice,
          markup_percent: Number(markup[item.id] ?? 0),
          unit_price: unitPrice,
          total_price: totalPrice,
        }
      })

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('offer_items').insert(rows)
      if (insertError) {
        setError(insertError.message)
        return
      }
    }

    const { error: updateError } = await supabase
      .from('offers')
      .update({ total_amount: grandTotal, status: 'sent' })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await supabase.from('requests').update({ status: 'quote_sent' }).eq('id', requestInfo?.id)

    setSaved(true)
    loadData()
  }

  async function handleMarkStatus(status: 'accepted' | 'rejected') {
    setError(null)

    const { error: offerErr } = await supabase.from('offers').update({ status }).eq('id', id)
    if (offerErr) {
      setError(offerErr.message)
      return
    }

    const requestStatus = status === 'accepted' ? 'won' : 'lost'
    await supabase.from('requests').update({ status: requestStatus }).eq('id', requestInfo?.id)

    loadData()
  }

  async function handleGoToContract() {
    if (contractId) {
      router.push(`/contracts/${contractId}`)
      return
    }

    if (!requestInfo) return

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        request_id: requestInfo.id,
        customer_id: requestInfo.customer_id,
        amount: offer?.total_amount ?? 0,
        currency: offer?.currency ?? 'RUB',
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/contracts/${data.id}`)
  }

  if (loading) {
    return <main className="max-w-3xl mx-auto p-8 text-gray-500">Загрузка...</main>
  }

  if (!offer) {
    return <main className="max-w-3xl mx-auto p-8 text-red-600">{error ?? 'КП не найдено'}</main>
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link href={`/requests/${offer.request_id}`} className="text-sm text-blue-600 hover:underline">
        ← К заявке
      </Link>

      <div className="flex justify-between items-start mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            КП {offer.number || `#${offer.id.slice(0, 8)}`}
          </h1>
          <p className="text-gray-600">{requestInfo?.customers?.name}</p>
        </div>
        <span className="text-sm border rounded px-3 py-1">
          {STATUS_LABELS[offer.status] ?? offer.status}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500">В заявке нет позиций</p>
      ) : (
        <table className="w-full border-collapse text-sm mb-6">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-2">Товар</th>
              <th className="py-2 pr-2">Кол-во</th>
              <th className="py-2 pr-2">Поставщик / цена</th>
              <th className="py-2 pr-2">Наценка, %</th>
              <th className="py-2 pr-2">Цена за ед.</th>
              <th className="py-2 pr-2">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const itemOptions = optionsForItem(item.id)
              const { unitPrice, totalPrice } = calcRow(item)
              return (
                <tr key={item.id} className="border-b">
                  <td className="py-2 pr-2">{item.product_name}</td>
                  <td className="py-2 pr-2">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2 pr-2">
                    {itemOptions.length === 0 ? (
                      <span className="text-gray-400">нет ответа завода</span>
                    ) : (
                      <select
                        className="border rounded px-2 py-1"
                        value={selectedOption[item.id] ?? ''}
                        onChange={(e) =>
                          setSelectedOption((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      >
                        {itemOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.factory_requests?.manufacturers?.name} — {o.response_price}{' '}
                            {o.response_currency} ({o.response_lead_time_days} дн.)
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="border rounded px-2 py-1 w-16"
                      type="number"
                      value={markup[item.id] ?? '20'}
                      onChange={(e) =>
                        setMarkup((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">{unitPrice.toFixed(2)}</td>
                  <td className="py-2 pr-2 font-medium">{totalPrice.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className="text-right text-lg font-semibold mb-6">
        Итого: {grandTotal.toFixed(2)} {offer.currency}
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleSave}
          className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Сохранить и отправить КП
        </button>
        <button
          onClick={() => handleMarkStatus('accepted')}
          className="bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700"
        >
          Принято
        </button>
        <button
          onClick={() => handleMarkStatus('rejected')}
          className="bg-red-600 text-white rounded px-4 py-2 hover:bg-red-700"
        >
          Отклонено
        </button>
      </div>

      {offer.status === 'accepted' && (
        <button
          onClick={handleGoToContract}
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 mb-4"
        >
          {contractId ? 'Открыть контракт' : 'Создать контракт'}
        </button>
      )}

      {saved && <p className="text-green-600 text-sm mt-2">Сохранено</p>}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </main>
  )
}