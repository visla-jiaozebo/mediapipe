/**
 * WebGL Shader 美颜系统 - 基于GPU加速的高质量美颜处理
 * 参考 GPUPixel face_reshape_filter.cc 实现
 * 作者: AI Assistant
 * 功能: GPU shader 实现的瘦脸、大眼、磨皮效果
 */

// 导入样式文件
import { OBJParser } from './obj-parser';
import './styles.css';

// 导入录制模块
import { VideoRecorder } from './video-recorder';
import type { RecordingOptions, RecordingCallbacks } from './video-recorder';
import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import standard_landmarks, { StandardFaceLandmark } from './standard_face'; // 导入标准人脸标志点

// 类型定义
export class BeautyParams {
    faceSlim: number;
    eyeEnlarge: number;
    skinSmoothing: number;
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;

    // 唇部化妆参数
    lipstickIntensity: number;
    lipstickBlendMode: number;
    blushIntensity: number;
    eyeshadowIntensity: number;
    blushBlendMode: number;
    eyeshadowBlendMode: number;

    constructor() {
        this.faceSlim = 0.0;       // 瘦脸强度 [0.0, 1.0] - 匹配HTML默认值
        this.eyeEnlarge = 0.0;     // 大眼强度 [0.0, 1.0] - 匹配HTML默认值  
        this.skinSmoothing = 0.5;  // 磨皮强度 [0.0, 1.0] - 匹配HTML默认值
        this.brightness = 0.0;     // 美白强度（skinBrightening）[0.0, 1.0] - 匹配HTML默认值
        this.contrast = 0.0;       // 对比度 [-1.0, 1.0] - 匹配HTML默认值
        this.saturation = 0.0;    // 饱和度 [-1.0, 1.0] - 匹配HTML默认值
        this.warmth = 0.0;         // 暖色调 [-1.0, 1.0]

        // 唇部化妆默认值
        this.lipstickIntensity = 0.8;   // 唇膏强度 [0.0, 1.0]
        this.lipstickBlendMode = 15;   //

        this.blushIntensity = 0;     // 混合模式: 0=正常, 1=叠加, 2=柔光
        this.blushBlendMode = 0;      // 腮红混合模式: 0=正常, 1=叠加, 2=柔光

        this.eyeshadowIntensity = 0; // 混合模式: 0=正常, 1=叠加, 2=柔光
        this.eyeshadowBlendMode = 0;  // 眼影混合模式: 0=正常, 1=叠加, 2=柔光
    }
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
    originalPicture?: ShaderProgramInfo;
    faceBeauty?: ShaderProgramInfo;
    lipMakeup?: ShaderProgramInfo;  // 专门的唇部化妆shader
}

interface WebGLTextures {
    [key: string]: WebGLTexture;
}

interface WebGLFramebuffers {
    [key: string]: WebGLFramebuffer;
}



class WebGLFaceBeautyApp {

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

    // 唇部纹理
    private lipTexture: WebGLTexture | null = null;

    // 唇部变换矩阵
    private lipTransformMatrix: Float32Array | null = null;

    // 化妆相关缓冲区
    private faceMakeupVertexBuffer: WebGLBuffer | null = null;
    private faceMakeupTexCoordBuffer: WebGLBuffer | null = null;
    private faceMakeupIndexBuffer: WebGLBuffer | null = null;

    // 唇部三角形渲染
    private lipVertexBuffer: WebGLBuffer | null = null;
    private lipTexCoordBuffer: WebGLBuffer | null = null;
    private lipIndexBuffer: WebGLBuffer | null = null;
    private lipTriangles: number[] = [];

    // 录制相关
    private videoRecorder: VideoRecorder | null = null;
    private faceLandmarker: FaceLandmarker | null = null;
    private standardLandmarks: StandardFaceLandmark | null = null;

    // 相机相关
    private videoElement: HTMLVideoElement | null = null;
    private cameraStream: MediaStream | null = null;
    private animationFrameId: number | null = null;
    private isCameraActive: boolean = false;

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        this.showLoading(true, '正在初始化GPU美颜系统...');
        this.setupEventListeners();

