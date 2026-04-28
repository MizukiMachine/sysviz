function sanitizeStorageSegment(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) return 'unknown';

  return trimmed
    .replace(/\//g, '__')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

export function getTargetArtifactPrefix(targetProjectPath: string, targetRef: string): string {
  return [
    'outputs',
    sanitizeStorageSegment(targetProjectPath),
    sanitizeStorageSegment(targetRef),
  ].join('/');
}

export function joinArtifactPath(root: string, file: string): string {
  const cleanRoot = root.replace(/^\/+|\/+$/g, '');
  const cleanFile = file.replace(/^\/+/, '');
  return cleanRoot ? `${cleanRoot}/${cleanFile}` : cleanFile;
}

export function encodePathSegments(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
