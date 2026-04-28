import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isGitLabConfigured,
  loadGitLabSettings,
  saveGitLabSettings,
  type GitLabSettings,
} from '@/lib/gitlab/GitLabSettings';
import { GitLabService, type GitLabManifest } from '@/lib/gitlab/GitLabService';
import { createGitLabViewEntry, type ViewEntry } from '@/lib/views/viewRegistry';

export function useGitLab() {
  const [settings, setSettings] = useState<GitLabSettings>(loadGitLabSettings);
  const [manifest, setManifest] = useState<GitLabManifest | null>(null);
  const [views, setViews] = useState<ViewEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const service = useMemo(() => new GitLabService(settings), [settings]);
  const configured = isGitLabConfigured(settings);

  const updateSettings = useCallback((next: GitLabSettings) => {
    setSettings(next);
    saveGitLabSettings(next);
  }, []);

  const refreshManifest = useCallback(async () => {
    if (!configured) {
      setManifest(null);
      setViews([]);
      setError(null);
      return null;
    }

    const ac = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      service.invalidateArtifactCache();
      const nextManifest = await service.fetchManifest(ac.signal);
      setManifest(nextManifest);
      setViews(nextManifest.diagrams.map((diagram) => createGitLabViewEntry(diagram)));
      return nextManifest;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitLab manifest fetch failed';
      setManifest(null);
      setViews([]);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [configured, service]);

  const triggerReanalyze = useCallback(async () => {
    if (!configured) {
      throw new Error('GitLab settings are incomplete');
    }

    setIsTriggering(true);
    setError(null);
    try {
      const pipeline = await service.triggerPipeline();
      return pipeline;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitLab pipeline trigger failed';
      setError(message);
      throw err;
    } finally {
      setIsTriggering(false);
    }
  }, [configured, service]);

  useEffect(() => {
    if (!settings.enabled) {
      setManifest(null);
      setViews([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    void refreshManifest();
  }, [refreshManifest, settings.enabled]);

  return {
    settings,
    updateSettings,
    manifest,
    views,
    error,
    isLoading,
    isTriggering,
    configured,
    refreshManifest,
    triggerReanalyze,
    service,
  };
}
