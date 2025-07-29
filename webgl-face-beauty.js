/**
 * WebGL Shader 美颜系统 - 基于GPU加速的高质量美颜处理
 * 参考 GPUPixel face_reshape_filter.cc 实现
 * 作者: AI Assistant
 * 功能: GPU shader 实现的瘦脸、大眼、磨皮效果
 */


class WebGLFaceBeautyApp {
    constructor() {
        this.faceMesh = null;
        this.originalImage = null;
        this.originalCanvas = null;
        this.resultCanvas = null;
        this.faceLandmarks = [];
        this.isMediaPipeReady = false;
        this.isProcessing = false;
        
        // WebGL相关
        this.gl = null;
        this.programs = {};
        this.textures = {};
        this.framebuffers = {};
        this.vertexBuffer = null;
        this.indexBuffer = null;
        
        // 美颜参数
        this.beautyParams = {
            faceSlim: 0.02,       // 瘦脸强度 [0.0, 1.0] - 增强效果
            eyeEnlarge: 0.4,     // 大眼强度 [0.0, 1.0] - 增强效果  
            skinSmoothing: 0.5,  // 磨皮强度 [0.0, 1.0]
            brightness: 0.2,     // 美白强度 [-1.0, 1.0]
            contrast: 0.1,       // 对比度 [-1.0, 1.0]
            saturation: 0.15,    // 饱和度 [-1.0, 1.0]
            warmth: 0.1          // 暖色调 [-1.0, 1.0]
        };
        
        // 化妆参数
        this.makeupParams = {
            lipstickIntensity: 0.5,    // 口红强度 [0.0, 1.0]
            blushIntensity: 0.3,       // 腮红强度 [0.0, 1.0]
            eyeshadowIntensity: 0.4,   // 眼影强度 [0.0, 1.0]
            lipstickBlendMode: 22,     // 口红混合模式 (强光)
            blushBlendMode: 17,        // 腮红混合模式 (叠加)
            eyeshadowBlendMode: 15     // 眼影混合模式 (正片叠底)
        };
        
        // 化妆纹理
        this.makeupTextures = {
            lipstick: null,
            blush: null,
            eyeshadow: null
        };
        
        this.init();
    }
    
    async init() {
        this.showLoading(true, '正在初始化GPU美颜系统...');
        this.setupEventListeners();
        
        try {
            console.log('开始初始化WebGL...');
            await this.initializeWebGL();
            console.log('WebGL初始化完成，开始初始化MediaPipe...');
            await this.initializeMediaPipe();
            console.log('MediaPipe初始化完成，检查就绪状态...');
            this.checkReadyState();
            console.log('应用初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('系统初始化失败，请刷新页面重试: ' + error.message);
            this.showLoading(false);
        }
    }
    
    async initializeWebGL() {
        console.log('开始创建WebGL上下文...');
        // 创建隐藏的WebGL画布
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        document.body.appendChild(canvas);
        canvas.style.display = 'none';
        
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!this.gl) {
            throw new Error('WebGL不支持');
        }
        console.log('WebGL上下文创建成功');
        
        // 加载外部shader文件
        console.log('开始加载shader文件...');
        const vertexShaderSource = await this.loadShaderFile('gl/facebeauty.vert');
        console.log('Vertex shader加载成功，长度:', vertexShaderSource.length);
        const fragmentShaderSource = await this.loadShaderFile('gl/facebeauty.frag');
        console.log('Fragment shader加载成功，长度:', fragmentShaderSource.length);
        
        // 编译统一的着色器程序
        console.log('开始编译着色器程序...');
        this.programs.faceBeauty = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        console.log('着色器程序编译成功');
        
        // 设置几何体（全屏四边形）
        console.log('设置几何体...');
        this.setupGeometry();
        
        console.log('WebGL初始化完成');
    }
    
