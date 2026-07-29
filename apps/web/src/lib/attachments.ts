interface OpfsWritable {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface OpfsFileHandle {
  createWritable(): Promise<OpfsWritable>
  getFile(): Promise<File>
}

interface OpfsDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsDirectoryHandle>
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsFileHandle>
  removeEntry(name: string): Promise<void>
}

interface BrowserAttachmentOptions {
  getRootDirectory?: () => Promise<OpfsDirectoryHandle>
  directoryName?: string
}

const attachmentId = /^[A-Za-z0-9_-]{1,128}$/

function browserRootDirectory() {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<OpfsDirectoryHandle>
  }
  if (!storage.getDirectory) {
    throw new Error('此浏览器不支持本机附件存储。')
  }
  return storage.getDirectory()
}

export function createBrowserAttachmentStore(options: BrowserAttachmentOptions = {}) {
  const getDirectory = async () => {
    const root = await (options.getRootDirectory ?? browserRootDirectory)()
    return await root.getDirectoryHandle(
      options.directoryName ?? 'archresearch-web-attachments',
      { create: true },
    )
  }

  const fileName = (id: string) => {
    if (!attachmentId.test(id)) throw new Error('附件标识不合法。')
    return id
  }

  return {
    async save(id: string, file: Blob) {
      const directory = await getDirectory()
      const target = await directory.getFileHandle(fileName(id), { create: true })
      const writable = await target.createWritable()
      await writable.write(file)
      await writable.close()
    },

    async read(id: string) {
      const directory = await getDirectory()
      try {
        return await (await directory.getFileHandle(fileName(id))).getFile()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return null
        throw error
      }
    },

    async remove(id: string) {
      const directory = await getDirectory()
      try {
        await directory.removeEntry(fileName(id))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') return
        throw error
      }
    },
  }
}
