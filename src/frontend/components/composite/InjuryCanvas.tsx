import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Palette, Eraser, RotateCcw, Download, Upload, Trash2 } from 'lucide-react'
import { Button, Tooltip } from '@/components/ui'
import { cn } from '@/utils'

interface InjuryCanvasProps {
  value?: string
  onChange: (canvasData: string) => void
  width?: number
  height?: number
  className?: string
}

const InjuryCanvas: React.FC<InjuryCanvasProps> = ({
  value,
  onChange,
  width = 600,
  height = 400,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const [brushColor, setBrushColor] = useState('#DC2626')
  const [brushSize, setBrushSize] = useState(3)
  const [drawingMode, setDrawingMode] = useState<'pen' | 'eraser'>('pen')
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  // Use refs for all drawing state to avoid stale closures
  const isDrawingRef = useRef(false)
  const strokesRef = useRef<Array<{
    color: string
    size: number
    points: Array<{ x: number; y: number }>
  }>>([])
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([])
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const drawStyleRef = useRef({ color: '#DC2626', size: 3 })

  // Track last value we sent to parent to prevent feedback loop
  const lastSentValueRef = useRef<string>('')

  // Counter to trigger re-renders when strokes change (after drawing completes)
  const [strokeVersion, setStrokeVersion] = useState(0)

  const colors = [
    { name: 'Red', value: '#DC2626', description: 'Injury/wound' },
    { name: 'Blue', value: '#2563EB', description: 'Bruising' },
    { name: 'Yellow', value: '#D97706', description: 'Swelling' },
    { name: 'Green', value: '#059669', description: 'Other' },
    { name: 'Black', value: '#1F2937', description: 'General marking' },
  ]

  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current || !contextRef.current) return

    const ctx = contextRef.current
    const currentStrokes = strokesRef.current

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Fill background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Draw background image if loaded
    if (backgroundImageRef.current) {
      const img = backgroundImageRef.current
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight)
      const x = (width - img.naturalWidth * scale) / 2
      const y = (height - img.naturalHeight * scale) / 2
      ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale)
    }

    // Draw all strokes
    currentStrokes.forEach(stroke => {
      if (stroke.points.length === 0) return

      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (stroke.points.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2)
        ctx.fillStyle = stroke.color
        ctx.fill()
        return
      }

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }

      ctx.stroke()
    })
  }, [width, height])

  const saveCanvasData = useCallback(() => {
    if (!canvasRef.current) return

    const imageDataUrl = canvasRef.current.toDataURL('image/png', 1.0)

    const canvasData = {
      strokes: strokesRef.current,
      imageData: imageDataUrl,
    }

    const serialized = JSON.stringify(canvasData)
    lastSentValueRef.current = serialized
    onChange(serialized)
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    contextRef.current = ctx

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Load background image
    const img = new Image()
    img.onload = () => {
      backgroundImageRef.current = img
      setIsImageLoaded(true)
      redrawCanvas()
    }
    img.onerror = () => {
      console.error('Failed to load background image')
      setIsImageLoaded(true)
      redrawCanvas()
    }
    // Use relative path for Electron compatibility
    img.src = './images/front_image.jpg'
  }, [width, height])

  // Load canvas data from parent — but skip echoes of our own onChange
  useEffect(() => {
    if (!isImageLoaded || !value || !value.trim()) return
    // Skip if this is just the parent echoing back what we sent
    if (value === lastSentValueRef.current) return
    // Don't overwrite strokes while user is actively drawing
    if (isDrawingRef.current) return

    try {
      const parsedValue = JSON.parse(value)

      if (parsedValue.strokes && Array.isArray(parsedValue.strokes)) {
        strokesRef.current = parsedValue.strokes
        setStrokeVersion(v => v + 1)
      } else if (parsedValue.fabricData && parsedValue.fabricData.objects) {
        // Convert old Fabric.js format to new format (basic conversion)
        strokesRef.current = []
        setStrokeVersion(v => v + 1)
      }
    } catch (error) {
      console.error('Failed to load canvas data:', error)
      strokesRef.current = []
      setStrokeVersion(v => v + 1)
    }
  }, [value, isImageLoaded])

  // Redraw when stroke data changes (not during active drawing)
  useEffect(() => {
    if (!isDrawingRef.current) {
      redrawCanvas()
    }
  }, [strokeVersion, redrawCanvas])

  // Save canvas data when strokes change
  useEffect(() => {
    if (strokesRef.current.length > 0 && !isDrawingRef.current) {
      saveCanvasData()
    }
  }, [strokeVersion, saveCanvasData])

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!contextRef.current) return

      const pos = getMousePos(e)
      lastPointRef.current = pos
      currentStrokeRef.current = [pos]
      isDrawingRef.current = true

      // Compute and store drawing style
      const currentColor = drawingMode === 'eraser' ? '#f9fafb' : brushColor
      const currentSize = drawingMode === 'eraser' ? brushSize * 2 : brushSize
      drawStyleRef.current = { color: currentColor, size: currentSize }

      // Set up drawing context
      const ctx = contextRef.current
      ctx.strokeStyle = currentColor
      ctx.lineWidth = currentSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    },
    [getMousePos, brushColor, brushSize, drawingMode],
  )

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !lastPointRef.current || !contextRef.current) return

      const pos = getMousePos(e)
      const ctx = contextRef.current
      const style = drawStyleRef.current

      // Re-apply style in case canvas state was corrupted by a redraw
      ctx.strokeStyle = style.color
      ctx.lineWidth = style.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Draw line segment from last point to current position
      ctx.beginPath()
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()

      // Add point to current stroke
      currentStrokeRef.current.push(pos)
      lastPointRef.current = pos
    },
    [getMousePos],
  )

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return

    if (currentStrokeRef.current.length > 0) {
      const style = drawStyleRef.current

      // Save the completed stroke
      strokesRef.current = [
        ...strokesRef.current,
        {
          color: style.color,
          size: style.size,
          points: [...currentStrokeRef.current],
        },
      ]
    }

    isDrawingRef.current = false
    lastPointRef.current = null
    currentStrokeRef.current = []

    // Trigger re-render → redraw + save
    setStrokeVersion(v => v + 1)
  }, [])

  const handleColorChange = (color: string) => {
    setBrushColor(color)
    setDrawingMode('pen')
  }

  const handleClearCanvas = () => {
    strokesRef.current = []
    lastSentValueRef.current = ''
    setStrokeVersion(v => v + 1)
    onChange('')
  }

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = 'injury-diagram.png'
    link.href = canvasRef.current.toDataURL()
    link.click()
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-4">
          {/* Colors */}
          <div className="flex space-x-2">
            {colors.map(color => (
              <Tooltip key={color.value} content={`${color.name} - ${color.description}`}>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault()
                    handleColorChange(color.value)
                  }}
                  aria-label={`Select ${color.name} (${color.description})`}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    brushColor === color.value
                      ? 'border-gray-900 dark:border-gray-100 scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105',
                  )}
                  style={{ backgroundColor: color.value }}
                />
              </Tooltip>
            ))}
          </div>

          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium dark:text-white">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="w-16"
            />
            <span className="text-sm w-6 dark:text-white">{brushSize}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearCanvas}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex justify-center items-center">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  )
}

export default InjuryCanvas