    async loadShaderFile(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`加载shader文件失败: ${url}`);
            }
            return await response.text();
        } catch (error) {
            console.error('加载shader文件错误:', error);
            throw error;
        }
    }
    
    createShaderProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        // 编译顶点着色器
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(vertexShader);
            console.error('顶点着色器编译失败:', error);
            console.log('顶点着色器源码:', vertexSource);
            throw new Error('顶点着色器编译失败: ' + error);
        }
        
        // 编译片段着色器
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(fragmentShader);
            console.error('片段着色器编译失败:', error);
            console.log('片段着色器源码:', fragmentSource);
            throw new Error('片段着色器编译失败: ' + error);
        }
        
        // 链接程序
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            console.error('着色器程序链接失败:', error);
            throw new Error('着色器程序链接失败: ' + error);
        }
        
        // 获取属性和uniform位置
        const programInfo = {
            program: program,
            attributeLocations: {
                'a_position': gl.getAttribLocation(program, 'a_position'),
                'a_texCoord': gl.getAttribLocation(program, 'a_texCoord'),
            },
            uniformLocations: {}
        };
        
        // 获取所有uniform位置
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        console.log(`着色器程序包含 ${numUniforms} 个 uniform:`);
        for (let i = 0; i < numUniforms; i++) {
            const uniformInfo = gl.getActiveUniform(program, i);
            let uniformName = uniformInfo.name;
            
            // 处理数组uniform的名称（WebGL可能在数组名称后添加[0]）
            if (uniformName.endsWith('[0]')) {
                uniformName = uniformName.slice(0, -3); // 移除[0]后缀
            }
            
            const location = gl.getUniformLocation(program, uniformInfo.name);
            programInfo.uniformLocations[uniformName] = location;
            console.log(`- ${uniformInfo.name} -> ${uniformName}: ${location ? '✓' : '✗'}`);
        }
        
        console.log('着色器程序创建成功');
        return programInfo;
    }
    
    setupGeometry() {
        const gl = this.gl;
        
        // 全屏四边形顶点 (位置 + 纹理坐标)
        const vertices = new Float32Array([
            // 位置      纹理坐标
            -1.0, -1.0,  0.0, 0.0,
             1.0, -1.0,  1.0, 0.0,
            -1.0,  1.0,  0.0, 1.0,
             1.0,  1.0,  1.0, 1.0,
        ]);
        
        const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);
        
        // 创建顶点缓冲区
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // 创建索引缓冲区
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
    
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
            throw error;
        }
    }
    
    onFaceMeshResults(results) {
        this.faceLandmarks = results.multiFaceLandmarks || [];
        this.updateFaceInfo();
        
        if (this.originalImage && !this.isProcessing && this.faceLandmarks.length > 0) {
            console.log(`检测到人脸，关键点数量: ${this.faceLandmarks[0].length}`);
            
            // 绘制原始关键点到canvas上进行验证
            this.drawLandmarksOnCanvas();
            
            this.applyWebGLBeautyEffects();
        }
    }
    
    checkReadyState() {
        console.log('检查就绪状态...');
        console.log('- WebGL:', this.gl ? '✅' : '❌');
        console.log('- MediaPipe:', this.isMediaPipeReady ? '✅' : '❌');
        
        if (this.gl && this.isMediaPipeReady) {
            this.showLoading(false);
            this.showSuccess('🎉 GPU美颜系统初始化完成！正在加载示例图片...');
            console.log('系统就绪，开始加载示例图片');
            // 自动加载 demo.png
            this.loadDemoImage();
        } else {
            console.log('系统未就绪，等待初始化完成...');
        }
    }
    
    async loadDemoImage() {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = async () => {
                console.log('Demo图片加载成功');
                this.originalImage = img;
                await this.displayOriginalImage();
                await this.detectFace();
                this.showSuccess('✅ 示例图片加载完成，开始美颜处理！');
            };
            
            img.onerror = () => {
                console.warn('Demo图片加载失败，请手动上传图片');
                this.showSuccess('🎉 GPU美颜系统已就绪！请上传包含人脸的图片');
            };
            
            // 加载 demo.png
            img.src = './demo.png';
        } catch (error) {
            console.error('加载demo图片失败:', error);
            this.showSuccess('🎉 GPU美颜系统已就绪！请上传包含人脸的图片');
        }
    }
    
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
    
    setupBeautyControls() {
        const controlMapping = {
            'skinSmoothing': 'skinSmoothing',
            'skinBrightening': 'brightness', 
            'skinWarmth': 'warmth',
            'eyeEnlarge': 'eyeEnlarge',
            'faceSlim': 'faceSlim',
            'contrast': 'contrast',
            'saturation': 'saturation'
        };
        
        Object.keys(controlMapping).forEach(controlId => {
            const paramKey = controlMapping[controlId];
            const slider = document.getElementById(controlId);
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    
                    // 转换滑块值到shader参数范围
                    if (paramKey === 'faceSlim' || paramKey === 'eyeEnlarge') {
                        value = value / 100.0; // [0, 100] -> [0.0, 1.0]
                    } else if (paramKey === 'skinSmoothing') {
                        value = value / 100.0; // [0, 100] -> [0.0, 1.0]
                    } else if (paramKey === 'brightness' || paramKey === 'warmth') {
                        value = value / 50.0;  // [0, 100] -> [0.0, 2.0], 然后减1变成[-1.0, 1.0]
                        value = Math.max(-1.0, Math.min(1.0, value - 1.0));
                    } else {
                        value = value / 50.0 - 1.0; // [0, 100] -> [-1.0, 1.0]
                    }
                    
                    this.beautyParams[paramKey] = value;
                    valueDisplay.textContent = e.target.value;
                    
                    // 防抖处理
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        this.applyWebGLBeautyEffects();
                    }, 100);
                });
            }
        });

        // 化妆效果控制
        const makeupControls = [
            'lipstickIntensity', 'blushIntensity', 'eyeshadowIntensity',
            'lipstickColorHue', 'lipstickColorSat', 
            'blushColorHue', 'blushColorSat',
            'eyeshadowColorHue', 'eyeshadowColorSat'
        ];

        makeupControls.forEach(controlId => {
            const slider = document.getElementById(controlId);
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    
                    if (controlId.includes('Intensity')) {
                        const makeupType = controlId.replace('Intensity', '').toLowerCase();
                        this.makeupParams[makeupType + 'Intensity'] = value / 100.0;
                    } else if (controlId.includes('Hue')) {
                        const makeupType = controlId.replace('ColorHue', '').toLowerCase();
                        this.makeupParams[makeupType + 'Hue'] = value / 360.0;
                    } else if (controlId.includes('Sat')) {
                        const makeupType = controlId.replace('ColorSat', '').toLowerCase();
                        this.makeupParams[makeupType + 'Saturation'] = value / 100.0;
                    }
                    
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                    
                    // 防抖处理
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        this.applyWebGLBeautyEffects();
                    }, 100);
                });
            }
        });

        // 颜色选择器
        const colorPickers = ['lipstickColor', 'blushColor', 'eyeshadowColor'];
        colorPickers.forEach(colorId => {
            const colorPicker = document.getElementById(colorId);
            if (colorPicker) {
                colorPicker.addEventListener('input', (e) => {
                    const makeupType = colorId.replace('Color', '').toLowerCase();
                    const color = this.hexToHSL(e.target.value);
                    
                    this.makeupParams[makeupType + 'Hue'] = color.h / 360.0;
                    this.makeupParams[makeupType + 'Saturation'] = color.s / 100.0;
                    this.makeupParams[makeupType + 'Lightness'] = color.l / 100.0;
                    
                    // 同步更新相关滑块
                    const hueSlider = document.getElementById(makeupType + 'ColorHue');
                    const satSlider = document.getElementById(makeupType + 'ColorSat');
                    if (hueSlider) hueSlider.value = color.h;
                    if (satSlider) satSlider.value = color.s;
                    
                    this.applyWebGLBeautyEffects();
                });
            }
        });

        // 混合模式选择
        const blendModeSelect = document.getElementById('makeupBlendMode');
        if (blendModeSelect) {
            blendModeSelect.addEventListener('change', (e) => {
                const blendMode = parseInt(e.target.value);
                this.makeupParams.lipstickBlendMode = blendMode;
                this.makeupParams.blushBlendMode = blendMode;
                this.makeupParams.eyeshadowBlendMode = blendMode;
                this.applyWebGLBeautyEffects();
            });
        }
    }

    // 颜色转换辅助函数
    hexToHSL(hex) {
        // 将十六进制转换为RGB
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // 灰色
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }
    
    // 事件处理方法
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processImageFile(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processImageFile(file);
        }
    }
    
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
    
    async displayOriginalImage() {
        const canvas = document.getElementById('originalCanvas');
        if (!canvas) {
            throw new Error('找不到原始图片画布');
        }
        
        const ctx = canvas.getContext('2d');
        
        // 设置合适的画布尺寸
        const maxWidth = 400;
        const maxHeight = 300;
        const scale = Math.min(maxWidth / this.originalImage.width, maxHeight / this.originalImage.height);
        
        canvas.width = this.originalImage.width * scale;
        canvas.height = this.originalImage.height * scale;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.originalImage, 0, 0, canvas.width, canvas.height);
        this.originalCanvas = canvas;
    }
    
    async detectFace() {
        if (!this.faceMesh || !this.originalCanvas) return;

        try {
            await this.faceMesh.send({ image: this.originalCanvas });
        } catch (error) {
            console.error('人脸检测失败:', error);
            this.showError('人脸检测失败，请确保图片中包含清晰的人脸');
        }
    }
    
    // 在canvas上绘制所有MediaPipe关键点，包含索引标注
    drawLandmarksOnCanvas() {
        if (true) return; // 调试模式下不绘制
        if (!this.originalCanvas || this.faceLandmarks.length === 0) return;
        
        const canvas = this.originalCanvas;
        const ctx = canvas.getContext('2d');
        
        // 重新绘制原图
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.originalImage, 0, 0, canvas.width, canvas.height);
        
        const landmarks = this.faceLandmarks[0];
        console.log(`开始绘制所有 ${landmarks.length} 个MediaPipe关键点`);
        
        // 设置基本绘制样式
        ctx.lineWidth = 1;
        
        // 绘制所有468个关键点
        for (let i = 0; i < landmarks.length; i++) {
            const point = landmarks[i];
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;
            
            // 根据关键点区域设置不同颜色
            let pointColor = this.getLandmarkColor(i);
            
            // 绘制关键点圆圈
            ctx.fillStyle = pointColor;
            ctx.strokeStyle = pointColor;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // 绘制索引标签
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.font = '8px Arial';
            ctx.lineWidth = 0.5;
            
            // 为文字添加描边效果以便在任何背景下都能看清
            // ctx.strokeText(i.toString(), x + 3, y - 3);
            // ctx.fillText(i.toString(), x + 3, y - 3);
        }
        
        // 特别标注我们在shader中使用的关键点（用更大的圆圈）
        const shaderKeyPoints = [
            // 眼部关键点
            { index: 33, name: 'LeftInner', color: 'yellow', size: 6 },    // 左眼内眼角
            { index: 133, name: 'LeftOuter', color: 'yellow', size: 6 },   // 左眼外眼角
            { index: 160, name: 'LeftTop', color: 'yellow', size: 6 },     // 左眼上方
            { index: 144, name: 'LeftBottom', color: 'yellow', size: 6 },  // 左眼下方
            { index: 362, name: 'RightInner', color: 'orange', size: 6 },  // 右眼内眼角
            { index: 263, name: 'RightOuter', color: 'orange', size: 6 },  // 右眼外眼角
            { index: 385, name: 'RightTop', color: 'orange', size: 6 },    // 右眼上方
            { index: 380, name: 'RightBottom', color: 'orange', size: 6 }, // 右眼下方
            
            // 脸颊关键点 (基于MediaPipe Face Oval轮廓)
            { index: 234, name: 'LeftCheek1', color: 'lime', size: 5 },    // 左颞区
            { index: 127, name: 'LeftCheek2', color: 'lime', size: 5 },    // 左脸颊上部  
            { index: 162, name: 'LeftCheek3', color: 'lime', size: 5 },    // 左脸颊中部
            { index: 21, name: 'LeftCheek4', color: 'lime', size: 5 },     // 左脸颊下部
            { index: 454, name: 'RightCheek1', color: 'cyan', size: 5 },   // 右颞区
            { index: 356, name: 'RightCheek2', color: 'cyan', size: 5 },   // 右脸颊上部
            { index: 389, name: 'RightCheek3', color: 'cyan', size: 5 },   // 右脸颊中部
            { index: 251, name: 'RightCheek4', color: 'cyan', size: 5 },   // 右脸颊下部
            
            // 面部中心点
            { index: 1, name: 'NoseTip', color: 'magenta', size: 4 },      // 鼻尖
            { index: 18, name: 'ChinCenter', color: 'magenta', size: 4 }   // 下巴中心 (正确的MediaPipe索引)
        ];
        
        // 绘制特殊标注点
        shaderKeyPoints.forEach(point => {
            if (point.index < landmarks.length) {
                const landmark = landmarks[point.index];
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;
                
                // 绘制较大的圆圈标识
                ctx.strokeStyle = point.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, point.size, 0, 2 * Math.PI);
                ctx.stroke();
                
                // 标注名称
                // ctx.fillStyle = point.color;
                // ctx.strokeStyle = 'black';
                // ctx.font = 'bold 10px Arial';
                // ctx.lineWidth = 1;
                // ctx.strokeText(point.name, x + point.size + 2, y + 3);
                // ctx.fillText(point.name, x + point.size + 2, y + 3);
            }
        });
        
        console.log('已在原图canvas上绘制所有MediaPipe关键点:');
        console.log('- 灰色小圆点: 普通关键点');
        console.log('- 红色小圆点: 眼部轮廓关键点');
        console.log('- 绿色小圆点: 面部轮廓关键点');
        console.log('- 蓝色小圆点: 嘴部关键点');
        console.log('- 黄色/橙色大圆圈: Shader使用的眼部关键点');
        console.log('- 青色/绿色大圆圈: Shader使用的脸颊关键点');
        console.log('- 紫色大圆圈: 面部中心点');
    }
    
    // 根据关键点索引返回相应的颜色
    getLandmarkColor(index) {
        // MediaPipe Face Mesh 468 关键点的区域分布
        
        // 眼部区域 (红色)
        const eyeIndices = [
            // 左眼轮廓
            33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
            // 右眼轮廓
            362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382,
            // 眼部其他关键点
            130, 25, 110, 24, 23, 22, 26, 112, 243, 190, 56, 28, 27, 29, 30, 247, 
            359, 255, 339, 254, 253, 252, 256, 341, 463, 414, 286, 258, 257, 259, 260, 467
        ];
        
        // 面部轮廓 (绿色)
        const faceContourIndices = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
            377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ];
        
        // 嘴部区域 (蓝色)
        const mouthIndices = [
            0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 0, 269, 270, 267, 271, 272,
            191, 80, 81, 82, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312,
            13, 82, 81, 80, 78, 191, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308
        ];
        
        // 鼻部区域 (黄色)
        const noseIndices = [
            1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 48, 64
        ];
        
        if (eyeIndices.includes(index)) {
            return 'red';
        } else if (faceContourIndices.includes(index)) {
            return 'green';
        } else if (mouthIndices.includes(index)) {
            return 'blue';
        } else if (noseIndices.includes(index)) {
            return 'gold';
        } else {
            return 'gray';  // 其他点用灰色
        }
    }
    
    // 获取人脸化妆区域的三角形索引 - 基于GPUPixel实现
    getFaceMakeupIndices() {
        // 基于MediaPipe Face Mesh的化妆区域三角化索引
        // 参考 MediaPipe FACEMESH_LIPS, FACEMESH_LEFT_EYE, FACEMESH_RIGHT_EYE 等
        
        // 嘴唇区域三角化 - 基于FACEMESH_LIPS landmarks
        const lipIndices = [
            // 上唇外轮廓三角形
            61, 84, 17,    17, 314, 405,   405, 320, 375,   375, 321, 308,
            308, 324, 318, 318, 402, 317,  317, 14, 87,     87, 178, 88,
            88, 95, 78,    78, 191, 80,    80, 81, 82,      82, 13, 312,
            312, 311, 310, 310, 415, 308,
            
            // 下唇外轮廓三角形  
            61, 146, 91,   91, 181, 84,    84, 17, 314,     314, 405, 321,
            321, 375, 291, 291, 303, 267,  267, 269, 270,   270, 409, 415,
            415, 310, 311, 311, 312, 13,   13, 82, 81,      81, 80, 78,
            78, 95, 88,    88, 178, 87,    87, 14, 317,     317, 402, 318,
            
            // 内唇区域三角形
            78, 191, 80,   80, 81, 82,     82, 13, 312,     312, 311, 310,
            310, 415, 308, 61, 185, 40,    40, 39, 37,      37, 0, 267,
            267, 269, 270, 270, 409, 291
        ];
        
        // 左眼区域三角化 - 基于FACEMESH_LEFT_EYE landmarks  
        const leftEyeIndices = [
            263, 249, 390, 390, 373, 374,  374, 380, 381,   381, 382, 362,
            263, 466, 388, 388, 387, 386,  386, 385, 384,   384, 398, 362
        ];
        
        // 右眼区域三角化 - 基于FACEMESH_RIGHT_EYE landmarks
        const rightEyeIndices = [
            33, 7, 163,    163, 144, 145,  145, 153, 154,   154, 155, 133,
            33, 246, 161,  161, 160, 159,  159, 158, 157,   157, 173, 133
        ];
        
        // 左脸颊区域 - 基于FACEMESH_FACE_OVAL选取的脸颊部分
        const leftCheekIndices = [
            234, 127, 162, 162, 21, 54,    54, 103, 67,     67, 109, 10,
            127, 234, 93,  93, 132, 58,    58, 172, 136,    136, 150, 149
        ];
        
        // 右脸颊区域 - 基于FACEMESH_FACE_OVAL选取的脸颊部分  
        const rightCheekIndices = [
            454, 356, 389, 389, 251, 284,  284, 332, 297,   297, 338, 10,
            356, 454, 323, 323, 361, 288,  288, 397, 365,   365, 379, 378
        ];
        
        // 合并所有区域的索引
        return new Uint32Array([
            ...lipIndices,
            ...leftEyeIndices, 
            ...rightEyeIndices,
            ...leftCheekIndices,
            ...rightCheekIndices
        ]);
    }
    
    // 获取人脸化妆纹理坐标 - 基于MediaPipe Face Mesh landmarks
    getFaceMakeupTextureCoords() {
        // 基于MediaPipe 468个关键点的化妆纹理坐标映射
        // 这些坐标定义了化妆纹理在人脸各个区域的映射位置
        
        // 嘴唇区域纹理坐标 (对应FACEMESH_LIPS区域)
        const lipCoords = [
            // 上唇轮廓对应的纹理坐标
            0.3, 0.4, 0.32, 0.38, 0.34, 0.36, 0.36, 0.35, 0.38, 0.34,
            0.4, 0.33, 0.42, 0.32, 0.44, 0.31, 0.46, 0.3, 0.48, 0.29,
            0.5, 0.28, 0.52, 0.29, 0.54, 0.3, 0.56, 0.31, 0.58, 0.32,
            0.6, 0.33, 0.62, 0.34, 0.64, 0.35, 0.66, 0.36, 0.68, 0.38,
            0.7, 0.4,
            
            // 下唇轮廓对应的纹理坐标
            0.3, 0.6, 0.32, 0.62, 0.34, 0.64, 0.36, 0.65, 0.38, 0.66,
            0.4, 0.67, 0.42, 0.68, 0.44, 0.69, 0.46, 0.7, 0.48, 0.71,
            0.5, 0.72, 0.52, 0.71, 0.54, 0.7, 0.56, 0.69, 0.58, 0.68,
            0.6, 0.67, 0.62, 0.66, 0.64, 0.65, 0.66, 0.64, 0.68, 0.62,
            0.7, 0.6
        ];
        
        // 左眼区域纹理坐标 (对应FACEMESH_LEFT_EYE区域)  
        const leftEyeCoords = [
            0.2, 0.25, 0.22, 0.24, 0.24, 0.23, 0.26, 0.22, 0.28, 0.21,
            0.3, 0.2, 0.32, 0.21, 0.34, 0.22, 0.36, 0.23, 0.38, 0.24,
            0.4, 0.25, 0.38, 0.26, 0.36, 0.27, 0.34, 0.28, 0.32, 0.29,
            0.3, 0.3, 0.28, 0.29, 0.26, 0.28, 0.24, 0.27, 0.22, 0.26
        ];
        
        // 右眼区域纹理坐标 (对应FACEMESH_RIGHT_EYE区域)
        const rightEyeCoords = [
            0.6, 0.25, 0.62, 0.24, 0.64, 0.23, 0.66, 0.22, 0.68, 0.21,
            0.7, 0.2, 0.72, 0.21, 0.74, 0.22, 0.76, 0.23, 0.78, 0.24,
            0.8, 0.25, 0.78, 0.26, 0.76, 0.27, 0.74, 0.28, 0.72, 0.29,
            0.7, 0.3, 0.68, 0.29, 0.66, 0.28, 0.64, 0.27, 0.62, 0.26
        ];
        
        // 左脸颊区域纹理坐标
        const leftCheekCoords = [
            0.15, 0.4, 0.18, 0.42, 0.21, 0.44, 0.24, 0.46, 0.27, 0.48,
            0.3, 0.5, 0.27, 0.52, 0.24, 0.54, 0.21, 0.56, 0.18, 0.58,
            0.15, 0.6, 0.12, 0.58, 0.09, 0.56, 0.06, 0.54, 0.03, 0.52,
            0.0, 0.5, 0.03, 0.48, 0.06, 0.46, 0.09, 0.44, 0.12, 0.42
        ];
        
        // 右脸颊区域纹理坐标
        const rightCheekCoords = [
            0.85, 0.4, 0.82, 0.42, 0.79, 0.44, 0.76, 0.46, 0.73, 0.48,
            0.7, 0.5, 0.73, 0.52, 0.76, 0.54, 0.79, 0.56, 0.82, 0.58,
            0.85, 0.6, 0.88, 0.58, 0.91, 0.56, 0.94, 0.54, 0.97, 0.52,
            1.0, 0.5, 0.97, 0.48, 0.94, 0.46, 0.91, 0.44, 0.88, 0.42
        ];
        
        // 合并所有区域的纹理坐标
        return new Float32Array([
            ...lipCoords,
            ...leftEyeCoords,
            ...rightEyeCoords, 
            ...leftCheekCoords,
            ...rightCheekCoords
        ]);
    }
    
    // 加载化妆纹理
    async loadMakeupTextures() {
        try {
            // 这里可以加载实际的化妆纹理图片
            // 为了演示，我们创建简单的程序化纹理
            this.makeupTextures.lipstick = this.createLipstickTexture();
            this.makeupTextures.blush = this.createBlushTexture();
            this.makeupTextures.eyeshadow = this.createEyeshadowTexture();
            console.log('化妆纹理加载完成');
        } catch (error) {
            console.error('化妆纹理加载失败:', error);
        }
    }
    
    // 创建口红纹理 (程序化生成示例)
    createLipstickTexture() {
        const gl = this.gl;
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        // 生成红色渐变纹理
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;
                const intensity = Math.sin((x + y) / size * Math.PI) * 0.5 + 0.5;
                data[index] = 220 * intensity;     // R
                data[index + 1] = 20 * intensity;  // G  
                data[index + 2] = 60 * intensity;  // B
                data[index + 3] = 180 * intensity; // A
            }
        }
        
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    // 创建腮红纹理
    createBlushTexture() {
        const gl = this.gl;
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 3;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const intensity = Math.max(0, 1 - dist / radius);
                
                data[index] = 255 * intensity;     // R
                data[index + 1] = 180 * intensity; // G
                data[index + 2] = 180 * intensity; // B
                data[index + 3] = 120 * intensity; // A
            }
        }
        
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    // 创建眼影纹理
    createEyeshadowTexture() {
        const gl = this.gl;
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;
                const intensity = (1 - y / size) * 0.8;
                
                data[index] = 150 * intensity;     // R
                data[index + 1] = 100 * intensity; // G
                data[index + 2] = 200 * intensity; // B
                data[index + 3] = 100 * intensity; // A
            }
        }
        
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    // 渲染化妆效果 - 基于GPUPixel face_makeup_filter.cc实现
    renderFaceMakeup(inputTexture, landmarks, makeupType = 'all') {
        if (!this.faceLandmarks.length || !landmarks) {
            console.warn('No face landmarks available for makeup rendering');
            return;
        }

        const gl = this.gl;
        const program = this.programs.faceMakeup;

        gl.useProgram(program.program);

        // 设置基础图像纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(program.uniformLocations['u_image'], 0);

        // 获取面部三角网格索引和纹理坐标 (基于GPUPixel实现)
        const faceIndices = this.getFaceMakeupIndices();
        const faceTexCoords = this.getFaceMakeupTextureCoords();

        // 转换MediaPipe landmarks到GPUPixel格式 (归一化到[-1,1])
        const faceLandmarks = this.convertLandmarksToGPUPixelFormat(landmarks);

        // 设置面部关键点作为顶点位置属性
        if (!this.faceMakeupVertexBuffer) {
            this.faceMakeupVertexBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceMakeupVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(faceLandmarks), gl.DYNAMIC_DRAW);

        // 设置纹理坐标属性
        if (!this.faceMakeupTexCoordBuffer) {
            this.faceMakeupTexCoordBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceMakeupTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, faceTexCoords, gl.STATIC_DRAW);

        // 设置索引缓冲区
        if (!this.faceMakeupIndexBuffer) {
            this.faceMakeupIndexBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.faceMakeupIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW);

        // 根据化妆类型渲染不同效果
        this.renderMakeupType('lipstick', program, faceLandmarks.length / 2, faceIndices.length);
        this.renderMakeupType('eyeshadow', program, faceLandmarks.length / 2, faceIndices.length);
        this.renderMakeupType('blush', program, faceLandmarks.length / 2, faceIndices.length);
    }

    // 渲染特定化妆类型
    renderMakeupType(makeupType, program, vertexCount, indexCount) {
        const gl = this.gl;
        const params = this.makeupParams;

        // 检查是否需要渲染此类型
        const intensity = params[makeupType + 'Intensity'];
        if (intensity <= 0 || !this.makeupTextures[makeupType]) {
            return;
        }

        console.log(`渲染${makeupType}化妆效果，强度: ${intensity}`);

        // 设置化妆纹理
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.makeupTextures[makeupType]);
        gl.uniform1i(program.uniformLocations['u_makeupTexture'], 1);

        // 设置uniform参数
        gl.uniform1f(program.uniformLocations['u_intensity'], intensity);
        gl.uniform1i(program.uniformLocations['u_blendMode'], params[makeupType + 'BlendMode']);

        // 设置顶点属性 - 位置 (face landmarks)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceMakeupVertexBuffer);
        gl.enableVertexAttribArray(program.attributeLocations['a_position']);
        gl.vertexAttribPointer(program.attributeLocations['a_position'], 2, gl.FLOAT, false, 0, 0);

        // 设置顶点属性 - 纹理坐标
        gl.bindBuffer(gl.ARRAY_BUFFER, this.faceMakeupTexCoordBuffer);
        gl.enableVertexAttribArray(program.attributeLocations['a_texCoord']);
        gl.vertexAttribPointer(program.attributeLocations['a_texCoord'], 2, gl.FLOAT, false, 0, 0);

        // 使用索引绘制三角网格
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.faceMakeupIndexBuffer);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

        // 清理
        gl.disableVertexAttribArray(program.attributeLocations['a_position']);
        gl.disableVertexAttribArray(program.attributeLocations['a_texCoord']);
    }

    // 转换MediaPipe landmarks到GPUPixel格式
    convertLandmarksToGPUPixelFormat(landmarks) {
        // GPUPixel使用[-1,1]坐标系，MediaPipe使用[0,1]坐标系
        const converted = [];
        for (let i = 0; i < landmarks.length; i++) {
            // 转换到[-1,1]坐标系 (GPUPixel格式)
            converted.push(2.0 * landmarks[i].x - 1.0); // x坐标
            converted.push(2.0 * landmarks[i].y - 1.0); // y坐标
        }
        return converted;
    }
    
    applyWebGLBeautyEffects() {
        if (!this.gl || !this.originalCanvas || this.isProcessing || this.faceLandmarks.length === 0) {
            console.log('条件不满足，跳过美颜处理');
            return;
        }

        this.isProcessing = true;

        try {
            console.log('开始GPU美颜处理...');
            
            const gl = this.gl;
            const canvas = gl.canvas;
            
            // 调整WebGL画布尺寸匹配原图
            canvas.width = this.originalCanvas.width;
            canvas.height = this.originalCanvas.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            // 创建输入纹理
            const inputTexture = this.createTextureFromCanvas(this.originalCanvas);
            
            // 转换关键点到纹理坐标
            const landmarks = this.convertLandmarksToTextureCoords(this.faceLandmarks[0]);
            
            // 使用统一的美颜shader一次性渲染所有效果
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this.renderUnifiedBeautyEffects(inputTexture, landmarks);
            
            // 复制结果到显示画布
            this.copyToResultCanvas();
            
            // 清理资源
            gl.deleteTexture(inputTexture);
            
            console.log('GPU美颜处理完成');
            
        } catch (error) {
            console.error('GPU美颜处理失败:', error);
            this.showError(`美颜处理失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    createTextureFromCanvas(canvas) {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    createEmptyTexture(width, height) {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }
    
    createFramebuffer(texture) {
        const gl = this.gl;
        const framebuffer = gl.createFramebuffer();
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('帧缓冲区创建失败');
        }
        
        return framebuffer;
    }
    
    convertLandmarksToTextureCoords(landmarks) {
        const canvas = this.originalCanvas;
        return landmarks.map(point => ({
            x: point.x,  // MediaPipe已经是归一化坐标 [0,1]
            y: point.y,  // 保持原始Y坐标，不翻转
            z: point.z || 0
        }));
    }
    
    renderUnifiedBeautyEffects(inputTexture, landmarks) {
        const gl = this.gl;
        const program = this.programs.faceBeauty;
        
        console.log('=== 开始统一美颜渲染 ===');
        
        gl.useProgram(program.program);
        
        // 设置顶点属性
        this.setupVertexAttributes(program);
        
        // 绑定纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        
        // 安全设置uniform - 检查是否存在再设置
        const safeSetUniform = (name, setter) => {
            const location = program.uniformLocations[name];
            if (location !== null && location !== undefined) {
                setter(location);
            } else {
                console.warn(`Uniform ${name} 不存在或无法获取位置`);
            }
        };
        
        // 设置纹理uniform
        safeSetUniform('u_texture', (loc) => gl.uniform1i(loc, 0));
        
        // 设置人脸检测参数
        safeSetUniform('u_hasFace', (loc) => gl.uniform1i(loc, 1));
        const aspectRatio = this.originalCanvas.width / this.originalCanvas.height;
        safeSetUniform('u_aspectRatio', (loc) => gl.uniform1f(loc, aspectRatio));
        
        // 传递关键点数据
        const facePointsX = new Float32Array(468);
        const facePointsY = new Float32Array(468);
        for (let i = 0; i < Math.min(landmarks.length, 468); i++) {
            facePointsX[i] = landmarks[i].x;
            facePointsY[i] = landmarks[i].y;
        }
        
        // 传递关键点数组
        safeSetUniform('u_facePointsX', (loc) => gl.uniform1fv(loc, facePointsX));
        safeSetUniform('u_facePointsY', (loc) => gl.uniform1fv(loc, facePointsY));
        
        // 设置美颜参数
        safeSetUniform('u_thinFaceDelta', (loc) => gl.uniform1f(loc, this.beautyParams.faceSlim));
        safeSetUniform('u_bigEyeDelta', (loc) => gl.uniform1f(loc, this.beautyParams.eyeEnlarge));
        
        // 设置磨皮参数
        safeSetUniform('u_textureSize', (loc) => 
            gl.uniform2f(loc, this.originalCanvas.width, this.originalCanvas.height));
        safeSetUniform('u_smoothingLevel', (loc) => gl.uniform1f(loc, this.beautyParams.skinSmoothing));
        
        // 设置颜色调整参数
        safeSetUniform('u_brightness', (loc) => gl.uniform1f(loc, this.beautyParams.brightness));
        safeSetUniform('u_contrast', (loc) => gl.uniform1f(loc, this.beautyParams.contrast));
        safeSetUniform('u_saturation', (loc) => gl.uniform1f(loc, this.beautyParams.saturation));
        safeSetUniform('u_warmth', (loc) => gl.uniform1f(loc, this.beautyParams.warmth));
        
        // 调试输出
        console.log(`统一美颜参数:`);
        console.log(`- 瘦脸强度: ${this.beautyParams.faceSlim}`);
        console.log(`- 大眼强度: ${this.beautyParams.eyeEnlarge}`);
        console.log(`- 磨皮强度: ${this.beautyParams.skinSmoothing}`);
        console.log(`- 美白强度: ${this.beautyParams.brightness}`);
        console.log(`- 对比度: ${this.beautyParams.contrast}`);
        console.log(`- 饱和度: ${this.beautyParams.saturation}`);
        console.log(`- 暖色调: ${this.beautyParams.warmth}`);
        console.log(`- 关键点数量: ${landmarks.length}`);
        console.log(`- 宽高比: ${aspectRatio}`);
        
        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
        console.log('统一美颜渲染完成');
    }
    
    renderFaceReshape(inputTexture, landmarks) {
        const gl = this.gl;
        const program = this.programs.faceReshape;
        
        console.log('=== 开始面部变形渲染 ===');
        
        gl.useProgram(program.program);
        
        // 设置顶点属性
        this.setupVertexAttributes(program);
        
        // 绑定纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(program.uniformLocations['u_texture'], 0);
        
        // 设置人脸检测参数
        gl.uniform1i(program.uniformLocations['u_hasFace'], 1);
        const aspectRatio = this.originalCanvas.width / this.originalCanvas.height;
        gl.uniform1f(program.uniformLocations['u_aspectRatio'], aspectRatio);
        
        // 传递关键点数据
        const facePointsX = new Float32Array(468);
        const facePointsY = new Float32Array(468);
        for (let i = 0; i < Math.min(landmarks.length, 468); i++) {
            facePointsX[i] = landmarks[i].x;
            facePointsY[i] = landmarks[i].y;
        }
        
        // 调试输出 - 检查uniform位置和数据
        console.log('Uniform位置检查:');
        console.log('- u_facePointsX:', program.uniformLocations['u_facePointsX']);
        console.log('- u_facePointsY:', program.uniformLocations['u_facePointsY']);
        console.log('关键点数据样本:');
        console.log('- landmarks[33]:', landmarks[33] ? `(${landmarks[33].x}, ${landmarks[33].y})` : 'undefined');
        console.log('- facePointsX[33]:', facePointsX[33]);
        console.log('- facePointsY[33]:', facePointsY[33]);
        
        if (program.uniformLocations['u_facePointsX']) {
            gl.uniform1fv(program.uniformLocations['u_facePointsX'], facePointsX);
        } else {
            console.error('u_facePointsX uniform location not found!');
        }
        
        if (program.uniformLocations['u_facePointsY']) {
            gl.uniform1fv(program.uniformLocations['u_facePointsY'], facePointsY);
        } else {
            console.error('u_facePointsY uniform location not found!');
        }
        
        // 设置变形参数
        gl.uniform1f(program.uniformLocations['u_thinFaceDelta'], this.beautyParams.faceSlim);
        gl.uniform1f(program.uniformLocations['u_bigEyeDelta'], this.beautyParams.eyeEnlarge);
        
        // 调试输出 - 检查关键点
        console.log(`面部变形参数:`);
        console.log(`- 瘦脸强度: ${this.beautyParams.faceSlim}`);
        console.log(`- 大眼强度: ${this.beautyParams.eyeEnlarge}`);
        console.log(`- 宽高比: ${aspectRatio}`);
        console.log(`- 关键点数量: ${landmarks.length}`);
        
        // 检查关键眼部和脸颊点位
        if (landmarks.length >= 468) {
            const leftEye = [landmarks[33], landmarks[133], landmarks[160], landmarks[144]];
            const rightEye = [landmarks[362], landmarks[263], landmarks[385], landmarks[380]];
            const leftCheek = [landmarks[86], landmarks[68]];
            const rightCheek = [landmarks[316], landmarks[298]];
            
            console.log(`关键点检查:`);
            console.log(`- 左眼: (${leftEye[0].x.toFixed(3)}, ${leftEye[0].y.toFixed(3)}) 到 (${leftEye[1].x.toFixed(3)}, ${leftEye[1].y.toFixed(3)})`);
            console.log(`- 右眼: (${rightEye[0].x.toFixed(3)}, ${rightEye[0].y.toFixed(3)}) 到 (${rightEye[1].x.toFixed(3)}, ${rightEye[1].y.toFixed(3)})`);
            console.log(`- 左脸颊: (${leftCheek[0].x.toFixed(3)}, ${leftCheek[0].y.toFixed(3)})`);
            console.log(`- 右脸颊: (${rightCheek[0].x.toFixed(3)}, ${rightCheek[0].y.toFixed(3)})`);
        }
        
        // 检查WebGL错误
        let error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error('WebGL错误 (设置uniform前):', error);
        }
        
        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
        // 再次检查WebGL错误
        error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error('WebGL错误 (渲染后):', error);
        }
        
        console.log('=== 面部变形渲染完成 ===');
    }
    
    renderSkinSmoothing(inputTexture) {
        const gl = this.gl;
        const program = this.programs.skinSmoothing;
        
        gl.useProgram(program.program);
        
        // 设置顶点属性
        this.setupVertexAttributes(program);
        
        // 绑定纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(program.uniformLocations['u_texture'], 0);
        
        // 设置磨皮参数
        gl.uniform2f(program.uniformLocations['u_textureSize'], 
                     this.originalCanvas.width, this.originalCanvas.height);
        gl.uniform1f(program.uniformLocations['u_smoothingLevel'], this.beautyParams.skinSmoothing);
        
        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    
    renderColorAdjustment(inputTexture) {
        const gl = this.gl;
        const program = this.programs.colorAdjustment;
        
        gl.useProgram(program.program);
        
        // 设置顶点属性
        this.setupVertexAttributes(program);
        
        // 绑定纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(program.uniformLocations['u_texture'], 0);
        
        // 设置颜色调整参数
        gl.uniform1f(program.uniformLocations['u_brightness'], this.beautyParams.brightness);
        gl.uniform1f(program.uniformLocations['u_contrast'], this.beautyParams.contrast);
        gl.uniform1f(program.uniformLocations['u_saturation'], this.beautyParams.saturation);
        gl.uniform1f(program.uniformLocations['u_warmth'], this.beautyParams.warmth);
        
        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    
    setupVertexAttributes(program) {
        const gl = this.gl;
        
        // 绑定顶点缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        
        // 设置位置属性
        gl.enableVertexAttribArray(program.attributeLocations['a_position']);
        gl.vertexAttribPointer(program.attributeLocations['a_position'], 2, gl.FLOAT, false, 16, 0);
        
        // 设置纹理坐标属性
        gl.enableVertexAttribArray(program.attributeLocations['a_texCoord']);
        gl.vertexAttribPointer(program.attributeLocations['a_texCoord'], 2, gl.FLOAT, false, 16, 8);
    }
    
    copyToResultCanvas() {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas) return;
        
        const ctx = resultCanvas.getContext('2d');
        resultCanvas.width = this.originalCanvas.width;
        resultCanvas.height = this.originalCanvas.height;
        
        // 翻转WebGL画布到正确方向
        ctx.save();
        ctx.scale(1, -1);  // 垂直翻转
        ctx.translate(0, -resultCanvas.height);  // 平移到正确位置
        ctx.drawImage(this.gl.canvas, 0, 0);
        ctx.restore();
        
        this.resultCanvas = resultCanvas;
    }
    
    resetParameters() {
        this.beautyParams = {
            faceSlim: 0.02,       // 增强瘦脸效果
            eyeEnlarge: 0.4,     // 增强大眼效果
            skinSmoothing: 0.5,
            brightness: 0.2,
            contrast: 0.1,
            saturation: 0.15,
            warmth: 0.1
        };

        // 更新UI - 需要反向转换参数值到滑块值
        const controlMapping = {
            'skinSmoothing': 'skinSmoothing',
            'skinBrightening': 'brightness', 
            'skinWarmth': 'warmth',
            'eyeEnlarge': 'eyeEnlarge',
            'faceSlim': 'faceSlim',
            'contrast': 'contrast',
            'saturation': 'saturation'
        };
        
        Object.keys(controlMapping).forEach(controlId => {
            const paramKey = controlMapping[controlId];
            const slider = document.getElementById(controlId);
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider && valueDisplay) {
                let sliderValue;
                if (paramKey === 'faceSlim' || paramKey === 'eyeEnlarge' || paramKey === 'skinSmoothing') {
                    sliderValue = this.beautyParams[paramKey] * 100;
                } else {
                    sliderValue = (this.beautyParams[paramKey] + 1.0) * 50;
                }
                
                slider.value = sliderValue;
                valueDisplay.textContent = Math.round(sliderValue);
            }
        });

        // 重新应用效果
        this.applyWebGLBeautyEffects();
        this.showSuccess('参数已重置');
    }
    
    downloadResult() {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas || resultCanvas.width === 0 || resultCanvas.height === 0) {
            this.showError('请先上传图片并进行美颜处理！');
            return;
        }

        try {
            const link = document.createElement('a');
            link.download = `webgl_beauty_result_${Date.now()}.png`;
            link.href = resultCanvas.toDataURL('image/png', 0.9);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showSuccess('GPU美颜图片下载成功！');
        } catch (error) {
            console.error('下载失败:', error);
            this.showError('下载失败，请重试！');
        }
    }
    
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
                    <p>🚀 使用GPU Shader加速处理</p>
                    <p>✨ 准备进行高质量美颜处理</p>
                `;
            }
        } else {
            if (faceInfo) faceInfo.style.display = 'none';
        }
    }
    
    // UI方法
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
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
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

// 页面加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动WebGL美颜应用...');
    window.webglFaceBeautyApp = new WebGLFaceBeautyApp();
});
