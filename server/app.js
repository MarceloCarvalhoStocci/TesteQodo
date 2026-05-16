import cors from 'cors'
import express from 'express'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const dataFile = path.join(dataDir, 'products.json')
const reviewsFile = path.join(dataDir, 'reviews.json')

const app = express()
const port = process.env.PORT || 4101

app.use(cors())
app.use(express.json())

const defaultProducts = [
  {
    id: 'prod-1',
    name: 'Cadeira ergonômica',
    sku: 'CAD-001',
    category: 'Móveis',
    fornecedor: 'Ergomóveis Ltda.',
    price: 899.9,
    stock: 12,
    description: 'Cadeira com apoio lombar e ajuste de altura.'
  },
  {
    id: 'prod-2',
    name: 'Monitor 27"',
    sku: 'MON-027',
    category: 'Eletrônicos',
    fornecedor: 'TechImport S.A.',
    price: 1599.9,
    stock: 8,
    description: 'Monitor IPS full HD com bordas finas.'
  },
  {
    id: 'prod-3',
    name: 'Teclado mecânico',
    sku: 'TEC-104',
    category: 'Periféricos',
    fornecedor: 'KeyMasters Brasil',
    price: 349.9,
    stock: 18,
    description: 'Switch tátil, iluminação RGB e corpo em alumínio.'
  }
]

async function ensureStorage() {
  await mkdir(dataDir, { recursive: true })

  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await writeFile(dataFile, JSON.stringify(defaultProducts, null, 2))
  }
}

async function readProducts() {
  await ensureStorage()
  const raw = await readFile(dataFile, 'utf8')
  return JSON.parse(raw)
}

async function saveProducts(products) {
  await ensureStorage()
  await writeFile(dataFile, JSON.stringify(products, null, 2))
}

async function readReviews() {
  await ensureStorage()
  try {
    const raw = await readFile(reviewsFile, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function saveReviews(reviews) {
  await writeFile(reviewsFile, JSON.stringify(reviews, null, 2))
}

function createId() {
  return `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeProduct(input, previous = {}) {
  const name = String(input.name ?? previous.name ?? '').trim()
  const sku = String(input.sku ?? previous.sku ?? '').trim()
  const category = String(input.category ?? previous.category ?? '').trim()
  const description = String(input.description ?? previous.description ?? '').trim()
  const fornecedor = String(input.fornecedor ?? previous.fornecedor ?? '').trim()
  const price = Number.parseFloat(input.price ?? previous.price ?? 0)
  const stock = Number.parseInt(input.stock ?? previous.stock ?? 0, 10)

  if (!name) {
    throw new Error('O nome do produto é obrigatório.')
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error('O preço deve ser um número válido e não negativo.')
  }

  if (Number.isNaN(stock) || stock < 0) {
    throw new Error('O estoque deve ser um número inteiro não negativo.')
  }

  return {
    ...previous,
    name,
    sku,
    category,
    fornecedor,
    description,
    price,
    stock
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/products', async (_request, response) => {
  try {
    const products = await readProducts()
    response.json(products)
  } catch (error) {
    response.status(500).json({ message: 'Falha ao carregar os produtos.', detail: error.message })
  }
})

app.post('/api/products', async (request, response) => {
  try {
    const products = await readProducts()
    const product = normalizeProduct(request.body)
    const newProduct = {
      id: createId(),
      ...product
    }

    products.unshift(newProduct)
    await saveProducts(products)

    response.status(201).json(newProduct)
  } catch (error) {
    response.status(400).json({ message: error.message })
  }
})

app.put('/api/products/:id', async (request, response) => {
  try {
    const products = await readProducts()
    const productIndex = products.findIndex((product) => product.id === request.params.id)

    if (productIndex === -1) {
      return response.status(404).json({ message: 'Produto não encontrado.' })
    }

    const updatedProduct = normalizeProduct(request.body, products[productIndex])
    products[productIndex] = {
      ...products[productIndex],
      ...updatedProduct,
      id: products[productIndex].id
    }

    await saveProducts(products)
    response.json(products[productIndex])
  } catch (error) {
    response.status(400).json({ message: error.message })
  }
})

app.delete('/api/products/:id', async (request, response) => {
  try {
    const products = await readProducts()
    const nextProducts = products.filter((product) => product.id !== request.params.id)

    if (nextProducts.length === products.length) {
      return response.status(404).json({ message: 'Produto não encontrado.' })
    }

    await saveProducts(nextProducts)
    response.status(204).send()
  } catch (error) {
    response.status(500).json({ message: 'Falha ao remover o produto.', detail: error.message })
  }
})

app.get('/api/products/:id/reviews', async (request, response) => {
  try {
    const reviews = await readReviews()
    response.json(reviews[request.params.id] || [])
  } catch (error) {
    response.status(500).json({ message: 'Falha ao carregar as avaliações.', detail: error.message })
  }
})

app.post('/api/products/:id/reviews', async (request, response) => {
  try {
    const { rating, comment, author } = request.body
    const parsedRating = Number(rating)

    if (!rating || parsedRating < 1 || parsedRating > 5) {
      return response.status(400).json({ message: 'A nota deve ser um número entre 1 e 5.' })
    }

    const reviews = await readReviews()
    const productReviews = reviews[request.params.id] || []

    const newReview = {
      id: createId(),
      rating: parsedRating,
      comment: String(comment || '').trim(),
      author: String(author || '').trim() || 'Anônimo',
      createdAt: new Date().toISOString()
    }

    reviews[request.params.id] = [...productReviews, newReview]
    await saveReviews(reviews)

    response.status(201).json(newReview)
  } catch (error) {
    response.status(400).json({ message: error.message })
  }
})

function startServer() {
  const server = app.listen(port, () => {
    console.log(`API de produtos rodando em http://localhost:${port}`)
  })

  return server
}

export { app, startServer }
