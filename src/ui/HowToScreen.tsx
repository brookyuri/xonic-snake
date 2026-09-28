import { duelHeads, DUEL_LEGEND, Legend, SOLO_LEGEND, type HeadView } from './Board'
import { BoardView } from './BoardView'
import { staticSnapshot } from '../render/adapters'
import type { RenderSnapshot } from '../render/types'
import { diagram, soloDiagram } from './diagram'
import type { Cell, Pos } from '../engine/types'
import type { Mode } from './settings'

interface Step {
  text: string
  board: Cell[][]
  heads: HeadView[]
  balls?: Pos[]
}

/** Кадр схемы — один раз на шаг, а не на каждый рендер. */
const snapshots = new WeakMap<Step, RenderSnapshot>()
function stepSnapshot(step: Step, mode: Mode): RenderSnapshot {
  let snap = snapshots.get(step)
  if (!snap) snapshots.set(step, (snap = staticSnapshot(mode, step.board, step.heads, step.balls)))
  return snap
}

const duel = (rows: string[], directions: Parameters<typeof diagram>[1]) => {
  const state = diagram(rows, directions)
  return { board: state.board, heads: duelHeads(state) }
}

const DUEL_STEPS: Step[] = [
  {
    text: 'Leave home. Moving outside your territory draws a trail behind you.',
    ...duel(['.....', '..1..', '..b..', '.BBB.', '.BBB.'], { P1: 'UP', P2: 'DOWN' }),
  },
  {
    text: 'Come back home to close the loop — the trail and everything inside become yours.',
    ...duel(['.bbb.', '.b.b.', '.b.1.', '.BBB.', '.BBB.'], { P1: 'DOWN', P2: 'DOWN' }),
  },
  {
    text: "Step on RED's trail to win instantly.",
    ...duel(['.....', 'rrr2.', '.1...', '.b...', '.B...'], { P1: 'UP', P2: 'RIGHT' }),
  },
  {
    text: 'Never cross your own trail — you lose.',
    ...duel(['.....', '.bbb.', '.b1b.', '.b...', '.B...'], { P1: 'LEFT', P2: 'DOWN' }),
  },
  {
    text: 'Your snake moves by itself — just steer.',
    ...duel(['.....', '.bb1.', '.b...', '.B...', '.B...'], { P1: 'RIGHT', P2: 'DOWN' }),
  },
]

const SOLO_STEPS: Step[] = [
  {
    text: 'Leave the frame. Outside your land you draw a trail.',
    ...soloDiagram(['#####', '#...#', '#.1.#', '#.t.#', '#####'], 'UP', 'trail'),
  },
  {
    text: 'Get back to your land to close the loop — every area without a ball becomes yours.',
    ...soloDiagram(['#####', '#.o.#', '#tt1#', '#...#', '#####'], 'RIGHT', 'trail'),
  },
  {
    text: 'Balls bounce off your land. If one touches your trail, you lose a life.',
    ...soloDiagram(['#####', '#...#', '#.1.#', '#ot.#', '#####'], 'UP', 'trail'),
  },
  {
    text: 'Capture 75% of the field to reach the next level — with one more ball.',
    ...soloDiagram(['#####', '##o.#', '#####', '#####', '##1##'], 'RIGHT', 'land'),
  },
]

const FOOTER: Record<Mode, string> = {
  duel: 'You are BLUE. Most territory after 2 minutes wins.',
  solo: 'You have 3 lives and no time limit. Your snake moves by itself — just steer.',
}

export function HowToScreen({ mode, onDone, doneLabel }: { mode: Mode; onDone: () => void; doneLabel: string }) {
  const steps = mode === 'solo' ? SOLO_STEPS : DUEL_STEPS
  return (
    <div className="screen">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 pt-5 text-ts-text">
        <h1 className="text-center font-pixel text-base">
          HOW TO PLAY <span className={mode === 'solo' ? 'text-ts-ball' : 'text-ts-blue'}>{mode === 'solo' ? 'SOLO' : 'DUEL'}</span>
        </h1>
        <ol className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-4">
              <BoardView snapshot={stepSnapshot(step, mode)} className="board-mini w-[76px] shrink-0" />
              <p className="font-mono text-sm leading-snug text-ts-text2">
                <span className="mr-1 font-semibold text-ts-blue">{i + 1}.</span>
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex justify-center">
          <Legend items={mode === 'solo' ? SOLO_LEGEND : DUEL_LEGEND} />
        </div>
        <p className="mt-3 text-center font-mono text-sm leading-snug text-ts-text2">
          Swipe on the board, tap the arrows or use arrow keys / WASD.
          <br />
          {FOOTER[mode]}
        </p>
        <button type="button" onClick={onDone} className="mt-3 min-h-14 w-full btn text-sm text-ts-timer">
          {doneLabel}
        </button>
      </div>
    </div>
  )
}
