import * as Otlp from "@effect/opentelemetry/Otlp"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpServer from "@effect/platform/HttpServer"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import { MyHttpApi } from "./api"
import { HttpAppLive } from "./handle"

declare global {
  // eslint-disable-next-line no-var
  var env: Env
}

const SERVICE_NAME = "greetings"
const NAMESPACE = "workers-test"
const DATASET = NAMESPACE

const HttpLive = HttpApiBuilder.api(MyHttpApi).pipe(
  Layer.provide([HttpAppLive]),
  Layer.provide(Layer.suspend(() => {
    return Otlp.layer({
      baseUrl: globalThis.env.OTEL_HOST ?? "http://localhost:4318",
      resource: {
        serviceName: SERVICE_NAME,
        serviceVersion: "0.0.1"
      },
      headers: {
        "x-api-key": globalThis.env.OTEL_API_KEY,
        "x-namespace": NAMESPACE,
        "x-service": SERVICE_NAME,
        "x-baselime-dataset": DATASET
      }
    })
  })),
  Layer.provide(FetchHttpClient.layer)
)

const Live = pipe(
  HttpApiBuilder.Router.Live,
  Layer.provideMerge(HttpLive),
  Layer.provideMerge(HttpServer.layerContext)
)

export default {
  fetch(request, env, ctx) {
    Object.assign(globalThis, {
      env
    })

    const handler = HttpApiBuilder.toWebHandler(Live)

    return handler.handler(request as unknown as Request).finally(() => {
      ctx.waitUntil(handler.dispose())
    })
  }
} satisfies ExportedHandler<Env>
