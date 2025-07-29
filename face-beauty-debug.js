/**
 * 人脸美颜系统调试版本 - 增强错误处理和内存管理
 */

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('全局错误:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的Promise拒绝:', e.reason);
});

// OpenCV.js模块加载检查
function checkOpenCVModule() {
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            if (typeof cv !== 'undefined' && cv.Mat) {
                clearInterval(checkInterval);
                console.log('OpenCV模块验证成功');
                resolve(true);
            }
        }, 100);
        
        // 30秒超时
        setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('OpenCV模块加载超时'));
        }, 30000);
    });
}

class FaceBeautyApp {
    constructor() {
        this.faceMesh = null;
        this.originalImage = null;
        this.originalCanvas = null;
        this.resultCanvas = null;
        this.faceLandmarks = [];
        this.isOpenCvReady = false;
        this.isMediaPipeReady = false;
        this.isProcessing = false;
        
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
        this.showLoading(true, '正在初始化系统...');
        this.setupEventListeners();
        
        try {
            await this.waitForOpenCV();
            await this.initializeMediaPipe();
            this.checkReadyState();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('系统初始化失败，请刷新页面重试');
            this.showLoading(false);
        }
    }

    /**
     * 等待OpenCV加载完成
     */
    async waitForOpenCV() {
        try {
            await checkOpenCVModule();
            this.isOpenCvReady = true;
            console.log('OpenCV已准备就绪');
        } catch (error) {
            throw new Error('OpenCV加载失败: ' + error.message);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 文件上传
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');

        if (uploadArea && imageInput) {
            uploadArea.addEventListener('click', () => imageInput.click());
            uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            uploadArea.addEventListener('drop', this.handleDrop.bind(this));
            imageInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // 美颜参数控制
        this.setupBeautyControls();

        // 功能按钮
        const resetBtn = document.getElementById('resetBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (resetBtn) resetBtn.addEventListener('click', this.resetParameters.bind(this));
        if (downloadBtn) downloadBtn.addEventListener('click', this.downloadResult.bind(this));
    }

    /**
     * 设置美颜参数控制
     */
    setupBeautyControls() {
        const controls = ['smoothness', 'brightness', 'warmth', 'sharpness', 'contrast', 'saturation'];
        
        controls.forEach(control => {
            const slider = document.getElementById(control);
            const valueDisplay = document.getElementById(control + 'Value');
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.beautyParams[control] = value;
                    valueDisplay.textContent = value;
                    
                    // 防抖处理
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        this.applyBeautyEffects();
                    }, 200);
                });
            }
        });
    }

    /**
     * 初始化MediaPipe
     */
    async initializeMediaPipe() {
        try {
            if (typeof FaceMesh === 'undefined') {
                throw new Error('MediaPipe FaceMesh未加载');
            }

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
        
        if (this.originalImage && !this.isProcessing) {
            this.applyBeautyEffects();
        }
    }

    /**
     * 检查组件就绪状态
     */
    checkReadyState() {
        if (this.isOpenCvReady && this.isMediaPipeReady) {
            this.showLoading(false);
            this.showSuccess('🎉 系统初始化完成，请上传图片开始美颜！');
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

        // 检查文件大小 (限制10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('图片文件过大，请选择小于10MB的图片');
            return;
        }

        try {
            this.showLoading(true, '正在处理图片...');
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = async () => {
                try {
                    this.originalImage = img;
                    await this.displayOriginalImage();
                    await this.detectFace();
                    this.showLoading(false);
                } catch (error) {
                    console.error('图片显示失败:', error);
                    this.showError('图片显示失败，请重试');
                    this.showLoading(false);
                }
            };
            
            img.onerror = () => {
                this.showError('图片加载失败，请检查图片格式');
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
        if (!canvas) {
            throw new Error('找不到原始图片画布');
        }
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // 设置合适的画布尺寸
        const maxWidth = 400;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / this.originalImage.width, maxHeight / this.originalImage.height);
        
        canvas.width = this.originalImage.width * scale;
        canvas.height = this.originalImage.height * scale;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.originalImage, 0, 0, canvas.width, canvas.height);
        this.originalCanvas = canvas;
        
        console.log(`原始图片尺寸: ${canvas.width}x${canvas.height}`);
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
     * 应用美颜效果 - 超级安全版本
     */
    applyBeautyEffects() {
        if (!this.isOpenCvReady || !this.originalCanvas || this.isProcessing) {
            console.log('条件不满足，跳过美颜处理');
            return;
        }

        this.isProcessing = true;
        let src = null;
        let current = null;
        let next = null;

        try {
            console.log('开始美颜处理...');
            
            // 验证OpenCV模块
            if (typeof cv === 'undefined' || !cv.Mat) {
                throw new Error('OpenCV模块未就绪');
            }

            // 获取原始图像数据
            src = cv.imread(this.originalCanvas);
            
            // 验证图像是否有效
            if (!src || src.empty() || src.rows === 0 || src.cols === 0) {
                throw new Error('无效的图像数据');
            }

            console.log(`图像尺寸: ${src.cols}x${src.rows}, 通道数: ${src.channels()}`);

            // 设置当前处理图像为原图的副本
            current = src.clone();

            // 依次应用美颜效果，每次都进行安全检查
            console.log('应用磨皮效果...');
            next = this.applySkinSmoothing(current);
            if (next && next !== current) {
                if (current !== src) current.delete();
                current = next;
            }

            console.log('应用美白效果...');
            next = this.applyBrightening(current);
            if (next && next !== current) {
                if (current !== src) current.delete();
                current = next;
            }

            console.log('应用红润效果...');
            next = this.applyWarmth(current);
            if (next && next !== current) {
                if (current !== src) current.delete();
                current = next;
            }

            console.log('应用锐化效果...');
            next = this.applySharpening(current);
            if (next && next !== current) {
                if (current !== src) current.delete();
                current = next;
            }

            console.log('应用对比度调整...');
            next = this.applyContrastAndSaturation(current);
            if (next && next !== current) {
                if (current !== src) current.delete();
                current = next;
            }

            // 显示结果
            const resultCanvas = document.getElementById('resultCanvas');
            if (!resultCanvas) {
                throw new Error('找不到结果画布');
            }

            const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
            resultCanvas.width = this.originalCanvas.width;
            resultCanvas.height = this.originalCanvas.height;
            
            // 清空画布
            resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            
            // 显示处理结果
            cv.imshow('resultCanvas', current);
            this.resultCanvas = resultCanvas;
            
            console.log('美颜处理完成');

        } catch (error) {
            console.error('美颜处理失败:', error);
            this.showError(`美颜处理失败: ${error.message}`);
            
            // 发生错误时，显示原图
            if (src && !src.empty()) {
                try {
                    const resultCanvas = document.getElementById('resultCanvas');
                    if (resultCanvas) {
                        resultCanvas.width = this.originalCanvas.width;
                        resultCanvas.height = this.originalCanvas.height;
                        cv.imshow('resultCanvas', src);
                    }
                } catch (displayError) {
                    console.error('显示原图失败:', displayError);
                }
            }
        } finally {
            // 安全清理内存
            if (src && !src.isDeleted()) {
                try { src.delete(); } catch (e) { console.warn('src删除失败:', e); }
            }
            if (current && current !== src && !current.isDeleted()) {
                try { current.delete(); } catch (e) { console.warn('current删除失败:', e); }
            }
            this.isProcessing = false;
        }
    }

    /**
     * 磨皮效果 - 安全版本
     */
    applySkinSmoothing(src) {
        if (this.beautyParams.smoothness === 0) return src;

        // 使用简单的高斯模糊代替双边滤波，避免内存问题
        let blurred = null;
        let result = null;

        try {
            // 验证输入
            if (!src || src.empty()) {
                console.warn('磨皮输入无效');
                return src;
            }

            // 创建模糊版本
            blurred = new cv.Mat();
            const kernelSize = Math.max(3, Math.min(15, Math.floor(this.beautyParams.smoothness / 10)));
            const ksize = new cv.Size(kernelSize, kernelSize);
            
            // 使用高斯模糊代替双边滤波
            cv.GaussianBlur(src, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
            
            // 混合原图和模糊结果
            const alpha = Math.min(0.6, this.beautyParams.smoothness / 120); // 降低强度
            result = new cv.Mat();
            cv.addWeighted(src, 1 - alpha, blurred, alpha, 0, result);
            
            return result;
        } catch (error) {
            console.error('磨皮处理失败:', error);
            // 如果处理失败，返回原图的副本
            try {
                return src.clone();
            } catch (cloneError) {
                console.error('克隆失败:', cloneError);
                return src; // 返回原图引用
            }
        } finally {
            // 安全清理
            if (blurred) {
                try { 
                    if (!blurred.isDeleted()) blurred.delete(); 
                } catch (e) { 
                    console.warn('磨皮blurred删除失败:', e); 
                }
            }
        }
    }

    /**
     * 美白效果 - 安全版本
     */
    applyBrightening(src) {
        if (this.beautyParams.brightness === 0) return src;

        try {
            // 验证输入
            if (!src || src.empty()) {
                console.warn('美白输入无效');
                return src;
            }

            const dst = new cv.Mat();
            const brightness = Math.min(40, this.beautyParams.brightness * 1.2); // 限制最大亮度
            const contrast = 1.0; // 保持对比度不变
            
            src.convertTo(dst, -1, contrast, brightness);
            return dst;
        } catch (error) {
            console.error('美白处理失败:', error);
            try {
                return src.clone();
            } catch (cloneError) {
                console.error('美白克隆失败:', cloneError);
                return src;
            }
        }
    }

    /**
     * 红润效果 - 简化安全版本
     */
    applyWarmth(src) {
        if (this.beautyParams.warmth === 0) return src;

        try {
            // 验证输入
            if (!src || src.empty()) {
                console.warn('红润输入无效');
                return src;
            }

            // 使用简单的颜色空间调整，避免复杂的通道操作
            const dst = new cv.Mat();
            src.copyTo(dst);
            
            // 创建暖色调整矩阵 (简化版本)
            const warmthFactor = 1 + Math.min(0.2, this.beautyParams.warmth / 150);
            
            // 直接调整亮度和对比度来模拟暖色效果
            dst.convertTo(dst, -1, warmthFactor, this.beautyParams.warmth * 0.3);
            
            return dst;
        } catch (error) {
            console.error('红润处理失败:', error);
            try {
                return src.clone();
            } catch (cloneError) {
                console.error('红润克隆失败:', cloneError);
                return src;
            }
        }
    }

    /**
     * 锐化效果 - 简化安全版本
     */
    applySharpening(src) {
        if (this.beautyParams.sharpness === 0) return src;

        try {
            // 验证输入
            if (!src || src.empty()) {
                console.warn('锐化输入无效');
                return src;
            }

            // 使用简单的unsharp mask算法
            const blurred = new cv.Mat();
            const result = new cv.Mat();
            
            // 先创建模糊版本
            const ksize = new cv.Size(3, 3);
            cv.GaussianBlur(src, blurred, ksize, 1.0);
            
            // 计算锐化强度
            const amount = Math.min(0.3, this.beautyParams.sharpness / 200);
            
            // Unsharp mask: result = src + amount * (src - blurred)
            cv.addWeighted(src, 1 + amount, blurred, -amount, 0, result);
            
            // 清理临时变量
            blurred.delete();
            
            return result;
        } catch (error) {
            console.error('锐化处理失败:', error);
            try {
                return src.clone();
            } catch (cloneError) {
                console.error('锐化克隆失败:', cloneError);
                return src;
            }
        }
    }

    /**
     * 对比度和饱和度调整 - 简化安全版本
     */
    applyContrastAndSaturation(src) {
        try {
            // 验证输入
            if (!src || src.empty()) {
                console.warn('对比度调整输入无效');
                return src;
            }

            let dst = new cv.Mat();
            
            // 只进行对比度调整，跳过复杂的饱和度调整
            const contrast = 1 + Math.max(-0.3, Math.min(0.3, this.beautyParams.contrast / 150));
            const brightness = this.beautyParams.saturation * 0.2; // 用亮度模拟饱和度效果
            
            src.convertTo(dst, -1, contrast, brightness);
            
            return dst;
        } catch (error) {
            console.error('对比度调整失败:', error);
            try {
                return src.clone();
            } catch (cloneError) {
                console.error('对比度克隆失败:', cloneError);
                return src;
            }
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
            link.href = resultCanvas.toDataURL('image/png', 0.9);
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
            if (faceInfo) faceInfo.style.display = 'block';
            if (faceCount) faceCount.textContent = `检测到 ${this.faceLandmarks.length} 张人脸`;
            if (landmarkInfo) landmarkInfo.innerHTML = `<p>检测到 ${this.faceLandmarks[0].length} 个关键点</p>`;
        } else {
            if (faceInfo) faceInfo.style.display = 'none';
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(show, message = '正在加载...') {
        const loading = document.getElementById('loading');
        if (loading) {
            if (show) {
                loading.style.display = 'flex';
                const messageEl = loading.querySelector('p');
                if (messageEl) messageEl.textContent = message;
            } else {
                loading.style.display = 'none';
            }
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
        if (mainContent) {
            mainContent.insertBefore(messageDiv, mainContent.firstChild);

            // 3秒后自动移除
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 3000);
        }
    }
}

/**
 * OpenCV.js就绪回调
 */
function onOpenCvReady() {
    console.log('OpenCV.js模块加载完成');
    // 不在这里立即设置ready标志，让应用自己检查
}

/**
 * 页面加载完成后启动应用
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动应用...');
    window.faceBeautyApp = new FaceBeautyApp();
});

// 确保OpenCV全局可用
window.onOpenCvReady = onOpenCvReady;
