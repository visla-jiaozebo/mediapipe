/**
 * WebGL美颜视频录制模块
 * 负责处理canvas内容的视频录制功能
 * 作者: AI Assistant
 */

import { BeautyParams } from './webgl-face-beauty';

// 录制相关类型定义
interface RecordingOptions {
    duration: number;        // 录制时长（毫秒）
    frameRate: number;       // 帧率
    videoBitsPerSecond: number; // 视频码率
    mimeType: string;        // 视频格式
}

interface RecordingCallbacks {
    onStart?: () => void;
    onStop?: () => void;
    onDataAvailable?: (chunk: Blob) => void;
    onError?: (error: Error) => void;
    onProgress?: (progress: number) => void;
}

interface ParameterAnimation {
    paramName: keyof BeautyParams;
    minValue: number;
    maxValue: number;
    currentValue: number;
    direction: number;
    speed: number;
}

class VideoRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private isRecording: boolean = false;
    private animationInterval: number | null = null;
    private progressInterval: number | null = null;
    private originalParams: BeautyParams | null = null;
    private animations: ParameterAnimation[] = [];
    
    // 默认录制选项
    private defaultOptions: RecordingOptions = {
        duration: 5000,           // 5秒
        frameRate: 30,            // 30fps
        videoBitsPerSecond: 5000000, // 5Mbps
        mimeType: 'video/webm;codecs=vp9'
    };

    constructor(
        private canvas: HTMLCanvasElement,
        private beautyParams: BeautyParams,
        private callbacks: RecordingCallbacks = {}
    ) {}

    /**
     * 开始录制视频
     */
    public async startRecording(options: Partial<RecordingOptions> = {}): Promise<void> {
        if (this.isRecording) {
            throw new Error('录制已在进行中');
        }

        const recordingOptions = { ...this.defaultOptions, ...options };

        try {
            // 检查浏览器支持
            if (!this.checkBrowserSupport()) {
                throw new Error('浏览器不支持视频录制功能');
            }

            // 直接使用原始canvas进行录制
            const stream = this.canvas.captureStream(recordingOptions.frameRate);
            if (!stream) {
                throw new Error('无法获取canvas流');
            }

            // 创建MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: recordingOptions.mimeType,
                videoBitsPerSecond: recordingOptions.videoBitsPerSecond
            });

            // 设置事件处理器
            this.setupMediaRecorderEvents();

            // 重置录制数据
            this.recordedChunks = [];
            this.isRecording = true;

            // 保存原始参数
            this.originalParams = { ...this.beautyParams };

            // 开始录制
            this.mediaRecorder.start();

            // 启动参数动画
            this.startParameterAnimation();

            // 启动进度跟踪
            this.startProgressTracking(recordingOptions.duration);

            // 设置自动停止
            setTimeout(() => {
                this.stopRecording();
            }, recordingOptions.duration);

            // 调用开始回调
            this.callbacks.onStart?.();

            console.log(`开始录制视频 [${this.canvas.width}x${this.canvas.height}]，时长: ${recordingOptions.duration}ms, 帧率: ${recordingOptions.frameRate}fps`);

        } catch (error) {
            this.isRecording = false;
            this.callbacks.onError?.(error as Error);
            throw error;
        }
    }

    /**
     * 停止录制
     */
    public stopRecording(): void {
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }

        try {
            // 停止MediaRecorder
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }

            // 停止参数动画
            this.stopParameterAnimation();

            // 停止进度跟踪
            this.stopProgressTracking();

            this.isRecording = false;

            console.log('录制停止');

        } catch (error) {
            console.error('停止录制失败:', error);
            this.callbacks.onError?.(error as Error);
        }
    }

    /**
     * 获取录制状态
     */
    public getRecordingState(): boolean {
        return this.isRecording;
    }

    /**
     * 设置参数动画序列
     */
    public setParameterAnimations(animations: Partial<ParameterAnimation>[]): void {
        this.animations = animations.map(anim => ({
            paramName: anim.paramName || 'skinSmoothing',
            minValue: anim.minValue || 0,
            maxValue: anim.maxValue || 1,
            currentValue: anim.currentValue || 0,
            direction: anim.direction || 1,
            speed: anim.speed || 0.02
        }));
    }

    /**
     * 检查浏览器支持
     */
    private checkBrowserSupport(): boolean {
        try {
            return !!(
                window.MediaRecorder &&
                typeof this.canvas.captureStream === 'function' &&
                typeof window.MediaRecorder.isTypeSupported === 'function' &&
                window.MediaRecorder.isTypeSupported(this.defaultOptions.mimeType)
            );
        } catch {
            return false;
        }
    }

    /**
     * 设置MediaRecorder事件处理器
     */
    private setupMediaRecorderEvents(): void {
        if (!this.mediaRecorder) return;

        this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                this.callbacks.onDataAvailable?.(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.handleRecordingComplete();
            this.callbacks.onStop?.();
        };

        this.mediaRecorder.onerror = (event: any) => {
            console.error('MediaRecorder错误:', event.error);
            this.callbacks.onError?.(new Error('录制过程中发生错误: ' + event.error));
        };
    }

    /**
     * 处理录制完成
     */
    private handleRecordingComplete(): void {
        if (this.recordedChunks.length === 0) {
            console.warn('录制数据为空');
            return;
        }

        // 创建视频blob
        const videoBlob = new Blob(this.recordedChunks, {
            type: this.defaultOptions.mimeType
        });

        // 触发下载
        this.downloadVideo(videoBlob);

        // 恢复原始参数
        this.restoreOriginalParameters();
    }

    /**
     * 开始参数动画
     */
    private startParameterAnimation(): void {
        // 如果没有设置自定义动画，使用默认动画
        if (this.animations.length === 0) {
            this.setupDefaultAnimations();
        }

        this.animationInterval = window.setInterval(() => {
            this.updateParameterAnimations();
        }, 100); // 每100ms更新一次
    }

    /**
     * 停止参数动画
     */
    private stopParameterAnimation(): void {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    /**
     * 设置默认动画序列
     */
    private setupDefaultAnimations(): void {
        this.animations = [
            {
                paramName: 'skinSmoothing',
                minValue: 0,
                maxValue: 0.8,
                currentValue: this.beautyParams.skinSmoothing,
                direction: 1,
                speed: 0.02
            },
            {
                paramName: 'faceSlim',
                minValue: 0,
                maxValue: 0.08,
                currentValue: this.beautyParams.faceSlim,
                direction: 1,
                speed: 0.001
            },
            {
                paramName: 'eyeEnlarge',
                minValue: 0,
                maxValue: 0.05,
                currentValue: this.beautyParams.eyeEnlarge,
                direction: 1,
                speed: 0.001
            },
            {
                paramName: 'brightness',
                minValue: -0.2,
                maxValue: 0.3,
                currentValue: this.beautyParams.brightness,
                direction: 1,
                speed: 0.01
            }
        ];
    }

    /**
     * 更新参数动画
     */
    private updateParameterAnimations(): void {
        let hasChanges = false;

        this.animations.forEach(animation => {
            // 更新当前值
            animation.currentValue += animation.direction * animation.speed;

            // 检查边界并反转方向
            if (animation.currentValue >= animation.maxValue) {
                animation.currentValue = animation.maxValue;
                animation.direction = -1;
            } else if (animation.currentValue <= animation.minValue) {
                animation.currentValue = animation.minValue;
                animation.direction = 1;
            }

            // 应用到美颜参数
            if (animation.paramName in this.beautyParams) {
                (this.beautyParams as any)[animation.paramName] = animation.currentValue;
                hasChanges = true;
            }
        });

        // 如果有参数变化，触发重新渲染（通过自定义事件）
        if (hasChanges) {
            const event = new CustomEvent('beautyParamsChanged', {
                detail: { beautyParams: this.beautyParams }
            });
            this.canvas.dispatchEvent(event);
            
            // 等待主画布更新后，触发重新绘制
            // 不需要额外的更新，因为我们直接使用原始canvas
        }
    }

    /**
     * 开始进度跟踪
     */
    private startProgressTracking(duration: number): void {
        let elapsed = 0;
        const interval = 100; // 100ms更新一次

        this.progressInterval = window.setInterval(() => {
            elapsed += interval;
            const progress = Math.min(elapsed / duration, 1);
            this.callbacks.onProgress?.(progress);

            if (progress >= 1) {
                this.stopProgressTracking();
            }
        }, interval);
    }

    /**
     * 停止进度跟踪
     */
    private stopProgressTracking(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * 恢复原始参数
     */
    private restoreOriginalParameters(): void {
        if (this.originalParams) {
            Object.assign(this.beautyParams, this.originalParams);
            
            // 触发参数恢复事件
            const event = new CustomEvent('beautyParamsRestored', {
                detail: { beautyParams: this.beautyParams }
            });
            this.canvas.dispatchEvent(event);
        }
    }

    /**
     * 下载视频文件
     */
    private downloadVideo(videoBlob: Blob): void {
        try {
            const url = URL.createObjectURL(videoBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `webgl_beauty_recording_${Date.now()}.webm`;
            
            // 添加到DOM并触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理URL
            URL.revokeObjectURL(url);
            
            console.log('视频下载完成:', link.download);
            
        } catch (error) {
            console.error('下载视频失败:', error);
            this.callbacks.onError?.(error as Error);
        }
    }

    /**
     * 获取支持的视频格式
     */
    public static getSupportedMimeTypes(): string[] {
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4;codecs=h264',
            'video/mp4'
        ];

        return types.filter(type => 
            MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)
        );
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        this.stopRecording();
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.originalParams = null;
        this.animations = [];
    }
}

export { VideoRecorder };
export type { RecordingOptions, RecordingCallbacks, ParameterAnimation };
