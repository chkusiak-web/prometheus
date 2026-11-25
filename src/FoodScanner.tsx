import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { isBarcode } from './foods'

type CameraFocus = MediaTrackConstraintSet & {
  focusMode?: 'continuous' | 'single-shot'
  pointsOfInterest?: { x: number; y: number }[]
}

export default function FoodScanner({ onCode, onBack }: { onCode: (code: string) => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const track = useRef<MediaStreamTrack | undefined>(undefined)
  const [phase, setPhase] = useState<'starting' | 'scanning' | 'locked' | 'unavailable'>('starting')
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; id: number }>()
  const [message, setMessage] = useState('Starting camera…')

  useEffect(() => {
    let cancelled = false
    let locked = false
    let lockTimer: number | undefined
    let stream: MediaStream | undefined
    let controls: { stop(): void } | undefined

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPhase('unavailable')
          setMessage('Camera is unavailable. Enter the barcode in food search.')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        const camera = stream.getVideoTracks()[0]
        track.current = camera
        const modes = (camera?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined)?.focusMode
        if (modes?.includes('continuous')) {
          const focus: CameraFocus = { focusMode: 'continuous' }
          await camera.applyConstraints({ advanced: [focus] }).catch(() => {})
        }
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'), import('@zxing/library'),
        ])
        if (cancelled || !video.current) return
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
        ]]])
        const reader = new BrowserMultiFormatReader(hints)
        controls = await reader.decodeFromStream(stream, video.current, (result, _, scanner) => {
          const code = result?.getText()
          if (cancelled || locked || !code || !isBarcode(code)) return
          locked = true
          scanner.stop()
          setPhase('locked')
          setMessage('Barcode found')
          lockTimer = window.setTimeout(() => onCode(code), 180)
        })
        if (cancelled) controls.stop()
        else if (!locked) {
          setPhase('scanning')
          setMessage('Align the barcode in the camera view.')
        }
      } catch {
        stream?.getTracks().forEach(track => track.stop())
        if (!cancelled) {
          setPhase('unavailable')
          setMessage('Could not open the camera. Enter the barcode in food search.')
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      window.clearTimeout(lockTimer)
      track.current = undefined
      controls?.stop()
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [onCode])

  async function focus(event: MouseEvent<HTMLButtonElement>) {
    const camera = track.current
    const preview = video.current
    if (!camera || !preview || phase !== 'scanning') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.detail === 0 ? 0.5 : (event.clientX - bounds.left) / bounds.width
    const y = event.detail === 0 ? 0.5 : (event.clientY - bounds.top) / bounds.height
    const modes = (camera.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined)?.focusMode
    const focus: CameraFocus = {}
    if ((navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & { pointsOfInterest?: boolean }).pointsOfInterest) {
      // Translate from the cropped object-fit: cover preview to normalized video coordinates.
      const scale = Math.max(bounds.width / preview.videoWidth, bounds.height / preview.videoHeight)
      const width = preview.videoWidth * scale
      const height = preview.videoHeight * scale
      if (width > 0 && height > 0) focus.pointsOfInterest = [{
        x: (x * bounds.width + (width - bounds.width) / 2) / width,
        y: (y * bounds.height + (height - bounds.height) / 2) / height,
      }]
    }
    if (focus.pointsOfInterest && modes?.includes('continuous')) focus.focusMode = 'continuous'
    else if (modes?.includes('single-shot')) focus.focusMode = 'single-shot'
    if (!focus.pointsOfInterest && !focus.focusMode) {
      setMessage('Move the package back slightly and hold it steady.')
      return
    }
    try {
      await camera.applyConstraints({ advanced: [focus] })
      if (camera.readyState === 'live') setFocusPoint(point => ({ x, y, id: (point?.id ?? 0) + 1 }))
    } catch {
      if (camera.readyState === 'live') setMessage('Move the package back slightly and hold it steady.')
    }
  }

  return (
    <>
      <div className="row between"><h2 className="cond">Scan barcode</h2><button className="link" onClick={onBack}>Back</button></div>
      <div className="food-camera-frame" data-phase={phase}>
        <video ref={video} className="food-camera" playsInline muted />
        <div className="food-scan-guide" aria-hidden="true"><i /></div>
        {focusPoint && phase === 'scanning' && <i key={focusPoint.id} className="food-focus-ring" aria-hidden="true"
          style={{ left: `${focusPoint.x * 100}%`, top: `${focusPoint.y * 100}%` }} />}
        <button className="food-focus-button" type="button" aria-label="Focus camera" onClick={focus} disabled={phase !== 'scanning'} />
      </div>
      <p className="small" role="status">{message}</p>
    </>
  )
}
