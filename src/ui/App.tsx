import { useCallback, useRef, useState } from 'react'
import { GameScreen } from './GameScreen'
import { HowToScreen } from './HowToScreen'
import { MenuScreen } from './MenuScreen'
import { SoloScreen } from './SoloScreen'
import { readJSON, writeJSON } from './storage'
import { loadSettings, saveSettings, type Settings } from './settings'
import { Toast, type ToastMessage } from './Toast'

const SEEN_RULES_KEY = 'ts_seen_rules'

type Screen = 'menu' | 'howto' | 'game'

export function App() {
  // При первом запуске сразу показываем правила.
  const [screen, setScreen] = useState<Screen>(() =>
    readJSON(SEEN_RULES_KEY, false) ? 'menu' : 'howto'
  )
  const [firstVisit, setFirstVisit] = useState(() => !readJSON(SEEN_RULES_KEY, false))
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const changeSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  // VISUAL_2026.md раздел 1: WebGL и Canvas не поднялись — классическое поле и тост.
  const fallbackTo1986 = useCallback((error: unknown) => {
    console.warn('2026 graphics unavailable, switching to 1986:', error)
    setSettings((current) => {
      const next = { ...current, theme: '1986' as const }
      saveSettings(next)
      return next
    })
    setToast({ id: Date.now(), text: "Classic mode — your device doesn't support 2026 graphics" })
  }, [])

  // VISUAL_2026.md раздел 5: тики опаздывают — один раз за сессию предложить 1986. Кнопка
  // переключает сразу, прямо в партии: поле пересоздаётся, игра идёт дальше.
  const offeredClassic = useRef(false)
  const offerClassic = useCallback(() => {
    if (offeredClassic.current) return
    offeredClassic.current = true
    setToast({
      id: Date.now(),
      text: 'Switch to Classic 1986 for smoother play?',
      action: {
        label: 'SWITCH',
        onClick: () =>
          setSettings((current) => {
            const next = { ...current, theme: '1986' as const }
            saveSettings(next)
            return next
          }),
      },
    })
  }, [])

  return (
    <>
      {renderScreen()}
      <Toast toast={toast} onClose={closeToast} />
    </>
  )

  function renderScreen() {
    if (screen === 'howto') {
      return (
        <HowToScreen
          mode={settings.mode}
          doneLabel={firstVisit ? "GOT IT — LET'S PLAY" : 'BACK'}
          onDone={() => {
            writeJSON(SEEN_RULES_KEY, true)
            setScreen(firstVisit ? 'game' : 'menu')
            setFirstVisit(false)
          }}
        />
      )
    }
    if (screen === 'game') {
      return settings.mode === 'solo' ? (
        <SoloScreen settings={settings} onMenu={() => setScreen('menu')} onRendererFallback={fallbackTo1986} onSlowRenderer={offerClassic} />
      ) : (
        <GameScreen settings={settings} onMenu={() => setScreen('menu')} onRendererFallback={fallbackTo1986} onSlowRenderer={offerClassic} />
      )
    }
    return (
      <MenuScreen
        settings={settings}
        onSettingsChange={changeSettings}
        onPlay={() => setScreen('game')}
        onHowTo={() => setScreen('howto')}
      />
    )
  }
}
