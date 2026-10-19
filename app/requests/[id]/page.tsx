'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type RequestDetail = {
  id: string
  number: string | null
  status: string
  description: string | null
  deadline: string | null
  customers: { name: string } | null
}

type RequestItem = {
  id: string
  position_no: number | null
  product_name: string
  specification: string | null
  unit: string | null
  quantity: number | null
  notes: string | null
}

type Manufacturer = {
  id: string
  name: string
}

type FactoryRequestItem = {
  id: string
  request_item_id: string
  quantity: number | null
  response_price: number | null
  response_currency: string | null
  response_lead_time_days: number | null
  response_comment: string | null
}

type FactoryRequest = {
  id: string
  manufacturer_id: string
  status: string
  manufacturers: { name: string } | null
  factory_request_items: FactoryRequestItem[]
}

type ResponseEdit = {
  price: string
  currency: string
  leadTime: string
  comment: string
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  quote_sent: 'КП отправлено',
  won: 'Выиграна',
  lost: 'Проиграна',
  contract: 'Контракт',
}

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [items, setItems] = useState<RequestItem[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([])
  const [offerId, setOfferId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [productName, setProductName] = useState('')
  const [specification, setSpecification] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')

  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  const [responseEdits, setResponseEdits] = useState<Record<string, ResponseEdit>>({})

  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))

  async function loadData() {
    setLoading(true)

    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('id, number, status, description, deadline, customers(name)')
      .eq('id', id)
      .single()

    const { data: itemsData, error: itemsError } = await supabase
      .from('request_items')
      .select('*')
      .eq('request_id', id)
      .order('position_no', { ascending: true })

    const { data: manufacturersData } = await supabase
      .from('manufacturers')
      .select('id, name')
      .order('name')

    const { data: factoryRequestsData, error: frError } = await supabase
      .from('factory_requests')
      .select('id, manufacturer_id, status, manufacturers(name), factory_request_items(*)')
      .eq('request_id', id)
      .order('sent_at', { ascending: false })

    const { data: offerData } = await supabase
      .from('offers')
      .select('id')
      .eq('request_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setOfferId(offerData?.id ?? null)

    if (requestError) setError(requestError.message)
    else setRequest(requestData as unknown as RequestDetail)

    if (itemsError) setError(itemsError.message)
    else setItems(itemsData ?? [])

    setManufacturers(manufacturersData ?? [])

    if (frError) {
      setError(frError.message)
    } else {
      const fr = (factoryRequestsData as unknown as FactoryRequest[]) ?? []
      setFactoryRequests(fr)

      const edits: Record<string, ResponseEdit> = {}
      fr.forEach((r) => {
        r.factory_request_items.forEach((fri) => {
          edits[fri.id] = {
            price: fri.response_price?.toString() ?? '',
            currency: fri.response_currency ?? 'RUB',
            leadTime: fri.response_lead_time_days?.toString() ?? '',
            comment: fri.response_comment ?? '',
          }
        })
      })
      setResponseEdits(edits)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!productName.trim()) {
      setError('Название товара обязательно')
      return
    }

    const nextPositionNo =
      items.length > 0 ? Math.max(...items.map((i) => i.position_no ?? 0)) + 1 : 1

    const { error } = await supabase.from('request_items').insert({
      request_id: id,
      position_no: nextPositionNo,
      product_name: productName.trim(),
      specification: specification.trim() || null,
      unit: unit.trim() || null,
      quantity: quantity ? Number(quantity) : null,
    })

    if (error) {
      setError(error.message)
      return
    }

    setProductName('')
    setSpecification('')
    setUnit('')
    setQuantity('')
    loadData()
  }

  async function handleDeleteItem(itemId: string) {
    await supabase.from('request_items').delete().eq('id', itemId)
    loadData()
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function handleCreateFactoryRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedManufacturer) {
      setError('Выберите производителя')
      return
    }
    if (selectedItemIds.size === 0) {
      setError('Выберите хотя бы одну позицию')
      return
    }

    const { data: frData, error: frError } = await supabase
      .from('factory_requests')
      .insert({
        request_id: id,
        manufacturer_id: selectedManufacturer,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (frError || !frData) {
      setError(frError?.message ?? 'Не удалось создать запрос')
      return
    }

    const rows = Array.from(selectedItemIds).map((itemId) => ({
      factory_request_id: frData.id,
      request_item_id: itemId,
      quantity: itemsById[itemId]?.quantity ?? null,
    }))

    const { error: itemsError } = await supabase.from('factory_request_items').insert(rows)

    if (itemsError) {
      setError(itemsError.message)
      return
    }

    setSelectedManufacturer('')
    setSelectedItemIds(new Set())
    loadData()
  }

  function handleResponseChange(itemId: string, field: keyof ResponseEdit, value: string) {
    setResponseEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  async function handleSaveResponses(fr: FactoryRequest) {
    setError(null)

    const updates = fr.factory_request_items.map((fri) => {
      const edit = responseEdits[fri.id]
      return supabase
        .from('factory_request_items')
        .update({
          response_price: edit.price ? Number(edit.price) : null,
          response_currency: edit.currency || null,
          response_lead_time_days: edit.leadTime ? Number(edit.leadTime) : null,
          response_comment: edit.comment || null,
          response_date: new Date().toISOString().slice(0, 10),
        })
        .eq('id', fri.id)
    })

    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)

    if (failed?.error) {
      setError(failed.error.message)
      return
    }

    await supabase.from('factory_requests').update({ status: 'answered' }).eq('id', fr.id)
    loadData()
  }

  async function handleGoToOffer() {
    if (offerId) {
      router.push(`/offers/${offerId}`)
      return
    }

    const { data, error } = await supabase
      .from('offers')
      .insert({ request_id: id, status: 'draft', currency: 'RUB' })
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/offers/${data.id}`)
  }

  if (loading) {
    return <main className="max-w-3xl mx-auto p-8 text-gray-500">Загрузка...</main>
  }

  if (!request) {
    return <main className="max-w-3xl mx-auto p-8 text-red-600">Заявка не найдена</main>
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link href="/requests" className="text-sm text-blue-600 hover:underline">
        ← К списку заявок
      </Link>

      <div className="flex justify-between items-start mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {request.number || 'Заявка без номера'}
          </h1>
          <p className="text-gray-600">{request.customers?.name}</p>
          {request.deadline && (
            <p className="text-sm text-gray-500">Срок: {request.deadline}</p>
          )}
          {request.description && (
            <p className="text-sm text-gray-500 mt-1">{request.description}</p>
          )}
        </div>
        <span className="text-sm border rounded px-3 py-1">
          {STATUS_LABELS[request.status] ?? request.status}
        </span>
      </div>

      <button
        onClick={handleGoToOffer}
        className="mb-6 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
      >
        {offerId ? 'Открыть КП' : 'Создать КП'}
      </button>

      <h2 className="text-lg font-medium mb-3">Позиции заявки</h2>

      <form onSubmit={handleAddItem} className="grid grid-cols-4 gap-3 mb-6 p-4 border rounded-lg">
        <input
          className="border rounded px-3 py-2 col-span-4"
          placeholder="Наименование товара *"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 col-span-2"
          placeholder="Характеристики"
          value={specification}
          onChange={(e) => setSpecification(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Ед. изм."
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Кол-во"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button
          type="submit"
          className="col-span-4 bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Добавить позицию
        </button>
        {error && <p className="col-span-4 text-red-600 text-sm">{error}</p>}
      </form>

      {items.length === 0 ? (
        <p className="text-gray-500 mb-8">Пока нет ни одной позиции</p>
      ) : (
        <table className="w-full border-collapse mb-8">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Товар</th>
              <th className="py-2 pr-2">Характеристики</th>
              <th className="py-2 pr-2">Ед.</th>
              <th className="py-2 pr-2">Кол-во</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2 pr-2">{item.position_no}</td>
                <td className="py-2 pr-2">{item.product_name}</td>
                <td className="py-2 pr-2 text-gray-500">{item.specification}</td>
                <td className="py-2 pr-2">{item.unit}</td>
                <td className="py-2 pr-2">{item.quantity}</td>
                <td className="py-2 pr-2 text-right">
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="text-lg font-medium mb-3">Новый запрос заводу</h2>

      <form
        onSubmit={handleCreateFactoryRequest}
        className="mb-8 p-4 border rounded-lg space-y-3"
      >
        <select
          className="border rounded px-3 py-2 w-full"
          value={selectedManufacturer}
          onChange={(e) => setSelectedManufacturer(e.target.value)}
        >
          <option value="">Выберите производителя *</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <div className="space-y-1">
          <p className="text-sm text-gray-500">Позиции для запроса:</p>
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedItemIds.has(item.id)}
                onChange={() => toggleItemSelection(item.id)}
              />
              {item.product_name} ({item.quantity} {item.unit})
            </label>
          ))}
        </div>

        <button
          type="submit"
          className="bg-black text-white rounded px-4 py-2 hover:bg-gray-800"
        >
          Отправить запрос заводу
        </button>
      </form>

      <h2 className="text-lg font-medium mb-3">Запросы заводам</h2>

      {factoryRequests.length === 0 ? (
        <p className="text-gray-500">Пока нет ни одного запроса заводу</p>
      ) : (
        <div className="space-y-6">
          {factoryRequests.map((fr) => (
            <div key={fr.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium">{fr.manufacturers?.name}</span>
                <span className="text-sm text-gray-500">
                  {fr.status === 'answered' ? 'Ответ получен' : 'Отправлен'}
                </span>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-2">Товар</th>
                    <th className="py-1 pr-2">Кол-во</th>
                    <th className="py-1 pr-2">Цена</th>
                    <th className="py-1 pr-2">Валюта</th>
                    <th className="py-1 pr-2">Срок, дн.</th>
                    <th className="py-1 pr-2">Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {fr.factory_request_items.map((fri) => {
                    const item = itemsById[fri.request_item_id]
                    const edit = responseEdits[fri.id] ?? {
                      price: '',
                      currency: 'RUB',
                      leadTime: '',
                      comment: '',
                    }
                    return (
                      <tr key={fri.id} className="border-b">
                        <td className="py-1 pr-2">{item?.product_name}</td>
                        <td className="py-1 pr-2">{fri.quantity}</td>
                        <td className="py-1 pr-2">
                          <input
                            className="border rounded px-2 py-1 w-20"
                            type="number"
                            value={edit.price}
                            onChange={(e) =>
                              handleResponseChange(fri.id, 'price', e.target.value)
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            className="border rounded px-2 py-1 w-16"
                            value={edit.currency}
                            onChange={(e) =>
                              handleResponseChange(fri.id, 'currency', e.target.value)
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            className="border rounded px-2 py-1 w-16"
                            type="number"
                            value={edit.leadTime}
                            onChange={(e) =>
                              handleResponseChange(fri.id, 'leadTime', e.target.value)
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={edit.comment}
                            onChange={(e) =>
                              handleResponseChange(fri.id, 'comment', e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <button
                onClick={() => handleSaveResponses(fr)}
                className="mt-3 bg-black text-white rounded px-4 py-2 text-sm hover:bg-gray-800"
              >
                Сохранить ответ завода
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}