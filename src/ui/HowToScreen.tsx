import { Board } from './Board'
import { diagram } from './diagram'

const STEPS = [
  {
    text: 'Leave home. Moving outside your territory draws a trail behind you.',
    state: diagram(['.....', '..1..', '..b..', '.BBB.', '.BBB.'], { P1: 'UP', P2: 'DOWN' }),
  },
  {
    text: 'Come back home to close the loop — the trail and everything inside become yours.',
    state: diagram(['.bbb.', '.b.b.', '.b.1.', '.BBB.', '.BBB.'], { P1: 'DOWN', P2: 'DOWN' }),
  },
  {
    text: "Step on RED's trail to win instantly.",
    state: diagram(['.....', 'rrr2.', '.1...', '.b...', '.B...'], { P1: 'UP', P2: 'RIGHT' }),
  },
  {
    text: 'Never cross your own trail — you lose.',
    state: diagram(['.....', '.bbb.', '.b1b.', '.b...', '.B...'], { P1: 'LEFT', P2: 'DOWN' }),
  },
  {
    text: 'Both snakes move at the same time: each tap plays one round for both.',
    state: diagram(['..2..', '.....', '.....', '..1..', '.BBB.'], { P1: 'UP', P2: 'DOWN' }),
  },
]

export function HowToScreen({ onDone, doneLabel }: { onDone: () => void; doneLabel: string }) {
  return (
    <div className="screen">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 pt-5 text-neutral-100">
        <h1 className="text-center text-2xl font-bold tracking-widest">HOW TO PLAY</h1>
        <ol className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-center gap-4">
              <Board state={step.state} className="w-[76px] shrink-0" />
              <p className="text-[15px] leading-snug text-neutral-200">
                <span className="mr-1 font-semibold text-cyan-300">{i + 1}.</span>
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-center text-sm text-neutral-500">
          You are BLUE. Most territory after 100 rounds wins.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-3 min-h-14 w-full rounded-lg bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  )
}
