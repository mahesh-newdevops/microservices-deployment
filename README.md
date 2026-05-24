# microservices-deployment

Minikube deployment for a small microservices demo.

## Services

- `frontend` runs on port `80`
- `user-service` runs on container port `3000`
- `order-service` runs on container port `3000`
- `payment-service` runs on container port `3000`
- `notification-service` runs on container port `3000`
- `postgres` runs on port `5432`
- `redis` runs on port `6379`

All Kubernetes resources deploy into the `microservices` namespace.

## Images

The Kubernetes manifests pull public images from Docker Hub:

```text
jatinsai/frontend:v1.0.0
jatinsai/user-service:v1.0.0
jatinsai/order-service:v1.0.0
jatinsai/payment-service:v1.0.0
jatinsai/notification-service:v1.0.0
```

Build and push images after changing application code:

```bash
docker login

IMAGE_TAG=v1.0.0

docker build -t jatinsai/frontend:${IMAGE_TAG} ./frontend
docker build -t jatinsai/user-service:${IMAGE_TAG} ./user-service
docker build -t jatinsai/order-service:${IMAGE_TAG} ./order-service
docker build -t jatinsai/payment-service:${IMAGE_TAG} ./payment-service
docker build -t jatinsai/notification-service:${IMAGE_TAG} ./notification-service

docker push jatinsai/frontend:${IMAGE_TAG}
docker push jatinsai/user-service:${IMAGE_TAG}
docker push jatinsai/order-service:${IMAGE_TAG}
docker push jatinsai/payment-service:${IMAGE_TAG}
docker push jatinsai/notification-service:${IMAGE_TAG}
```

For the next release, build and push a new tag such as `v1.0.1`, update the image tags in `k8s/*/deployment.yaml`, then push the Git change. Argo CD will detect the manifest diff and deploy the new image version.

## SonarQube Scan

The GitHub Actions workflow `.github/workflows/sonarqube-scan.yml` runs SonarQube analysis on pushes and pull requests to `main`.

Configure this GitHub secret before running it:

```text
SONAR_TOKEN
```

The scanner reads project settings from:

```text
sonar-project.properties
```

The default project key is:

```text
mahesh-newdevops_microservices-deployment
```

If your SonarQube Cloud project uses a different key or organization, update `sonar.projectKey` and `sonar.organization`.

## Minikube Deployment

The GitHub Actions workflow in `.github/workflows/microservices-deploy.yml` runs on a self-hosted runner, verifies Minikube is already running, and applies the manifests in `k8s/`.

Minikube startup is owned by the `gitops-platform-minikube` repository workflow:

```text
Bootstrap GitOps On Minikube
```

The application Ingress uses:

```text
microservices.local
```

Routes:

```text
/users          -> user-service
/orders         -> order-service
/payments       -> payment-service
/notifications -> notification-service
/               -> frontend
```

After the app is deployed, open the frontend and use the forms to create demo data:

```text
http://microservices.local/
```

You can also test the service-to-service flow with curl:

```bash
curl -s -X POST http://microservices.local/users/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Anaya","email":"anaya@example.com"}'

curl -s -X POST http://microservices.local/orders/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":"1","item":"minikube-checkout","amount":49.99}'
```

The order request calls:

```text
order-service -> user-service
order-service -> payment-service
order-service -> notification-service
```

To inspect stored demo data:

```bash
curl -s http://microservices.local/users/users
curl -s http://microservices.local/orders/orders
curl -s http://microservices.local/payments/payments
curl -s http://microservices.local/notifications/notifications
```

## Argo CD Deployment

Install Argo CD in Minikube first, then apply:

```bash
kubectl apply -f argocd/microservices-deployment.yaml
```

Argo CD syncs the `k8s/` kustomization from this repository. Since the images are public Docker Hub images, Minikube pulls them directly and no image pull secret is required.

## OpenTelemetry Traces

The backend Node.js services are configured for OpenTelemetry auto-instrumentation.
When the monitoring stack is running, each service sends traces to Grafana Alloy:

```text
http://alloy.monitoring.svc.cluster.local:4318/v1/traces
```

Alloy forwards those traces to Tempo, and Grafana reads them from the Tempo datasource.

Runtime environment used by the service Deployments:

```text
NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=none
OTEL_LOGS_EXPORTER=none
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://alloy.monitoring.svc.cluster.local:4318/v1/traces
```

In Grafana:

- Prometheus shows service metrics.
- Loki shows service logs.
- Tempo shows request traces.

Tempo will show data only after traffic reaches the instrumented services.
