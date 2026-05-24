const express = require('express')
const client = require('prom-client')

const app = express()
const serviceName = 'user-service'
const register = new client.Registry()
const users = new Map()
let nextUserId = 1

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
    endpoints: ['GET /users', 'POST /users', 'GET /users/:id']
  })
})

app.get('/health', (req, res) => {
  res.json({ service: serviceName, status: 'healthy' })
})

app.get('/users', (req, res) => {
  res.json({ users: Array.from(users.values()) })
})

app.post('/users', (req, res) => {
  const { name, email } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' })
  }

  const user = {
    id: String(nextUserId++),
    name,
    email,
    createdAt: new Date().toISOString()
  }

  users.set(user.id, user)
  res.status(201).json(user)
})

app.get('/users/:id', (req, res) => {
  const user = users.get(req.params.id)

  if (!user) {
    return res.status(404).json({ error: 'user not found' })
  }

  res.json(user)
})

app.get('/fail', (req, res) => {
  res.status(500).json({ service: serviceName, error: 'intentional test failure' })
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log('User Service Running')
})
