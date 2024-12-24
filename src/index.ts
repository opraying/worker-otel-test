import * as Resource from "@effect/opentelemetry/Resource"
import * as Tracer from "@effect/opentelemetry/Tracer"
import * as Etag from "@effect/platform/Etag"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpPlatform from "@effect/platform/HttpPlatform"
import * as Path from "@effect/platform/Path"
import type { ResolveConfigFn } from "@microlabs/otel-cf-workers"
import { instrument } from "@microlabs/otel-cf-workers"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import { MyHttpApi } from "./api"
import { HttpAppLive } from "./handle"

declare global {
  // eslint-disable-next-line no-var
  var env: Env
}

const SERVICE_NAME = "greetings"

const TraceLive = Tracer.layerGlobal.pipe(
  Layer.provide(Resource.layer({
    serviceName: SERVICE_NAME
  }))
)

const HttpLive = HttpApiBuilder.api(MyHttpApi).pipe(
  //
  Layer.provide([HttpAppLive]),
  Layer.provide(TraceLive)
)

const Live = pipe(
  HttpApiBuilder.Router.Live,
  Layer.provideMerge(HttpLive),
  Layer.provideMerge(HttpPlatform.layer),
  Layer.provideMerge(Etag.layerWeak),
  Layer.provideMerge(Path.layer),
  Layer.provideMerge(FileSystem.layerNoop({})),
  Layer.provide(Logger.pretty),
  Layer.provide(TraceLive)
)

const config: ResolveConfigFn = (_env: Env, _trigger) => {
  return {
    exporter: {
      url: "http://localhost:4318/v1/traces",
      headers: {}
    },
    sampling: {
      headSampler: { ratio: 1 }
    },
    service: { name: SERVICE_NAME }
  }
}

export default instrument({
  fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    Object.assign(globalThis, {
      env
    })

    const handler = HttpApiBuilder.toWebHandler(Live)

    return handler.handler(request as unknown as Request)
  }
}, config)
