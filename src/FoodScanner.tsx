import { useEffect, useRef, useState } from 'react'
import { isBarcode } from './foods'

export default function FoodScanner({ onCode, onBack }: { onCode: (code: string) => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [message, setMessage] = useState('Starting camera…')

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | undefined
    let controls: { stop(): void } | undefined

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMessage('Camera is unavailable. Enter the barcode in food search.')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
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
          if (!cancelled && code && isBarcode(code)) {
            scanner.stop()
            onCode(code)
          }
        })
        if (cancelled) controls.stop()
        else setMessage('Align the barcode in the camera view.')
      } catch {
        stream?.getTracks().forEach(track => track.stop())
        if (!cancelled) setMessage('Could not open the camera. Enter the barcode in food search.')
      }
    }

    void start()
    return () => {
      cancelled = true
      controls?.stop()
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [onCode])

  return (
    <>
      <div className="row between"><h2 className="cond">Scan barcode</h2><button className="link" onClick={onBack}>Back</button></div>
      <video ref={video} className="food-camera" playsInline muted />
      <p className="small" role="status">{message}</p>
    </>
  )
}
