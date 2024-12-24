import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import { pipe } from "effect"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Random from "effect/Random"
import { MyHttpApi } from "./api"

export const HttpAppLive = HttpApiBuilder.group(MyHttpApi, "app", (handles) =>
  Effect.gen(function*() {
    yield* Effect.log("Hello")

    return handles.handle("index", () =>
      Effect.gen(function*() {
        const kv = globalThis.env.KV
        const d1 = globalThis.env.DB
        const r2 = globalThis.env.R2

        const createdAt = yield* DateTime.now.pipe(Effect.withSpan("now-1"))
        const updatedAt = yield* DateTime.now.pipe(Effect.withSpan("now-2"))

        yield* Effect.sleep("1 seconds").pipe(
          Effect.tap(Effect.log("sleep-1")),
          Effect.withSpan("sleep-1")
        )

        yield* Effect.log("hi", { createdAt, updatedAt }).pipe(
          Effect.delay("100 millis"),
          Effect.withSpan("fiber-fork"),
          Effect.fork
        )

        yield* Effect.sleep("1 seconds").pipe(
          Effect.tap(Effect.log("sleep-2")),
          Effect.withSpan("sleep-2")
        )

        const randomInt = yield* Random.nextInt

        yield* Effect.promise(() => kv.put(randomInt.toString(), randomInt.toString())).pipe(
          Effect.withSpan("set-random-key")
        )
        yield* Effect.promise(() => kv.list()).pipe(
          Effect.tap(
            (_) =>
              Effect.log("random-keys").pipe(
                Effect.annotateLogs({ kvKeys: _.keys.map((k) => k.name) })
              )
          ),
          Effect.withSpan("get-random-keys")
        )

        yield* Effect.promise(() => r2.put(randomInt.toString(), new Blob([randomInt.toString()]))).pipe(
          Effect.withSpan("set-random-bucket")
        )

        yield* pipe(
          Effect.promise(() => d1.exec("CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, text TEXT)")),
          Effect.withSpan("init-database"),
          Effect.andThen(
            Effect.promise(() => d1.exec("INSERT INTO todo (text) VALUES ('Hello, World!')"))
          ),
          Effect.withSpan("insert-hello-world"),
          Effect.andThen(
            Effect.promise(() => d1.exec("SELECT * FROM todo"))
          ),
          Effect.withSpan("select-hello-world")
        )

        yield* Effect.promise(() => r2.list()).pipe(
          Effect.withSpan("get-random-bucket"),
          Effect.andThen(
            Effect.promise(() => r2.get(randomInt.toString()))
          ),
          Effect.andThen((_) => _ ? Effect.promise(() => _.blob()) : Effect.dieMessage("No blob")),
          Effect.andThen((blob) => Effect.promise(() => blob.text())),
          Effect.tap((text) =>
            Effect.log("random-bucket-value").pipe(
              Effect.annotateLogs({ text })
            )
          ),
          Effect.withSpan("get-random-bucket-value")
        )

        return "ok"
      }).pipe(Effect.withSpan("index-api")))
      .handle("health", () => Effect.succeed("ok"))
  }))
