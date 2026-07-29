import { describe, expect, it } from 'vitest'

import { createBrowserAttachmentStore } from './attachments'

class MemoryFileHandle {
  private contents = new Blob()

  constructor(readonly name: string) {}

  async createWritable() {
    return {
      write: async (value: Blob) => {
        this.contents = value
      },
      close: async () => undefined,
    }
  }

  async getFile() {
    return new File([this.contents], this.name, { type: this.contents.type })
  }
}

class MemoryDirectoryHandle {
  readonly directories = new Map<string, MemoryDirectoryHandle>()
  readonly files = new Map<string, MemoryFileHandle>()

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.directories.get(name)
    if (existing) return existing
    if (!options?.create) throw new DOMException('Not found', 'NotFoundError')
    const created = new MemoryDirectoryHandle()
    this.directories.set(name, created)
    return created
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.files.get(name)
    if (existing) return existing
    if (!options?.create) throw new DOMException('Not found', 'NotFoundError')
    const created = new MemoryFileHandle(name)
    this.files.set(name, created)
    return created
  }

  async removeEntry(name: string) {
    if (!this.files.delete(name)) throw new DOMException('Not found', 'NotFoundError')
  }
}

describe('browser-local OPFS attachments', () => {
  it('keeps an attachment in the browser file system and removes it explicitly', async () => {
    const root = new MemoryDirectoryHandle()
    const store = createBrowserAttachmentStore({
      getRootDirectory: async () => root,
    })
    const source = new File(['site boundary and circulation notes'], 'brief.txt', {
      type: 'text/plain',
    })

    await store.save('run-attachment-1', source)

    const restored = await store.read('run-attachment-1')
    expect(restored).not.toBeNull()
    if (!restored) throw new Error('Expected OPFS attachment to be restored.')
    expect(restored).toMatchObject({ name: 'run-attachment-1', type: 'text/plain' })
    await expect(restored.text()).resolves.toBe('site boundary and circulation notes')

    await store.remove('run-attachment-1')
    await expect(store.read('run-attachment-1')).resolves.toBeNull()
  })
})
