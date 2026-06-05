import type { ChangeEvent, DragEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

type PdfChunk = {
  id: string
  fileName: string
  fromPage: number
  toPage: number
}

type UploadStatus = 'idle' | 'uploading' | 'ready'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000'

type PageCountResponse = {
  pageCount: number
}

function createChunkId() {
  return crypto.randomUUID()
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function createOutputFileName(sourceFileName: string, partNumber: number) {
  const baseName = sourceFileName.replace(/\.pdf$/i, '') || 'pdf'

  return `${baseName}-${partNumber}.pdf`
}

function createSplitZipFileName(sourceFileName: string) {
  const baseName = sourceFileName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return `${baseName || 'pdf'}-split.zip`
}

async function getPdfPageCount(file: File) {
  const formData = new FormData()

  formData.append('file', file)

  const response = await fetch(`${apiBaseUrl}/pdf/page-count`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      detail?: string
    } | null

    throw new Error(errorPayload?.detail ?? 'Không thể đọc số trang PDF.')
  }

  const payload = (await response.json()) as PageCountResponse

  return payload.pageCount
}

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [chunks, setChunks] = useState<PdfChunk[]>([])
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const hasInvalidChunk = useMemo(
    () =>
      chunks.some(
        (chunk) =>
          chunk.fromPage < 1 ||
          chunk.toPage < 1 ||
          chunk.fromPage > chunk.toPage ||
          (pageCount !== null &&
            (chunk.fromPage > pageCount || chunk.toPage > pageCount)) ||
          !chunk.fileName.trim(),
      ),
    [chunks, pageCount],
  )

  const canAddChunk = useMemo(
    () =>
      Boolean(
        pdfFile &&
          pageCount &&
          uploadStatus === 'ready' &&
          (chunks.at(-1)?.toPage ?? 0) < pageCount,
      ),
    [chunks, pageCount, pdfFile, uploadStatus],
  )

  useEffect(() => {
    if (uploadStatus === 'ready' && pdfFile) {
      toast.success('PDF đã tải lên', {
        description: pdfFile.name,
      })
      return
    }

    if (uploadStatus !== 'uploading') {
      return
    }

    const progressTimer = window.setInterval(() => {
      setUploadProgress((currentProgress) => {
        return Math.min(currentProgress + 12, 88)
      })
    }, 120)

    return () => window.clearInterval(progressTimer)
  }, [pdfFile, uploadStatus])

  function resetUploadState() {
    setPdfFile(null)
    setChunks([])
    setPageCount(null)
    setUploadProgress(0)
    setUploadStatus('idle')
    setIsDragging(false)
  }

  async function handleSelectedFile(selectedFile: File) {
    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      resetUploadState()
      toast.error('Không thể tải lên', {
        description: 'Vui lòng chọn đúng tệp PDF.',
      })
      return
    }

    setPdfFile(selectedFile)
    setChunks([])
    setPageCount(null)
    setUploadProgress(12)
    setUploadStatus('uploading')
    toast.info('Đang tải PDF', {
      description: selectedFile.name,
    })

    try {
      const nextPageCount = await getPdfPageCount(selectedFile)

      setPageCount(nextPageCount)
      setChunks([
        {
          id: createChunkId(),
          fileName: createOutputFileName(selectedFile.name, 1),
          fromPage: 1,
          toPage: nextPageCount,
        },
      ])
      setUploadProgress(100)
      setUploadStatus('ready')
    } catch (error) {
      resetUploadState()
      toast.error('Không thể tải lên', {
        description:
          error instanceof Error
            ? error.message
            : 'Không thể đọc số trang PDF.',
      })
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    void handleSelectedFile(selectedFile)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (event.dataTransfer.files.length > 1) {
      resetUploadState()
      toast.error('Không thể tải lên', {
        description: 'Vui lòng chỉ tải lên 1 tệp PDF mỗi lần.',
      })
      return
    }

    const droppedFile = event.dataTransfer.files[0]

    if (droppedFile) {
      void handleSelectedFile(droppedFile)
    }
  }

  function addChunk() {
    setChunks((currentChunks) => {
      const lastPage = currentChunks.at(-1)?.toPage ?? 0
      const partNumber = currentChunks.length + 1

      return [
        ...currentChunks,
        {
          id: createChunkId(),
          fileName: createOutputFileName(pdfFile?.name ?? 'pdf.pdf', partNumber),
          fromPage: lastPage + 1,
          toPage: pageCount ?? lastPage + 1,
        },
      ]
    })
  }

  function removeChunk(id: string) {
    setChunks((currentChunks) =>
      currentChunks.length === 1
        ? currentChunks
        : currentChunks.filter((chunk) => chunk.id !== id),
    )
  }

  function updateChunkPage(
    id: string,
    field: 'fromPage' | 'toPage',
    value: string,
  ) {
    const nextValue = Math.max(1, Number(value) || 1)

    setChunks((currentChunks) =>
      currentChunks.map((chunk) =>
        chunk.id === id ? { ...chunk, [field]: nextValue } : chunk,
      ),
    )
  }

  function updateChunkFileName(id: string, value: string) {
    setChunks((currentChunks) =>
      currentChunks.map((chunk) =>
        chunk.id === id ? { ...chunk, fileName: value } : chunk,
      ),
    )
  }

  function getChunkStatusLabel(chunk: PdfChunk) {
    if (!chunk.fileName.trim()) {
      return 'Thiếu tên tệp'
    }

    if (chunk.fromPage > chunk.toPage) {
      return 'Khoảng trang chưa hợp lệ'
    }

    if (
      pageCount !== null &&
      (chunk.fromPage > pageCount || chunk.toPage > pageCount)
    ) {
      return 'Vượt quá số trang PDF'
    }

    return 'Khoảng trang hợp lệ'
  }

  async function handleProcess() {
    if (!pdfFile || hasInvalidChunk) {
      return
    }

    setIsProcessing(true)

    const formData = new FormData()
    formData.append('file', pdfFile)
    formData.append(
      'chunks',
      JSON.stringify(
        chunks.map(({ fileName, fromPage, toPage }) => ({
          fileName,
          fromPage,
          toPage,
        })),
      ),
    )

    try {
      const response = await fetch(`${apiBaseUrl}/pdf/split`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          detail?: string
        } | null

        throw new Error(errorPayload?.detail ?? 'Không thể tách PDF.')
      }

      const zipBlob = await response.blob()
      const downloadUrl = URL.createObjectURL(zipBlob)
      const downloadLink = document.createElement('a')

      downloadLink.href = downloadUrl
      downloadLink.download = createSplitZipFileName(pdfFile.name)
      downloadLink.click()
      URL.revokeObjectURL(downloadUrl)

      toast.success('Đã tách PDF', {
        description: `Đã tạo ${chunks.length} tệp từ ${pdfFile.name}.`,
      })
    } catch (error) {
      toast.error('Xử lý thất bại', {
        description:
          error instanceof Error
            ? error.message
            : 'Có lỗi xảy ra khi tách PDF.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <main className="flex min-h-screen w-full justify-center bg-background px-3 py-4 text-foreground sm:px-6 sm:py-6 lg:px-8">
        <div className="flex w-full max-w-3xl flex-col gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tệp PDF gốc</CardTitle>
            <CardDescription>
              Kéo thả tệp vào vùng bên dưới hoặc chọn tệp từ máy của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              id="pdf-file"
              className="hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
            />
            <Label
              htmlFor="pdf-file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={[
                'flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors sm:min-h-40 sm:px-6 sm:py-8',
                isDragging
                  ? 'border-primary bg-muted text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50',
              ].join(' ')}
            >
              <div className="space-y-1">
                <div className="text-base font-medium text-foreground">
                  Kéo thả PDF vào đây
                </div>
                <div className="text-sm">
                  hoặc bấm để chọn tệp. Chỉ nhận định dạng .pdf.
                </div>
              </div>
            </Label>

            {pdfFile ? (
              <Alert>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <AlertTitle className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate">{pdfFile.name}</span>
                    <Badge
                      variant={
                        uploadStatus === 'ready' ? 'secondary' : 'outline'
                      }
                      className={
                        uploadStatus === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : undefined
                      }
                    >
                      {uploadStatus === 'ready'
                        ? 'Đã tải lên'
                        : 'Đang tải lên'}
                    </Badge>
                  </AlertTitle>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      resetUploadState()
                      toast.info('Đã xóa PDF', {
                        description: 'Bạn có thể tải lên tệp mới.',
                      })
                    }}
                  >
                    Xóa
                  </Button>
                </div>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span>
                        {formatFileSize(pdfFile.size)}
                        {pageCount ? ` · ${pageCount} trang` : null}
                        {chunks.length ? ` · ${chunks.length} phần tách` : null}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Các phần cần tách</CardTitle>
            <CardDescription>
              Mỗi phần gồm tên tệp PDF và khoảng trang muốn xuất ra.
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                size="icon"
                className="bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-sky-200 disabled:bg-muted disabled:text-muted-foreground"
                aria-label="Thêm phần tách"
                title="Thêm phần tách"
                disabled={!canAddChunk}
                onClick={addChunk}
              >
                +
              </Button>
            </CardAction>
          </CardHeader>

          {pdfFile ? (
            <CardContent className="space-y-4">
              {chunks.map((chunk, index) => (
                  <Card key={chunk.id} size="sm">
                    <CardHeader>
                      <CardTitle>Phần {index + 1}</CardTitle>
                      <CardAction>
                        <Badge variant="outline">
                          Trang {chunk.fromPage}-{chunk.toPage}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`file-name-${chunk.id}`}>
                            Tên tệp
                          </Label>
                          <Input
                            id={`file-name-${chunk.id}`}
                            value={chunk.fileName}
                            aria-invalid={!chunk.fileName.trim()}
                            onChange={(event) =>
                              updateChunkFileName(
                                chunk.id,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor={`from-page-${chunk.id}`}>
                            Từ trang
                          </Label>
                          <Input
                            id={`from-page-${chunk.id}`}
                            type="number"
                            min={1}
                            value={chunk.fromPage}
                            aria-invalid={chunk.fromPage > chunk.toPage}
                            onChange={(event) =>
                              updateChunkPage(
                                chunk.id,
                                'fromPage',
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`to-page-${chunk.id}`}>
                            Đến trang
                          </Label>
                          <Input
                            id={`to-page-${chunk.id}`}
                            type="number"
                            min={1}
                            value={chunk.toPage}
                            aria-invalid={chunk.fromPage > chunk.toPage}
                            onChange={(event) =>
                              updateChunkPage(
                                chunk.id,
                                'toPage',
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Badge
                        variant={
                          !chunk.fileName.trim() ||
                          chunk.fromPage > chunk.toPage ||
                          (pageCount !== null &&
                            (chunk.fromPage > pageCount ||
                              chunk.toPage > pageCount))
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {getChunkStatusLabel(chunk)}
                      </Badge>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="sm:w-auto"
                        disabled={chunks.length === 1}
                        onClick={() => removeChunk(chunk.id)}
                      >
                        Xóa
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </CardContent>
          ) : null}

          <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {pdfFile
                ? `${chunks.length} phần đã cấu hình${
                    pageCount ? ` · ${pageCount} trang` : ''
                  }`
                : 'Chưa có phần nào'}
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={
                !pdfFile ||
                hasInvalidChunk ||
                isProcessing ||
                uploadStatus !== 'ready'
              }
              onClick={handleProcess}
            >
              {isProcessing ? 'Đang xử lý' : 'Xử lý'}
            </Button>
          </CardFooter>
        </Card>

        </div>
      </main>
      <Toaster position="top-center" />
    </>
  )
}

export default App
