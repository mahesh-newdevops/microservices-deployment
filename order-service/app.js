const express = require('express')
const client = require('prom-client')

const app = express()
const serviceName = 'order-service'
const register = new client.Registry()
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service'
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service'
const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service'
const orders = []
let nextOrderId = 1

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
    downstreams: {
      userServiceUrl,
      paymentServiceUrl,
      notificationServiceUrl
    },
    endpoints: ['GET /orders', 'POST /orders']
  })
})

app.get('/health', (req, res) => {
  res.json({ service: serviceName, status: 'healthy' })
})

app.get('/orders', (req, res) => {
  res.json({ orders })
})

app.post('/orders', async (req, res) => {
  const { userId, item, amount } = req.body
  const numericAmount = Number(amount)

  if (!userId || !item || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'userId, item, and positive amount are required' })
  }

  try {
    const userResponse = await fetch(`${userServiceUrl}/users/${userId}`)
    if (!userResponse.ok) {
      return res.status(404).json({ error: 'user not found' })
    }

    const user = await userResponse.json()
    const order = {
      id: String(nextOrderId++),
      userId,
      item,
      amount: numericAmount,
      status: 'created',
      createdAt: new Date().toISOString()
    }

    const paymentResponse = await fetch(`${paymentServiceUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        userId,
        amount: numericAmount
      })
    })

    if (!paymentResponse.ok) {
      const paymentError = await paymentResponse.json().catch(() => ({}))
      return res.status(502).json({ error: 'payment failed', details: paymentError })
    }

    const payment = await paymentResponse.json()
    order.status = payment.status === 'approved' ? 'confirmed' : 'payment_pending'
    orders.push(order)

    const notificationResponse = await fetch(`${notificationServiceUrl}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, order, payment })
    })

    const notification = notificationResponse.ok
      ? await notificationResponse.json()
      : { status: 'failed' }

    res.status(201).json({ order, user, payment, notification })
  } catch (error) {
    res.status(502).json({
      error: 'order workflow failed',
      details: error.message
    })
  }
})

app.get('/fail', (req, res) => {
  res.status(500).json({ service: serviceName, error: 'intentional test failure' })
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log('Order Service Running')
})
