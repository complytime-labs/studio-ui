// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { apiFetch } from "../api/fetch";
import { detectGemaraMetadataType } from "../lib/detect-gemara-type";

const ACCEPT = ".yaml,.yml,.json,application/json,text/yaml,text/x-yaml";

type ImportTab = "file" | "paste" | "oci";

export interface ImportOverlayProps {
  open: boolean;
  onClose: () => void;
  expectedArtifactType?: string;
  onSuccess?: () => void;
}

export function ImportOverlay({ open, onClose, expectedArtifactType, onSuccess }: ImportOverlayProps) {
  const [tab, setTab] = useState<ImportTab>("file");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [ociRef, setOciRef] = useState("");
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetAll = useCallback(() => {
    setFileName("");
    setRawText(null);
    setPasteText("");
    setOciRef("");
    setDetectedType(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) {
      resetAll();
      setSubmitting(false);
      setTab("file");
    }
  }, [open, resetAll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (tab === "paste" && pasteText.trim()) {
      setDetectedType(detectGemaraMetadataType(pasteText));
    } else if (tab !== "file") {
      setDetectedType(null);
    }
  }, [tab, pasteText]);

  const processFile = (file: File) => {
    const lower = file.name.toLowerCase();
    const ok = lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json");
    if (!ok) {
      setResult({ ok: false, message: "Choose a .yaml, .yml, or .json file." });
      return;
    }
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFileName(file.name);
      setRawText(text);
      setDetectedType(detectGemaraMetadataType(text));
    };
    reader.onerror = () => setResult({ ok: false, message: "Could not read file." });
    reader.readAsText(file, "UTF-8");
  };

  const contentTypeForName = (name: string): string =>
    name.toLowerCase().endsWith(".json") ? "application/json" : "text/yaml";

  const pollJob = async (jobId: string, maxAttempts = 20): Promise<Record<string, string>> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await apiFetch(`/api/ingest/jobs/${jobId}`);
      if (!res.ok) throw new Error(`Poll failed (${res.status})`);
      const j = await res.json() as Record<string, string>;
      if (j.status === "completed" || j.status === "failed") return j;
    }
    return { status: "pending", job_id: jobId };
  };

  const formatJobResult = (job: Record<string, string>, jobId: string): string => {
    if (job.status === "failed") return job.error || "Ingest failed";
    if (job.artifact_type && job.artifact_id) return `Imported ${job.artifact_type} ${job.artifact_id}.`;
    if (job.policy_id) return `Ingested ${job.inserted || "?"} evidence rows.`;
    if (job.status === "pending") return `Ingest queued (job ${jobId}). Check back shortly.`;
    return "Import succeeded.";
  };

  const doIngestImport = async (body: string, contentType: string) => {
    const res = await apiFetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    const accepted = await res.json() as Record<string, string>;
    if (!res.ok) throw new Error(String(accepted.error || accepted.errors || `Import failed (${res.status})`));
    const jobId = accepted.job_id;
    if (!jobId) throw new Error("No job ID returned");
    const job = await pollJob(jobId);
    if (job.status === "failed") throw new Error(job.error || "Ingest failed");
    return formatJobResult(job, jobId);
  };

  const doOciImport = async (ref: string) => {
    const res = await apiFetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: ref }),
    });
    const data = await res.json() as { imported?: Array<{ type: string; id: string; name?: string }>; error?: string };
    if (!res.ok) throw new Error(String(data.error || `Import failed (${res.status})`));
    const count = data.imported?.length ?? 0;
    if (count === 0) return "No artifacts found in bundle.";
    const summary = data.imported!.map((a) => `${a.type} ${a.id || a.name || ""}`).join(", ");
    return `Imported ${count} artifact${count > 1 ? "s" : ""}: ${summary}`;
  };

  const doImport = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      let msg: string;
      if (tab === "oci") {
        msg = await doOciImport(ociRef.trim());
      } else {
        const body = tab === "paste" ? pasteText : rawText!;
        const ct = tab === "paste" ? guessContentType(pasteText) : contentTypeForName(fileName);
        msg = await doIngestImport(body, ct);
      }
      setResult({ ok: true, message: msg });
      onSuccess?.();
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (): boolean => {
    if (submitting) return false;
    if (tab === "file") return !!rawText?.trim();
    if (tab === "paste") return !!pasteText.trim();
    if (tab === "oci") return !!ociRef.trim();
    return false;
  };

  const typeMismatch = expectedArtifactType && detectedType && detectedType !== expectedArtifactType;

  if (!open) return null;

  return (
    <div
      class="import-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div class="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <h3 id="import-title">Import artifact</h3>
        {expectedArtifactType && (
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-muted)" }}>
            Expected: {expectedArtifactType}
          </p>
        )}

        <div class="import-tabs" role="tablist">
          {(["file", "paste", "oci"] as ImportTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              class={`import-tab ${tab === t ? "import-tab-active" : ""}`}
              onClick={() => { setTab(t); setResult(null); }}
            >
              {t === "file" ? "File" : t === "paste" ? "Paste" : "OCI Reference"}
            </button>
          ))}
        </div>

        {tab === "file" && (
          <>
            <label
              class={`import-dropzone ${dragActive ? "drag-active" : ""}`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const f = e.dataTransfer?.files?.[0];
                if (f) processFile(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) processFile(f);
                }}
              />
              Drop a Gemara artifact or click to browse
            </label>
            {(fileName || detectedType) && (
              <div class="import-file-info">
                {fileName && <span>{fileName}</span>}
                {detectedType && <span class="import-type-badge">{detectedType}</span>}
              </div>
            )}
          </>
        )}

        {tab === "paste" && (
          <>
            <textarea
              class="import-paste-area"
              placeholder="Paste Gemara artifact YAML or JSON..."
              value={pasteText}
              onInput={(e) => setPasteText((e.target as HTMLTextAreaElement).value)}
              rows={10}
            />
            {detectedType && (
              <div class="import-file-info">
                <span>Detected type:</span>
                <span class="import-type-badge">{detectedType}</span>
              </div>
            )}
          </>
        )}

        {tab === "oci" && (
          <div class="import-oci-input">
            <label for="oci-ref-input" style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>
              OCI bundle reference
            </label>
            <input
              id="oci-ref-input"
              type="text"
              class="import-oci-field"
              placeholder="ghcr.io/org/artifact:v1.0.0"
              value={ociRef}
              onInput={(e) => setOciRef((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit()) void doImport(); }}
            />
          </div>
        )}

        {typeMismatch && (
          <div class="import-result import-result-error" style={{ marginTop: "12px" }}>
            File type is {detectedType}, not {expectedArtifactType}. You can still import.
          </div>
        )}

        <div class="import-actions">
          <button type="button" class="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={!canSubmit()}
            onClick={() => void doImport()}
          >
            {submitting ? "Importing…" : "Import"}
          </button>
        </div>

        {result && (
          <div
            class={`import-result ${result.ok ? "import-result-success" : "import-result-error"}`}
            role={result.ok ? "status" : "alert"}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

function guessContentType(text: string): string {
  return text.trimStart().startsWith("{") ? "application/json" : "text/yaml";
}
