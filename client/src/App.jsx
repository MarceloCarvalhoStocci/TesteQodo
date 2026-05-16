import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const emptyForm = {
  name: '',
  sku: '',
  category: '',
  fornecedor: '',
  price: '',
  stock: '',
  description: ''
}

const emptyReviewForm = {
  rating: '',
  comment: '',
  author: ''
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

function App() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [reviewingProduct, setReviewingProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewForm, setReviewForm] = useState(emptyReviewForm)
  const [savingReview, setSavingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products')

      if (!response.ok) {
        throw new Error('Não foi possível carregar os produtos.')
      }

      const data = await response.json()
      setProducts(data)
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchInitialProducts() {
      try {
        const response = await fetch('/api/products')

        if (!response.ok) {
          throw new Error('Não foi possível carregar os produtos.')
        }

        const data = await response.json()

        if (!cancelled) {
          setProducts(data)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchInitialProducts()

    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0)
    const totalValue = products.reduce(
      (sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0),
      0
    )

    return {
      count: products.length,
      totalStock,
      totalValue
    }
  }, [products])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const loadReviews = useCallback(async (productId, signal) => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, { signal })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Falha ao carregar avaliações.')
      }

      const data = await response.json()
      setReviews(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.name === 'AbortError') return
      setReviews([])
      setReviewError(err.message)
    }
  }, [])

  const reviewAbortRef = useRef(null)

  function openReviews(product) {
    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort()
    }

    const controller = new AbortController()
    reviewAbortRef.current = controller

    setReviewingProduct(product)
    setReviews([])
    setReviewForm(emptyReviewForm)
    setReviewError('')
    setReviewMessage('')
    loadReviews(product.id, controller.signal)
  }

  function closeReviews() {
    if (reviewAbortRef.current) {
      reviewAbortRef.current.abort()
      reviewAbortRef.current = null
    }

    setReviewingProduct(null)
    setReviews([])
    setReviewForm(emptyReviewForm)
    setReviewError('')
    setReviewMessage('')
  }

  function handleReviewChange(event) {
    const { name, value } = event.target
    setReviewForm((current) => ({ ...current, [name]: value }))
  }

  async function handleReviewSubmit(event) {
    event.preventDefault()
    setSavingReview(true)
    setReviewError('')
    setReviewMessage('')

    try {
      const response = await fetch(`/api/products/${reviewingProduct.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: Number(reviewForm.rating),
          comment: reviewForm.comment,
          author: reviewForm.author
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível salvar a avaliação.')
      }

      setReviewForm(emptyReviewForm)
      setReviewMessage('Avaliação registrada com sucesso.')
      await loadReviews(reviewingProduct.id)
    } catch (err) {
      setReviewError(err.message)
    } finally {
      setSavingReview(false)
    }
  }

  function startEditing(product) {
    setEditingId(product.id)
    setMessage('')
    setError('')
    setForm({
      name: product.name ?? '',
      sku: product.sku ?? '',
      category: product.category ?? '',
      fornecedor: product.fornecedor ?? '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
      description: product.description ?? ''
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setMessage('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      if (!form.name.trim()) {
        throw new Error('Informe o nome do produto.')
      }

      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category.trim(),
        fornecedor: form.fornecedor.trim(),
        price: Number(form.price),
        stock: Number.parseInt(form.stock, 10),
        description: form.description.trim()
      }

      const response = await fetch(
        editingId ? `/api/products/${editingId}` : '/api/products',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseData.message || 'Não foi possível salvar o produto.')
      }

      await loadProducts()
      setForm(emptyForm)
      setEditingId(null)
      setMessage(editingId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(productId) {
    const confirmed = window.confirm('Tem certeza que deseja remover este produto?')

    if (!confirmed) {
      return
    }

    setDeletingId(productId)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      })

      if (!response.ok && response.status !== 204) {
        const responseData = await response.json().catch(() => ({}))
        throw new Error(responseData.message || 'Não foi possível remover o produto.')
      }

      if (editingId === productId) {
        resetForm()
      }

      await loadProducts()
      setMessage('Produto removido com sucesso.')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CRUD de produtos</p>
          <h1>Gerencie seu catálogo em uma única tela.</h1>
          <p className="hero-copy">
            React no front, Node/Express no back e persistência em arquivo JSON para manter
            o fluxo simples, rápido e funcional.
          </p>
        </div>

        <div className="hero-card">
          <span>Resumo</span>
          <strong>{stats.count} produtos</strong>
          <p>{stats.totalStock} unidades em estoque</p>
          <p>{currencyFormatter.format(stats.totalValue)} em valor total</p>
        </div>
      </header>

      <section className="stats-grid" aria-label="Indicadores do catálogo">
        <article className="stat-card">
          <span>Itens cadastrados</span>
          <strong>{stats.count}</strong>
        </article>
        <article className="stat-card">
          <span>Estoque total</span>
          <strong>{stats.totalStock}</strong>
        </article>
        <article className="stat-card">
          <span>Valor estimado</span>
          <strong>{currencyFormatter.format(stats.totalValue)}</strong>
        </article>
      </section>

      <section className="content-grid">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{editingId ? 'Editar produto' : 'Novo produto'}</p>
              <h2>{editingId ? 'Atualize os dados do item' : 'Cadastre um novo produto'}</h2>
            </div>
            {editingId ? (
              <button type="button" className="ghost-button" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="field-grid">
            <label>
              Nome
              <input name="name" value={form.name} onChange={handleChange} placeholder="Ex.: Mouse sem fio" />
            </label>
            <label>
              SKU
              <input name="sku" value={form.sku} onChange={handleChange} placeholder="Ex.: MOU-210" />
            </label>
            <label>
              Categoria
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="Ex.: Periféricos"
              />
            </label>
            <label>
              Fornecedor
              <input
                name="fornecedor"
                value={form.fornecedor}
                onChange={handleChange}
                placeholder="Ex.: TechImport S.A."
              />
            </label>
            <label>
              Preço
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="0,00"
              />
            </label>
            <label>
              Estoque
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                placeholder="0"
              />
            </label>
            <label className="full-width">
              Descrição
              <textarea
                name="description"
                rows="4"
                value={form.description}
                onChange={handleChange}
                placeholder="Descreva os diferenciais do produto"
              />
            </label>
          </div>

          {error ? <p className="feedback error">{error}</p> : null}
          {message ? <p className="feedback success">{message}</p> : null}

          <div className="actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm} disabled={saving}>
              Limpar formulário
            </button>
          </div>
        </form>

        <section className="panel list-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Lista</p>
              <h2>Produtos cadastrados</h2>
            </div>
          </div>

          {loading ? <p className="state-copy">Carregando produtos...</p> : null}

          {!loading && products.length === 0 ? (
            <p className="state-copy">Nenhum produto encontrado.</p>
          ) : null}

          {!loading && products.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Fornecedor</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <p>{product.sku || 'Sem SKU'}</p>
                        <p className="table-description">{product.description || 'Sem descrição'}</p>
                      </td>
                      <td>{product.fornecedor || 'Não informado'}</td>
                      <td>{product.category || 'Sem categoria'}</td>
                      <td>{currencyFormatter.format(Number(product.price || 0))}</td>
                      <td>{product.stock ?? 0}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="link-button" onClick={() => startEditing(product)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => openReviews(product)}
                          >
                            Avaliar
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleDelete(product.id)}
                            disabled={deletingId === product.id}
                          >
                            {deletingId === product.id ? 'Removendo...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>

      {reviewingProduct ? (
        <section className="panel reviews-panel" aria-label="Avaliações do produto">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Avaliações</p>
              <h2>{reviewingProduct.name}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeReviews}>
              Fechar
            </button>
          </div>

          <div className="reviews-list">
            {reviews.length === 0 ? (
              <p className="state-copy">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="review-card">
                  <div className="review-header">
                    <strong>{review.author}</strong>
                    <span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  </div>
                  {review.comment ? <p>{review.comment}</p> : null}
                  <time className="review-date">{new Date(review.createdAt).toLocaleDateString('pt-BR')}</time>
                </article>
              ))
            )}
          </div>

          <form className="review-form" onSubmit={handleReviewSubmit}>
            <h3>Nova avaliação</h3>

            <div className="field-grid">
              <label>
                Seu nome
                <input
                  name="author"
                  value={reviewForm.author}
                  onChange={handleReviewChange}
                  placeholder="Ex.: João Silva"
                />
              </label>
              <label>
                Nota (1 a 5)
                <select name="rating" value={reviewForm.rating} onChange={handleReviewChange} required>
                  <option value="">Selecione...</option>
                  <option value="1">1 – Péssimo</option>
                  <option value="2">2 – Ruim</option>
                  <option value="3">3 – Regular</option>
                  <option value="4">4 – Bom</option>
                  <option value="5">5 – Excelente</option>
                </select>
              </label>
              <label className="full-width">
                Comentário
                <textarea
                  name="comment"
                  rows="3"
                  value={reviewForm.comment}
                  onChange={handleReviewChange}
                  placeholder="Conte o que achou do produto..."
                />
              </label>
            </div>

            {reviewError ? <p className="feedback error">{reviewError}</p> : null}
            {reviewMessage ? <p className="feedback success">{reviewMessage}</p> : null}

            <div className="actions">
              <button type="submit" className="primary-button" disabled={savingReview}>
                {savingReview ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  )
}

export default App
