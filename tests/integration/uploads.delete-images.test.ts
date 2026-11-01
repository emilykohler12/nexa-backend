import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { env } from '../../src/app/config/env'

const remove = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ remove }) } }),
}))

import { uploadProvider } from '../../src/modules/uploads/upload.provider'

const BASE = 'https://proyecto.supabase.test'
const PUB  = `${BASE}/storage/v1/object/public/images`

describe('uploadProvider.deleteImages', () => {
  const original = { url: env.SUPABASE_URL, key: env.SUPABASE_ANON_KEY }

  beforeEach(() => {
    remove.mockReset()
    env.SUPABASE_URL = BASE
    env.SUPABASE_ANON_KEY = 'clave-de-prueba'
  })
  afterEach(() => {
    env.SUPABASE_URL = original.url
    env.SUPABASE_ANON_KEY = original.key
  })

  it('manda al bucket la ruta de cada URL y da por borrados los archivos que Supabase confirma', async () => {
    remove.mockResolvedValue({ data: [{ name: 'galeria/a.jpg' }, { name: 'galeria/b.png' }], error: null })

    const res = await uploadProvider.deleteImages([`${PUB}/galeria/a.jpg`, `${PUB}/galeria/b.png`])

    expect(remove).toHaveBeenCalledWith(['galeria/a.jpg', 'galeria/b.png'])
    expect(res).toEqual({ deleted: [`${PUB}/galeria/a.jpg`, `${PUB}/galeria/b.png`], failed: [] })
  })

  it('cuenta como fallido lo que Supabase no devuelve (política del bucket que impide borrar)', async () => {
    remove.mockResolvedValue({ data: [{ name: 'galeria/a.jpg' }], error: null })

    const res = await uploadProvider.deleteImages([`${PUB}/galeria/a.jpg`, `${PUB}/galeria/b.png`])

    expect(res.deleted).toEqual([`${PUB}/galeria/a.jpg`])
    expect(res.failed).toEqual([`${PUB}/galeria/b.png`])
  })

  it('si Supabase da error o lanza, todo queda como fallido y no lanza', async () => {
    const urls = [`${PUB}/galeria/a.jpg`]

    remove.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await uploadProvider.deleteImages(urls)).toEqual({ deleted: [], failed: urls })

    remove.mockRejectedValueOnce(new Error('sin red'))
    expect(await uploadProvider.deleteImages(urls)).toEqual({ deleted: [], failed: urls })
  })

  it('una URL que no es de nuestro bucket se informa como fallida y no se manda a borrar', async () => {
    remove.mockResolvedValue({ data: [{ name: 'galeria/a.jpg' }], error: null })

    const res = await uploadProvider.deleteImages(['https://otro-sitio.test/foto.jpg', `${PUB}/galeria/a.jpg`])

    expect(remove).toHaveBeenCalledWith(['galeria/a.jpg'])
    expect(res.failed).toEqual(['https://otro-sitio.test/foto.jpg'])
    expect(res.deleted).toEqual([`${PUB}/galeria/a.jpg`])
  })

  it('sin URL no llama al almacenamiento, y sin configuración todo queda como fallido', async () => {
    expect(await uploadProvider.deleteImages([])).toEqual({ deleted: [], failed: [] })
    expect(remove).not.toHaveBeenCalled()

    env.SUPABASE_URL = undefined
    expect(await uploadProvider.deleteImages([`${PUB}/galeria/a.jpg`])).toEqual({ deleted: [], failed: [`${PUB}/galeria/a.jpg`] })
    expect(remove).not.toHaveBeenCalled()
  })
})
