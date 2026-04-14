import { lazy, Suspense, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Canvas3D, type Canvas3DHandle } from './components/Canvas3D';
import { PlaybackControls } from './components/PlaybackControls';
import { SystemSelector } from './components/SystemSelector';
import { CaptionBar } from './components/CaptionBar';
import { usePlayback } from './hooks/usePlayback';
import { useChat } from './hooks/useChat';
import { useVisualizationController } from './hooks/useVisualizationController';

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
  const { selectedView, disabledOptions, handleViewChange } = useVisualizationController({
    canvasRef,
    initEngine,
    stop,
  });

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
          className="fixed top-5 right-5 z-30 w-11 h-11 flex items-center justify-center rounded-full glass-panel cursor-pointer text-slate-600 hover:text-slate-800 hover:shadow-lg transition-all"
          aria-label="Open chat"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* Chat panel */}
      {isChatOpen && (
        <Suspense fallback={null}>
          <ChatPanel
            playbackInfo={playbackInfo}
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
        </Suspense>
      )}
    </div>
  );
}
