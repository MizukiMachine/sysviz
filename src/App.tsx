import { useRef, useState, useCallback, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Canvas3D, type Canvas3DHandle, type ViewConfig } from './components/Canvas3D';
import { PlaybackControls } from './components/PlaybackControls';
import { SystemSelector } from './components/SystemSelector';
import { CaptionBar } from './components/CaptionBar';
import { ChatPanel } from './components/ChatPanel';
import { usePlayback } from './hooks/usePlayback';
import { useChat } from './hooks/useChat';
import {
  FLASK_NODES,
  FLASK_CONNECTIONS,
  FLASK_TIMELINE,
  buildTrafficRoutes as buildFlaskRoutes,
} from './lib/three/data/FlaskFlow.js';
import {
  DATA_FLOW_NODES,
  DATA_FLOW_CONNECTIONS,
  DATA_FLOW_TIMELINE,
  DATA_FLOW_CAMERA,
  buildTrafficRoutes as buildDataFlowRoutes,
} from './lib/three/data/FlaskDataFlow.js';
import {
  SEQUENCE_NODES,
  SEQUENCE_CONNECTIONS,
  SEQUENCE_TIMELINE,
  SEQUENCE_CAMERA,
  buildTrafficRoutes as buildSequenceRoutes,
} from './lib/three/data/FlaskSequence.js';
import { MermaidParser } from './lib/three/parser/MermaidParser.js';

const VIEWS: Record<string, {
  nodes: any[];
  connections: any[];
  timeline: any;
  buildRoutes: any;
  camera: any;
}> = {
  'flask-request-flow': {
    nodes: FLASK_NODES,
    connections: FLASK_CONNECTIONS,
    timeline: FLASK_TIMELINE,
    buildRoutes: buildFlaskRoutes,
    camera: null,
  },
  'flask-data-flow': {
    nodes: DATA_FLOW_NODES,
    connections: DATA_FLOW_CONNECTIONS,
    timeline: DATA_FLOW_TIMELINE,
    buildRoutes: buildDataFlowRoutes,
    camera: DATA_FLOW_CAMERA,
  },
  'flask-sequence': {
    nodes: SEQUENCE_NODES,
    connections: SEQUENCE_CONNECTIONS,
    timeline: SEQUENCE_TIMELINE,
    buildRoutes: buildSequenceRoutes,
    camera: SEQUENCE_CAMERA,
  },
};

export default function App() {
  const canvasRef = useRef<Canvas3DHandle>(null);
  const [selectedView, setSelectedView] = useState('flask-data-flow');
  const [disabledOptions, setDisabledOptions] = useState<Set<string>>(new Set());
  const [mermaidView, setMermaidView] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const {
    info: playbackInfo,
    initEngine,
    play,
    pause,
    stop,
    next,
    prev,
  } = usePlayback();
  const chat = useChat();
  const initializedRef = useRef(false);
  const loadViewRef = useRef<(viewName: string) => void>(() => {});

  // Parse Mermaid file on mount (with cancellation guard)
  useEffect(() => {
    let cancelled = false;
    const mermaidParser = new MermaidParser();
    mermaidParser
      .parse('/data/03_data_flow.mmd')
      .then((data: any) => {
        if (!cancelled) setMermaidView(data);
      })
      .catch((e: any) => {
        if (!cancelled) {
          console.warn('Mermaid parse failed:', e);
          setDisabledOptions(new Set(['mermaid-data-flow']));
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Stable loadView function using ref
  loadViewRef.current = (viewName: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.renderer) return;

    stop();

    if (viewName === 'mermaid-data-flow') {
      if (!mermaidView) return;
      const viewConfig: ViewConfig = {
        nodes: mermaidView.nodes,
        connections: mermaidView.connections,
        timeline: mermaidView.timeline,
        buildRoutes: mermaidView.buildRoutes,
        camera: mermaidView.camera,
        subgraphs: mermaidView.subgraphs,
        nodeSubgraphs: mermaidView.nodeSubgraphs ?? new Map(),
      };
      canvas.loadView(viewConfig);
      initEngine(canvas.renderer, mermaidView.timeline);
      return;
    }

    const view = VIEWS[viewName];
    if (!view) return;

    const viewConfig: ViewConfig = {
      nodes: view.nodes,
      connections: view.connections,
      timeline: view.timeline,
      buildRoutes: view.buildRoutes,
      camera: view.camera,
    };
    canvas.loadView(viewConfig);
    initEngine(canvas.renderer, view.timeline);
  };

  // Initial load — poll for canvas readiness instead of fixed timer
  useEffect(() => {
    if (initializedRef.current) return;
    if (selectedView === 'mermaid-data-flow' && !mermaidView) return;

    let tries = 0;
    const poll = () => {
      if (canvasRef.current?.renderer) {
        initializedRef.current = true;
        loadViewRef.current(selectedView);
        return;
      }
      tries++;
      if (tries < 20) {
        setTimeout(poll, 50);
      } else {
        // Fallback: force load anyway
        initializedRef.current = true;
        loadViewRef.current(selectedView);
      }
    };
    const timer = setTimeout(poll, 100);
    return () => clearTimeout(timer);
  }, [selectedView, mermaidView]);

  // Re-load when view changes (after initial)
  useEffect(() => {
    if (!initializedRef.current) return;
    loadViewRef.current(selectedView);
  }, [selectedView]);

  const handleViewChange = useCallback((viewName: string) => {
    initializedRef.current = true;
    stop();
    setSelectedView(viewName);
  }, [stop]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Canvas3D ref={canvasRef} />

      <SystemSelector
        value={selectedView}
        onChange={handleViewChange}
        disabledOptions={disabledOptions}
      />

      <CaptionBar
        text={playbackInfo.currentCaption}
        step={playbackInfo.currentStep}
        totalSteps={playbackInfo.totalSteps}
      />

      <PlaybackControls
        state={playbackInfo.state}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onNext={next}
        onPrev={prev}
      />

      {/* Chat toggle button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed top-5 right-5 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel cursor-pointer text-slate-600 hover:text-slate-800 hover:shadow-lg transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* Chat panel */}
      {isChatOpen && (
        <ChatPanel
          playbackInfo={playbackInfo}
          selectedView={selectedView}
          onClose={() => setIsChatOpen(false)}
          messages={chat.messages}
          isLoading={chat.isLoading}
          error={chat.error}
          settings={chat.settings}
          onSendMessage={(text) => chat.sendMessage(text, playbackInfo, selectedView)}
          onStopStreaming={chat.stopStreaming}
          onClearChat={chat.clearChat}
          onUpdateSettings={chat.updateSettings}
        />
      )}
    </div>
  );
}
