/**
 * 人脸美颜系统 - 基于MediaPipe和OpenCV.js
 * 作者: AI Assistant
 * 功能: 人脸检测、关键点识别、智能美颜处理
 */

class FaceBeautyApp {
    constructor() {
        this.faceMesh = null;
        this.originalImage = null;
        this.originalCanvas = null;
        this.resultCanvas = null;
        this.faceLandmarks = [];
        this.isOpenCvReady = false;
        this.isMediaPipeReady = false;
        
        // 美颜参数
        this.beautyParams = {
            smoothness: 30,
            brightness: 10,
            warmth: 5,
            sharpness: 20,
            contrast: 5,
            saturation: 10
        };

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        this.showLoading(true);
        this.setupEventListeners();
        await this.initializeMediaPipe();
        this.checkReadyState();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 文件上传
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');

        uploadArea.addEventListener('click', () => imageInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        imageInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 美颜参数控制
        this.setupBeautyControls();

        // 功能按钮
        document.getElementById('resetBtn').addEventListener('click', this.resetParameters.bind(this));
        document.getElementById('downloadBtn').addEventListener('click', this.downloadResult.bind(this));
    }

    /**
     * 设置美颜参数控制
     */
    setupBeautyControls() {
        const controls = ['smoothness', 'brightness', 'warmth', 'sharpness', 'contrast', 'saturation'];
        
        controls.forEach(control => {
            const slider = document.getElementById(control);
            const valueDisplay = document.getElementById(control + 'Value');
            
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.beautyParams[control] = value;
                valueDisplay.textContent = value;
                this.applyBeautyEffects();
            });
        });
    }

    /**
     * 初始化MediaPipe
     */
    async initializeMediaPipe() {
        try {
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults(this.onFaceMeshResults.bind(this));
            this.isMediaPipeReady = true;
            console.log('MediaPipe初始化完成');
        } catch (error) {
            console.error('MediaPipe初始化失败:', error);
            this.showError('MediaPipe加载失败，请刷新页面重试');
        }
    }

    /**
     * MediaPipe结果处理
     */
    onFaceMeshResults(results) {
        this.faceLandmarks = results.multiFaceLandmarks || [];
        this.updateFaceInfo();
        
        if (this.originalImage) {
            this.applyBeautyEffects();
        }
    }

    /**
     * 检查组件就绪状态
     */
    checkReadyState() {
        if (this.isOpenCvReady && this.isMediaPipeReady) {
            this.showLoading(false);
            this.showSuccess('系统初始化完成，请上传图片开始美颜！');
        }
    }

    /**
     * 拖拽处理
     */
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    /**
     * 拖拽放置处理
     */
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processImageFile(files[0]);
        }
    }

    /**
     * 文件选择处理
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processImageFile(file);
        }
    }

    /**
     * 处理图片文件
     */
    async processImageFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('请选择有效的图片文件！');
            return;
        }

        try {
            this.showLoading(true, '正在处理图片...');
            
            const img = new Image();
            img.onload = async () => {
                this.originalImage = img;
                await this.displayOriginalImage();
                await this.detectFace();
                this.showLoading(false);
            };
            
            img.src = URL.createObjectURL(file);
        } catch (error) {
            console.error('图片处理失败:', error);
            this.showError('图片处理失败，请重试！');
            this.showLoading(false);
        }
    }

    /**
     * 显示原始图片
     */
    async displayOriginalImage() {
        const canvas = document.getElementById('originalCanvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // 设置合适的画布尺寸
        const maxWidth = 400;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / this.originalImage.width, maxHeight / this.originalImage.height);
        
        canvas.width = this.originalImage.width * scale;
        canvas.height = this.originalImage.height * scale;
        
        ctx.drawImage(this.originalImage, 0, 0, canvas.width, canvas.height);
        this.originalCanvas = canvas;
    }

    /**
     * 人脸检测
     */
    async detectFace() {
        if (!this.faceMesh || !this.originalCanvas) return;

        try {
            await this.faceMesh.send({ image: this.originalCanvas });
        } catch (error) {
            console.error('人脸检测失败:', error);
            this.showError('人脸检测失败，请确保图片中包含清晰的人脸');
        }
    }

    /**
     * 应用美颜效果
     */
    applyBeautyEffects() {
        if (!this.isOpenCvReady || !this.originalCanvas) {
            console.log('OpenCV未就绪或无原始图片');
            return;
        }

        let src = null;
        let dst = null;

        try {
            // 获取原始图像数据
            src = cv.imread(this.originalCanvas);
            
            // 验证图像是否有效
            if (src.empty() || src.rows === 0 || src.cols === 0) {
                console.error('无效的图像数据');
                this.showError('图像数据无效，请重新上传图片');
                return;
            }

            dst = src.clone();

            // 应用各种美颜效果
            dst = this.applySkinSmoothing(dst);
            dst = this.applyBrightening(dst);
            dst = this.applyWarmth(dst);
            dst = this.applySharpening(dst);
            dst = this.applyContrastAndSaturation(dst);

            // 显示结果
            const resultCanvas = document.getElementById('resultCanvas');
            const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
            resultCanvas.width = this.originalCanvas.width;
            resultCanvas.height = this.originalCanvas.height;
            cv.imshow('resultCanvas', dst);

            this.resultCanvas = resultCanvas;

        } catch (error) {
            console.error('美颜处理失败:', error);
            this.showError(`美颜处理失败: ${error.message || error}`);
        } finally {
            // 确保清理内存
            if (src && !src.isDeleted()) src.delete();
            if (dst && !dst.isDeleted()) dst.delete();
        }
    }

    /**
     * 磨皮效果
     */
    applySkinSmoothing(src) {
        if (this.beautyParams.smoothness === 0) return src;

        let dst = null;
        let result = null;

        try {
            dst = new cv.Mat();
            const kernelSize = Math.max(1, Math.floor(this.beautyParams.smoothness / 10)) * 2 + 1;
            
            // 双边滤波实现磨皮
            cv.bilateralFilter(src, dst, kernelSize, kernelSize * 2, kernelSize / 2);
            
            // 混合原图和磨皮结果
            const alpha = this.beautyParams.smoothness / 100;
            result = new cv.Mat();
            cv.addWeighted(src, 1 - alpha, dst, alpha, 0, result);
            
            return result;
        } catch (error) {
            console.error('磨皮处理失败:', error);
            return src.clone();
        } finally {
            if (dst && !dst.isDeleted()) dst.delete();
        }
    }

    /**
     * 美白效果
     */
    applyBrightening(src) {
        if (this.beautyParams.brightness === 0) return src;

        try {
            const dst = new cv.Mat();
            const brightness = this.beautyParams.brightness * 2;
            src.convertTo(dst, -1, 1, brightness);
            return dst;
        } catch (error) {
            console.error('美白处理失败:', error);
            return src.clone();
        }
    }

    /**
     * 红润效果
     */
    applyWarmth(src) {
        if (this.beautyParams.warmth === 0) return src;

        let dst = null;
        let channels = null;
        let redChannel = null;

        try {
            dst = new cv.Mat();
            src.copyTo(dst);
            
            // 增加红色通道
            channels = new cv.MatVector();
            cv.split(dst, channels);
            
            redChannel = channels.get(2); // BGR格式，红色是第2个通道
            const warmthFactor = 1 + (this.beautyParams.warmth / 100);
            redChannel.convertTo(redChannel, -1, warmthFactor, 0);
            
            channels.set(2, redChannel);
            cv.merge(channels, dst);
            
            return dst;
        } catch (error) {
            console.error('红润处理失败:', error);
            return src.clone();
        } finally {
            if (channels) channels.delete();
            if (redChannel && !redChannel.isDeleted()) redChannel.delete();
        }
    }

    /**
     * 锐化效果
     */
    applySharpening(src) {
        if (this.beautyParams.sharpness === 0) return src;

        let dst = null;
        let kernel = null;
        let result = null;

        try {
            dst = new cv.Mat();
            kernel = cv.matFromArray(3, 3, cv.CV_32FC1, [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ]);
            
            const sharpness = this.beautyParams.sharpness / 100;
            cv.filter2D(src, dst, cv.CV_8U, kernel);
            
            result = new cv.Mat();
            cv.addWeighted(src, 1 - sharpness, dst, sharpness, 0, result);
            
            return result;
        } catch (error) {
            console.error('锐化处理失败:', error);
            return src.clone();
        } finally {
            if (kernel && !kernel.isDeleted()) kernel.delete();
            if (dst && !dst.isDeleted()) dst.delete();
        }
    }

    /**
     * 对比度和饱和度调整
     */
    applyContrastAndSaturation(src) {
        let dst = null;
        let hsv = null;
        let channels = null;
        let satChannel = null;

        try {
            dst = new cv.Mat();
            
            // 对比度调整
            const contrast = 1 + (this.beautyParams.contrast / 100);
            src.convertTo(dst, -1, contrast, 0);
            
            // 饱和度调整
            if (this.beautyParams.saturation !== 0) {
                hsv = new cv.Mat();
                cv.cvtColor(dst, hsv, cv.COLOR_BGR2HSV);
                
                channels = new cv.MatVector();
                cv.split(hsv, channels);
                
                satChannel = channels.get(1);
                const satFactor = 1 + (this.beautyParams.saturation / 100);
                satChannel.convertTo(satChannel, -1, satFactor, 0);
                
                channels.set(1, satChannel);
                cv.merge(channels, hsv);
                cv.cvtColor(hsv, dst, cv.COLOR_HSV2BGR);
            }
            
            return dst;
        } catch (error) {
            console.error('对比度/饱和度处理失败:', error);
            return src.clone();
        } finally {
            if (hsv && !hsv.isDeleted()) hsv.delete();
            if (channels) channels.delete();
            if (satChannel && !satChannel.isDeleted()) satChannel.delete();
        }
    }

    /**
     * 重置参数
     */
    resetParameters() {
        this.beautyParams = {
            smoothness: 30,
            brightness: 10,
            warmth: 5,
            sharpness: 20,
            contrast: 5,
            saturation: 10
        };

        // 更新UI
        Object.keys(this.beautyParams).forEach(key => {
            const slider = document.getElementById(key);
            const valueDisplay = document.getElementById(key + 'Value');
            if (slider && valueDisplay) {
                slider.value = this.beautyParams[key];
                valueDisplay.textContent = this.beautyParams[key];
            }
        });

        // 重新应用效果
        this.applyBeautyEffects();
        this.showSuccess('参数已重置');
    }

    /**
     * 下载结果图片
     */
    downloadResult() {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas || resultCanvas.width === 0 || resultCanvas.height === 0) {
            this.showError('请先上传图片并进行美颜处理！');
            return;
        }

        try {
            const link = document.createElement('a');
            link.download = `beauty_result_${Date.now()}.png`;
            link.href = resultCanvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showSuccess('图片下载成功！');
        } catch (error) {
            console.error('下载失败:', error);
            this.showError('下载失败，请重试！');
        }
    }

    /**
     * 更新人脸信息显示
     */
    updateFaceInfo() {
        const faceInfo = document.getElementById('faceInfo');
        const faceCount = document.getElementById('faceCount');
        const landmarkInfo = document.getElementById('landmarkInfo');

        if (this.faceLandmarks.length > 0) {
            faceInfo.style.display = 'block';
            faceCount.textContent = `检测到 ${this.faceLandmarks.length} 张人脸`;
            landmarkInfo.innerHTML = `<p>检测到 ${this.faceLandmarks[0].length} 个关键点</p>`;
        } else {
            faceInfo.style.display = 'none';
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(show, message = '正在加载...') {
        const loading = document.getElementById('loading');
        if (show) {
            loading.style.display = 'flex';
            loading.querySelector('p').textContent = message;
        } else {
            loading.style.display = 'none';
        }
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * 显示消息
     */
    showMessage(message, type) {
        // 移除现有消息
        const existingMessage = document.querySelector('.success-message, .error-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.textContent = message;

        // 插入到主内容区域顶部
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(messageDiv, mainContent.firstChild);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

/**
 * OpenCV.js就绪回调
 */
function onOpenCvReady() {
    console.log('OpenCV.js加载完成');
    if (window.faceBeautyApp) {
        window.faceBeautyApp.isOpenCvReady = true;
        window.faceBeautyApp.checkReadyState();
    }
}

/**
 * 页面加载完成后启动应用
 */
document.addEventListener('DOMContentLoaded', () => {
    window.faceBeautyApp = new FaceBeautyApp();
});

// 确保OpenCV全局可用
window.onOpenCvReady = onOpenCvReady;
