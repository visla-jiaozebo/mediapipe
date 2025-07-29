/**
 * 精确人脸美颜系统 - 基于MediaPipe关键点的区域化处理
 * 作者: AI Assistant
 * 功能: 基于468个关键点的精确美颜、大眼、瘦脸、区域磨皮
 */

// 人脸关键点区域定义 (基于MediaPipe 468个关键点)
const FACE_LANDMARKS = {
    // 脸部轮廓 (用于瘦脸)
    FACE_OVAL: [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ],
    
    // 左眼区域
    LEFT_EYE: [
        33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
    ],
    
    // 右眼区域
    RIGHT_EYE: [
        362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
    ],
    
    // 左眼瞳孔中心 (用于大眼效果)
    LEFT_EYE_CENTER: [468], // MediaPipe额外提供的虹膜关键点
    RIGHT_EYE_CENTER: [473],
    
    // 皮肤区域 (基于MediaPipe标准关键点，覆盖完整面部皮肤)
    SKIN_REGIONS: [
        // 面部主要轮廓区域 (完整脸部皮肤)
        [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
        
        // 左脸颊区域
        [116, 117, 118, 119, 120, 121, 128, 126, 142, 36, 205, 206, 207, 213, 192, 147, 187, 207, 177, 137, 227, 116],
        
        // 右脸颊区域  
        [345, 346, 347, 348, 349, 350, 451, 452, 453, 464, 435, 410, 454, 323, 361, 340, 346, 347, 348, 349, 350],
        
        // 额头区域 (扩大覆盖范围)
        [10, 151, 9, 10, 151, 9, 10, 151, 9, 151, 337, 299, 333, 298, 301, 284, 332, 297, 338],
        
        // 鼻子和鼻梁区域
        [1, 2, 5, 4, 6, 168, 8, 9, 10, 151, 195, 197, 196, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305],
        
        // 下巴和下半脸区域
        [18, 175, 199, 200, 9, 10, 151, 175, 199, 200, 17, 18, 200, 199, 175, 0, 17, 18],
        
        // 脸部中间区域 (填补空隙)
        [93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323]
    ]
};

// 需要排除的区域定义
const EXCLUDE_REGIONS = {
    // 眼部 (包括眼皮)
    EYES: [
        ...FACE_LANDMARKS.LEFT_EYE, ...FACE_LANDMARKS.RIGHT_EYE,
        // 眼皮
        246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33,
        // 右眼皮
        398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382, 362
    ],
    // 嘴唇
    LIPS: [
        61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
        // 上唇
        12, 15, 16, 17, 18, 200, 199, 175, 0, 13, 82, 81, 80, 78,
        // 下唇
        14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 78
    ],
    // 眉毛
    EYEBROWS: [
        46, 53, 52, 51, 48, 115, 131, 134, 102, 48, 64, // 左眉
        276, 283, 282, 295, 285, 336, 296, 334, 293, 300, 276 // 右眉
    ]
};

class PreciseFaceBeautyApp {
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
            // 皮肤美化
            skinSmoothing: 30,      // 磨皮强度
            skinBrightening: 10,    // 美白程度
            skinWarmth: 5,          // 红润度
            
            // 面部塑形 (调低初始值避免过度变形)
            eyeEnlarge: 5,          // 大眼程度 (降低到5)
            faceSlim: 3,            // 瘦脸程度 (降低到3)
            noseThin: 0,            // 瘦鼻程度 (设为0)
            
            // 整体调节
            sharpness: 20,          // 锐化强度
            contrast: 5,            // 对比度
            saturation: 10          // 饱和度
        };

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        this.showLoading(true, '正在初始化精确美颜系统...');
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
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    clearInterval(checkInterval);
                    this.isOpenCvReady = true;
                    console.log('OpenCV已准备就绪');
                    resolve(true);
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('OpenCV加载超时'));
            }, 30000);
        });
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
        const controls = Object.keys(this.beautyParams);
        
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
                        this.applyPreciseBeautyEffects();
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
     * MediaPipe结果处理 - 获取468个关键点
     */
    onFaceMeshResults(results) {
        this.faceLandmarks = results.multiFaceLandmarks || [];
        this.updateFaceInfo();
        
        if (this.originalImage && !this.isProcessing && this.faceLandmarks.length > 0) {
            console.log(`检测到人脸，关键点数量: ${this.faceLandmarks[0].length}`);
            this.applyPreciseBeautyEffects();
        }
    }

    /**
     * 检查组件就绪状态
     */
    checkReadyState() {
        if (this.isOpenCvReady && this.isMediaPipeReady) {
            this.showLoading(false);
            this.showSuccess('🎉 精确美颜系统初始化完成！请上传包含人脸的图片');
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

        if (file.size > 10 * 1024 * 1024) {
            this.showError('图片文件过大，请选择小于10MB的图片');
            return;
        }

        try {
            this.showLoading(true, '正在分析人脸特征...');
            
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
     * 应用精确美颜效果 - 基于关键点的区域化处理
     */
    applyPreciseBeautyEffects() {
        if (!this.isOpenCvReady || !this.originalCanvas || this.isProcessing || this.faceLandmarks.length === 0) {
            console.log('条件不满足，跳过美颜处理');
            return;
        }

        this.isProcessing = true;
        let src = null;
        let result = null;

        try {
            console.log('开始精确美颜处理...');
            
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

            console.log(`图像尺寸: ${src.cols}x${src.rows}, 关键点数: ${this.faceLandmarks[0].length}`);

            // 克隆原图作为处理基础
            result = src.clone();

            // 获取人脸关键点坐标 (转换为像素坐标)
            const landmarks = this.convertLandmarksToPixels(this.faceLandmarks[0], src.cols, src.rows);

            // 1. 面部塑形 (大眼、瘦脸) - 需要在磨皮前进行
            if (this.beautyParams.eyeEnlarge > 0 || this.beautyParams.faceSlim > 0) {
                console.log('应用面部塑形...');
                const shaped = this.applyFaceShaping(result, landmarks);
                if (shaped !== result) {
                    result.delete();
                    result = shaped;
                }
            }

            // 2. 皮肤区域精确磨皮
            if (this.beautyParams.skinSmoothing > 0) {
                console.log('应用精确磨皮...');
                const smoothed = this.applySkinRegionSmoothing(result, landmarks);
                if (smoothed !== result) {
                    result.delete();
                    result = smoothed;
                }
            }

            // 3. 皮肤区域美白
            if (this.beautyParams.skinBrightening > 0) {
                console.log('应用皮肤美白...');
                const brightened = this.applySkinRegionBrightening(result, landmarks);
                if (brightened !== result) {
                    result.delete();
                    result = brightened;
                }
            }

            // 4. 皮肤区域红润
            if (this.beautyParams.skinWarmth > 0) {
                console.log('应用皮肤红润...');
                const warmed = this.applySkinRegionWarmth(result, landmarks);
                if (warmed !== result) {
                    result.delete();
                    result = warmed;
                }
            }

            // 5. 整体调节 (锐化、对比度、饱和度)
            if (this.beautyParams.sharpness > 0 || this.beautyParams.contrast !== 0 || this.beautyParams.saturation !== 0) {
                console.log('应用整体调节...');
                const adjusted = this.applyGlobalAdjustments(result);
                if (adjusted !== result) {
                    result.delete();
                    result = adjusted;
                }
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
            cv.imshow('resultCanvas', result);
            this.resultCanvas = resultCanvas;
            
            console.log('精确美颜处理完成');

        } catch (error) {
            console.error('精确美颜处理失败:', error);
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
            if (result && result !== src && !result.isDeleted()) {
                try { result.delete(); } catch (e) { console.warn('result删除失败:', e); }
            }
            this.isProcessing = false;
        }
    }

    /**
     * 转换MediaPipe标准化坐标为像素坐标
     */
    convertLandmarksToPixels(landmarks, width, height) {
        return landmarks.map(point => ({
            x: Math.floor(point.x * width),
            y: Math.floor(point.y * height),
            z: point.z || 0
        }));
    }

    /**
     * 面部塑形 - 大眼和瘦脸
     */
    applyFaceShaping(src, landmarks) {
        try {
            const dst = src.clone();
            
            // 大眼效果
            if (this.beautyParams.eyeEnlarge > 0) {
                this.applyEyeEnlargement(dst, landmarks);
            }
            
            // 瘦脸效果
            if (this.beautyParams.faceSlim > 0) {
                this.applyFaceSlimming(dst, landmarks);
            }
            
            return dst;
        } catch (error) {
            console.error('面部塑形失败:', error);
            return src.clone();
        }
    }

    /**
     * 大眼效果 - 基于眼部关键点的局部放大
     */
    applyEyeEnlargement(dst, landmarks) {
        try {
            // 计算放大系数，范围控制在1.0-1.3之间
            const enlargeFactor = 1 + (this.beautyParams.eyeEnlarge / 300);
            const eyeRadius = 30; // 眼部变形半径
            
            // 处理左眼
            const leftEyePoints = FACE_LANDMARKS.LEFT_EYE.map(idx => landmarks[idx]).filter(p => p);
            if (leftEyePoints.length > 0) {
                const leftEyeCenter = this.calculateCentroid(leftEyePoints);
                console.log(`左眼中心: (${leftEyeCenter.x}, ${leftEyeCenter.y}), 放大系数: ${enlargeFactor}`);
                this.applyLocalWarp(dst, leftEyeCenter, eyeRadius, enlargeFactor);
            }
            
            // 处理右眼
            const rightEyePoints = FACE_LANDMARKS.RIGHT_EYE.map(idx => landmarks[idx]).filter(p => p);
            if (rightEyePoints.length > 0) {
                const rightEyeCenter = this.calculateCentroid(rightEyePoints);
                console.log(`右眼中心: (${rightEyeCenter.x}, ${rightEyeCenter.y}), 放大系数: ${enlargeFactor}`);
                this.applyLocalWarp(dst, rightEyeCenter, eyeRadius, enlargeFactor);
            }
        } catch (error) {
            console.error('大眼效果失败:', error);
        }
    }

    /**
     * 瘦脸效果 - 基于脸部轮廓的收缩
     */
    applyFaceSlimming(dst, landmarks) {
        try {
            // 计算收缩系数，范围控制在0.85-1.0之间
            const slimFactor = 1 - (this.beautyParams.faceSlim / 500);
            const cheekRadius = 50; // 脸颊变形半径
            
            // 获取脸部轮廓关键点
            const faceOvalPoints = FACE_LANDMARKS.FACE_OVAL.map(idx => landmarks[idx]).filter(p => p);
            if (faceOvalPoints.length > 0) {
                const faceCenter = this.calculateCentroid(faceOvalPoints);
                
                // 计算更精确的脸颊位置
                const faceWidth = Math.max(...faceOvalPoints.map(p => p.x)) - Math.min(...faceOvalPoints.map(p => p.x));
                const offsetX = faceWidth * 0.25; // 脸颊偏移距离
                
                // 对左右脸颊区域进行收缩
                const leftCheekCenter = { 
                    x: faceCenter.x - offsetX, 
                    y: faceCenter.y + 10 
                };
                const rightCheekCenter = { 
                    x: faceCenter.x + offsetX, 
                    y: faceCenter.y + 10 
                };
                
                console.log(`瘦脸中心点 - 左脸颊: (${leftCheekCenter.x}, ${leftCheekCenter.y}), 右脸颊: (${rightCheekCenter.x}, ${rightCheekCenter.y}), 收缩系数: ${slimFactor}`);
                
                this.applyLocalWarp(dst, leftCheekCenter, cheekRadius, slimFactor);
                this.applyLocalWarp(dst, rightCheekCenter, cheekRadius, slimFactor);
            }
        } catch (error) {
            console.error('瘦脸效果失败:', error);
        }
    }

    /**
     * 局部变形 - 使用优化的径向变形算法（参考GPU实现）
     */
    applyLocalWarp(dst, center, radius, factor) {
        try {
            const size = dst.size();
            const width = size.width;
            const height = size.height;
            
            // 确保中心点在有效范围内
            const validCenter = {
                x: Math.max(radius, Math.min(width - radius, center.x)),
                y: Math.max(radius, Math.min(height - radius, center.y))
            };
            
            // 计算宽高比，用于修正椭圆变形
            const aspectRatio = width / height;
            
            // 创建映射矩阵用于重映射
            const mapX = new cv.Mat(height, width, cv.CV_32FC1);
            const mapY = new cv.Mat(height, width, cv.CV_32FC1);
            
            // 生成优化的径向变形映射（参考GPUPixel算法）
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // 计算到变形中心的标准化距离（考虑宽高比）
                    const dx = x - validCenter.x;
                    const dy = y - validCenter.y;
                    
                    // 使用椭圆距离计算，修正宽高比影响
                    const normalizedX = dx;
                    const normalizedY = dy / aspectRatio;
                    const distance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
                    
                    let newX = x;
                    let newY = y;
                    
                    // 只对半径范围内的点进行变形
                    if (distance < radius && distance > 0) {
                        // 使用更平滑的权重函数（类似GPU shader实现）
                        const weight = distance / radius;
                        
                        // 采用二次函数衰减，效果更自然
                        const smoothWeight = 1.0 - (1.0 - weight * weight) * Math.abs(factor - 1);
                        const clampedWeight = Math.max(0.0, Math.min(1.0, smoothWeight));
                        
                        // 计算新的位置
                        const newDx = dx * clampedWeight;
                        const newDy = dy * clampedWeight;
                        
                        newX = validCenter.x + newDx;
                        newY = validCenter.y + newDy;
                    }
                    
                    // 确保映射坐标在有效范围内
                    newX = Math.max(0, Math.min(width - 1, newX));
                    newY = Math.max(0, Math.min(height - 1, newY));
                    
                    // 设置映射矩阵的值
                    mapX.floatPtr(y, x)[0] = newX;
                    mapY.floatPtr(y, x)[0] = newY;
                }
            }
            
            // 应用重映射，使用更高质量的插值
            const warped = new cv.Mat();
            cv.remap(dst, warped, mapX, mapY, cv.INTER_CUBIC, cv.BORDER_REFLECT);
            
            // 复制结果回原图像
            warped.copyTo(dst);
            
            // 清理资源
            mapX.delete();
            mapY.delete();
            warped.delete();
            
        } catch (error) {
            console.error('局部变形失败:', error);
        }
    }

    /**
     * 计算关键点的重心
     */
    calculateCentroid(points) {
        const sum = points.reduce((acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y
        }), { x: 0, y: 0 });
        
        return {
            x: Math.floor(sum.x / points.length),
            y: Math.floor(sum.y / points.length)
        };
    }

    /**
     * 皮肤区域精确磨皮 - 只处理皮肤区域，保护眼部和嘴唇
     */
    applySkinRegionSmoothing(src, landmarks) {
        let dst = null;
        let mask = null;
        let smoothed = null;
        let blended = null;
        
        try {
            dst = src.clone();
            
            // 创建皮肤区域掩码
            mask = this.createSkinMask(src, landmarks);
            if (!mask || mask.empty()) {
                console.warn('皮肤蒙版创建失败');
                if (mask) mask.delete();
                return dst;
            }
            
            // 调试：可视化皮肤蒙版 (可选)
            if (window.DEBUG_SKIN_MASK) {
                const debugCanvas = document.getElementById('debugCanvas');
                if (debugCanvas) {
                    debugCanvas.width = src.cols;
                    debugCanvas.height = src.rows;
                    cv.imshow('debugCanvas', mask);
                }
            }
            
            // 检查蒙版是否有效
            const maskNonZero = cv.countNonZero(mask);
            console.log(`皮肤蒙版覆盖像素数: ${maskNonZero}, 占比: ${(maskNonZero / (src.rows * src.cols) * 100).toFixed(1)}%`);
            
            if (maskNonZero < 1000) {
                console.warn('皮肤蒙版覆盖区域过小，跳过磨皮处理');
                mask.delete();
                return dst;
            }
            
            // 使用高斯模糊代替双边滤波，避免内存问题
            smoothed = new cv.Mat();
            const kernelSize = Math.max(5, Math.min(15, Math.floor(this.beautyParams.skinSmoothing / 7)));
            const ksize = new cv.Size(kernelSize, kernelSize);
            cv.GaussianBlur(src, smoothed, ksize, 0);
            
            // 混合原图和模糊结果
            const alpha = this.beautyParams.skinSmoothing / 100;
            blended = new cv.Mat();
            cv.addWeighted(src, 1 - alpha, smoothed, alpha, 0, blended);
            
            // 只在皮肤区域应用磨皮效果
            blended.copyTo(dst, mask);
            
            console.log('皮肤磨皮处理完成');
            
        } catch (error) {
            console.error('皮肤磨皮失败:', error);
            
        } finally {
            // 安全清理资源
            if (mask && !mask.isDeleted()) {
                try { mask.delete(); } catch (e) { console.warn('mask删除失败:', e); }
            }
            if (smoothed && !smoothed.isDeleted()) {
                try { smoothed.delete(); } catch (e) { console.warn('smoothed删除失败:', e); }
            }
            if (blended && !blended.isDeleted()) {
                try { blended.delete(); } catch (e) { console.warn('blended删除失败:', e); }
            }
        }
        
        return dst || src.clone();
    }

    /**
     * 创建皮肤区域掩码 - 最简化方法，避免内存错误
     */
    createSkinMask(src, landmarks) {
        let mask = null;
        let excludeMask = null;
        let kernel = null;
        
        try {
            // 创建基础蒙版
            mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            
            // 1. 计算面部边界框
            let minX = src.cols, maxX = 0, minY = src.rows, maxY = 0;
            
            // 使用更少的关键点计算边界，避免内存问题
            const boundaryIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
            
            for (let idx of boundaryIndices) {
                if (idx < landmarks.length && landmarks[idx]) {
                    const point = landmarks[idx];
                    minX = Math.min(minX, point.x);
                    maxX = Math.max(maxX, point.x);
                    minY = Math.min(minY, point.y);
                    maxY = Math.max(maxY, point.y);
                }
            }
            
            // 2. 扩展边界
            const padding = 15;
            minX = Math.max(0, minX - padding);
            maxX = Math.min(src.cols - 1, maxX + padding);
            minY = Math.max(0, minY - padding);
            maxY = Math.min(src.rows - 1, maxY + padding);
            
            // 3. 创建矩形面部区域（更安全）
            cv.rectangle(mask, 
                new cv.Point(minX, minY), 
                new cv.Point(maxX, maxY), 
                new cv.Scalar(255), -1);
            
            console.log(`面部矩形区域: (${minX}, ${minY}) 到 (${maxX}, ${maxY})`);
            
            // 4. 创建排除蒙版
            excludeMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            
            // 5. 排除眼部区域（简化）
            const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155];
            const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249];
            
            // 左眼
            let leftEyeX = 0, leftEyeY = 0, leftEyeCount = 0;
            for (let idx of leftEyeIndices) {
                if (idx < landmarks.length && landmarks[idx]) {
                    leftEyeX += landmarks[idx].x;
                    leftEyeY += landmarks[idx].y;
                    leftEyeCount++;
                }
            }
            if (leftEyeCount > 0) {
                leftEyeX /= leftEyeCount;
                leftEyeY /= leftEyeCount;
                cv.circle(excludeMask, new cv.Point(leftEyeX, leftEyeY), 20, new cv.Scalar(255), -1);
            }
            
            // 右眼
            let rightEyeX = 0, rightEyeY = 0, rightEyeCount = 0;
            for (let idx of rightEyeIndices) {
                if (idx < landmarks.length && landmarks[idx]) {
                    rightEyeX += landmarks[idx].x;
                    rightEyeY += landmarks[idx].y;
                    rightEyeCount++;
                }
            }
            if (rightEyeCount > 0) {
                rightEyeX /= rightEyeCount;
                rightEyeY /= rightEyeCount;
                cv.circle(excludeMask, new cv.Point(rightEyeX, rightEyeY), 20, new cv.Scalar(255), -1);
            }
            
            // 6. 排除嘴唇区域（简化）
            const lipIndices = [61, 84, 17, 314, 405, 320, 307, 375];
            let lipX = 0, lipY = 0, lipCount = 0;
            for (let idx of lipIndices) {
                if (idx < landmarks.length && landmarks[idx]) {
                    lipX += landmarks[idx].x;
                    lipY += landmarks[idx].y;
                    lipCount++;
                }
            }
            if (lipCount > 0) {
                lipX /= lipCount;
                lipY /= lipCount;
                cv.circle(excludeMask, new cv.Point(lipX, lipY), 15, new cv.Scalar(255), -1);
            }
            
            // 7. 从面部蒙版中减去排除区域
            cv.subtract(mask, excludeMask, mask);
            
            // 8. 轻微模糊边缘（最小化处理）
            kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
            cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
            
            console.log('简化皮肤蒙版创建完成');
            
        } catch (error) {
            console.error('创建皮肤掩码失败:', error);
            if (mask) {
                try { mask.delete(); } catch (e) {}
                mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            }
        } finally {
            // 安全清理资源
            if (excludeMask && !excludeMask.isDeleted()) {
                try { excludeMask.delete(); } catch (e) { console.warn('excludeMask删除失败:', e); }
            }
            if (kernel && !kernel.isDeleted()) {
                try { kernel.delete(); } catch (e) { console.warn('kernel删除失败:', e); }
            }
        }
        
        return mask || cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    }

    /**
     * 皮肤区域美白
     */
    applySkinRegionBrightening(src, landmarks) {
        let dst = null;
        let mask = null;
        let brightened = null;
        
        try {
            dst = src.clone();
            mask = this.createSkinMask(src, landmarks);
            
            if (!mask || mask.empty()) {
                console.warn('美白：皮肤蒙版创建失败');
                if (mask) mask.delete();
                return dst;
            }
            
            // 检查蒙版有效性
            const maskNonZero = cv.countNonZero(mask);
            if (maskNonZero < 1000) {
                console.warn('美白：皮肤蒙版覆盖区域过小，跳过美白处理');
                mask.delete();
                return dst;
            }
            
            // 简化的美白算法，避免色彩空间转换的复杂操作
            const brightness = this.beautyParams.skinBrightening * 1.2;
            brightened = new cv.Mat();
            src.convertTo(brightened, -1, 1, brightness);
            
            // 只在皮肤区域应用美白效果
            brightened.copyTo(dst, mask);
            
            console.log('皮肤美白处理完成');
            
        } catch (error) {
            console.error('皮肤美白失败:', error);
            
        } finally {
            // 安全清理资源
            if (mask && !mask.isDeleted()) {
                try { mask.delete(); } catch (e) { console.warn('mask删除失败:', e); }
            }
            if (brightened && !brightened.isDeleted()) {
                try { brightened.delete(); } catch (e) { console.warn('brightened删除失败:', e); }
            }
        }
        
        return dst || src.clone();
    }

    /**
     * 皮肤区域红润
     */
    applySkinRegionWarmth(src, landmarks) {
        let dst = null;
        let mask = null;
        let warmed = null;
        
        try {
            dst = src.clone();
            mask = this.createSkinMask(src, landmarks);
            
            if (!mask || mask.empty()) {
                console.warn('红润度：皮肤蒙版创建失败');
                if (mask) mask.delete();
                return dst;
            }
            
            // 检查蒙版有效性
            const maskNonZero = cv.countNonZero(mask);
            if (maskNonZero < 1000) {
                console.warn('红润度：皮肤蒙版覆盖区域过小，跳过红润处理');
                mask.delete();
                return dst;
            }
            
            // 简化的红润算法
            const warmthFactor = 1 + (this.beautyParams.skinWarmth / 200);
            const warmthOffset = this.beautyParams.skinWarmth * 0.5;
            warmed = new cv.Mat();
            src.convertTo(warmed, -1, warmthFactor, warmthOffset);
            
            // 只在皮肤区域应用红润效果
            warmed.copyTo(dst, mask);
            
            console.log('皮肤红润处理完成');
            
        } catch (error) {
            console.error('皮肤红润失败:', error);
            
        } finally {
            // 安全清理资源
            if (mask && !mask.isDeleted()) {
                try { mask.delete(); } catch (e) { console.warn('mask删除失败:', e); }
            }
            if (warmed && !warmed.isDeleted()) {
                try { warmed.delete(); } catch (e) { console.warn('warmed删除失败:', e); }
            }
        }
        
        return dst || src.clone();
    }

    /**
     * 整体调节 - 锐化、对比度、饱和度
     */
    applyGlobalAdjustments(src) {
        try {
            let dst = src.clone();
            
            // 锐化
            if (this.beautyParams.sharpness > 0) {
                const blurred = new cv.Mat();
                const ksize = new cv.Size(3, 3);
                cv.GaussianBlur(dst, blurred, ksize, 1.0);
                
                const amount = this.beautyParams.sharpness / 200;
                const sharpened = new cv.Mat();
                cv.addWeighted(dst, 1 + amount, blurred, -amount, 0, sharpened);
                
                dst.delete();
                dst = sharpened;
                blurred.delete();
            }
            
            // 对比度和亮度调节
            if (this.beautyParams.contrast !== 0 || this.beautyParams.saturation !== 0) {
                const contrast = 1 + (this.beautyParams.contrast / 100);
                const brightness = this.beautyParams.saturation * 0.3;
                
                const adjusted = new cv.Mat();
                dst.convertTo(adjusted, -1, contrast, brightness);
                
                dst.delete();
                dst = adjusted;
            }
            
            return dst;
        } catch (error) {
            console.error('整体调节失败:', error);
            return src.clone();
        }
    }

    /**
     * 重置参数
     */
    resetParameters() {
        this.beautyParams = {
            skinSmoothing: 30,
            skinBrightening: 10,
            skinWarmth: 5,
            eyeEnlarge: 5,          // 降低大眼初始值
            faceSlim: 3,            // 降低瘦脸初始值
            noseThin: 0,            // 瘦鼻设为0
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
        this.applyPreciseBeautyEffects();
        this.showSuccess('参数已重置为安全默认值');
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
            link.download = `precise_beauty_result_${Date.now()}.png`;
            link.href = resultCanvas.toDataURL('image/png', 0.9);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showSuccess('精确美颜图片下载成功！');
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
            if (faceCount) faceCount.textContent = `✅ 检测到 ${this.faceLandmarks.length} 张人脸`;
            if (landmarkInfo) {
                landmarkInfo.innerHTML = `
                    <p>🎯 检测到 ${this.faceLandmarks[0].length} 个精确关键点</p>
                    <p>🔍 已定位皮肤区域和面部特征</p>
                    <p>✨ 准备进行精确美颜处理</p>
                `;
            }
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
    console.log('DOM加载完成，启动精确美颜应用...');
    window.preciseFaceBeautyApp = new PreciseFaceBeautyApp();
});

/**
 * 切换皮肤蒙版调试模式
 */
function toggleSkinMaskDebug() {
    const debugInfo = document.getElementById('debugInfo');
    const debugBtn = document.getElementById('debugSkinBtn');
    
    if (window.DEBUG_SKIN_MASK) {
        window.DEBUG_SKIN_MASK = false;
        debugInfo.style.display = 'none';
        debugBtn.textContent = '调试皮肤区域';
        debugBtn.style.background = '#6c757d';
    } else {
        window.DEBUG_SKIN_MASK = true;
        debugInfo.style.display = 'block';
        debugBtn.textContent = '关闭调试';
        debugBtn.style.background = '#dc3545';
        
        // 如果有图片，重新处理以显示调试信息
        if (window.preciseFaceBeautyApp && window.preciseFaceBeautyApp.originalImage) {
            window.preciseFaceBeautyApp.applyPreciseBeautyEffects();
        }
    }
}

// 确保OpenCV全局可用
window.onOpenCvReady = onOpenCvReady;
