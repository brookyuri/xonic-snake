import { useState } from 'react'
import { GameScreen } from './GameScreen'
import { HowToScreen } from './HowToScreen'
import { MenuScreen } from './MenuScreen'
import { readJSON, writeJSON } from './storage'
import { loadSettings, saveSettings, type Settings } from './settings'

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

  if (screen === 'howto') {
    return (
      <HowToScreen
        doneLabel={firstVisit ? "GOT IT — LET'S PLAY" : 'BACK'}
        onDone={() => {
          writeJSON(SEEN_RULES_KEY, true)
          setScreen(firstVisit ? 'game' : 'menu')
          setFirstVisit(false)
        }}
      />
    )
  }
  if (screen === 'game') return <GameScreen settings={settings} onMenu={() => setScreen('menu')} />
  return (
    <MenuScreen
      settings={settings}
      onSettingsChange={changeSettings}
      onPlay={() => setScreen('game')}
      onHowTo={() => setScreen('howto')}
    />
  )
}
