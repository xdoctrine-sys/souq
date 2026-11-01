export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || !useRuntimeConfig().public.singleInstance)
    return

  const server = to.params.server as string | undefined
  if (!server)
    return

  const prefix = `/${server}`
  if (!to.path.startsWith(prefix))
    return

  // Cloning `to` (upstream behaviour) keeps `path`/`fullPath`, which still embed the
  // `/{server}` prefix, so vue-router re-derives `params.server` from them and the
  // middleware re-runs on the very same location until the main thread is monopolised.
  // Rebuilding the target from its `name` does not fix it either: `matcher.resolve`
  // re-injects the optional keys of the parent record (here `server`) from the current
  // location, which holds the prefixed params in the browser (hydrated route) while a
  // freshly created test router starts from an empty one.
  // Targeting an explicit server-free `path` instead takes the `path` branch of
  // `resolve()`, which parses the params back from that path: the redirect happens once.
  return {
    path: to.path.slice(prefix.length) || '/',
    query: to.query,
    hash: to.hash,
  }
})