        try {
            this.standardLandmarks = standard_landmarks;
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

    private async createShaderProgramWithPath(vertPath: string, fragmentPath: string): Promise<ShaderProgramInfo> {
        const vertexShaderSource = await this.loadShaderFile(vertPath);
        const fragmentShaderSource = await this.loadShaderFile(fragmentPath);
        return this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
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
        // original-picture
        this.programs.originalPicture = await this.createShaderProgramWithPath('gl/original-picture.vert', 'gl/original-picture.frag');
        this.programs.faceBeauty = await this.createShaderProgramWithPath('gl/facebeauty.vert', 'gl/facebeauty.frag');
        this.programs.lipMakeup = await this.createShaderProgramWithPath('gl/lip-makeup.vert', 'gl/lip-makeup.frag');
        console.log('shader编译成功');
    }

    /**
     * 创建全局尺寸的唇部纹理，将mouth.png映射到lipArea区域
     */
    private async createGlobalLipTexture(landmarks: Landmark[]): Promise<void> {
        if (!this.gl || !this.originalCanvas) return;

        const gl = this.gl;

        // 计算唇部区域
        const lipArea = {
            left: landmarks[57].x,
            top: 1 - landmarks[37].y,
            right: landmarks[287].x,
            bottom: 1 - landmarks[17].y
        };

        console.log('唇部区域:', lipArea);

        const mouthImage = await this.loadMouthImage();

        if (mouthImage) {
            const width = this.originalCanvas.width;
            const height = this.originalCanvas.height;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');

            if (tempCtx) {
                // 🔥 关键修复：翻转Canvas坐标系使其与WebGL一致
                tempCtx.save();
                tempCtx.scale(1, -1);           // Y轴翻转
                tempCtx.translate(0, -height);  // 平移到正确位置

                // 计算在画布上的像素位置（注意现在Y轴已翻转）
                const lipPixelArea = {
                    left: Math.floor(lipArea.left * width),
                    top: Math.floor((1.0 - lipArea.bottom) * height), // 翻转Y坐标
                    right: Math.ceil(lipArea.right * width),
                    bottom: Math.ceil((1.0 - lipArea.top) * height)   // 翻转Y坐标
                };

                const lipWidth = lipPixelArea.right - lipPixelArea.left;
                const lipHeight = lipPixelArea.bottom - lipPixelArea.top;

                console.log('翻转后的唇部像素区域:', lipPixelArea, `尺寸: ${lipWidth}x${lipHeight}`);

                // 将mouth.png绘制到唇部区域
                tempCtx.drawImage(
                    mouthImage,
                    0, 0, mouthImage.width, mouthImage.height,  // 源图像
                    lipPixelArea.left, lipPixelArea.top,        // 目标位置
                    lipWidth, lipHeight                         // 目标尺寸
                );

                tempCtx.restore(); // 恢复坐标系

                // 直接从canvas创建WebGL纹理
                const globalTexture = this.createTextureFromCanvas(tempCanvas);

                // 清理旧的唇部纹理
                if (this.lipTexture) {
                    gl.deleteTexture(this.lipTexture);
                }

                this.lipTexture = globalTexture;
                console.log('Y轴修正的全局唇部纹理创建成功');
                this.debugShowGlobalLipTexture(tempCanvas);
            }
        }
    }
    lipImage: HTMLImageElement | null = null;
    private async loadMouthImage(): Promise<HTMLImageElement | null> {
        if (this.lipImage) return this.lipImage;

        this.lipImage = await new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';

            image.onload = () => {
                console.log('mouth.png加载成功:', image.width, 'x', image.height);
                resolve(image);
            };

            image.onerror = (e) => {
                console.warn('无法加载 gl/mouth.png:', e);
                resolve(null);
            };

            image.src = 'gl/mouth.png';
        });
        return this.lipImage;
    }

    private async createDefaultLipTexture(): Promise<void> {
        if (!this.gl) return;

        const gl = this.gl;
        // 加载 gl/mouth.png 图片文件
        const image = new Image();
        image.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
            image.onload = () => {
                // 创建纹理
                // 
                this.lipTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.lipTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                console.log('唇部纹理从 gl/mouth.png 加载完成');
                resolve();
            };

            image.onerror = (e) => {
                console.warn('无法加载 gl/mouth.');
                reject(e);
            };
            if (!this.standardLandmarks?.path) {
                throw new Error('Error to load standard landmarks');
            }
            image.src = this.standardLandmarks?.path;
        });
    }

    private createFallbackLipTexture(): void {
        if (!this.gl) return;

        const gl = this.gl;

        // 创建一个简单的红色渐变纹理作为备用唇膏
        const size = 64;
        const data = new Uint8Array(size * size * 4);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;

                // 创建径向渐变效果
                const centerX = size / 2;
                const centerY = size / 2;
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const maxDistance = size / 2;
                const intensity = Math.max(0, 1 - (distance / maxDistance));

                // 红色唇膏颜色 (RGB: 200, 50, 50)
                data[index] = Math.floor(200 * intensity);     // R
                data[index + 1] = Math.floor(50 * intensity);  // G
                data[index + 2] = Math.floor(50 * intensity);  // B
                data[index + 3] = Math.floor(255 * intensity); // A
            }
        }

        // 创建纹理
        this.lipTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.lipTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        console.log('备用唇部纹理创建完成');
    }
    /**
     * 调试方法：显示全局唇部纹理
     */
    private debugShowGlobalLipTexture(tempCanvas: HTMLCanvasElement): void {
        // 移除之前的调试canvas
        const existingDebugCanvas = document.getElementById('debug-lip-texture');
        if (existingDebugCanvas) {
            existingDebugCanvas.remove();
        }

        // 创建调试显示canvas
        const debugCanvas = document.createElement('canvas');
        debugCanvas.id = 'debug-lip-texture';
        debugCanvas.width = tempCanvas.width;
        debugCanvas.height = tempCanvas.height;
        debugCanvas.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 200px;
        height: 300px;
        border: 2px solid #ff6b6b;
        z-index: 9999;
        background: white;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;

        const debugCtx = debugCanvas.getContext('2d');
        if (debugCtx) {
            // 复制全局纹理内容
            debugCtx.drawImage(tempCanvas, 0, 0);

            // 添加标题
            debugCtx.fillStyle = 'red';
            debugCtx.font = '12px Arial';
            debugCtx.fillText('Global Lip Texture', 5, 15);
        }

        document.body.appendChild(debugCanvas);

        // 添加点击事件来隐藏/显示
        debugCanvas.addEventListener('click', () => {
            debugCanvas.style.display = debugCanvas.style.display === 'none' ? 'block' : 'none';
        });

        console.log('调试纹理已显示在页面右上角');
    }
    /**
     * MediaPipe Face Mesh 唇部三角形索引
     * 基于FACEMESH_LIPS的三角形定义
     */
    private getLipTriangleIndices(): number[] {
        // MediaPipe Face Mesh 唇部区域的三角形索引
        // 这些三角形覆盖整个唇部区域

        /**
FACEMESH_LIPS = frozenset([(61, 146), (146, 91), (91, 181), (181, 84), (84, 17),
                           (17, 314), (314, 405), (405, 321), (321, 375),
                           (375, 291), (61, 185), (185, 40), (40, 39), (39, 37),
                           (37, 0), (0, 267),
                           (267, 269), (269, 270), (270, 409), (409, 291),
                           (78, 95), (95, 88), (88, 178), (178, 87), (87, 14),
                           (14, 317), (317, 402), (402, 318), (318, 324),
                           (324, 308), (78, 191), (191, 80), (80, 81), (81, 82),
                           (82, 13), (13, 312), (312, 311), (311, 310),
                           (310, 415), (415, 308)])
         */
        let a = [
            // 下唇:
            61, 146, 95,
            146, 95, 91,
            95, 91, 88,
            91, 88, 181,
            88, 181, 178,
            181, 178, 84,
            178, 84, 87,
            84, 87, 17,
            87, 17, 14,
            17, 14, 314,
            14, 314, 317,
            314, 317, 405,
            317, 405, 402,
            405, 402, 321,
            402, 321, 318,
            321, 318, 375,
            318, 375, 324,
            375, 324, 308,
            324, 308, 291,
            308, 291, 375,
            // 上唇:
            308, 291, 409,
            291, 409, 415,
            409, 415, 270,
            415, 270, 310,
            270, 310, 269,
            310, 269, 311,
            269, 311, 267,
            311, 267, 312,
            267, 312, 0,
            312, 0, 13,
            0, 13, 37,
            13, 37, 82,
            37, 82, 39,
            82, 39, 81,
            39, 81, 40,
            81, 40, 80,
            40, 80, 185,
            80, 185, 191,
            185, 191, 78,
            191, 78, 61,
            78, 61, 185
        ];
        let a1 = [
            // 下唇:
            61, 146, 95, 91, 88, 181, 178, 84, 87, 17, 14, 314, 317, 405, 402, 321, 318, 375, 324, 308, 291, 375,
            // 上唇:
            308, 291, 409, 415, 270, 310, 269, 311, 267, 312, 0, 13, 37, 82, 39, 81, 40, 80, 185, 191, 78, 61, 185
        ];
        // {left:landmarks[57].x,top:landmarks[37].y,right:landmarks[287].x,bottom:landmarks[17].y};
        let a2 = [
            // 下唇:
            57, 61, 146,
            61, 146, 95,
            146, 95, 91,
            95, 91, 88,
            91, 88, 181,
            88, 181, 178,
            181, 178, 84,
            178, 84, 87,
            84, 87, 17,
            87, 17, 14,
            17, 14, 314,
            14, 314, 317,
            314, 317, 405,
            317, 405, 402,
            405, 402, 321,
            402, 321, 318,
            321, 318, 375,
            318, 375, 324,
            375, 324, 308,
            324, 308, 291,
            308, 291, 375,
            291, 375, 287,
            // 上唇:
            287, 409, 291,
            409, 291, 408,
            291, 408, 292,
            408, 292, 308,
            292, 308, 409,
            308, 409, 415,
            409, 415, 270,
            415, 270, 310,
            270, 310, 269,
            310, 269, 311,
            269, 311, 267,
            311, 267, 312,
            267, 312, 0,
            312, 0, 13,
            0, 13, 37,
            13, 37, 82,
            37, 82, 39,
            82, 39, 81,
            39, 81, 40,
            81, 40, 80,
            40, 80, 185,
            80, 185, 191,
            185, 191, 78,
            191, 78, 61,
            78, 61, 185,
            61, 185, 57
        ];
        // full lip
        a = [
            57, 61, 40, 41, 37, 12, 37, 0,  12, 267, 271, 270, 287, 291, 321, 402, 314, 14,  17, 178, 181, 91, 178, 61, 57
        ]
        // left right drop some
        a = [
            61, 40, 41, 37, 12, 37, 0,  12, 267, 271, 270, 291, 321, 402, 314, 14, 17, 178, 181, 91, 178, 61
        ]
        // middle
        a2 = [
            61, 74, 41, 72, 12, 72, 11,  12, 302, 271, 304, 291, 320, 402, 315, 14,  16, 178, 180, 90, 178, 61
        ]
        let a3 = []
        for (let i = 0; i < a.length - 2; i++) {
            a3.push(a[i], a[i + 1], a[i + 2]);
        }
        a = a3;
        a = [
            61, 40, 41, 
            40, 41, 37,
            41, 37, 12,
            37, 12, 0,
            12, 0, 267,
            12, 267,271,
            267,271,270,
            271,270,291,
            291, 321, 402, 
            321, 402, 314, 
            402, 314, 14,   
            314, 14, 17,
            17, 178,14, 
            17, 178, 181, 
            178, 181, 91,
            91, 178, 61,
        ]
        a = [
            61, 40, 41, 
            40, 41, 37,
            41, 37, 12,
            37, 12, 0,
            12, 0, 271,
            0, 271, 267,
            271, 267,291,
            267,291,270,

            61,91,178,
            91,178,181,
            178,181,14,
            181,14,17,
            14,17,402,
            17,402,314,
            402,314,291,
            314,291,321,
        ]
        return a
    }

    private getLipTexCoords(): number[] {
        // upper_lip_points = {
        let map = new Map<number, number[]>()
        map.set(84, [0.1638784000000002, 0.29671928358209004])
        map.set(85, [0.2963254857142857, 0.24026173134328344])
        map.set(96, [0.2006058666666667, 0.31260656716417884])
        map.set(96, [0.2006058666666667, 0.31260656716417884])
        map.set(97, [0.3623978666666664, 0.323534328358209])
        map.set(97, [0.3623978666666664, 0.323534328358209])
        map.set(85, [0.2963254857142857, 0.24026173134328344])
        map.set(86, [0.4324199619047622, 0.2132556417910442])
        map.set(98, [0.5238095238095238, 0.3453745671641797])
        map.set(86, [0.4324199619047622, 0.2132556417910442])
        map.set(98, [0.5238095238095238, 0.3453745671641797])
        map.set(87, [0.5238095238095238, 0.22763749253731339])
        map.set(87, [0.5238095238095238, 0.22763749253731339])
        map.set(98, [0.5238095238095238, 0.3453745671641797])
        map.set(88, [0.6151990857142859, 0.2132556417910442])
        map.set(88, [0.6151990857142859, 0.2132556417910442])
        map.set(99, [0.6852211809523808, 0.323534328358209])
        map.set(99, [0.6852211809523808, 0.323534328358209])
        map.set(89, [0.7512935619047619, 0.24026173134328344])
        map.set(89, [0.7512935619047619, 0.24026173134328344])
        map.set(100, [0.847013180952381, 0.31260656716417884])
        map.set(100, [0.847013180952381, 0.31260656716417884])
        map.set(90, [0.8837406476190478, 0.29671928358209004])
        map.set(90, [0.8837406476190478, 0.29671928358209004])
        map.set(100, [0.847013180952381, 0.31260656716417884])
        map.set(91, [0.7995288380952383, 0.5020924179104481])
        map.set(100, [0.847013180952381, 0.31260656716417884])
        map.set(91, [0.7995288380952383, 0.5020924179104481])
        map.set(101, [0.692691504761905, 0.42818865671641837])
        map.set(101, [0.692691504761905, 0.42818865671641837])
        map.set(91, [0.7995288380952383, 0.5020924179104481])
        map.set(92, [0.6765318095238096, 0.6494337910447763])
        map.set(102, [0.5238095238095238, 0.4698593432835817])
        map.set(102, [0.5238095238095238, 0.4698593432835817])
        map.set(92, [0.6765318095238096, 0.6494337910447763])
        map.set(93, [0.5238095238095238, 0.6894691343283583])
        map.set(102, [0.5238095238095238, 0.4698593432835817])
        map.set(93, [0.5238095238095238, 0.6894691343283583])
        map.set(94, [0.371087238095238, 0.6494337910447763])
        map.set(102, [0.5238095238095238, 0.4698593432835817])
        map.set(94, [0.371087238095238, 0.6494337910447763])
        map.set(103, [0.354927542857143, 0.42818865671641837])
        map.set(103, [0.354927542857143, 0.42818865671641837])
        map.set(94, [0.371087238095238, 0.6494337910447763])
        map.set(95, [0.24809020952380967, 0.5020924179104481])
        map.set(96, [0.2006058666666667, 0.31260656716417884])
        map.set(96, [0.2006058666666667, 0.31260656716417884])
        map.set(95, [0.24809020952380967, 0.5020924179104481])
        map.set(84, [0.1638784000000002, 0.29671928358209004])

        let idx_map = new Map<number, number>()
        let a = [
            61, 40, 41, 37, 12, 37, 0,  12, 267, 271, 270, 291, 321, 402, 314, 14, 17, 178, 181, 91, 178, 61
        ]
        let a2 = [
            96, 85, 97, 87, 98, 86, 87, 98, 88, 99,  89,  100, 91,  101,  92, 102, 93, 103,  94, 95, 103, 96
        ]
        for (let i = 0; i < a2.length; i++) {
            idx_map.set(a[i], a2[i]);
        }
        a2 = []
        a = this.getLipTriangleIndices();
        for (let i = 0; i < a.length; i++) {
            if (!idx_map.has(a[i])) {
                console.warn(`唇部纹理坐标缺失: ${a[i]}`);
                continue;
            }
            a2.push(idx_map.get(a[i])!);
        }
        let a3 = []
        for (let i = 0; i < a2.length - 2; i++) {
            let v0 = map.get(a2[i]);
            let v1 = map.get(a2[i + 1]);
            let v2 = map.get(a2[i + 2]);
            if (!v0 || !v1 || !v2) {
                console.warn(`唇部纹理坐标缺失: ${a2[i]}, ${a2[i + 1]}, ${a2[i + 2]}`);
                continue;
            }
            a3.push(v0[0], v0[1], v1[0], v1[1], v2[0], v2[1]);
        }
        return a3
    }

    /**
     * 使用变换矩阵变换点
     */
    private transformPoint(x: number, y: number, matrix: Float32Array): { x: number, y: number } {
        // 矩阵乘法: [x y 1] * matrix
        const transformedX = x * matrix[0] + y * matrix[3] + matrix[6];
        const transformedY = x * matrix[1] + y * matrix[4] + matrix[7];

        return { x: transformedX, y: transformedY };
    }

    private async initializeMediaPipe(): Promise<void> {
        try {
            if (typeof (window as any).FaceMesh === 'undefined') {
                throw new Error('MediaPipe FaceMesh未加载');
            }
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );

            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "res/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                outputFaceBlendshapes: false,

                outputFacialTransformationMatrixes: true,
                runningMode: "IMAGE",
                numFaces: 1,
            });

            let options = {
                useCpuInference: { type: 0, graphOptionXref: { calculatorType: "InferenceCalculator", fieldName: "use_cpu_inference" }, default: "iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";").includes(navigator.platform) || navigator.userAgent.includes("Mac") && "ontouchend" in document },
                enableFaceGeometry: {
                    type: 0, graphOptionXref: {
                        calculatorName: "EnableFaceGeometryConstant", calculatorType: "ConstantSidePacketCalculator",
                        fieldName: "bool_value"
                    }
                },
                selfieMode: { type: 0, graphOptionXref: { calculatorType: "GlScalerCalculator", calculatorIndex: 1, fieldName: "flip_horizontal" } }, maxNumFaces: { type: 1, graphOptionXref: { calculatorType: "ConstantSidePacketCalculator", calculatorName: "ConstantSidePacketCalculatorNumFaces", fieldName: "int_value" } },
                refineLandmarks: { type: 0, graphOptionXref: { calculatorType: "ConstantSidePacketCalculator", calculatorName: "ConstantSidePacketCalculatorRefineLandmarks", fieldName: "bool_value" } }, minDetectionConfidence: {
                    type: 1,
                    graphOptionXref: { calculatorType: "TensorsToDetectionsCalculator", calculatorName: "facelandmarkfrontgpu__facedetectionshortrangegpu__facedetectionshortrangecommon__TensorsToDetectionsCalculator", fieldName: "min_score_thresh" }
                }, minTrackingConfidence: { type: 1, graphOptionXref: { calculatorType: "ThresholdingCalculator", calculatorName: "facelandmarkfrontgpu__facelandmarkgpu__ThresholdingCalculator", fieldName: "threshold" } }, cameraNear: {
                    type: 1, graphOptionXref: {
                        calculatorType: "FaceGeometryEnvGeneratorCalculator",
                        fieldName: "near"
                    }
                }, cameraFar: { type: 1, graphOptionXref: { calculatorType: "FaceGeometryEnvGeneratorCalculator", fieldName: "far" } }, cameraVerticalFovDegrees: { type: 1, graphOptionXref: { calculatorType: "FaceGeometryEnvGeneratorCalculator", fieldName: "vertical_fov_degrees" } }
            };

            // this.faceMesh.setOptions({
            //     maxNumFaces: 1,
            //     refineLandmarks: false,
            //     minDetectionConfidence: 0.5,
            //     minTrackingConfidence: 0.5,
            //     enableFaceGeometry: true
            // });

            // this.faceMesh.onResults(this.onFaceMeshResults.bind(this));
            this.isMediaPipeReady = true;
            console.log('MediaPipe初始化完成');
        } catch (error) {
            console.error('MediaPipe初始化失败:', error);
            throw error;
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
            'saturation': 'saturation',
            'lipstickIntensity': 'lipstickIntensity',
            'blushIntensity': 'blushIntensity',
            'eyeshadowIntensity': 'eyeshadowIntensity'
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

        // 唇膏混合模式控件
        const lipstickBlendModeSelect = document.getElementById('lipstickBlendMode') as HTMLSelectElement;
        if (lipstickBlendModeSelect) {
            lipstickBlendModeSelect.addEventListener('change', (e) => {
                const value = parseInt((e.target as HTMLSelectElement).value);
                this.beautyParams.lipstickBlendMode = value;

                // 实时应用效果
                if (this.originalImage && this.faceLandmarks.length > 0) {
                    this.applyWebGLBeautyEffects();
                }
            });
        }

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

        // 相机控制按钮
        const startCameraBtn = document.getElementById('startCameraBtn');
        const stopCameraBtn = document.getElementById('stopCameraBtn');
        
        if (startCameraBtn) {
            startCameraBtn.addEventListener('click', () => {
                this.startCamera();
            });
        }
        
        if (stopCameraBtn) {
            stopCameraBtn.addEventListener('click', () => {
                this.stopCamera();
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
        let results = this.faceLandmarker?.detect(this.originalImage!);
        if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
            console.warn('未检测到人脸或人脸关键点');
            this.showError('未检测到人脸，请上传包含人脸的图片');
            return;
        }
        this.faceLandmarks = results.faceLandmarks;
        this.updateFaceInfo();

        // 创建默认唇部纹理
        console.log('创建默认唇部纹理...');
        await this.createDefaultLipTexture();

        if (this.originalImage && !this.isProcessing && this.faceLandmarks.length > 0) {
            console.log(`检测到人脸，关键点数量: ${this.faceLandmarks[0].length}`);
            console.log(this.faceLandmarks[0]);

            // 绘制原始关键点到canvas上进行验证
            // this.drawLandmarksOnCanvas();

            this.applyWebGLBeautyEffects();
        }
    }

    private drawLandmarksOnCanvas(): void {
        // 将唇部关键点绘制到原始画布上
        if (!this.originalCanvas || !this.gl || this.faceLandmarks.length === 0) {
            console.warn('无法绘制关键点，条件不满足');
            return;
        }
        const ctx = this.originalCanvas.getContext('2d');
        if (!ctx) {
            console.warn('无法获取2D上下文');
            return;
        }
        // ctx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const landmarks = this.faceLandmarks[0];
        let lips_points = new Set<number>();
        let lips_indices = this.getLipTriangleIndices();
        for (let i = 0; i < lips_indices.length; i++) {
            lips_points.add(lips_indices[i]);
        }
        for (let i = 0; i < landmarks.length; i++) {
            if (!lips_points.has(i)) {
                // 绘制唇部关键点
                continue
            }
            const landmark = landmarks[i];
            if (landmark) {
                ctx.fillStyle = '#ff0000';
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.strokeText(`${i}`, landmark.x * this.originalCanvas.width, landmark.y * this.originalCanvas.height - 5);
                ctx.arc(landmark.x * this.originalCanvas.width, landmark.y * this.originalCanvas.height, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        console.log('关键点已绘制到原始画布上');
    }

    private createEmptyTexture(width: number, height: number): WebGLTexture {
        const gl = this.gl!;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }

    private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
        const gl = this.gl!;
        const framebuffer = gl.createFramebuffer();
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('create framebuffer failed: Framebuffer is not complete');
        }
        
        return framebuffer;
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
            const landmarks = this.faceLandmarks[0];

            // 调整WebGL画布尺寸匹配原图
            canvas.width = this.originalCanvas.width;
            canvas.height = this.originalCanvas.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
            let currentFrameTexture: WebGLTexture;
            let outputTexture: WebGLTexture;
            let fb: WebGLFramebuffer;
            {
                // 底图+唇部
                currentFrameTexture = this.createTextureFromCanvas(this.originalCanvas);
                outputTexture = this.createEmptyTexture(this.originalCanvas.width, this.originalCanvas.height);
                fb = this.createFramebuffer(outputTexture);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
                // 底图
                this.setupGeometry();
                this.renderRawPicture(currentFrameTexture);
                // 如果有唇膏效果，渲染唇部
                if (this.beautyParams.lipstickIntensity > 0) {
                    this.renderLipMakeup(currentFrameTexture, landmarks);
                }
                gl.deleteTexture(currentFrameTexture);
            }

            {
                currentFrameTexture = outputTexture;
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                // const currentFrameTexture = this.createTextureFromCanvas(gl.canvas as HTMLCanvasElement);
                this.setupGeometry();
                this.renderUnifiedBeautyEffects(currentFrameTexture, landmarks);
                gl.deleteTexture(currentFrameTexture);
            }

            // 使用统一的美颜shader一次性渲染所有效果
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);


            // 复制结果到显示画布
            this.copyToResultCanvas();

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

    // 安全设置uniform - 检查是否存在再设置
    private safeSetUniform = (program: ShaderProgramInfo, name: string, setter: (loc: WebGLUniformLocation) => void): void => {
        const location = program.uniformLocations[name];
        if (location !== null && location !== undefined) {
            setter(location);
        } else {
            console.warn(`Uniform ${name} 不存在或无法获取位置`);
        }
    };

    private renderRawPicture(inputTexture: WebGLTexture): void {
        if (!this.gl || !this.originalCanvas || !this.programs.originalPicture) return;

        const gl = this.gl;
        const program = this.programs.originalPicture;

        console.log('=== rawpicture rendering ===');

        gl.useProgram(program.program);

        // 设置顶点属性
        this.setupVertexAttributes(program);

        // 绑定纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        this.safeSetUniform(program, 'u_texture', (loc) => gl.uniform1i(loc, 0));
        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        console.log('renderRawPicture done');
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


        // 设置纹理uniform
        this.safeSetUniform(program, 'u_texture', (loc) => gl.uniform1i(loc, 0));
        // 设置人脸检测参数
        this.safeSetUniform(program, 'u_hasFace', (loc) => gl.uniform1i(loc, 1));
        const aspectRatio = this.originalCanvas.width / this.originalCanvas.height;
        this.safeSetUniform(program, 'u_aspectRatio', (loc) => gl.uniform1f(loc, aspectRatio));

        // 传递关键点数据
        const facePointsX = new Float32Array(478);
        const facePointsY = new Float32Array(478);
        for (let i = 0; i < Math.min(landmarks.length, 478); i++) {
            facePointsX[i] = landmarks[i].x;
            facePointsY[i] = landmarks[i].y;
        }

        // 传递关键点数组
        this.safeSetUniform(program, 'u_facePointsX', (loc) => gl.uniform1fv(loc, facePointsX));
        this.safeSetUniform(program, 'u_facePointsY', (loc) => gl.uniform1fv(loc, facePointsY));

        // 设置美颜参数
        this.safeSetUniform(program, 'u_thinFaceDelta', (loc) => gl.uniform1f(loc, this.beautyParams.faceSlim));
        this.safeSetUniform(program, 'u_bigEyeDelta', (loc) => gl.uniform1f(loc, this.beautyParams.eyeEnlarge));

        // 设置磨皮参数
        this.safeSetUniform(program, 'u_textureSize', (loc) => {
            if (this.originalCanvas) {
                gl.uniform2f(loc, this.originalCanvas.width, this.originalCanvas.height);
            }
        });
        this.safeSetUniform(program, 'u_smoothingLevel', (loc) => gl.uniform1f(loc, this.beautyParams.skinSmoothing));

        // 设置颜色调整参数
        this.safeSetUniform(program, 'u_brightness', (loc) => gl.uniform1f(loc, this.beautyParams.brightness));
        this.safeSetUniform(program, 'u_contrast', (loc) => gl.uniform1f(loc, this.beautyParams.contrast));
        this.safeSetUniform(program, 'u_saturation', (loc) => gl.uniform1f(loc, this.beautyParams.saturation));
        this.safeSetUniform(program, 'u_warmth', (loc) => gl.uniform1f(loc, this.beautyParams.warmth));

        // 调试输出
        console.log(`统一美颜参数:`);
        console.log(`- 瘦脸强度: ${this.beautyParams.faceSlim}`);
        console.log(`- 大眼强度: ${this.beautyParams.eyeEnlarge}`);
        console.log(`- 磨皮强度: ${this.beautyParams.skinSmoothing}`);
        console.log(`- 美白强度: ${this.beautyParams.brightness}`);
        console.log(`- 对比度: ${this.beautyParams.contrast}`);
        console.log(`- 饱和度: ${this.beautyParams.saturation}`);
        console.log(`- 暖色调: ${this.beautyParams.warmth}`);
        console.log(`- 唇膏强度: ${this.beautyParams.lipstickIntensity}`);
        console.log(`- 唇膏混合模式: ${this.beautyParams.lipstickBlendMode}`);
        console.log(`- 关键点数量: ${landmarks.length}`);
        console.log(`- 宽高比: ${aspectRatio}`);

        // 渲染
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        console.log('统一美颜渲染完成');
    }


    /**
     * 根据MediaPipe landmarks生成唇部几何体
     */
    private generateLipGeometry(landmarks: Landmark[]): {
        vertices: Float32Array,
        texCoords: Float32Array,
        lipTexCoords: Float32Array,
        indices: Uint16Array
    } {
        const triangleIndices = this.getLipTriangleIndices();

        // 生成顶点数据
        const vertices: number[] = [];
        const texCoords: number[] = [];
        let lipTexCoords: number[] = [];
        const standard_landmark = this.standardLandmarks?.landmarks || [];

        for (const index of triangleIndices) {
            if (index < landmarks.length) {
                const landmark = landmarks[index];

                // 顶点位置 (NDC坐标)
                const x = landmark.x * 2.0 - 1.0; // [0,1] -> [-1,1]
                const y = (landmark.y) * 2.0 - 1.0; // [0,1] -> [-1,1], 翻转Y轴
                vertices.push(x, y);
                console.log(`顶点 ${index}: (${x}, ${y})`);

                // 原始纹理坐标
                texCoords.push(landmark.x, landmark.y);
                lipTexCoords.push(standard_landmark[index].x, standard_landmark[index].y);

                // 唇部纹理坐标 (这里可以使用变换矩阵)
                // if (this.lipTransformMatrix) {
                //     const transformed = this.transformPoint(landmark.x, landmark.y, this.lipTransformMatrix);
                //     lipTexCoords.push(transformed.x, transformed.y);
                // } else {
                //     // 备用：简单的边界框映射
                //     lipTexCoords.push(landmark.x, 1 - landmark.y);
                // }
            }
        }
        lipTexCoords = this.getLipTexCoords();
        let lipArea = { left: landmarks[57].x, top: landmarks[37].y, right: landmarks[287].x, bottom: landmarks[17].y };

        // 生成索引
        let indices: number[] = [];
        for (let i = 0; i < triangleIndices.length; i += 3) {
            indices.push(i, i + 1, i + 2);
        }
        return {
            vertices: new Float32Array(vertices),
            texCoords: new Float32Array(texCoords),
            lipTexCoords: new Float32Array(lipTexCoords),
            indices: new Uint16Array(indices)
        };
    }
    /**
     * 渲染唇部化妆效果 - 只处理唇部三角形
     */
    private renderLipMakeup(inputTexture: WebGLTexture, landmarks: Landmark[]): void {
        if (!this.gl || !this.programs.lipMakeup || !this.lipTexture) return;

        const gl = this.gl;
        const program = this.programs.lipMakeup;

        console.log('=== 开始唇部三角形渲染 ===');

        // 生成唇部几何体
        const lipGeometry = this.generateLipGeometry(landmarks);

        // 创建唇部顶点缓冲区
        if (!this.lipVertexBuffer) {
            this.lipVertexBuffer = gl.createBuffer();
            this.lipTexCoordBuffer = gl.createBuffer();
            this.lipIndexBuffer = gl.createBuffer();
        }

        // 更新顶点数据
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lipVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lipGeometry.vertices, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lipTexCoordBuffer);
        const combinedTexCoords = new Float32Array(lipGeometry.texCoords.length + lipGeometry.lipTexCoords.length);
        combinedTexCoords.set(lipGeometry.texCoords, 0);
        combinedTexCoords.set(lipGeometry.lipTexCoords, lipGeometry.texCoords.length);
        gl.bufferData(gl.ARRAY_BUFFER, combinedTexCoords, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lipIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lipGeometry.indices, gl.DYNAMIC_DRAW);

        // 使用唇部shader
        gl.useProgram(program.program);

        // 绑定纹理
        if (inputTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(program.uniformLocations['u_texture']!, 0);
            this.safeSetUniform(program, 'u_texture', (loc) => gl.uniform1i(loc, 0));
        }
        // 设置唇部化妆纹理
        if (this.lipTexture) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.lipTexture);
            this.safeSetUniform(program, 'u_lipTexture', (loc) => gl.uniform1i(loc, 1));
        }
        // 设置唇部化妆参数
        this.safeSetUniform(program, 'u_lipIntensity', (loc) => gl.uniform1f(loc, this.beautyParams.lipstickIntensity));
        this.safeSetUniform(program, 'u_lipstickBlendMode', (loc) => gl.uniform1i(loc, this.beautyParams.lipstickBlendMode));

        // 设置顶点属性
        const positionLoc = program.attributeLocations['a_position'];
        const texCoordLoc = program.attributeLocations['a_texCoord'];
        const lipTexCoordLoc = gl.getAttribLocation(program.program, 'a_lipTexCoord');

        // 位置属性
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lipVertexBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // 纹理坐标属性
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lipTexCoordBuffer);
        gl.enableVertexAttribArray(texCoordLoc);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        // 唇部纹理坐标属性
        gl.enableVertexAttribArray(lipTexCoordLoc);
        gl.vertexAttribPointer(lipTexCoordLoc, 2, gl.FLOAT, false, 0, lipGeometry.texCoords.length * 4);

        // 启用混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 渲染唇部三角形
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lipIndexBuffer);
        gl.drawElements(gl.TRIANGLES, lipGeometry.indices.length, gl.UNSIGNED_SHORT, 0);

        // 禁用混合
        gl.disable(gl.BLEND);

        console.log(`唇部三角形渲染完成，绘制了 ${lipGeometry.indices.length / 3} 个三角形`);
    }

    private setupGeometry(flipTextureCoordY: boolean = false): void {
        if (!this.gl) return;

        const gl = this.gl;

        // 全屏四边形顶点 (位置 + 纹理坐标)
        const vertices = new Float32Array([
            // 位置      纹理坐标
            -1.0, -1.0, 0.0, 0.0,
            1.0, -1.0, 1.0, 0.0,
            -1.0, 1.0, 0.0, 1.0,
            1.0, 1.0, 1.0, 1.0,
        ]);
        if (flipTextureCoordY) {
            // 翻转Y轴纹理坐标
            for (let i = 3; i < vertices.length; i += 4) {
                vertices[i] = 1.0 - vertices[i]; // 反转Y坐标
            }
        }

        const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);

        // 创建顶点缓冲区
        if (!this.vertexBuffer) this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // 创建索引缓冲区
        if (!this.indexBuffer) this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
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
            'saturation': 'saturation',
            'lipstickIntensity': 'lipstickIntensity',
            'blushIntensity': 'blushIntensity',
            'eyeshadowIntensity': 'eyeshadowIntensity'
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

        // 更新唇膏混合模式选择器
        const lipstickBlendModeSelect = document.getElementById('lipstickBlendMode') as HTMLSelectElement;
        if (lipstickBlendModeSelect) {
            lipstickBlendModeSelect.value = this.beautyParams.lipstickBlendMode.toString();
        }

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
            'saturation': 'saturation',
            'lipstickIntensity': 'lipstickIntensity'
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

        // 更新唇膏混合模式选择器
        const lipstickBlendModeSelect = document.getElementById('lipstickBlendMode') as HTMLSelectElement;
        if (lipstickBlendModeSelect) {
            lipstickBlendModeSelect.value = this.beautyParams.lipstickBlendMode.toString();
        }
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
     * 启动相机
     */
    private async startCamera(): Promise<void> {
        try {
            this.showLoading(true, '正在启动相机...');
            
            // 停止之前的相机流
            if (this.cameraStream) {
                this.stopCamera();
            }

            // 请求相机权限
            const constraints: MediaStreamConstraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user' // 前置摄像头
                },
                audio: false
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // 创建或获取video元素
            if (!this.videoElement) {
                this.videoElement = document.createElement('video');
                this.videoElement.autoplay = true;
                this.videoElement.playsInline = true;
                this.videoElement.muted = true;
                this.videoElement.style.display = 'none';
                document.body.appendChild(this.videoElement);
            }

            // 设置视频流
            this.videoElement.srcObject = this.cameraStream;
            
            // 等待视频开始播放
            await new Promise<void>((resolve, reject) => {
                this.videoElement!.onloadedmetadata = () => {
                    this.videoElement!.play()
                        .then(() => resolve())
                        .catch(reject);
                };
                this.videoElement!.onerror = reject;
            });

            // 更新按钮状态
            this.updateCameraButtonStates(true);
            
            // 开始实时处理
            this.isCameraActive = true;
            this.startCameraProcessing();
            
            this.showLoading(false);
            this.showSuccess('📷 相机启动成功，开始实时美颜处理！');
            
        } catch (error) {
            console.error('启动相机失败:', error);
            this.showLoading(false);
            this.showError('启动相机失败: ' + (error as Error).message);
            this.updateCameraButtonStates(false);
        }
    }

    /**
     * 停止相机
     */
    private stopCamera(): void {
        try {
            // 停止动画帧
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            // 停止相机流
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.cameraStream = null;
            }

            // 清理video元素
            if (this.videoElement) {
                this.videoElement.srcObject = null;
                this.videoElement.remove();
                this.videoElement = null;
            }

            this.isCameraActive = false;
            this.updateCameraButtonStates(false);
            this.showSuccess('📷 相机已停止');
            
        } catch (error) {
            console.error('停止相机失败:', error);
            this.showError('停止相机失败: ' + (error as Error).message);
        }
    }

    /**
     * 开始相机处理循环
     */
    private startCameraProcessing(): void {
        if (!this.isCameraActive || !this.videoElement || !this.originalCanvas) {
            return;
        }

        const processFrame = async () => {
            try {
                if (!this.isCameraActive || !this.videoElement || !this.originalCanvas) {
                    return;
                }

                // 检查video是否准备好
                if (this.videoElement.readyState >= 2) {
                    await this.drawCameraFrameToCanvas();
                    await this.detectFaceFromCamera();
                }

                // 继续下一帧
                this.animationFrameId = requestAnimationFrame(processFrame);
                
            } catch (error) {
                console.error('相机帧处理失败:', error);
                // 继续处理，不中断相机流
                this.animationFrameId = requestAnimationFrame(processFrame);
            }
        };

        // 开始处理循环
        this.animationFrameId = requestAnimationFrame(processFrame);
    }

    /**
     * 将相机帧绘制到originalCanvas
     */
    private async drawCameraFrameToCanvas(): Promise<void> {
        if (!this.videoElement || !this.originalCanvas) return;

        const canvas = this.originalCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 设置canvas尺寸匹配视频
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        
        if (videoWidth === 0 || videoHeight === 0) return;

        // 保持显示尺寸控制
        const maxDisplayWidth = 400;
        const maxDisplayHeight = 300;
        const displayScale = Math.min(maxDisplayWidth / videoWidth, maxDisplayHeight / videoHeight);

        // 设置canvas实际分辨率为视频分辨率
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // 设置canvas显示尺寸
        canvas.style.width = `${videoWidth * displayScale}px`;
        canvas.style.height = `${videoHeight * displayScale}px`;

        // 水平翻转相机画面（镜像效果）
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-videoWidth, 0);
        
        // 绘制视频帧
        ctx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);
        
        ctx.restore();
    }

    /**
     * 从相机帧检测人脸
     */
    private async detectFaceFromCamera(): Promise<void> {
        if (!this.faceLandmarker || !this.originalCanvas) return;

        try {
            // 从canvas检测人脸
            const results = this.faceLandmarker.detect(this.originalCanvas);
            
            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                this.faceLandmarks = results.faceLandmarks;
                this.updateFaceInfo();

                // 创建唇部纹理（如果还没有）
                if (!this.lipTexture && this.faceLandmarks.length > 0) {
                    await this.createGlobalLipTexture(this.faceLandmarks[0]);
                }

                // 应用实时美颜效果
                if (!this.isProcessing) {
                    this.applyWebGLBeautyEffects();
                }
            } else {
                // 没有检测到人脸，清空面部信息
                this.faceLandmarks = [];
                this.updateFaceInfo();
            }
            
        } catch (error) {
            console.error('相机人脸检测失败:', error);
            // 不显示错误信息，避免频繁提示
        }
    }

    /**
     * 更新相机按钮状态
     */
    private updateCameraButtonStates(cameraActive: boolean): void {
        const startCameraBtn = document.getElementById('startCameraBtn') as HTMLButtonElement;
        const stopCameraBtn = document.getElementById('stopCameraBtn') as HTMLButtonElement;

        if (startCameraBtn) {
            startCameraBtn.disabled = cameraActive;
            startCameraBtn.textContent = cameraActive ? '📷 相机运行中' : '📷 启动相机';
        }

        if (stopCameraBtn) {
            stopCameraBtn.disabled = !cameraActive;
            stopCameraBtn.textContent = cameraActive ? '⏹️ 停止相机' : '⏹️ 相机已停止';
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

            // 清理唇部纹理
            if (this.lipTexture) {
                gl.deleteTexture(this.lipTexture);
                this.lipTexture = null;
            }

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
        if (this.faceLandmarker) {
            this.faceLandmarker.close();
            this.faceLandmarker = null;
        }

        console.log('资源清理完成');
    }
}

// 页面加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动WebGL美颜应用...');
    (window as any).webglFaceBeautyApp = new WebGLFaceBeautyApp();
});
