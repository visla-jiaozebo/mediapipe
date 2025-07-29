/**
 * MediaPipe和OpenCV.js配置文件
 * 用于优化性能和自定义设置
 */

window.BEAUTY_CONFIG = {
    // MediaPipe FaceMesh配置
    faceMesh: {
        maxNumFaces: 1,                    // 最大检测人脸数
        refineLandmarks: true,             // 是否细化关键点
        minDetectionConfidence: 0.5,       // 最小检测置信度
        minTrackingConfidence: 0.5,        // 最小跟踪置信度
        staticImageMode: true              // 静态图像模式
    },

    // 美颜参数默认值
    defaultBeautyParams: {
        smoothness: 30,      // 磨皮强度 (0-100)
        brightness: 10,      // 美白程度 (0-50)
        warmth: 5,          // 红润度 (0-50)
        sharpness: 20,      // 锐化强度 (0-100)
        contrast: 5,        // 对比度 (-50-50)
        saturation: 10      // 饱和度 (-50-50)
    },

    // 图像处理配置
    imageProcessing: {
        maxImageSize: 800,              // 最大图像尺寸
        jpegQuality: 0.9,              // JPEG压缩质量
        enableGPUAcceleration: true,    // 启用GPU加速（如果可用）
        preserveAspectRatio: true      // 保持宽高比
    },

    // UI配置
    ui: {
        showLandmarks: false,           // 是否显示人脸关键点
        showFaceBox: false,            // 是否显示人脸框
        animationDuration: 300,        // 动画持续时间（毫秒）
        debounceDelay: 100            // 参数调整防抖延迟（毫秒）
    },

    // 性能配置
    performance: {
        enableWebWorker: false,        // 启用Web Worker（未实现）
        enableOffscreenCanvas: true,   // 启用离屏Canvas
        maxFrameRate: 30              // 最大帧率
    },

    // 调试配置
    debug: {
        enableConsoleLog: true,        // 启用控制台日志
        enablePerformanceMonitor: false, // 启用性能监控
        enableErrorReporting: true     // 启用错误报告
    },

    // CDN配置
    cdn: {
        mediapipe: 'https://cdn.jsdelivr.net/npm/@mediapipe',
        opencv: 'https://docs.opencv.org/4.10.0/opencv.js',
        fallbackTimeout: 10000        // CDN加载超时时间（毫秒）
    }
};

// 预设美颜模式
window.BEAUTY_PRESETS = {
    natural: {
        name: '自然',
        icon: '🌿',
        params: {
            smoothness: 20,
            brightness: 5,
            warmth: 3,
            sharpness: 15,
            contrast: 2,
            saturation: 5
        }
    },
    sweet: {
        name: '甜美',
        icon: '🍭',
        params: {
            smoothness: 40,
            brightness: 15,
            warmth: 8,
            sharpness: 25,
            contrast: 8,
            saturation: 15
        }
    },
    professional: {
        name: '职业',
        icon: '💼',
        params: {
            smoothness: 25,
            brightness: 8,
            warmth: 2,
            sharpness: 30,
            contrast: 10,
            saturation: 5
        }
    },
    dramatic: {
        name: '戏剧',
        icon: '🎭',
        params: {
            smoothness: 50,
            brightness: 20,
            warmth: 12,
            sharpness: 40,
            contrast: 15,
            saturation: 20
        }
    }
};

// 皮肤检测区域配置（基于MediaPipe关键点）
window.SKIN_REGIONS = {
    // 面部皮肤区域关键点索引
    face: [
        // 脸颊区域
        [116, 117, 118, 119, 120, 121, 128, 126, 142, 36, 205, 206, 207, 213, 192, 147, 187, 207, 216, 206, 205, 36],
        // 额头区域
        [10, 151, 9, 10, 151, 9, 10, 151, 9]
    ],
    
    // 需要特殊处理的区域
    exclude: {
        eyes: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], // 眼部
        eyebrows: [46, 53, 52, 51, 48, 115, 131, 134, 102, 48, 64], // 眉毛
        lips: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318] // 嘴唇
    }
};
