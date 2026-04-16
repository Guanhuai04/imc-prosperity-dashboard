import JSZip from "jszip";
import type { SourceGroupKind } from "./types";

export interface ImportSourceGroup {
  files: File[];
  id: string;
  kind: SourceGroupKind;
  label: string;
}

const SUPPORTED_ENTRY_PATTERN = /\.(csv|log|json)$/i;
const CSV_PATTERN = /\.csv$/i;
const LOG_PATTERN = /\.(log|json)$/i;
const ZIP_PATTERN = /\.zip$/i;

function sanitizeLabel(label: string) {
  return label.trim().replace(/\.[^.]+$/, "");
}

function buildGroupId(kind: SourceGroupKind, label: string) {
  return `${kind}:${sanitizeLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getRelativePath(file: File) {
  const candidate = file as File & { webkitRelativePath?: string };
  return candidate.webkitRelativePath && candidate.webkitRelativePath.trim().length > 0
    ? candidate.webkitRelativePath
    : null;
}

function setRelativePath(file: File, relativePath: string) {
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: relativePath,
    });
  } catch {
    // Ignore if the browser prevents redefining this property.
  }

  return file;
}

function isSupportedEntry(name: string) {
  return SUPPORTED_ENTRY_PATTERN.test(name);
}

function isCsvFile(file: File) {
  return CSV_PATTERN.test(file.name);
}

function isLogFile(file: File) {
  return LOG_PATTERN.test(file.name);
}

function isZipFile(file: File) {
  return ZIP_PATTERN.test(file.name);
}

function buildFlatFileImportGroups(files: File[]) {
  const supportedFiles = files.filter((file) => isCsvFile(file));
  if (supportedFiles.length === 0) {
    return [];
  }

  const label =
    supportedFiles.length === 1 ? sanitizeLabel(supportedFiles[0].name) : "selected-csv-files";

  return [
    {
      files: supportedFiles,
      id: buildGroupId("file", label),
      kind: "file" as const,
      label,
    },
  ];
}

export function buildFolderImportGroups(files: File[]) {
  const groups = new Map<string, ImportSourceGroup>();

  for (const file of files) {
    if (!isSupportedEntry(file.name)) {
      continue;
    }

    const relativePath = getRelativePath(file);
    const segments = relativePath?.split(/[\\/]/).filter(Boolean) ?? [];
    const label = segments[0] ?? sanitizeLabel(file.name);
    const id = buildGroupId("folder", label);
    const group = groups.get(id);

    if (group === undefined) {
      groups.set(id, {
        files: [file],
        id,
        kind: "folder",
        label,
      });
      continue;
    }

    group.files.push(file);
  }

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function buildLogImportGroups(files: File[]) {
  return files
    .filter((file) => isLogFile(file))
    .map((file) => ({
      files: [file],
      id: buildGroupId("log", file.name),
      kind: "log" as const,
      label: sanitizeLabel(file.name),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function buildArchiveImportGroups(files: File[]) {
  const groups: ImportSourceGroup[] = [];

  for (const archive of files) {
    if (!isZipFile(archive)) {
      continue;
    }

    const zip = await JSZip.loadAsync(archive);
    const extractedFiles: File[] = [];
    const label = sanitizeLabel(archive.name);

    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !isSupportedEntry(entry.name)) {
        continue;
      }

      const blob = await entry.async("blob");
      const baseName = entry.name.split(/[\\/]/).filter(Boolean).pop() ?? entry.name;
      const extracted = new File([blob], baseName, {
        lastModified: archive.lastModified,
        type: blob.type || undefined,
      });

      extractedFiles.push(setRelativePath(extracted, `${label}/${entry.name}`));
    }

    if (extractedFiles.length === 0) {
      continue;
    }

    groups.push({
      files: extractedFiles,
      id: buildGroupId("archive", label),
      kind: "archive",
      label,
    });
  }

  return groups.sort((left, right) => left.label.localeCompare(right.label));
}

export async function buildImportSourceGroups(files: File[]) {
  const folderFiles = files.filter(
    (file) => getRelativePath(file) !== null && !isZipFile(file) && isSupportedEntry(file.name),
  );
  const standaloneArchives = files.filter((file) => getRelativePath(file) === null && isZipFile(file));
  const standaloneLogs = files.filter((file) => getRelativePath(file) === null && isLogFile(file));
  const standaloneCsvs = files.filter((file) => getRelativePath(file) === null && isCsvFile(file));

  const groups = [
    ...buildFolderImportGroups(folderFiles),
    ...buildFlatFileImportGroups(standaloneCsvs),
    ...buildLogImportGroups(standaloneLogs),
    ...(await buildArchiveImportGroups(standaloneArchives)),
  ];

  return groups.sort((left, right) => left.label.localeCompare(right.label));
}
