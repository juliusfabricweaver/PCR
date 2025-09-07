import React, { useRef, useEffect, useState } from 'react'
import { Canvas, FabricImage, PencilBrush, util } from 'fabric'
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
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const backgroundImageRef = useRef<FabricImage | null>(null)
  const [brushColor, setBrushColor] = useState('#DC2626')
  const [brushSize, setBrushSize] = useState(3)
  const [drawingMode, setDrawingMode] = useState<'pen' | 'eraser'>('pen')
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const colors = [
    { name: 'Red', value: '#DC2626', description: 'Injury/wound' },
    { name: 'Blue', value: '#2563EB', description: 'Bruising' },
    { name: 'Yellow', value: '#D97706', description: 'Swelling' },
    { name: 'Green', value: '#059669', description: 'Other' },
    { name: 'Black', value: '#1F2937', description: 'General marking' },
  ]

  useEffect(() => {
    const canvasElement = document.getElementById('injury-canvas') as HTMLCanvasElement
    if (!canvasElement || fabricCanvasRef.current) return

    const canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: '#f9fafb',
      isDrawingMode: true,
      preserveObjectStacking: true,
    })

    const brush = new PencilBrush(canvas)
    brush.color = brushColor
    brush.width = brushSize
    canvas.freeDrawingBrush = brush

    const saveCanvasData = () => {
      if (!fabricCanvasRef.current) return
      
      // Only save drawing objects, exclude background image
      const allObjects = fabricCanvasRef.current.getObjects()
      const drawingObjects = allObjects.filter(obj => obj !== backgroundImageRef.current)
      
      const canvasData = {
        version: '5.3.0',
        objects: drawingObjects.map(obj => obj.toObject(['selectable', 'evented']))
      }
      
      // Get the canvas as a data URL for PDF generation
      const imageDataUrl = fabricCanvasRef.current.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2 // Higher resolution for PDF
      })
      
      // Store both JSON data (for editing) and image data (for PDF)
      const combinedData = {
        fabricData: canvasData,
        imageData: imageDataUrl
      }
      
      const dataString = JSON.stringify(combinedData)
      setIsInitialLoad(false) // Mark that we've saved once
      onChange(dataString)
    }

    canvas.on('path:created', saveCanvasData)
    canvas.on('object:modified', saveCanvasData)  
    canvas.on('object:removed', saveCanvasData)

    fabricCanvasRef.current = canvas

    // Load body image first, then load canvas data
    FabricImage.fromURL('/images/front_image.jpg').then((img) => {
      if (img && fabricCanvasRef.current) {
        const scale = Math.min(width / img.width, height / img.height)
        img.set({
          selectable: false,
          evented: false,
          scaleX: scale,
          scaleY: scale,
          left: (width - img.width * scale) / 2,
          top: (height - img.height * scale) / 2,
        })
        
        // Add image to canvas as background layer
        backgroundImageRef.current = img
        fabricCanvasRef.current.add(img)
        fabricCanvasRef.current.sendObjectToBack(img)
        setIsImageLoaded(true)
        
        // Data will be loaded by the useEffect when value changes
        fabricCanvasRef.current.renderAll()
        
      } else {
      }
    }).catch((error) => {
      // Set fallback background if image fails
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.set('backgroundColor', '#f0f0f0')
        
        // Load existing canvas data even if image fails
        if (value) {
          try {
            const parsedValue = JSON.parse(value)
            const fabricData = parsedValue.fabricData || parsedValue // Backward compatibility
            fabricCanvasRef.current.loadFromJSON(fabricData, () => {
              fabricCanvasRef.current?.renderAll()
            })
          } catch (error) {
            fabricCanvasRef.current?.renderAll()
          }
        } else {
          fabricCanvasRef.current.renderAll()
        }
      }
    })

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [])

  // Load canvas data when value changes - but only on initial load, not after user interaction
  useEffect(() => {
    
    // Only load if this is the initial load AND background image is loaded
    if (isInitialLoad && isImageLoaded && fabricCanvasRef.current && backgroundImageRef.current && value && value.trim()) {
      try {
        const parsedValue = JSON.parse(value)
        const fabricData = parsedValue.fabricData || parsedValue // Backward compatibility
        
        // Load only drawing objects - use the standard Fabric.js way
        if (fabricData.objects && fabricData.objects.length > 0) {
          
          // Save background image temporarily
          const tempBgImage = backgroundImageRef.current
          
          // Use loadFromJSON (it will clear canvas but that's fine, we'll re-add bg)
          fabricCanvasRef.current.loadFromJSON(fabricData, () => {
            
            // Re-add background image
            if (tempBgImage && fabricCanvasRef.current) {
              fabricCanvasRef.current.add(tempBgImage)
              fabricCanvasRef.current.sendObjectToBack(tempBgImage)
              backgroundImageRef.current = tempBgImage
            }
            
            fabricCanvasRef.current?.renderAll()
          })
        }
      } catch (error) {
      }
    }
  }, [value, isInitialLoad, isImageLoaded])


  useEffect(() => {
    if (fabricCanvasRef.current?.freeDrawingBrush) {
      fabricCanvasRef.current.freeDrawingBrush.color = brushColor
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize
      fabricCanvasRef.current.isDrawingMode = drawingMode === 'pen'
      fabricCanvasRef.current.renderAll()
    }
  }, [brushColor, brushSize, drawingMode])

  // Remove the interval - it's causing issues

  const handleColorChange = (color: string) => {
    setBrushColor(color)
    setDrawingMode('pen')
  }

  const handleClearCanvas = () => {
    fabricCanvasRef.current?.clear()
    onChange('')
  }

  const handleDownload = () => {
    if (!fabricCanvasRef.current) return
    const link = document.createElement('a')
    link.download = 'injury-diagram.png'
    link.href = fabricCanvasRef.current.toDataURL()
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
                  onClick={() => handleColorChange(color.value)}
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
            onClick={() => setDrawingMode(drawingMode === 'pen' ? 'eraser' : 'pen')}
            leftIcon={<Eraser className="w-4 h-4" />}
          >
            {drawingMode === 'pen' ? 'Eraser' : 'Pen'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearCanvas}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Clear
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <canvas
          id="injury-canvas"
          width={width}
          height={height}
          className="block"
        />
      </div>
    </div>
  )
}

export default InjuryCanvas