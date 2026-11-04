/**
 * Read the overview with GET and no body.
 *
 * The Desktop page lives at `dsh-app://app` and forwards fetches through
 * Node's `fetch`. A request body is forwarded with hop-by-hop headers
 * (`transfer-encoding`) that Node rejects, so the lines page never receives
 * a response and every enabled line looks switched off. GET has no body and
 * reaches the Host. `dsh web`, where the page origin is the Host, is unchanged.
 */
export function overviewRequest(): { url: string; init: RequestInit } {
  return {
    url: 'api/switchboard/overview',
    init: { method: 'GET', cache: 'no-store', headers: { accept: 'application/json' } },
  }
}
