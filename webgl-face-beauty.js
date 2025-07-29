/**
 * WebGL Shader 美颜系统 - 基于GPU加速的高质量美颜处理
 * 参考 GPUPixel face_reshape_filter.cc 实现
 * 作者: AI Assistant
 * 功能: GPU shader 实现的瘦脸、大眼、磨皮效果
 */

// 顶点着色器 - 标准的全屏四边形
const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

// 人脸变形片段着色器 - 基于 GPUPixel 实现
const faceReshapeFragmentShaderSource = `
    precision highp float;
    
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    
    // 人脸检测参数
    uniform int u_hasFace;
    uniform float u_facePointsX[468]; // MediaPipe 468个关键点 X坐标
    uniform float u_facePointsY[468]; // MediaPipe 468个关键点 Y坐标
    uniform float u_aspectRatio;
    
    // 美颜参数
    uniform float u_thinFaceDelta;   // 瘦脸强度 [0.0, 1.0]
    uniform float u_bigEyeDelta;     // 大眼强度 [0.0, 1.0]
    
    // 大眼效果函数 - 径向放大
    vec2 enlargeEye0(vec2 texCoord, vec2 centerPos, float radius, float delta) {
        if (delta <= 0.0) return texCoord;
        
        // 计算距离（考虑宽高比）
        vec2 adjustedTexCoord = vec2(texCoord.x, texCoord.y * u_aspectRatio);
        vec2 adjustedCenter = vec2(centerPos.x, centerPos.y * u_aspectRatio);
        float dist = length(adjustedTexCoord - adjustedCenter);
        
        // 如果在影响范围内
        if (dist < radius && dist > 0.0) {
            // 使用更强的放大算法
            float weight = smoothstep(radius, 0.0, dist);
            float scaleFactor = 1.0 - delta * weight * 0.5; // 增强放大效果
            
            vec2 direction = texCoord - centerPos;
            return centerPos + direction * scaleFactor;
        }
        
        return texCoord;
    }
    vec2 enlargeEye(vec2 textureCoord, vec2 originPosition, float radius, float delta) {

        float weight = distance(vec2(textureCoord.x, textureCoord.y / u_aspectRatio), vec2(originPosition.x, originPosition.y / u_aspectRatio)) / radius;

        weight = 1.0 - (1.0 - weight * weight) * delta;
        weight = clamp(weight,0.0,1.0);
        textureCoord = originPosition + (textureCoord - originPosition) * weight;
        return textureCoord;
    }
    
    // 曲线变形函数 - 用于瘦脸
    vec2 curveWarp(vec2 texCoord, vec2 originPos, vec2 targetPos, float delta) {
        if (delta <= 0.0) return texCoord;
        
        vec2 direction = normalize(targetPos - originPos);
        float maxDistance = distance(targetPos, originPos);
        
        if (maxDistance <= 0.0) return texCoord;
        
        // 计算当前点到原始点的距离
        vec2 adjustedTexCoord = vec2(texCoord.x, texCoord.y / u_aspectRatio);
        vec2 adjustedOrigin = vec2(originPos.x, originPos.y / u_aspectRatio);
        float distanceToOrigin = length(adjustedTexCoord - adjustedOrigin);
        
        // 影响半径 - 基于目标距离
        float influenceRadius = maxDistance * 1.5;
        
        if (distanceToOrigin < influenceRadius && distanceToOrigin > 0.0) {
            // 计算变形强度
            float influence = smoothstep(influenceRadius, 0.0, distanceToOrigin);
            float warpStrength = delta * influence * 0.3; // 增强变形效果
            
            // 计算变形方向
            vec2 warpDirection = direction * warpStrength * maxDistance;
            return texCoord - warpDirection;
        }
        
        return texCoord;
    }
    
    // 瘦脸效果 - 使用更准确的MediaPipe关键点
    vec2 thinFace(vec2 currentCoord) {
        if (u_hasFace == 0) return currentCoord;
        
        // 使用MediaPipe Face Mesh标准的脸部轮廓关键点进行瘦脸
        // 基于FACEMESH_FACE_OVAL的正确关键点索引
        // 左脸颊轮廓关键点 (面部椭圆左侧)
        // vec2 leftCheek1 = vec2(u_facePointsX[162], u_facePointsY[162]);
        vec2 leftCheek2 = vec2(u_facePointsX[127], u_facePointsY[127]);
        vec2 leftCheek3 = vec2(u_facePointsX[234], u_facePointsY[234]);
        vec2 leftCheek4 = vec2(u_facePointsX[93], u_facePointsY[93]);
        vec2 leftCheek5 = vec2(u_facePointsX[132], u_facePointsY[132]);
        vec2 leftCheek6 = vec2(u_facePointsX[215], u_facePointsY[215]);
        vec2 leftCheek7 = vec2(u_facePointsX[58], u_facePointsY[58]);
        vec2 leftCheek8 = vec2(u_facePointsX[172], u_facePointsY[172]);
        vec2 leftCheek9 = vec2(u_facePointsX[136], u_facePointsY[136]);
        vec2 leftCheek10 = vec2(u_facePointsX[150], u_facePointsY[150]);
        vec2 leftCheek11 = vec2(u_facePointsX[149], u_facePointsY[149]);  // 251 - 右脸颊下部
        
        // 右脸颊轮廓关键点 (面部椭圆右侧)
        // vec2 rightCheek1 = vec2(u_facePointsX[389], u_facePointsY[389]);  // 454 - 右颞区
        vec2 rightCheek2 = vec2(u_facePointsX[356], u_facePointsY[356]);  // 356 - 右脸颊上部
        vec2 rightCheek3 = vec2(u_facePointsX[454], u_facePointsY[454]);  // 389 - 右脸颊中部  
        vec2 rightCheek4 = vec2(u_facePointsX[323], u_facePointsY[323]);  // 251 - 右脸颊下部
        vec2 rightCheek5 = vec2(u_facePointsX[401], u_facePointsY[401]);  // 251 - 右脸颊下部
        vec2 rightCheek6 = vec2(u_facePointsX[361], u_facePointsY[361]);  // 251 - 右脸颊下部
        vec2 rightCheek7 = vec2(u_facePointsX[435], u_facePointsY[435]);  // 251 - 右脸颊下部
        vec2 rightCheek8 = vec2(u_facePointsX[288], u_facePointsY[288]);  // 251 - 右脸颊下部
        vec2 rightCheek9 = vec2(u_facePointsX[397], u_facePointsY[397]);  // 251 - 右脸颊下部
        vec2 rightCheek10 = vec2(u_facePointsX[365], u_facePointsY[365]);  // 251 - 右脸颊下部
        vec2 rightCheek11 = vec2(u_facePointsX[379], u_facePointsY[379]);  // 251 - 右脸颊下部
        vec2 rightCheek12 = vec2(u_facePointsX[378], u_facePointsY[378]);  // 251 - 右脸颊下部

        // 面部中心线关键点作为收缩目标
        vec2 noseTip = vec2(u_facePointsX[6], u_facePointsY[6]);          // 双眼中心
        vec2 chinCenter = vec2(u_facePointsX[18], u_facePointsY[18]);     // 18 - 下巴中心  
        vec2 faceCenter = (noseTip + chinCenter) * 0.5;
        
        // 左脸向中心收缩 - 使用Face Oval的准确关键点
        // currentCoord = curveWarp(currentCoord, leftCheek1, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek2, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek3, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek4, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek5, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek6, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek7, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek8, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek9, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, leftCheek10, faceCenter, u_thinFaceDelta);

        // 右脸向中心收缩 - 使用Face Oval的准确关键点
        // currentCoord = curveWarp(currentCoord, rightCheek1, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek2, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek3, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek4, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek5, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek6, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek7, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek8, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek9, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek10, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek11, faceCenter, u_thinFaceDelta);
        currentCoord = curveWarp(currentCoord, rightCheek12, faceCenter, u_thinFaceDelta);

        
        return currentCoord;
    }
    
    // 大眼效果 - 使用更准确的眼部关键点
    vec2 bigEye(vec2 currentCoord) {
        if (u_hasFace == 0) return currentCoord;
        
        // 左眼关键点 (MediaPipe Face Mesh标准索引)
        vec2 leftEyeInner = vec2(u_facePointsX[33], u_facePointsY[33]);      // 33
        vec2 leftEyeOuter = vec2(u_facePointsX[133], u_facePointsY[133]);    // 133
        vec2 leftEyeTop = vec2(u_facePointsX[159], u_facePointsY[159]);      // 159
        vec2 leftEyeBottom = vec2(u_facePointsX[145], u_facePointsY[145]);   // 145
        
        // 右眼关键点
        vec2 rightEyeInner = vec2(u_facePointsX[362], u_facePointsY[362]);   // 362
        vec2 rightEyeOuter = vec2(u_facePointsX[263], u_facePointsY[263]);   // 263
        vec2 rightEyeTop = vec2(u_facePointsX[386], u_facePointsY[386]);     // 386
        vec2 rightEyeBottom = vec2(u_facePointsX[374], u_facePointsY[374]);  // 374
        
        // 计算眼部中心
        vec2 leftEyeCenter = (leftEyeInner + leftEyeOuter + leftEyeTop + leftEyeBottom) / 4.0;
        vec2 rightEyeCenter = (rightEyeInner + rightEyeOuter + rightEyeTop + rightEyeBottom) / 4.0;
        
        // 计算眼部半径
        float leftEyeRadius = max(
            distance(leftEyeInner, leftEyeOuter), 
            distance(leftEyeTop, leftEyeBottom)
        ) * 0.6;
        
        float rightEyeRadius = max(
            distance(rightEyeInner, rightEyeOuter),
            distance(rightEyeTop, rightEyeBottom)
        ) * 0.6;
        
        // 应用大眼效果
        currentCoord = enlargeEye(currentCoord, leftEyeCenter, leftEyeRadius, u_bigEyeDelta);
        currentCoord = enlargeEye(currentCoord, rightEyeCenter, rightEyeRadius, u_bigEyeDelta);
        
        return currentCoord;
    }
    
    // 绘制区域边框函数
    float drawBorder(vec2 uv, vec2 center, float radius, float thickness) {
        float dist = length(uv - center);
        return smoothstep(radius - thickness, radius, dist) - smoothstep(radius, radius + thickness, dist);
    }
    
    // 绘制矩形边框
    float drawRectBorder(vec2 uv, vec2 topLeft, vec2 bottomRight, float thickness) {
        vec2 d = max(vec2(0.0), max(topLeft - uv, uv - bottomRight));
        float border = length(d);
        
        // 内边框
        vec2 innerTopLeft = topLeft + vec2(thickness);
        vec2 innerBottomRight = bottomRight - vec2(thickness);
        vec2 innerD = max(vec2(0.0), max(innerTopLeft - uv, uv - innerBottomRight));
        float innerBorder = length(innerD);
        
        return step(border, 0.0) - step(innerBorder, 0.0);
    }

    void main0() {
            vec2 texCoord = v_texCoord;
            vec4 color = texture2D(u_texture, texCoord);

                vec2 leftEyeInner = vec2(u_facePointsX[33], u_facePointsY[33]);    // 33
                vec2 leftEyeOuter = vec2(u_facePointsX[133], u_facePointsY[133]);  // 133
                vec2 leftEyeTop = vec2(u_facePointsX[160], u_facePointsY[160]);    // 160
                vec2 leftEyeBottom = vec2(u_facePointsX[144], u_facePointsY[144]); // 144

                vec2 leftEyeCenter = (leftEyeInner + leftEyeOuter + leftEyeTop + leftEyeBottom) / 4.0;

                if (distance(texCoord, leftEyeInner) < 0.02) {
                    color = vec4(1.0, 0.0, 0.0, 1.0); // 红色边框
                }
                if (distance(texCoord, leftEyeTop) < 0.02) {
                    color = vec4(1.0, 0.0, 0.0, 1.0); // 红色边框
                }


            gl_FragColor = color;
                
    }
    
    void main() {
        vec2 texCoord = v_texCoord;
        
        
        // 应用人脸变形效果
        if (u_hasFace == 1) {
            texCoord = thinFace(texCoord);
            texCoord = bigEye(texCoord);
        }
        
        // 确保纹理坐标在有效范围内
        texCoord = clamp(texCoord, 0.0, 1.0);
        // gl_FragColor = mix(texture2D(u_texture, texCoord), color, 0.3); // 混合原图和标记
        gl_FragColor = texture2D(u_texture, texCoord);
    }
`;

