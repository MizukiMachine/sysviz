import { useState, useCallback, useRef } from 'react';
import { PlaybackEngine } from '@/lib/three/engine/PlaybackEngine.js';
import type { ClusterRenderer } from '@/lib/three/rendering/ClusterRenderer.js';
import * as THREE from 'three';

export type PlaybackState = 'idle' | 'playing' | 'paused';

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
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const [info, setInfo] = useState<PlaybackInfo>({
    state: 'idle',
    elapsed: 0,
    duration: 0,
    currentStep: -1,
    totalSteps: 0,
    currentCaption: '',
    activeNodeId: null,
  });

  const initEngine = useCallback((renderer: ClusterRenderer, timeline: any) => {
    const engine = new PlaybackEngine(timeline, {
      onResourceState(resourceId: string, status: string) {
        renderer.setResourceStatus(resourceId, status);
        if (status === 'active') {
          const mesh = renderer.resourceMeshes.get(resourceId);
          if (mesh) {
            const stepIdx = engine.steps.findIndex((s: any) => s.nodeId === resourceId);
            const nextNodeId =
              stepIdx >= 0 && stepIdx < engine.steps.length - 1
                ? engine.steps[stepIdx + 1].nodeId
                : null;
            let targetPos = mesh.position.clone();
            if (nextNodeId) {
              const nextMesh = renderer.resourceMeshes.get(nextNodeId);
              if (nextMesh) {
                targetPos = mesh.position.clone().add(nextMesh.position).multiplyScalar(0.5);
              }
            }
            const cameraPos = targetPos.clone().add(new THREE.Vector3(0, 3, 14));
            renderer.flyTo(targetPos, cameraPos, 1000);
          }
        }
      },
      onRouteState(routeId: string, active: boolean) {
        renderer.setTrafficRouteActive(routeId, active);
        renderer.setConnectionActive(routeId.replace(/^route-/, ''), active);
      },
      onCaption(text: string) {
        setInfo((prev) => ({ ...prev, currentCaption: text || '' }));
      },
      onReset() {
        for (const id of [...renderer.resourceMeshes.keys()]) {
          renderer.setResourceStatus(id, 'idle');
        }
      },
      onStateChange(state: string) {
        renderer.lockDrag = state === 'playing';
        setInfo((prev) => ({ ...prev, state: state as PlaybackState }));
      },
      onStepChange(nodeId: string, _nextNodeId: string, caption: string, stepIndex: number, totalSteps: number) {
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
          if (_nextNodeId) {
            const nextMesh = renderer.resourceMeshes.get(_nextNodeId);
            if (nextMesh) {
              targetPos = mesh.position.clone().add(nextMesh.position).multiplyScalar(0.5);
            }
          }
          const cameraPos = targetPos.clone().add(new THREE.Vector3(0, 3, 14));
          renderer.flyTo(targetPos, cameraPos, 1000);
        }
      },
    });

    engineRef.current = engine;
    rendererRef.current = renderer;

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
  const pause = useCallback(() => engineRef.current?.pause(), []);
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

  const setTimeline = useCallback((timeline: any) => {
    if (engineRef.current) {
      engineRef.current.setTimeline(timeline);
      setInfo((prev) => ({
        ...prev,
        elapsed: 0,
        duration: timeline.duration,
        currentStep: -1,
        totalSteps: engineRef.current?.steps.length || 0,
        currentCaption: '',
        activeNodeId: null,
        state: 'idle',
      }));
    }
  }, []);

  return { info, initEngine, play, pause, stop, next, prev, setTimeline };
}
