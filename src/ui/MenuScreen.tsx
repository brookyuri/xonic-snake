interface Props {
  onPlay: () => void
  onHowTo: () => void
}

export function MenuScreen({ onPlay, onHowTo }: Props) {
  return (
    <div className="screen">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col px-4 pb-4 text-neutral-100">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <h1 className="text-center text-4xl font-bold tracking-widest">
            <span className="text-cyan-300">TERRITORY</span>
            <br />
            <span className="text-red-300">SNAKE</span>
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="min-h-16 rounded-xl bg-cyan-400 text-lg font-semibold text-neutral-950 active:bg-cyan-300"
          >
            PLAY VS COMPUTER
          </button>
          <button
            type="button"
            disabled
            className="min-h-16 rounded-xl bg-neutral-900 text-lg text-neutral-500"
          >
            PLAY WITH FRIEND
            <span className="block text-xs font-normal uppercase tracking-wider">Coming soon</span>
          </button>
          <button
            type="button"
            onClick={onHowTo}
            className="min-h-16 rounded-xl bg-neutral-800 text-lg text-neutral-100 active:bg-neutral-700"
          >
            HOW TO PLAY
          </button>
        </div>
      </div>
    </div>
  )
}