// 磨皮片段着色器
const skinSmoothingFragmentShaderSource = `
    precision highp float;
    
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec2 u_textureSize;
    uniform float u_smoothingLevel; // [0.0, 1.0]
    
    // 高质量双边滤波磨皮
    vec4 bilateralFilter(sampler2D tex, vec2 uv, vec2 texelSize) {
        vec4 center = texture2D(tex, uv);
        vec4 result = center;
        float totalWeight = 1.0;
        
        // 3x3核心采样
        for(int x = -1; x <= 1; x++) {
            for(int y = -1; y <= 1; y++) {
                if(x == 0 && y == 0) continue;
                
                vec2 offset = vec2(float(x), float(y)) * texelSize;
                vec4 sample = texture2D(tex, uv + offset);
                
                // 空间权重
                float spatialWeight = exp(-0.5 * (float(x*x + y*y)));
                
                // 颜色相似度权重
                float colorDiff = length(sample.rgb - center.rgb);
                float colorWeight = exp(-colorDiff * colorDiff * 25.0);
                
                float weight = spatialWeight * colorWeight;
                result += sample * weight;
                totalWeight += weight;
            }
        }
        
        return result / totalWeight;
    }
    
    void main() {
        vec2 texelSize = 1.0 / u_textureSize;
        vec4 original = texture2D(u_texture, v_texCoord);
        vec4 smoothed = bilateralFilter(u_texture, v_texCoord, texelSize);
        
        // 混合原图和磨皮结果
        gl_FragColor = mix(original, smoothed, u_smoothingLevel);
    }
`;

