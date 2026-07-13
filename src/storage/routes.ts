import type { StoredRoute } from '../domain/types'

const DATABASE_NAME = 'bikewind'
const STORE_NAME = 'routes'
const VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open route storage.'))
  })
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Route storage failed.'))
  }).finally(() => database.close())
}

export async function getRoutes(): Promise<StoredRoute[]> {
  const routes = await transaction<StoredRoute[]>('readonly', (store) => store.getAll())
  return routes.sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveRoute(route: StoredRoute): Promise<void> {
  await transaction<IDBValidKey>('readwrite', (store) => store.put(route))
}

export async function deleteRoute(id: string): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.delete(id))
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  const routes = await getRoutes()
  const route = routes.find((candidate) => candidate.id === id)
  if (!route) return
  await saveRoute({ ...route, favorite })
}
