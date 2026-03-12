"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";

interface ImageCropperProps {
  /** 是否打开对话框 */
  open: boolean;
  /** 关闭对话框 */
  onClose: () => void;
  /** 要裁剪的图片 URL */
  imageSrc: string;
  /** 裁剪完成回调 */
  onCropComplete: (croppedBlob: Blob) => void;
  /** 裁剪形状 */
  cropShape?: "rect" | "round";
  /** 宽高比 */
  aspect?: number;
  /** 标题 */
  title?: string;
}

/**
 * 将裁剪区域转换为实际的图片 Blob
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number = 0,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // 计算旋转后的尺寸
  const rotRad = (rotation * Math.PI) / 180;
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation,
  );

  // 设置画布大小为裁剪区域大小
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // 移动到画布中心
  ctx.translate(-pixelCrop.x, -pixelCrop.y);

  // 如果有旋转，应用旋转
  if (rotation !== 0) {
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
  }

  // 绘制图片
  ctx.drawImage(image, 0, 0);

  // 转换为 Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas is empty"));
        }
      },
      "image/jpeg",
      0.9,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export function ImageCropper({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  cropShape = "round",
  aspect = 1,
  title = "裁剪图片",
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 裁剪区域变化
  const onCropAreaChange = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  // 确认裁剪
  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
      );
      onCropComplete(croppedBlob);
      onClose();
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, rotation, onCropComplete, onClose]);

  // 重置
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  // 旋转 90 度
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* 裁剪区域 */}
        <div className="relative h-80 w-full overflow-hidden rounded-lg bg-[#141414]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
          />
        </div>

        {/* 控制区域 */}
        <div className="space-y-4">
          {/* 缩放控制 */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-[#666666]" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-[#666666]" />
          </div>

          {/* 旋转按钮 */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="gap-2"
            >
              <RotateCw className="h-4 w-4" />
              旋转
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              重置
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              "确认裁剪"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
