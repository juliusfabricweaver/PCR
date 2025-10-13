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
  const [isDrawing, setIsDrawing] = useState(false)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [strokes, setStrokes] = useState<Array<{
    color: string
    size: number
    points: Array<{ x: number, y: number }>
  }>>([])
  const currentStrokeRef = useRef<Array<{ x: number, y: number }>>([])
  const lastPointRef = useRef<{ x: number, y: number } | null>(null)

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
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return

      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }

      ctx.stroke()
    })
  }, [strokes, width, height])

  const saveCanvasData = useCallback(() => {
    if (!canvasRef.current) return

    const imageDataUrl = canvasRef.current.toDataURL('image/png', 1.0)

    const canvasData = {
      strokes,
      imageData: imageDataUrl
    }

    onChange(JSON.stringify(canvasData))
  }, [strokes, onChange])

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

  // Load canvas data when value changes
  useEffect(() => {
    if (isImageLoaded && value && value.trim()) {
      try {
        const parsedValue = JSON.parse(value)

        // Handle both new format and backward compatibility
        if (parsedValue.strokes && Array.isArray(parsedValue.strokes)) {
          setStrokes(parsedValue.strokes)
        } else if (parsedValue.fabricData && parsedValue.fabricData.objects) {
          // Convert old Fabric.js format to new format (basic conversion)
          setStrokes([])
        }
      } catch (error) {
        console.error('Failed to load canvas data:', error)
        setStrokes([])
      }
    }
  }, [value, isImageLoaded])

  // Only redraw when loading new data, not during active drawing
  useEffect(() => {
    if (!isDrawing) {
      redrawCanvas()
    }
  }, [strokes, isDrawing])

  // Save canvas data when strokes change (but not during active drawing)
  useEffect(() => {
    if (strokes.length > 0 && !isDrawing) {
      saveCanvasData()
    }
  }, [strokes, isDrawing])

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return

    const pos = getMousePos(e)
    lastPointRef.current = pos
    currentStrokeRef.current = [pos]
    setIsDrawing(true)

    // Set up drawing context
    const ctx = contextRef.current
    const currentColor = drawingMode === 'eraser' ? '#f9fafb' : brushColor
    const currentSize = drawingMode === 'eraser' ? brushSize * 2 : brushSize

    ctx.strokeStyle = currentColor
    ctx.lineWidth = currentSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getMousePos, brushColor, brushSize, drawingMode])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current || !contextRef.current) return

    const pos = getMousePos(e)
    const ctx = contextRef.current

    // Draw line to current position
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    // Add point to current stroke
    currentStrokeRef.current.push(pos)
    lastPointRef.current = pos
  }, [isDrawing, getMousePos])

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentStrokeRef.current.length > 1) {
      const currentColor = drawingMode === 'eraser' ? '#f9fafb' : brushColor
      const currentSize = drawingMode === 'eraser' ? brushSize * 2 : brushSize

      // Save the completed stroke
      setStrokes(prev => [...prev, {
        color: currentColor,
        size: currentSize,
        points: [...currentStrokeRef.current]
      }])
    }

    setIsDrawing(false)
    lastPointRef.current = null
    currentStrokeRef.current = []
  }, [isDrawing, brushColor, brushSize, drawingMode])

  const handleColorChange = (color: string) => {
    setBrushColor(color)
    setDrawingMode('pen')
  }

  const handleClearCanvas = () => {
    setStrokes([])
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
            {colors.map((color) => (
              <Tooltip key={color.value} content={`${color.name} - ${color.description}`}>
                <button
                  type="button"                                   // <-- add this
                  onClick={(e) => { e.preventDefault(); handleColorChange(color.value); }} // optional safety
                  aria-label={`Select ${color.name} (${color.description})`}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    brushColor === color.value
                      ? 'border-gray-900 dark:border-gray-100 scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  )}
                  style={{ backgroundColor: color.value }}
                />

              </Tooltip>
            ))}
          </div>

          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16"
            />
            <span className="text-sm w-6">{brushSize}</span>
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