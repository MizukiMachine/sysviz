import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Canvas3D, type Canvas3DHandle } from './components/Canvas3D';
import { PlaybackControls } from './components/PlaybackControls';
import { SystemSelector } from './components/SystemSelector';
import { CaptionBar } from './components/CaptionBar';
import { usePlayback } from './hooks/usePlayback';
import { useChat } from './hooks/useChat';
import { useVisualizationController } from './hooks/useVisualizationController';
import { BUILTIN_VIEW_OPTIONS, DEFAULT_VIEW } from './lib/views/viewRegistry';
import { useGitLab } from './hooks/useGitLab';

const ChatPanel = lazy(() =>
  import('./components/ChatPanel').then((module) => ({ default: module.ChatPanel }))
);

export default function App() {
  const canvasRef = useRef<Canvas3DHandle>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const {
    info: playbackInfo,
    initEngine,
    play,
    stop,
    next,
    prev,
  } = usePlayback();
  const chat = useChat();
  const gitLab = useGitLab();
  const { selectedView, disabledOptions, handleViewChange, mermaidView, rawMmdText, isEnriching, isLoadingView } = useVisualizationController({
    canvasRef,
    initEngine,
    stop,
    gitLabService: gitLab.configured ? gitLab.service : null,
  });
  const allViews = useMemo(() => [...BUILTIN_VIEW_OPTIONS, ...gitLab.views], [gitLab.views]);

  useEffect(() => {
    if (allViews.some((view) => view.value === selectedView)) return;
    handleViewChange(DEFAULT_VIEW);
  }, [allViews, handleViewChange, selectedView]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Canvas3D ref={canvasRef} />

      <SystemSelector
        value={selectedView}
        onChange={handleViewChange}
        disabledOptions={disabledOptions}
        builtInViews={BUILTIN_VIEW_OPTIONS}
        gitLabViews={gitLab.views}
        gitLabEnabled={gitLab.settings.enabled}
        gitLabLoading={gitLab.isLoading}
        gitLabRefreshing={gitLab.isTriggering}
        gitLabError={gitLab.error}
        onRefreshGitLab={() => { void gitLab.refreshManifest(); }}
        onTriggerReanalyze={() => { void gitLab.triggerReanalyze(); }}
      />

      {(isEnriching || isLoadingView) && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-48 z-20 pointer-events-none select-none">
          <div className="rounded-full bg-white/70 backdrop-blur-sm shadow px-4 py-1.5 flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">
              {isEnriching ? 'AI解説を生成中...' : '読み込み中...'}
            </span>
          </div>
        </div>
      )}

      <CaptionBar
        text={playbackInfo.currentCaption}
        step={playbackInfo.currentStep}
        totalSteps={playbackInfo.totalSteps}
      />

      <PlaybackControls
        info={playbackInfo}
        onPlay={play}
        onStop={stop}
        onNext={next}
        onPrev={prev}
      />

      {/* Chat toggle button */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed top-5 right-5 z-30 w-14 h-14 flex items-center justify-center rounded-full glass-panel cursor-pointer text-slate-600 hover:text-slate-800 hover:shadow-lg transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat panel */}
      {isChatOpen && (
        <Suspense fallback={null}>
          <ChatPanel
            playbackInfo={playbackInfo}
            viewConfig={mermaidView}
            rawMmdText={rawMmdText}
            onClose={() => setIsChatOpen(false)}
            messages={chat.messages}
            isLoading={chat.isLoading}
            error={chat.error}
            settings={chat.settings}
            gitLabSettings={gitLab.settings}
            onSendMessage={(text) => chat.sendMessage(text, playbackInfo, selectedView, mermaidView, rawMmdText)}
            onStopStreaming={chat.stopStreaming}
            onClearChat={chat.clearChat}
            onUpdateSettings={chat.updateSettings}
            onUpdateGitLabSettings={gitLab.updateSettings}
          />
        </Suspense>
      )}
    </div>
  );
}
