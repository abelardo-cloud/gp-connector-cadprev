# Responsible CadPrev Access

## Objective

The CadPrev connector must consume the official CadPrev public source conservatively during pilots and homologation. The goal is to reduce request bursts, avoid parallel browser sessions against the official source, and preserve clear source availability signals for GovPilot services.

## Default Limits

| Setting | Default | Purpose |
| --- | ---: | --- |
| `CADPREV_MAX_CONCURRENT_REQUESTS` | `1` | Maximum external CadPrev requests running at the same time. |
| `CADPREV_MIN_REQUEST_INTERVAL_MS` | `10000` | Minimum interval between the start of real CadPrev accesses. |
| `CACHE_TTL_SECONDS` | `1800` | In-memory CRP response cache TTL. |
| `CADPREV_RETRY_ATTEMPTS` | `2` | Additional retries after the initial attempt. |
| `CADPREV_RETRY_BACKOFF_INITIAL_MS` | `3000` | Initial retry delay. |
| `CADPREV_RETRY_BACKOFF_MAX_MS` | `30000` | Maximum retry delay. |
| `CADPREV_RETRY_JITTER_MS` | `500` | Small random jitter added to retry delays. |

## Cache Behavior

Cache hits are returned immediately and do not enter the external CadPrev scheduler. A cache hit:

- Does not open a browser.
- Does not call CadPrev.
- Does not update `last_success_at` in source status.
- Still reports `cache.hit: true` in the CRP response.

Cache keys are separated by normalized query type:

- `cadprev:crp:cnpj:{cnpj}`
- `cadprev:crp:ente:{ente}`

## Scheduler

External CadPrev requests are queued in memory by `CadPrevRequestScheduler`. The scheduler:

- Allows only the configured number of external requests at once.
- Uses a conservative default of one request.
- Waits the configured minimum interval before starting the next real access.
- Does not affect cache hits.

This protects CadPrev from bursts during national collection or manual homologation.

## Retry And Backoff

Retries are only applied to transient failures:

- Timeouts.
- Temporary connection failures.
- Browser navigation failures such as `net::ERR_CONNECTION_TIMED_OUT`.
- `fetch failed` and equivalent connection failures.

Retries are not applied to deterministic failures:

- Ambiguous ente selection.
- Invalid input.
- Unexpected/parsing content.
- Internal programming errors.

Retry delays use exponential backoff with bounded jitter:

```text
initial attempt
retry 1 after initial backoff + jitter
retry 2 after larger backoff + jitter
final structured error
```

## Possible Source Limitation

The connector may flag `possible_source_limitation` only after repeated transient failures. This is intentionally cautious. The connector does not claim the IP is blocked because it cannot compare against external networks by itself.

Institutional interpretation:

```text
O acesso ao CadPrev pode estar temporariamente limitado pela fonte oficial ou pela rota de rede utilizada.
```

## Source Status Integration

Real successful CadPrev access marks the observed source status as `available`.

Cache hits do not update source status timestamps.

After retries are exhausted:

- Timeout marks the source as `unavailable` with `CADPREV_TIMEOUT`.
- Connection/navigation failure marks the source as `unavailable` with `CADPREV_UNAVAILABLE`.
- Unexpected content marks the source as `degraded`.

## National Collection Guidance

For 27-state collection:

- Keep concurrency at `1`.
- Keep a minimum interval between requests.
- Let the connector reuse cache.
- Avoid manual loops that bypass the connector.
- Monitor structured logs for queue position, attempts, retry delays, and final error classification.

## Limitations

All controls are in memory in this sprint:

- Queue state is lost on process restart.
- Cache is not shared across replicas.
- Source status resets to `unknown` after restart.
- Multiple running connector instances need external coordination in a future sprint.
