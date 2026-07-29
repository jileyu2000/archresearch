import { describe, expect, it, vi } from 'vitest'

import {
  cleanupVisualPreviews,
  discardVisualPreviews,
  readVisualPreview,
  storeVisualPreviews,
} from './visual-preview-store'

function previewSource(previewDataUrl: string | null) {
  return {
    directionId: 'linework',
    sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
    title: '社区图书馆线稿轴测图',
    imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
    previewDataUrl,
    adjacentText: '细线、蓝色编号与留白组织公共流线。',
  }
}

describe('visual preview store', () => {
  it('stores screenshots under run-scoped keys and reads them back as data URLs', async () => {
    const objects = new Map<string, Uint8Array>()
    const bucket = {
      put: vi.fn(async (key: string, value: Uint8Array) => {
        objects.set(key, value)
        return null
      }),
      get: vi.fn(async (key: string) => {
        const bytes = objects.get(key)
        if (!bytes) return null
        return {
          size: bytes.byteLength,
          arrayBuffer: async () => bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        }
      }),
    } as unknown as R2Bucket

    const stored = await storeVisualPreviews(
      bucket,
      'run-visual',
      [previewSource('data:image/png;base64,aW1hZ2U=')],
    )

    expect(stored).toEqual([expect.objectContaining({
      previewObjectKey: 'visual-previews/run-visual/1.png',
    })])
    await expect(readVisualPreview(
      bucket,
      'run-visual',
      'visual-previews/run-visual/1.png',
    )).resolves.toBe('data:image/png;base64,aW1hZ2U=')
  })

  it('does not read an object key belonging to another run', async () => {
    const get = vi.fn()
    const bucket = { get } as unknown as R2Bucket

    await expect(readVisualPreview(
      bucket,
      'run-visual',
      'visual-previews/other-run/1.png',
    )).resolves.toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('removes already-written screenshots when a later write fails', async () => {
    const put = vi.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('R2 unavailable'))
    const remove = vi.fn().mockResolvedValue(undefined)
    const bucket = { put, delete: remove } as unknown as R2Bucket

    await expect(storeVisualPreviews(
      bucket,
      'run-visual',
      [
        previewSource('data:image/png;base64,YQ=='),
        previewSource('data:image/png;base64,Yg=='),
      ],
    )).rejects.toThrow('R2 unavailable')
    expect(remove).toHaveBeenCalledWith(['visual-previews/run-visual/1.png'])
  })

  it('discards only validated run keys and cleans every listed page', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const list = vi.fn()
      .mockResolvedValueOnce({
        objects: [{ key: 'visual-previews/run-visual/1.png' }],
        truncated: true,
        cursor: 'next-page',
      })
      .mockResolvedValueOnce({
        objects: [{ key: 'visual-previews/run-visual/2.png' }],
        truncated: false,
      })
    const bucket = { delete: remove, list } as unknown as R2Bucket

    await discardVisualPreviews(bucket, 'run-visual', [
      {
        directionId: 'linework',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
        title: '线稿轴测图',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
        previewObjectKey: 'visual-previews/run-visual/1.png',
        adjacentText: '细线组织公共流线。',
      },
      {
        directionId: 'linework',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-2',
        title: '错误跨 Run 键',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-2.webp',
        previewObjectKey: 'visual-previews/other-run/2.png',
        adjacentText: '不得删除其他 Run。',
      },
    ])
    expect(remove).toHaveBeenCalledWith(['visual-previews/run-visual/1.png'])

    remove.mockClear()
    await cleanupVisualPreviews(bucket, 'run-visual')
    expect(list).toHaveBeenNthCalledWith(1, {
      prefix: 'visual-previews/run-visual/',
    })
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: 'visual-previews/run-visual/',
      cursor: 'next-page',
    })
    expect(remove).toHaveBeenNthCalledWith(
      1,
      ['visual-previews/run-visual/1.png'],
    )
    expect(remove).toHaveBeenNthCalledWith(
      2,
      ['visual-previews/run-visual/2.png'],
    )
  })
})
