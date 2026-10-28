import Icon from './Icon'
import { useEffect, useRef, useState } from 'react'
import { asset } from './research'

const chapters = ['Molecule input', 'Three representation encoders', 'Parallel gating and cross-modal fusion', 'Concatenation and prediction MLP', 'Saved solubility prediction']
const times = [0, 6, 18, 29, 36]
const portraitQuery = '(max-width: 640px) and (max-aspect-ratio: 1/1)'

export default function ArchitectureFilm({ paused, setPaused }: { paused: boolean; setPaused: (value: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const resumeTime = useRef(0)
  const resumeAfterScrub = useRef(false)
  const [portrait, setPortrait] = useState(() => matchMedia(portraitQuery).matches)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(44)
  const [failed, setFailed] = useState(false)
  const mode = portrait ? 'portrait' : 'landscape'
  const chapter = times.reduce((active, start, i) => time >= start ? i : active, 0)

  useEffect(() => {
    const media = matchMedia(portraitQuery)
    const update = () => {
      const element = video.current
      if (element && element.readyState >= 1 && !element.seeking) resumeTime.current = element.currentTime
      setPortrait(media.matches)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const element = video.current
    if (!element || failed) return
    let visible = false, active = true
    const sync = () => {
      if (paused || !visible || document.hidden) element.pause()
      else if (element.readyState < 2) return
      else void element.play().catch(error => { if (active && error.name !== 'AbortError') setPaused(true) })
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= .15; sync() }, { threshold: [0, .15] })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    element.addEventListener('canplay', sync)
    return () => { active = false; observer.disconnect(); document.removeEventListener('visibilitychange', sync); element.removeEventListener('canplay', sync); element.pause() }
  }, [paused, portrait, failed, setPaused])

  function seek(value: number) {
    const element = video.current
    if (!Number.isFinite(value)) return
    const next = Math.max(0, Math.min(value, duration - .05))
    resumeTime.current = next
    setTime(next)
    if (element && element.readyState >= 1) element.currentTime = next
  }

  function finishScrub() {
    if (resumeAfterScrub.current) setPaused(false)
    resumeAfterScrub.current = false
  }

  return <section id="overview" className="architecture-film" aria-label="TriBioNode architecture film">
    <h1 className="sr-only">TriBioNode: from molecule to solubility prediction</h1>
    <video key={mode} ref={video} className="architecture-video" src={asset(`animation/architecture-refined-${mode}.mp4`)} poster={asset(`animation/architecture-refined-${mode}-poster.png`)} muted playsInline preload="metadata" aria-label="44-second 3D film: molecule input, three encoders, parallel fusion, prediction MLP, and a saved ESOL solubility prediction" aria-describedby="architecture-film-description" onLoadedMetadata={event => {
      const element = event.currentTarget
      setDuration(element.duration)
      element.currentTime = Math.min(resumeTime.current, element.duration - .05)
    }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onEnded={() => { resumeTime.current = duration; setPaused(true) }} onError={() => setFailed(true)} />
    <p className="sr-only" id="architecture-film-description">A molecule enters character-token, atom-and-BRICS-motif graph, and 3D distance-feature encoders. The three embeddings feed dynamic gating and a cross-modal Transformer in parallel. Their outputs are concatenated and passed through the prediction MLP. The saved ESOL example predicts −4.459 log₁₀(mol/L), compared with an observed −4.380.</p>
    <p className="sr-only" role="status">{chapters[chapter]}. Animation illustrates the implemented architecture; the result is a saved ESOL example.</p>
    {failed ? <div className="film-error" role="alert">The architecture film could not load.<button className="button secondary" onClick={() => { setFailed(false); video.current?.load() }}>Retry video</button></div> : <div className="film-controls" aria-label="Architecture film playback">
      <button type="button" aria-label={paused ? 'Play animation' : 'Pause animation'} aria-pressed={paused} onClick={() => setPaused(!paused)}><Icon name={paused ? "play" : "pause"} /></button>
      <button type="button" aria-label="Replay architecture film" onClick={() => { seek(0); setPaused(false) }}><Icon name="replay" /></button>
      <input type="range" aria-label="Architecture film progress" aria-valuetext={`${Math.floor(time)} seconds of ${Math.round(duration)}. ${chapters[chapter]}`} min="0" max={duration} step=".1" value={time} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); resumeAfterScrub.current = !paused; setPaused(true) }} onPointerUp={finishScrub} onPointerCancel={finishScrub} onBlur={finishScrub} onChange={event => seek(Number(event.target.value))} />
      <output aria-label="Playback time">{String(Math.floor(time)).padStart(2, '0')} / {Math.round(duration)}s</output>
    </div>}
  </section>
}
