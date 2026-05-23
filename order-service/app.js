const express = require('express')
const client = require('prom-client')

const app = express()
const serviceName = 'order-service'
const register = new client.Registry()

register.setDefaultLabels({ service: serviceName })
client.collectDefaultMetrics({ register })

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
    status: 'running'
  })
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log('Order Service Running')
})
