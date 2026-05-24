const express = require('express')
const client = require('prom-client')

const app = express()
const serviceName = 'payment-service'
const register = new client.Registry()
const payments = []
let nextPaymentId = 1

register.setDefaultLabels({ service: serviceName })
client.collectDefaultMetrics({ register })
app.use(express.json())

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

register.registerMetric(httpRequestsTotal)

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode
    })
  })
  next()
})

app.get('/', (req, res) => {
  res.json({
    service: serviceName,
    status: 'running',
    endpoints: ['GET /payments', 'POST /payments']
  })
})

app.get('/health', (req, res) => {
  res.json({ service: serviceName, status: 'healthy' })
})

app.get('/payments', (req, res) => {
  res.json({ payments })
})

app.post('/payments', (req, res) => {
  const { orderId, userId, amount } = req.body
  const numericAmount = Number(amount)

  if (!orderId || !userId || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'orderId, userId, and positive amount are required' })
  }

  const payment = {
    id: String(nextPaymentId++),
    orderId,
    userId,
    amount: numericAmount,
    status: 'approved',
    createdAt: new Date().toISOString()
  }

  payments.push(payment)
  res.status(201).json(payment)
})

app.get('/fail', (req, res) => {
  res.status(500).json({ service: serviceName, error: 'intentional test failure' })
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log('Payment Service Running')
})
