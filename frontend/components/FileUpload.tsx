"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadFile, suggestTarget } from "@/lib/api"
import { useStore } from "@/store/useStore"

export default function FileUpload() {
  const [isDragActive, setIsDragActive] = useState(false)
  const {
    setSession,
    setProfile,
    setTargetSuggestions,
    setStep,
    setLoading,
    setError,
    loading,
    error,
  } = useStore()

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)

      try {
        // Step 1: Upload and profile the dataset
        const uploadRes = await uploadFile(file)
        setSession(uploadRes.session_id, uploadRes.filename)
        setProfile(uploadRes.profile, uploadRes.problem_hint)

        // Step 2: Get target suggestions
        const suggestRes = await suggestTarget(uploadRes.session_id)
        setTargetSuggestions(suggestRes.suggestions)

        setStep("preview")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [setSession, setProfile, setTargetSuggestions, setStep, setLoading, setError]
  )

  const onDrop = useCallback(
    (accepted: File[], rejections: { errors: { code: string }[] }[]) => {
      if (accepted.length > 0) {
        processFile(accepted[0])
      } else if (rejections.length > 0) {
        const isTooLarge = rejections[0].errors.some((e) => e.code === "file-too-large")
        const isTooMany = rejections[0].errors.some((e) => e.code === "too-many-files")

        if (isTooLarge) {
          setError("File too large. Maximum size is 50 MB.")
        } else if (isTooMany) {
          setError("Please upload a single file at a time.")
        } else {
          setError("Unsupported file type. Please upload a CSV, XLS, or XLSX file.")
        }
      }
    },
    [processFile, setError]
  )

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: loading,
  })

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        role="button"
        aria-label="Upload dataset — drag and drop or click to browse"
        aria-disabled={loading}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-violet-500 bg-violet-500/10"
            : "border-zinc-700 bg-zinc-900/50 hover:border-violet-500/50 hover:bg-zinc-900",
          loading && "opacity-60 cursor-not-allowed pointer-events-none"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-5">
          {/* Icon area */}
          {loading ? (
            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Loader2 className="w-9 h-9 text-violet-400 animate-spin" aria-hidden="true" />
            </div>
          ) : isDragActive ? (
            <div className="w-20 h-20 rounded-full bg-violet-500/20 border-2 border-violet-400/60 flex items-center justify-center">
              <Upload className="w-9 h-9 text-violet-300" aria-hidden="true" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <FileText className="w-9 h-9 text-violet-400" aria-hidden="true" />
            </div>
          )}

          {/* Text */}
          <div className="space-y-1">
            {loading ? (
              <>
                <p className="text-lg font-semibold text-zinc-200">Analyzing your dataset...</p>
                <p className="text-sm text-zinc-500">Profiling columns and detecting patterns</p>
              </>
            ) : isDragActive ? (
              <p className="text-lg font-semibold text-violet-300">Release to upload</p>
            ) : (
              <>
                <p className="text-lg font-semibold text-zinc-200">
                  Drop your dataset here
                </p>
                <p className="text-sm text-zinc-500">
                  or{" "}
                  <span className="text-violet-400 underline underline-offset-2 hover:text-violet-300 transition-colors">
                    browse files
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Format chips */}
          {!loading && (
            <div className="flex gap-2">
              {[".csv", ".xls", ".xlsx"].map((ext) => (
                <span
                  key={ext}
                  className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono"
                >
                  {ext}
                </span>
              ))}
              <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-500">
                max 50 MB
              </span>
            </div>
          )}
        </div>

        {/* Drag overlay border animation */}
        {isDragActive && (
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl border-2 border-violet-400 animate-pulse pointer-events-none"
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