// 化妆效果着色器 - 基于 GPUPixel face_makeup_filter.cc 实现
const faceMakeupVertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    attribute vec2 a_landmarkCoord;  // 人脸关键点坐标
    
    varying vec2 v_texCoord;         // 原图纹理坐标
    varying vec2 v_landmarkCoord;    // 关键点纹理坐标
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
        v_landmarkCoord = a_landmarkCoord;
    }
`;

const faceMakeupFragmentShaderSource = `
    precision highp float;
    
    varying vec2 v_texCoord;
    varying vec2 v_landmarkCoord;
    
    uniform sampler2D u_inputTexture;        // 原图
    uniform sampler2D u_makeupTexture;       // 化妆纹理 (口红/腮红/眼影等)
    uniform float u_intensity;              // 化妆强度 [0.0, 1.0]
    uniform int u_blendMode;                 // 混合模式
    uniform int u_hasFace;                   // 是否检测到人脸
    
    // 强光混合
    float blendHardLight(float base, float blend) {
        return blend < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
    }
    
    vec3 blendHardLight(vec3 base, vec3 blend) {
        return vec3(blendHardLight(base.r, blend.r),
                    blendHardLight(base.g, blend.g),
                    blendHardLight(base.b, blend.b));
    }
    
    // 柔光混合
    float blendSoftLight(float base, float blend) {
        return (blend < 0.5) ? (base + (2.0 * blend - 1.0) * (base - base * base))
                             : (base + (2.0 * blend - 1.0) * (sqrt(base) - base));
    }
    
    vec3 blendSoftLight(vec3 base, vec3 blend) {
        return vec3(blendSoftLight(base.r, blend.r),
                    blendSoftLight(base.g, blend.g),
                    blendSoftLight(base.b, blend.b));
    }
    
    // 正片叠底
    vec3 blendMultiply(vec3 base, vec3 blend) {
        return base * blend;
    }
    
    // 叠加混合
    float blendOverlay(float base, float blend) {
        return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
    }
    
    vec3 blendOverlay(vec3 base, vec3 blend) {
        return vec3(blendOverlay(base.r, blend.r), 
                    blendOverlay(base.g, blend.g),
                    blendOverlay(base.b, blend.b));
    }
    
    // 混合函数选择器
    vec3 blendFunc(vec3 base, vec3 blend, int blendMode) {
        if (blendMode == 0) {
            return blend;                    // 正常混合
        } else if (blendMode == 15) {
            return blendMultiply(base, blend);  // 正片叠底
        } else if (blendMode == 17) {
            return blendOverlay(base, blend);   // 叠加
        } else if (blendMode == 22) {
            return blendHardLight(base, blend); // 强光
        } else if (blendMode == 23) {
            return blendSoftLight(base, blend); // 柔光
        }
        return blend;
    }
    
    void main() {
        if (u_hasFace == 0) {
            gl_FragColor = texture2D(u_inputTexture, v_texCoord);
            return;
        }
        
        // 获取原图颜色
        vec4 bgColor = texture2D(u_inputTexture, v_texCoord);
        
        // 获取化妆纹理颜色 (使用关键点映射的纹理坐标)
        vec4 fgColor = texture2D(u_makeupTexture, v_landmarkCoord);
        
        // 应用强度
        fgColor = fgColor * u_intensity;
        
        // 如果化妆纹理透明度为0，直接返回原图
        if (fgColor.a == 0.0) {
            gl_FragColor = bgColor;
            return;
        }
        
        // 执行混合
        vec3 blendedColor = blendFunc(bgColor.rgb, 
                                     clamp(fgColor.rgb * (1.0 / fgColor.a), 0.0, 1.0), 
                                     u_blendMode);
        
        // 最终颜色混合
        gl_FragColor = vec4(bgColor.rgb * (1.0 - fgColor.a) + blendedColor.rgb * fgColor.a, 1.0);
    }
