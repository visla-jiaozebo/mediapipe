/**
 * WebGL Shader 美颜系统 - 基于GPU加速的高质量美颜处理
 * 参考 GPUPixel face_reshape_filter.cc 实现
 * 作者: AI Assistant
 * 功能: GPU shader 实现的瘦脸、大眼、磨皮效果
 */

// 导入样式文件
import './styles.css';

// 导入录制模块
import { VideoRecorder } from './video-recorder';
import type { RecordingOptions, RecordingCallbacks } from './video-recorder';

// 类型定义
export class BeautyParams {
    faceSlim: number;
    eyeEnlarge: number;
    skinSmoothing: number;
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;

    constructor() {
        this.faceSlim = 0.0;       // 瘦脸强度 [0.0, 1.0] - 匹配HTML默认值
        this.eyeEnlarge = 0.0;     // 大眼强度 [0.0, 1.0] - 匹配HTML默认值  
        this.skinSmoothing = 0;  // 磨皮强度 [0.0, 1.0] - 匹配HTML默认值
        this.brightness = 0.0;     // 美白强度（skinBrightening）[0.0, 1.0] - 匹配HTML默认值
        this.contrast = 0.0;       // 对比度 [-1.0, 1.0] - 匹配HTML默认值
        this.saturation = 0.0;    // 饱和度 [-1.0, 1.0] - 匹配HTML默认值
        this.warmth = 0.0;         // 暖色调 [-1.0, 1.0]
    }
}

interface MakeupParams {
    lipstickIntensity: number;
    blushIntensity: number;
    eyeshadowIntensity: number;
    lipstickBlendMode: number;
    blushBlendMode: number;
    eyeshadowBlendMode: number;
}

interface MakeupTextures {
    lipstick: WebGLTexture | null;
    blush: WebGLTexture | null;
    eyeshadow: WebGLTexture | null;
}

interface Landmark {
    x: number;
    y: number;
    z?: number;
}

interface ShaderProgramInfo {
    program: WebGLProgram;
    attributeLocations: {
        'a_position': number;
        'a_texCoord': number;
    };
    uniformLocations: { [key: string]: WebGLUniformLocation | null };
}

interface WebGLPrograms {
    faceBeauty?: ShaderProgramInfo;
    faceMakeup?: ShaderProgramInfo;
}

interface WebGLTextures {
    [key: string]: WebGLTexture;
}

interface WebGLFramebuffers {
    [key: string]: WebGLFramebuffer;
}



class WebGLFaceBeautyApp {
    private faceMesh: any = null;
    private originalImage: HTMLImageElement | null = null;
    private originalCanvas: HTMLCanvasElement | null = null;
    private resultCanvas: HTMLCanvasElement | null = null;
    private faceLandmarks: any[] = [];
    private isMediaPipeReady: boolean = false;
    private isProcessing: boolean = false;
    
    // WebGL相关
    private gl: WebGLRenderingContext | null = null;
    private programs: WebGLPrograms = {};
    private textures: WebGLTextures = {};
    private framebuffers: WebGLFramebuffers = {};
    private vertexBuffer: WebGLBuffer | null = null;
    private indexBuffer: WebGLBuffer | null = null;
    
    // 美颜参数
    private beautyParams: BeautyParams = new BeautyParams();
    
    // 化妆纹理
    private makeupTextures: MakeupTextures = {
        lipstick: null,
        blush: null,
        eyeshadow: null
    };

    // 化妆相关缓冲区
    private faceMakeupVertexBuffer: WebGLBuffer | null = null;
    private faceMakeupTexCoordBuffer: WebGLBuffer | null = null;
    private faceMakeupIndexBuffer: WebGLBuffer | null = null;
    
    // 录制相关
    private videoRecorder: VideoRecorder | null = null;
    
    constructor() {
        this.init();
    }
    
