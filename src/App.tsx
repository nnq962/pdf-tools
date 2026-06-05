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

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [chunks, setChunks] = useState<PdfChunk[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [isDragging, setIsDragging] = useState(false)

  const hasInvalidChunk = useMemo(
    () =>
      chunks.some(
        (chunk) =>
          chunk.fromPage < 1 ||
          chunk.toPage < 1 ||
          chunk.fromPage > chunk.toPage ||
          !chunk.fileName.trim(),
      ),
    [chunks],
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
        const nextProgress = Math.min(currentProgress + 18, 100)

        if (nextProgress === 100) {
          window.clearInterval(progressTimer)
          setUploadStatus('ready')
        }

        return nextProgress
      })
    }, 120)

    return () => window.clearInterval(progressTimer)
  }, [pdfFile, uploadStatus])

  function resetUploadState() {
    setPdfFile(null)
    setChunks([])
    setUploadProgress(0)
    setUploadStatus('idle')
    setIsDragging(false)
  }

  function handleSelectedFile(selectedFile: File) {
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
    setChunks([
      {
        id: createChunkId(),
        fileName: createOutputFileName(selectedFile.name, 1),
        fromPage: 1,
        toPage: 1,
      },
    ])
    setUploadProgress(12)
    setUploadStatus('uploading')
    toast.info('Đang tải PDF', {
      description: selectedFile.name,
    })
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    handleSelectedFile(selectedFile)
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
      handleSelectedFile(droppedFile)
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
          toPage: lastPage + 1,
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

  function handleProcess() {
    if (!pdfFile || hasInvalidChunk) {
      return
    }

    toast.success('Sẵn sàng xử lý', {
      description: `Đã tạo cấu hình tách ${chunks.length} phần cho ${pdfFile.name}.`,
    })
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
                        {formatFileSize(pdfFile.size)} · {chunks.length} phần
                        tách
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
                disabled={!pdfFile}
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
                          chunk.fromPage > chunk.toPage
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {!chunk.fileName.trim()
                          ? 'Thiếu tên tệp'
                          : chunk.fromPage > chunk.toPage
                          ? 'Khoảng trang chưa hợp lệ'
                          : 'Khoảng trang hợp lệ'}
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
                ? `${chunks.length} phần đã cấu hình`
                : 'Chưa có phần nào'}
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!pdfFile || hasInvalidChunk}
              onClick={handleProcess}
            >
              Xử lý
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
