export function SoundToggle({ soundOn, onToggle }: { soundOn: boolean; onToggle: () => void }) {
  return (
    <button
      className="sound-toggle"
      onClick={onToggle}
      aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
      title={soundOn ? 'Sound on' : 'Sound off'}
    >
      {soundOn ? '🔊' : '🔇'}
    </button>
  )
}