    private async init(): Promise<void> {
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
            this.showError('系统初始化失败，请刷新页面重试: ' + (error as Error).message);
            this.showLoading(false);
        }
    }

    private async loadShaderFile(url: string): Promise<string> {
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
    
    private createShaderProgram(vertexSource: string, fragmentSource: string): ShaderProgramInfo {
        if (!this.gl) {
            throw new Error('WebGL上下文未初始化');
        }
        
        const gl = this.gl;
        
        // 编译顶点着色器
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) throw new Error('创建顶点着色器失败');
        
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
        if (!fragmentShader) throw new Error('创建片段着色器失败');
        
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
        if (!program) throw new Error('创建着色器程序失败');
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            console.error('着色器程序链接失败:', error);
            throw new Error('着色器程序链接失败: ' + error);
        }
        
        // 获取属性和uniform位置
        const programInfo: ShaderProgramInfo = {
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
            if (!uniformInfo) continue;
            
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

    private async initializeWebGL(): Promise<void> {
        console.log('开始创建WebGL上下文...');
        // 创建隐藏的WebGL画布
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        document.body.appendChild(canvas);
        canvas.style.display = 'none';
        
        this.gl = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
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
    
    private setupGeometry(): void {
        if (!this.gl) return;
        
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

    private async initializeMediaPipe(): Promise<void> {
        try {
            if (typeof (window as any).FaceMesh === 'undefined') {
                throw new Error('MediaPipe FaceMesh未加载');
            }

            this.faceMesh = new (window as any).FaceMesh({
                locateFile: (file: string) => {
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
    
    private onFaceMeshResults(results: any): void {
        this.faceLandmarks = results.multiFaceLandmarks || [];
        this.updateFaceInfo();
        
        if (this.originalImage && !this.isProcessing && this.faceLandmarks.length > 0) {
            console.log(`检测到人脸，关键点数量: ${this.faceLandmarks[0].length}`);
            
            // 绘制原始关键点到canvas上进行验证
            this.drawLandmarksOnCanvas();
            
            this.applyWebGLBeautyEffects();
        }
    }
    
    private checkReadyState(): void {
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

    private async loadDemoImage(): Promise<void> {
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
                console.log('Demo图片加载失败，等待用户上传图片');
                this.showSuccess('✅ 系统就绪，请上传图片开始美颜处理！');
            };
            
            img.src = 'demo.png';
        } catch (error) {
            console.error('Demo图片加载失败:', error);
            this.showSuccess('✅ 系统就绪，请上传图片开始美颜处理！');
        }
    }

    private setupEventListeners(): void {
        // 文件上传事件
        const fileInput = document.getElementById('imageInput') as HTMLInputElement;
        const uploadArea = document.getElementById('uploadArea');
        
        if (fileInput && uploadArea) {
            // 点击上传区域触发文件选择
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            // 文件选择事件
            fileInput.addEventListener('change', (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files.length > 0) {
                    this.processImageFile(files[0]);
                }
            });
        }

        // 拖拽上传事件
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.processImageFile(files[0]);
                }
            });
        }

        // 美颜参数控制事件
        this.setupBeautyControls();
    }

    private setupBeautyControls(): void {
        // 美颜参数映射
        const controlMapping: { [key: string]: keyof BeautyParams } = {
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
            const slider = document.getElementById(controlId) as HTMLInputElement;
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider && valueDisplay) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat((e.target as HTMLInputElement).value);
                    valueDisplay.textContent = value.toString();
                    
                    // 直接使用滑块值（已经是正确范围）
                    this.beautyParams[paramKey] = value;
                    
                    // 实时应用效果
                    if (this.originalImage && this.faceLandmarks.length > 0) {
                        this.applyWebGLBeautyEffects();
                    }
                });
            }
        });

        // 重置按钮
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetParameters();
            });
        }

        // 录制按钮
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                this.handleRecordButtonClick();
            });
        }

        // 下载按钮
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadResult();
            });
        }
    }

    private async processImageFile(file: File): Promise<void> {
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
    
    private async displayOriginalImage(): Promise<void> {
        const canvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
        if (!canvas || !this.originalImage) {
            throw new Error('找不到原始图片画布或图片');
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法获取2D渲染上下文');
        
        // 设置画布尺寸 - 保持原始分辨率用于录制
        // 显示尺寸和实际分辨率分离
        const maxDisplayWidth = 400;
        const maxDisplayHeight = 300;
        const displayScale = Math.min(maxDisplayWidth / this.originalImage.width, maxDisplayHeight / this.originalImage.height);
        
        // 设置canvas实际分辨率为原始图片分辨率
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        
        // 设置canvas显示尺寸
        canvas.style.width = `${this.originalImage.width * displayScale}px`;
        canvas.style.height = `${this.originalImage.height * displayScale}px`;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.originalImage, 0, 0, canvas.width, canvas.height);
        this.originalCanvas = canvas;
    }
    
    private async detectFace(): Promise<void> {
        if (!this.faceMesh || !this.originalCanvas) return;

        try {
            await this.faceMesh.send({ image: this.originalCanvas });
        } catch (error) {
            console.error('人脸检测失败:', error);
            this.showError('人脸检测失败，请确保图片中包含清晰的人脸');
        }
    }

    private drawLandmarksOnCanvas(): void {
        if (true) return; // 调试模式下不绘制
        // ... 其余实现保持不变
    }

    private getLandmarkColor(index: number): string {
        // ... 实现保持不变，返回颜色字符串
        return '#ff0000'; // 简化实现
    }

    private applyWebGLBeautyEffects(): void {
        if (!this.gl || !this.originalCanvas || this.isProcessing || this.faceLandmarks.length === 0) {
            console.log('条件不满足，跳过美颜处理');
            return;
        }

        this.isProcessing = true;

        try {
            console.log('开始GPU美颜处理...');
            
            const gl = this.gl;
            const canvas = gl.canvas as HTMLCanvasElement;
            
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
            this.showError(`美颜处理失败: ${(error as Error).message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    private createTextureFromCanvas(canvas: HTMLCanvasElement): WebGLTexture {
        if (!this.gl) throw new Error('WebGL上下文未初始化');
        
        const gl = this.gl;
        const texture = gl.createTexture();
        if (!texture) throw new Error('创建纹理失败');
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }

    private convertLandmarksToTextureCoords(landmarks: any[]): Landmark[] {
        return landmarks.map(point => ({
            x: point.x,  // MediaPipe已经是归一化坐标 [0,1]
            y: point.y,  // 保持原始Y坐标，不翻转
            z: point.z || 0
        }));
    }

    private renderUnifiedBeautyEffects(inputTexture: WebGLTexture, landmarks: Landmark[]): void {
        if (!this.gl || !this.programs.faceBeauty || !this.originalCanvas) return;
        
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
        const safeSetUniform = (name: string, setter: (loc: WebGLUniformLocation) => void): void => {
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
        safeSetUniform('u_textureSize', (loc) => {
            if (this.originalCanvas) {
                gl.uniform2f(loc, this.originalCanvas.width, this.originalCanvas.height);
            }
        });
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

    private setupVertexAttributes(program: ShaderProgramInfo): void {
        if (!this.gl) return;
        
        const gl = this.gl;
        
        // 绑定顶点缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        
        // 设置位置属性 - 现在有完整的类型安全
        gl.enableVertexAttribArray(program.attributeLocations['a_position']);
        gl.vertexAttribPointer(program.attributeLocations['a_position'], 2, gl.FLOAT, false, 16, 0);
        
        // 设置纹理坐标属性 - 现在有完整的类型安全
        gl.enableVertexAttribArray(program.attributeLocations['a_texCoord']);
        gl.vertexAttribPointer(program.attributeLocations['a_texCoord'], 2, gl.FLOAT, false, 16, 8);
    }

    private copyToResultCanvas(): void {
        const resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
        if (!resultCanvas || !this.gl || !this.originalCanvas) return;
        
        const ctx = resultCanvas.getContext('2d');
        if (!ctx) return;
        
        // 设置resultCanvas与originalCanvas相同的配置
        // 实际分辨率保持原始图片大小
        resultCanvas.width = this.originalCanvas.width;
        resultCanvas.height = this.originalCanvas.height;
        
        // 设置显示尺寸与originalCanvas相同（通过CSS控制）
        resultCanvas.style.width = this.originalCanvas.style.width;
        resultCanvas.style.height = this.originalCanvas.style.height;
        
        // 翻转WebGL画布到正确方向
        ctx.save();
        ctx.scale(1, -1);  // 垂直翻转
        ctx.translate(0, -resultCanvas.height);  // 平移到正确位置
        ctx.drawImage(this.gl.canvas, 0, 0);
        ctx.restore();
        
        this.resultCanvas = resultCanvas;
    }

    private resetParameters(): void {
        this.beautyParams = new BeautyParams(); // 重置美颜参数

        // 更新UI - 需要反向转换参数值到滑块值
        const controlMapping: { [key: string]: keyof BeautyParams } = {
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
            const slider = document.getElementById(controlId) as HTMLInputElement;
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider && valueDisplay) {
                // 直接使用参数值（滑块已经是正确范围）
                const sliderValue = this.beautyParams[paramKey];
                
                slider.value = sliderValue.toString();
                valueDisplay.textContent = sliderValue.toString();
            }
        });

        // 重新应用效果
        this.applyWebGLBeautyEffects();
        this.showSuccess('参数已重置');
    }

    private downloadResult(): void {
        const resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
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

    /**
     * 处理录制按钮点击
     */
    private async handleRecordButtonClick(): Promise<void> {
        const resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
        const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
        
        if (!resultCanvas || resultCanvas.width === 0 || resultCanvas.height === 0) {
            this.showError('请先上传图片并进行美颜处理！');
            return;
        }
        
        if (!this.originalImage || this.faceLandmarks.length === 0) {
            this.showError('请确保已检测到人脸后再开始录制！');
            return;
        }
        
        try {
            // 初始化录制器
            if (!this.videoRecorder) {
                this.initializeVideoRecorder(resultCanvas);
            }
            
            if (this.videoRecorder?.getRecordingState()) {
                this.showError('正在录制中，请稍候...');
                return;
            }
            
            // 更新按钮状态
            this.updateRecordButtonState(recordBtn, 'recording');
            
            // 开始录制 - 现在使用原始canvas的完整分辨率
            await this.videoRecorder!.startRecording({
                duration: 5000,  // 5秒
                frameRate: 30,
                videoBitsPerSecond: 8000000 // 8Mbps高码率
            });
            
        } catch (error) {
            console.error('录制失败:', error);
            this.showError('录制失败: ' + (error as Error).message);
            this.updateRecordButtonState(recordBtn, 'idle');
        }
    }

    /**
     * 初始化视频录制器
     */
    private initializeVideoRecorder(canvas: HTMLCanvasElement): void {
        const callbacks: RecordingCallbacks = {
            onStart: () => {
                this.showSuccess('开始录制视频，5秒后自动停止...');
                console.log('录制开始');
            },
            
            onStop: () => {
                const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
                this.updateRecordButtonState(recordBtn, 'idle');
                this.showSuccess('🎉 视频录制并下载成功！');
                console.log('录制停止');
            },
            
            onError: (error: Error) => {
                console.error('录制错误:', error);
                this.showError('录制过程中发生错误: ' + error.message);
                const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
                this.updateRecordButtonState(recordBtn, 'idle');
            },
            
            onProgress: (progress: number) => {
                const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
                const percentage = Math.round(progress * 100);
                recordBtn.innerHTML = `🔴 录制中... ${percentage}%`;
            }
        };

        this.videoRecorder = new VideoRecorder(canvas, this.beautyParams, callbacks);
        
        // 监听参数变化事件，重新渲染美颜效果
        canvas.addEventListener('beautyParamsChanged', () => {
            if (this.originalImage && this.faceLandmarks.length > 0) {
                this.applyWebGLBeautyEffects();
            }
        });
        
        // 监听参数恢复事件，更新UI控件
        canvas.addEventListener('beautyParamsRestored', () => {
            this.updateControlsFromParams();
            if (this.originalImage && this.faceLandmarks.length > 0) {
                this.applyWebGLBeautyEffects();
            }
        });
    }

    /**
     * 更新录制按钮状态
     */
    private updateRecordButtonState(button: HTMLButtonElement, state: 'idle' | 'recording'): void {
        if (state === 'recording') {
            button.disabled = true;
            button.innerHTML = '🔴 录制中...';
            button.style.background = 'linear-gradient(45deg, #ff4757, #ff6b6b)';
            button.style.animation = 'recordingBlink 1s infinite';
        } else {
            button.disabled = false;
            button.innerHTML = '🎥 录制视频 (5秒)';
            button.style.background = 'linear-gradient(45deg, #ff6b6b, #feca57)';
            button.style.animation = 'recordPulse 2s infinite';
        }
    }

    /**
     * 根据当前参数更新UI控件
     */
    private updateControlsFromParams(): void {
        const controlMapping: { [key: string]: keyof BeautyParams } = {
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
            const slider = document.getElementById(controlId) as HTMLInputElement;
            const valueDisplay = document.getElementById(controlId + 'Value');
            
            if (slider && valueDisplay) {
                const currentValue = this.beautyParams[paramKey];
                slider.value = currentValue.toString();
                valueDisplay.textContent = currentValue.toString();
            }
        });
    }

    private updateFaceInfo(): void {
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
    private showLoading(show: boolean, message: string = '正在加载...'): void {
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

    private showSuccess(message: string): void {
        this.showMessage(message, 'success');
    }

    private showError(message: string): void {
        this.showMessage(message, 'error');
    }

    private showMessage(message: string, type: 'success' | 'error'): void {
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

    /**
     * 清理资源
     */
    public dispose(): void {
        // 清理录制器
        if (this.videoRecorder) {
            this.videoRecorder.dispose();
            this.videoRecorder = null;
        }

        // 清理WebGL资源
        if (this.gl) {
            const gl = this.gl;
            
            // 清理纹理
            Object.values(this.textures).forEach(texture => {
                if (texture) gl.deleteTexture(texture);
            });
            
            // 清理帧缓冲
            Object.values(this.framebuffers).forEach(framebuffer => {
                if (framebuffer) gl.deleteFramebuffer(framebuffer);
            });
            
            // 清理缓冲区
            if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
            if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
            if (this.faceMakeupVertexBuffer) gl.deleteBuffer(this.faceMakeupVertexBuffer);
            if (this.faceMakeupTexCoordBuffer) gl.deleteBuffer(this.faceMakeupTexCoordBuffer);
            if (this.faceMakeupIndexBuffer) gl.deleteBuffer(this.faceMakeupIndexBuffer);
            
            // 清理程序
            Object.values(this.programs).forEach(programInfo => {
                if (programInfo?.program) gl.deleteProgram(programInfo.program);
            });
        }

        // 清理MediaPipe
        if (this.faceMesh) {
            this.faceMesh.close();
            this.faceMesh = null;
        }

        console.log('资源清理完成');
    }
}

// 页面加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动WebGL美颜应用...');
    (window as any).webglFaceBeautyApp = new WebGLFaceBeautyApp();
});
