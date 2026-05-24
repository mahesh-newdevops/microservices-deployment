const express = require('express')
const client = require('prom-client')

const app = express()
const serviceName = 'notification-service'
const register = new client.Registry()
const notifications = []
let nextNotificationId = 1

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
    endpoints: ['GET /notifications', 'POST /notifications']
  })
})

app.get('/health', (req, res) => {
  res.json({ service: serviceName, status: 'healthy' })
})

app.get('/notifications', (req, res) => {
  res.json({ notifications })
})

app.post('/notifications', (req, res) => {
  const { user, order, payment } = req.body

  if (!user || !order || !payment) {
    return res.status(400).json({ error: 'user, order, and payment are required' })
  }

  const notification = {
    id: String(nextNotificationId++),
    to: user.email,
    subject: `Order ${order.id} confirmed`,
    message: `Hi ${user.name}, your order for ${order.item} was confirmed.`,
    status: 'sent',
    createdAt: new Date().toISOString()
  }

  notifications.push(notification)
  console.log(`Notification sent to ${notification.to} for order ${order.id}`)
  res.status(201).json(notification)
})

app.get('/fail', (req, res) => {
  res.status(500).json({ service: serviceName, error: 'intentional test failure' })
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log('Notification Service Running')
})
