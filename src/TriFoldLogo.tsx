import Icon from './Icon'
import { useEffect, useRef, useState } from 'react'
import { asset } from './research'

export default function TriFoldLogo({ paused, setPaused }: { paused: boolean; setPaused: (value: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { if (preference.matches) setPaused(true) }
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [setPaused])

  useEffect(() => {
    const element = video.current
    if (!element || failed) return
    let visible = false
    const sync = () => {
      if (paused || document.hidden || !visible) element.pause()
      else void element.play().catch(() => setPaused(true))
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); element.pause() }
  }, [paused, failed])

  return <div className="trifold-animation">
    <div className="trifold-media" role="img" aria-label="TriFold: three complementary folds around one shared core">
      <img src={asset('brand/trifold-3d.webp')} width="485" height="480" alt="" fetchPriority="high" />
      {!failed && <video ref={video} muted loop playsInline preload="none" poster={asset('brand/trifold-3d.webp')} aria-hidden="true" onError={event => { if (event.target === event.currentTarget) setFailed(true) }}>
        <source src={asset('brand/trifold-3d.webm')} type="video/webm" />
        <source src={asset('brand/trifold-3d.mp4')} type="video/mp4" onError={() => setFailed(true)} />
      </video>}
    </div>
    <button className="trifold-motion" type="button" aria-pressed={paused} aria-label={paused ? 'Play logo animation' : 'Pause logo animation'} onClick={() => setPaused(!paused)}><Icon name={paused ? "play" : "pause"} />{paused ? 'Play animation' : 'Pause animation'}</button>
  </div>
}
