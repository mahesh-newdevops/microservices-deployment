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

## Minikube Deployment

The GitHub Actions workflow in `.github/workflows/microservices-deploy.yml` runs on a self-hosted runner, verifies Minikube is already running, builds the local Docker images inside Minikube's Docker daemon, and applies the manifests in `k8s/`.

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

## Argo CD Deployment

Install Argo CD in Minikube first, then apply:

```bash
kubectl apply -f argocd/microservices-deployment.yaml
```

Argo CD syncs the `k8s/` kustomization from this repository.

Important: these manifests use local images such as `user-service:latest` with `imagePullPolicy: Never`. Build the images inside Minikube before Argo CD syncs the application:

```bash
eval $(minikube docker-env)
docker build -t frontend:latest ./frontend
docker build -t user-service:latest ./user-service
docker build -t order-service:latest ./order-service
docker build -t payment-service:latest ./payment-service
docker build -t notification-service:latest ./notification-service
```

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
