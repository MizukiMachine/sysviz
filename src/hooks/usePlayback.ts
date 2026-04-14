import { useState, useCallback, useRef } from 'react';
import { PlaybackEngine, type PlaybackEngineState } from '@/lib/three/engine/PlaybackEngine.js';
import type { ClusterRenderer } from '@/lib/three/rendering/ClusterRenderer.js';
import type { ViewConfig } from '@/types/visualization';

/** Camera offset relative to the active node during playback */
const PLAYBACK_CAMERA_OFFSET = { y: 6, z: 9 } as const;

export type PlaybackState = PlaybackEngineState | 'paused';

export interface PlaybackInfo {
  state: PlaybackState;
  elapsed: number;
  duration: number;
  currentStep: number;
  totalSteps: number;
  currentCaption: string;
  activeNodeId: string | null;
}

export function usePlayback() {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [info, setInfo] = useState<PlaybackInfo>({
    state: 'idle',
    elapsed: 0,
    duration: 0,
    currentStep: -1,
    totalSteps: 0,
    currentCaption: '',
    activeNodeId: null,
  });

  const initEngine = useCallback((renderer: ClusterRenderer, timeline: ViewConfig['timeline']) => {
    const engine = new PlaybackEngine(timeline, {
      onResourceState(resourceId: string, status: string) {
        renderer.setResourceStatus(resourceId, status);
      },
      onRouteState(routeId: string, active: boolean) {
        renderer.setTrafficRouteActive(routeId, active);
        renderer.setConnectionActive(routeId.replace(/^route-/, ''), active);
      },
      onCaption(text: string) {
        setInfo((prev) => ({ ...prev, currentCaption: text || '' }));
      },
      onReset() {
        const allIds = [...renderer.resourceMeshes.keys()];
        for (const id of allIds) {
          renderer.setResourceStatus(id, 'idle');
        }
        renderer.clearTrafficParticles();
        for (const id of [...renderer.particleTraffic.routes.keys()]) {
          renderer.setTrafficRouteActive(id, false);
        }
        for (const id of [...renderer.connectionLines.connections.keys()]) {
          renderer.setConnectionActive(id, false);
        }
      },
      onStateChange(state) {
        renderer.lockDrag = state === 'playing';
        setInfo((prev) => ({ ...prev, state }));
      },
      onStepChange({ nodeId, nextNodeId, caption, stepIndex, totalSteps }) {
        setInfo((prev) => ({
          ...prev,
          currentStep: stepIndex,
          totalSteps,
          currentCaption: caption || '',
          activeNodeId: nodeId,
        }));
        const mesh = renderer.resourceMeshes.get(nodeId);
        if (mesh) {
          let targetPos = mesh.position.clone();
          if (nextNodeId) {
            const nextMesh = renderer.resourceMeshes.get(nextNodeId);
            if (nextMesh) {
              targetPos = mesh.position.clone().add(nextMesh.position).multiplyScalar(0.5);
            }
          }
          const cameraPos = targetPos.clone();
          cameraPos.y += PLAYBACK_CAMERA_OFFSET.y;
          cameraPos.z += PLAYBACK_CAMERA_OFFSET.z;
          renderer.flyTo(targetPos, cameraPos, 1000);
        }
      },
    });

    engineRef.current = engine;

    renderer.onAnimate = (delta: number) => {
      if (engine.state === 'playing') engine.update(delta);
    };

    setInfo({
      state: 'idle',
      elapsed: 0,
      duration: timeline.duration,
      currentStep: -1,
      totalSteps: engine.steps.length,
      currentCaption: '',
      activeNodeId: null,
    });

    return engine;
  }, []);

  const play = useCallback(() => engineRef.current?.play(), []);
  const stop = useCallback(() => {
    engineRef.current?.stop();
    setInfo((prev) => ({
      ...prev,
      currentStep: -1,
      currentCaption: '',
      activeNodeId: null,
      state: 'idle',
    }));
  }, []);
  const next = useCallback(() => engineRef.current?.next(), []);
  const prev = useCallback(() => engineRef.current?.prev(), []);

  return { info, initEngine, play, stop, next, prev };
}