`;

// 美白调色片段着色器
const colorAdjustmentFragmentShaderSource = `
    precision highp float;
    
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_brightness;  // 美白强度 [-1.0, 1.0]
    uniform float u_contrast;    // 对比度 [-1.0, 1.0]
    uniform float u_saturation;  // 饱和度 [-1.0, 1.0]
    uniform float u_warmth;      // 暖色调 [-1.0, 1.0]
    
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
#if 0
        {
            // 亮度调整 (美白)
            color.rgb += u_brightness * 0.3;
            
            // 对比度调整
            color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;
            
            // 饱和度调整
            vec3 hsv = rgb2hsv(color.rgb);
            hsv.y *= (1.0 + u_saturation);
            color.rgb = hsv2rgb(hsv);
            
            // 暖色调调整
            color.r += u_warmth * 0.1;
            color.g += u_warmth * 0.05;
            
            // 确保颜色在有效范围内
            color.rgb = clamp(color.rgb, 0.0, 1.0);
        }
#endif
        gl_FragColor = color;
    }
`;

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
            await this.initializeWebGL();
            await this.initializeMediaPipe();
            this.checkReadyState();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('系统初始化失败，请刷新页面重试');
            this.showLoading(false);
        }
    }
    
    async initializeWebGL() {
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
        
        // 编译着色器程序
        this.programs.faceReshape = this.createShaderProgram(vertexShaderSource, faceReshapeFragmentShaderSource);
        this.programs.skinSmoothing = this.createShaderProgram(vertexShaderSource, skinSmoothingFragmentShaderSource);
        this.programs.colorAdjustment = this.createShaderProgram(vertexShaderSource, colorAdjustmentFragmentShaderSource);
        this.programs.faceMakeup = this.createShaderProgram(faceMakeupVertexShaderSource, faceMakeupFragmentShaderSource);
        
        // 设置几何体（全屏四边形）
        this.setupGeometry();
        
        console.log('WebGL初始化完成');
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
            attribLocations: {
                position: gl.getAttribLocation(program, 'a_position'),
                texCoord: gl.getAttribLocation(program, 'a_texCoord'),
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
        if (this.gl && this.isMediaPipeReady) {
            this.showLoading(false);
            this.showSuccess('🎉 GPU美颜系统初始化完成！正在加载示例图片...');
            // 自动加载 demo.png
            this.loadDemoImage();
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
        // 参考face_makeup_filter.cc中的GetFaceIndexs()
        return new Uint32Array([
            // 嘴唇区域 - 上唇部分 (10个三角形)
            84, 85, 96, 96, 85, 97, 97, 85, 86, 86, 97, 98, 86, 98, 87, 87, 98, 88,
            88, 98, 99, 88, 99, 89, 89, 99, 100, 89, 100, 90,
            // 下唇部分 (10个三角形)  
            90, 100, 91, 100, 91, 101, 101, 91, 92, 101, 92, 102, 102, 92, 93, 102,
            93, 94, 102, 94, 103, 103, 94, 95, 103, 95, 96, 96, 95, 84,
            // 唇间部分 (8个三角形)
            96, 97, 103, 97, 103, 106, 97, 106, 98, 106, 103, 102, 106, 102, 101, 106,
            101, 99, 106, 98, 99, 99, 101, 100
        ]);
    }
    
    // 获取人脸化妆纹理坐标 - 基于GPUPixel实现  
    getFaceMakeupTextureCoords() {
        // 参考face_makeup_filter.cc中的FaceTextureCoordinates()
        // 这些坐标定义了化妆纹理在人脸上的映射位置
        return new Float32Array([
            0.302451, 0.384169, 0.302986, 0.409377, 0.304336, 0.434977, 0.306984,
            0.460683, 0.311010, 0.486447, 0.316537, 0.511947, 0.323069, 0.536942,
            0.331312, 0.561627, 0.342011, 0.585088, 0.355477, 0.607217, 0.371142,
            0.627774, 0.388459, 0.646991, 0.407041, 0.665229, 0.426325, 0.682694,
            0.447468, 0.697492, 0.471782, 0.707060, 0.500000, 0.709867, 0.528218,
            0.707060, 0.552532, 0.697492, 0.573675, 0.682694, 0.592959, 0.665229,
            0.611541, 0.646991, 0.628858, 0.627774, 0.644523, 0.607217, 0.657989,
            0.585088, 0.668688, 0.561627, 0.676931, 0.536942, 0.683463, 0.511947,
            0.688990, 0.486447, 0.693016, 0.460683, 0.695664, 0.434977, 0.697014,
            0.409377, 0.697549, 0.384169, 0.500000, 0.608028, 0.389259, 0.336870, 0.610740,
            0.336870, 0.386071, 0.503558, 0.613928, 0.503558
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
    
    // 渲染化妆效果
    renderFaceMakeup(inputTexture, landmarks, makeupType = 'lipstick') {
        if (!this.makeupTextures[makeupType]) {
            console.warn(`化妆纹理 ${makeupType} 未加载`);
            return;
        }
        
        const gl = this.gl;
        const program = this.programs.faceMakeup;
        
        gl.useProgram(program.program);
        
        // 设置输入纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(program.uniformLocations['u_inputTexture'], 0);
        
        // 设置化妆纹理
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.makeupTextures[makeupType]);
        gl.uniform1i(program.uniformLocations['u_makeupTexture'], 1);
        
        // 设置参数
        gl.uniform1i(program.uniformLocations['u_hasFace'], this.faceLandmarks.length > 0 ? 1 : 0);
        gl.uniform1f(program.uniformLocations['u_intensity'], this.makeupParams[makeupType + 'Intensity']);
        gl.uniform1i(program.uniformLocations['u_blendMode'], this.makeupParams[makeupType + 'BlendMode']);
        
        // 使用全屏四边形渲染 (简化版本)
        this.setupVertexAttributes(program);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
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
            const tempTexture1 = this.createEmptyTexture(canvas.width, canvas.height);
            const tempTexture2 = this.createEmptyTexture(canvas.width, canvas.height);
            
            // 创建帧缓冲区
            const framebuffer1 = this.createFramebuffer(tempTexture1);
            const framebuffer2 = this.createFramebuffer(tempTexture2);
            
        // 转换关键点到纹理坐标
        const landmarks = this.convertLandmarksToTextureCoords(this.faceLandmarks[0]);
        
        // 第一步：人脸变形 (瘦脸 + 大眼)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer1);
        this.renderFaceReshape(inputTexture, landmarks);
        
        // 第二步：磨皮
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer2);
        this.renderSkinSmoothing(tempTexture1);
        
        // 第三步：颜色调整 (美白、对比度等) - 渲染到屏幕
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.renderColorAdjustment(tempTexture2);
        
        // 复制结果到显示画布
        this.copyToResultCanvas();
        
        // 清理资源
        gl.deleteTexture(inputTexture);
        gl.deleteTexture(tempTexture1);
        gl.deleteTexture(tempTexture2);
        gl.deleteFramebuffer(framebuffer1);
        gl.deleteFramebuffer(framebuffer2);            console.log('GPU美颜处理完成');
            
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
        gl.enableVertexAttribArray(program.attribLocations.position);
        gl.vertexAttribPointer(program.attribLocations.position, 2, gl.FLOAT, false, 16, 0);
        
        // 设置纹理坐标属性
        gl.enableVertexAttribArray(program.attribLocations.texCoord);
        gl.vertexAttribPointer(program.attribLocations.texCoord, 2, gl.FLOAT, false, 16, 8);
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
