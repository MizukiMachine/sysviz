import type { GitLabSettings } from './GitLabSettings';
import { encodePathSegments, getTargetArtifactPrefix, joinArtifactPath } from './artifactPaths';

export interface GitLabManifestDiagram {
  file: string;
  label: string;
  type: 'flowchart' | 'sequence';
}

export interface GitLabManifest {
  repository: string;
  target_project_path: string;
  target_ref: string;
  target_commit_sha: string;
  generated_at: string;
  pipeline_id?: number;
  project_type?: string;
  project_size?: string;
  diagrams: GitLabManifestDiagram[];
}

interface GitLabPipelineResponse {
  id: number;
  web_url?: string;
  status?: string;
}

interface GitLabJob {
  id: number;
  name: string;
  ref: string;
  status: string;
  artifacts_file?: {
    filename: string;
    size: number;
  };
}

interface ResolvedArtifactJob {
  jobId: number;
  manifest: GitLabManifest;
}

const SYSVIZ_PIPELINE_REF = 'main';
const SYSVIZ_ANALYZE_JOB_NAME = 'sysviz-analyze';
const MAX_CANDIDATE_JOBS = 50;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export class GitLabService {
  private resolvedArtifactJobPromise: Promise<ResolvedArtifactJob> | null = null;

  constructor(private readonly settings: GitLabSettings) {}

  private get apiBaseUrl() {
    return `${trimTrailingSlash(this.settings.baseUrl)}/api/v4`;
  }

  private get encodedSysvizProjectPath() {
    return encodeURIComponent(this.settings.sysvizProjectPath);
  }

  private get headers(): HeadersInit {
    return {
      'PRIVATE-TOKEN': this.settings.token,
    };
  }

  private get artifactPrefix() {
    return getTargetArtifactPrefix(this.settings.targetProjectPath, this.settings.targetRef);
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `GitLab API request failed: ${response.status}`);
    }

    return response;
  }

  private async requestArtifactByJobId(jobId: number, artifactPath: string, signal?: AbortSignal): Promise<Response> {
    return this.request(
      `/projects/${this.encodedSysvizProjectPath}/jobs/${jobId}/artifacts/${encodePathSegments(artifactPath)}`,
      { signal }
    );
  }

  private async listCandidateJobs(signal?: AbortSignal): Promise<GitLabJob[]> {
    const response = await this.request(
      `/projects/${this.encodedSysvizProjectPath}/jobs?scope[]=success&per_page=${MAX_CANDIDATE_JOBS}`,
      { signal }
    );
    const jobs = await response.json() as GitLabJob[];
    return jobs.filter((job) =>
      job.name === SYSVIZ_ANALYZE_JOB_NAME &&
      job.ref === SYSVIZ_PIPELINE_REF &&
      job.status === 'success' &&
      Boolean(job.artifacts_file?.filename)
    );
  }

  private async resolveArtifactJob(signal?: AbortSignal): Promise<ResolvedArtifactJob> {
    if (!this.resolvedArtifactJobPromise) {
      this.resolvedArtifactJobPromise = (async () => {
        const manifestPath = joinArtifactPath(this.artifactPrefix, 'manifest.json');
        const jobs = await this.listCandidateJobs(signal);

        for (const job of jobs) {
          try {
            const response = await this.requestArtifactByJobId(job.id, manifestPath, signal);
            const manifest = await response.json() as GitLabManifest;
            if (
              manifest.target_project_path === this.settings.targetProjectPath &&
              manifest.target_ref === this.settings.targetRef
            ) {
              return {
                jobId: job.id,
                manifest,
              };
            }
          } catch {
            continue;
          }
        }

        throw new Error(
          `No SysViz artifact found for ${this.settings.targetProjectPath}@${this.settings.targetRef}`
        );
      })().catch((error) => {
        this.resolvedArtifactJobPromise = null;
        throw error;
      });
    }

    return this.resolvedArtifactJobPromise;
  }

  invalidateArtifactCache() {
    this.resolvedArtifactJobPromise = null;
  }

  async fetchManifest(signal?: AbortSignal): Promise<GitLabManifest> {
    const resolved = await this.resolveArtifactJob(signal);
    return resolved.manifest;
  }

  async fetchMmdFile(file: string, signal?: AbortSignal): Promise<string> {
    const resolved = await this.resolveArtifactJob(signal);
    const artifactPath = joinArtifactPath(this.artifactPrefix, file);
    const response = await this.requestArtifactByJobId(resolved.jobId, artifactPath, signal);
    return response.text();
  }

  async triggerPipeline(signal?: AbortSignal): Promise<GitLabPipelineResponse> {
    const form = new FormData();
    form.set('ref', SYSVIZ_PIPELINE_REF);
    form.set('variables[TARGET_PROJECT_PATH]', this.settings.targetProjectPath);
    form.set('variables[TARGET_REF]', this.settings.targetRef);

    const response = await this.request(
      `/projects/${this.encodedSysvizProjectPath}/pipeline`,
      {
        method: 'POST',
        body: form,
        signal,
      }
    );
    this.invalidateArtifactCache();
    return response.json();
  }
}
