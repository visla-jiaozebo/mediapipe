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

    // 磨皮参数
uniform vec2 u_textureSize;
uniform float u_smoothingLevel; // [0.0, 1.0] 

//  美白，对比度，饱和度，暖色调
uniform float u_brightness;  // 美白强度 [-1.0, 1.0]
uniform float u_contrast;    // 对比度 [-1.0, 1.0]
uniform float u_saturation;  // 饱和度 [-1.0, 1.0]
uniform float u_warmth;      // 暖色调 [-1.0, 1.0] 

vec2 enlargeEye(vec2 textureCoord, vec2 originPosition, float radius, float delta) {

    float weight = distance(vec2(textureCoord.x, textureCoord.y / u_aspectRatio), vec2(originPosition.x, originPosition.y / u_aspectRatio)) / radius;

    weight = 1.0 - (1.0 - weight * weight) * delta;
    weight = clamp(weight, 0.0, 1.0);
    textureCoord = originPosition + (textureCoord - originPosition) * weight;
    return textureCoord;
}
    // 曲线变形函数 - 用于瘦脸
vec2 curveWarp(vec2 texCoord, vec4 pos, float delta) {
    vec2 originPos = vec2(pos.x, pos.y);
    vec2 targetPos = vec2(pos.z, pos.w);
    vec2 direction = normalize(targetPos - originPos);
    float maxDistance = distance(targetPos, originPos);

    if(maxDistance <= 0.0)
        return texCoord;

        // 计算当前点到原始点的距离
    vec2 adjustedTexCoord = vec2(texCoord.x, texCoord.y / u_aspectRatio);
    vec2 adjustedOrigin = vec2(originPos.x, originPos.y / u_aspectRatio);
    float distanceToOrigin = length(adjustedTexCoord - adjustedOrigin);

        // 影响半径 - 基于目标距离
    float influenceRadius = maxDistance * 0.5;

    if(distanceToOrigin < influenceRadius && distanceToOrigin > 0.0) {
            // 计算变形强度
        float influence = smoothstep(influenceRadius, 0.0, distanceToOrigin);
        float warpStrength = delta * influence * 0.3; // 增强变形效果

            // 计算变形方向
        vec2 warpDirection = direction * warpStrength * maxDistance;
        return texCoord - warpDirection;
    }

    return texCoord;
}

    // 曲线变形函数 - 用于瘦脸
vec2 curveWarpVec2(vec2 texCoord, vec2 originPos, vec2 targetPos, float delta) {
    vec2 direction = normalize(targetPos - originPos);
    float maxDistance = distance(targetPos, originPos);

    if(maxDistance <= 0.0)
        return texCoord;

        // 计算当前点到原始点的距离
    vec2 adjustedTexCoord = vec2(texCoord.x, texCoord.y / u_aspectRatio);
    vec2 adjustedOrigin = vec2(originPos.x, originPos.y / u_aspectRatio);
    float distanceToOrigin = length(adjustedTexCoord - adjustedOrigin);

        // 影响半径 - 基于目标距离
    float influenceRadius = maxDistance * 1.5;

    if(distanceToOrigin < influenceRadius && distanceToOrigin > 0.0) {
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

        // 使用MediaPipe Face Mesh标准的脸部轮廓关键点进行瘦脸
        // 基于FACEMESH_FACE_OVAL的正确关键点索引
        // 左脸颊轮廓关键点 (面部椭圆左侧)
        // vec2 leftCheek1 = vec2(u_facePointsX[162], u_facePointsY[162]);
    // vec4 leftCheek2 = vec4(u_facePointsX[127], u_facePointsY[127], u_facePointsX[6], u_facePointsY[6]);
    vec4 leftCheek3 = vec4(u_facePointsX[234], u_facePointsY[234], u_facePointsX[5], u_facePointsY[5]);
    vec4 leftCheek4 = vec4(u_facePointsX[93], u_facePointsY[93], u_facePointsX[4], u_facePointsY[4]);
    vec4 leftCheek5 = vec4(u_facePointsX[132], u_facePointsY[132], u_facePointsX[164], u_facePointsY[164]);
    vec4 leftCheek6 = vec4(u_facePointsX[215], u_facePointsY[215], u_facePointsX[13], u_facePointsY[13]);
    vec4 leftCheek7 = vec4(u_facePointsX[58], u_facePointsY[58], u_facePointsX[14], u_facePointsY[14]);
    vec4 leftCheek8 = vec4(u_facePointsX[172], u_facePointsY[172], u_facePointsX[17], u_facePointsY[17]);
    vec4 leftCheek9 = vec4(u_facePointsX[136], u_facePointsY[136], u_facePointsX[18], u_facePointsY[18]);
    vec4 leftCheek10 = vec4(u_facePointsX[150], u_facePointsY[150], u_facePointsX[199], u_facePointsY[199]);
    vec4 leftCheek11 = vec4(u_facePointsX[149], u_facePointsY[149], u_facePointsX[175], u_facePointsY[175]);  // 251 - 右脸颊下部

        // 右脸颊轮廓关键点 (面部椭圆右侧)
        // vec2 rightCheek1 = vec2(u_facePointsX[389], u_facePointsY[389]);  // 454 - 右颞区
    // vec4 rightCheek2 = vec4(u_facePointsX[356], u_facePointsY[356], u_facePointsX[6], u_facePointsY[6]);  // 356 - 右脸颊上部
    vec4 rightCheek3 = vec4(u_facePointsX[454], u_facePointsY[454], u_facePointsX[195], u_facePointsY[195]);  // 389 - 右脸颊中部  
    vec4 rightCheek4 = vec4(u_facePointsX[323], u_facePointsY[323], u_facePointsX[4], u_facePointsY[4]);  // 251 - 右脸颊下部
    vec4 rightCheek5 = vec4(u_facePointsX[401], u_facePointsY[401], u_facePointsX[164], u_facePointsY[164]);  // 251 - 右脸颊下部
    vec4 rightCheek6 = vec4(u_facePointsX[361], u_facePointsY[361], u_facePointsX[164], u_facePointsY[164]);  // 251 - 右脸颊下部
    vec4 rightCheek7 = vec4(u_facePointsX[435], u_facePointsY[435], u_facePointsX[13], u_facePointsY[13]);  // 251 - 右脸颊下部
    vec4 rightCheek8 = vec4(u_facePointsX[288], u_facePointsY[288], u_facePointsX[14], u_facePointsY[14]);  // 251 - 右脸颊下部
    vec4 rightCheek9 = vec4(u_facePointsX[397], u_facePointsY[397], u_facePointsX[17], u_facePointsY[17]);  // 251 - 右脸颊下部
    vec4 rightCheek10 = vec4(u_facePointsX[365], u_facePointsY[365], u_facePointsX[18], u_facePointsY[18]);  // 251 - 右脸颊下部
    vec4 rightCheek11 = vec4(u_facePointsX[379], u_facePointsY[379], u_facePointsX[199], u_facePointsY[199]);  // 251 - 右脸颊下部
    vec4 rightCheek12 = vec4(u_facePointsX[378], u_facePointsY[378], u_facePointsX[175], u_facePointsY[175]);  // 251 - 右脸颊下部

        // 面部中心线关键点作为收缩目标
    vec2 noseTip = vec2(u_facePointsX[6], u_facePointsY[6]);          // 双眼中心
    vec2 chinCenter = vec2(u_facePointsX[18], u_facePointsY[18]);     // 18 - 下巴中心  
    vec2 faceCenter = (noseTip + chinCenter) * 0.5;

    // 左脸向中心收缩 - 使用Face Oval的准确关键点
    // currentCoord = curveWarpVec2(currentCoord, leftCheek2, faceCenter, u_thinFaceDelta);
    // currentCoord = curveWarp(currentCoord, leftCheek2, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek3, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek4, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek5, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek6, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek7, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek8, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek9, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, leftCheek10, u_thinFaceDelta);

        // 右脸向中心收缩 - 使用Face Oval的准确关键点
        // currentCoord = curveWarp(currentCoord, rightCheek1, u_thinFaceDelta);
    // currentCoord = curveWarp(currentCoord, rightCheek2, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek3, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek4, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek5, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek6, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek7, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek8, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek9, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek10, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek11, u_thinFaceDelta);
    currentCoord = curveWarp(currentCoord, rightCheek12, u_thinFaceDelta);

    return currentCoord;
}

    // 大眼效果 - 使用更准确的眼部关键点
vec2 bigEye(vec2 currentCoord) {
    if(u_hasFace == 0)
        return currentCoord;

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
    float leftEyeRadius = max(distance(leftEyeInner, leftEyeOuter), distance(leftEyeTop, leftEyeBottom)) * 0.6;

    float rightEyeRadius = max(distance(rightEyeInner, rightEyeOuter), distance(rightEyeTop, rightEyeBottom)) * 0.6;

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

// OpenCV风格的双边滤波实现
vec4 bilateralFilterOpenCV(sampler2D tex, vec2 uv, vec2 texelSize, float sigmaColor, float sigmaSpace) {
    vec4 center = texture2D(tex, uv);
    vec4 result = vec4(0.0);
    float totalWeight = 0.0;
    
    // 预计算σ的平方值，避免重复计算
    float sigmaColorSq2 = 2.0 * sigmaColor * sigmaColor;
    float sigmaSpaceSq2 = 2.0 * sigmaSpace * sigmaSpace;

    // 🔧 修复：使用固定的循环范围，但通过距离判断来模拟动态核大小
    float maxRadius = sigmaSpace * 2.0;
    
    for(int x = -7; x <= 7; x++) {
        for(int y = -7; y <= 7; y++) {
            // 计算当前采样点的距离
            float spatialDistSq = float(x*x + y*y);
            float spatialDist = sqrt(spatialDistSq);
            
            // 如果超出动态核大小范围，跳过这个采样点
            if(spatialDist > maxRadius) continue;

            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec4 sample = texture2D(tex, uv + offset);
            
            // 空间权重 (基于欧式距离)
            float spatialWeight = exp(-spatialDistSq / sigmaSpaceSq2);
            
            // 颜色权重 (在RGB空间计算)
            vec3 colorDiff = sample.rgb - center.rgb;
            float colorDistSq = dot(colorDiff, colorDiff);
            float colorWeight = exp(-colorDistSq / sigmaColorSq2);
            
            float weight = spatialWeight * colorWeight;
            result += sample * weight;
            totalWeight += weight;
        }
    }
    
    return result / totalWeight;
}
// 替换原来的bilateralFilter函数
vec4 bilateralFilter(sampler2D tex, vec2 uv, vec2 texelSize) {
    // 根据磨皮强度自适应调整参数
    float adaptiveSigmaColor = mix(1.0, 200.0, u_smoothingLevel);  // 颜色阈值
    float adaptiveSigmaSpace = mix(1.0, 200.0, u_smoothingLevel);    // 空间阈值
    
    return bilateralFilterOpenCV(tex, uv, texelSize, adaptiveSigmaColor, adaptiveSigmaSpace);
}
    // 高质量双边滤波磨皮
vec4 bilateralFilter1(sampler2D tex, vec2 uv, vec2 texelSize) {
    vec4 center = texture2D(tex, uv);
    vec4 result = center;
    float totalWeight = 1.0;

        // 3x3核心采样
    for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
            if(x == 0 && y == 0)
                continue;

            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec4 sample = texture2D(tex, uv + offset);

                // 空间权重
            float spatialWeight = exp(-0.5 * (float(x * x + y * y)));

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

// 唇部化妆混合函数
vec3 applyLipMakeup(vec3 baseColor, vec3 lipColor, float intensity, int blendMode) {
    if (blendMode == 0) {
        // 正常混合
        return mix(baseColor, lipColor, intensity);
    } else if (blendMode == 1) {
        // 叠加混合
        vec3 overlay;
        overlay.r = baseColor.r < 0.5 ? 2.0 * baseColor.r * lipColor.r : 1.0 - 2.0 * (1.0 - baseColor.r) * (1.0 - lipColor.r);
        overlay.g = baseColor.g < 0.5 ? 2.0 * baseColor.g * lipColor.g : 1.0 - 2.0 * (1.0 - baseColor.g) * (1.0 - lipColor.g);
        overlay.b = baseColor.b < 0.5 ? 2.0 * baseColor.b * lipColor.b : 1.0 - 2.0 * (1.0 - baseColor.b) * (1.0 - lipColor.b);
        return mix(baseColor, overlay, intensity);
    } else if (blendMode == 2) {
        // 柔光混合
        vec3 softLight;
        softLight.r = lipColor.r < 0.5 ? baseColor.r - (1.0 - 2.0 * lipColor.r) * baseColor.r * (1.0 - baseColor.r) : baseColor.r + (2.0 * lipColor.r - 1.0) * (sqrt(baseColor.r) - baseColor.r);
        softLight.g = lipColor.g < 0.5 ? baseColor.g - (1.0 - 2.0 * lipColor.g) * baseColor.g * (1.0 - baseColor.g) : baseColor.g + (2.0 * lipColor.g - 1.0) * (sqrt(baseColor.g) - baseColor.g);
        softLight.b = lipColor.b < 0.5 ? baseColor.b - (1.0 - 2.0 * lipColor.b) * baseColor.b * (1.0 - baseColor.b) : baseColor.b + (2.0 * lipColor.b - 1.0) * (sqrt(baseColor.b) - baseColor.b);
        return mix(baseColor, softLight, intensity);
    }
    
    return baseColor;
} 

void main() {
    vec2 texCoord = v_texCoord;
    
    if(u_hasFace == 1 && u_thinFaceDelta > 0.0) {
        texCoord = thinFace(texCoord); 
         texCoord = clamp(texCoord, 0.0, 1.0);
    }
    
    if(u_hasFace == 1 && u_bigEyeDelta > 0.0) {
        texCoord = bigEye(texCoord);
        texCoord = clamp(texCoord, 0.0, 1.0); 
    }
    
    // 磨皮处理
    vec4 color = texture2D(u_texture, texCoord);
    if(u_smoothingLevel > 0.0) {
        vec2 texelSize = 1.0 / u_textureSize;
        vec4 smoothedColor = bilateralFilter(u_texture, texCoord, texelSize);
        color = mix(color, smoothedColor, u_smoothingLevel);
    }
    
    // vec3 lipColor = texture2D(u_lipTexture, v_lipTexCoord).rgb;
    // color.rgb = applyLipMakeup(color.rgb, lipColor, u_lipIntensity , u_lipstickBlendMode);

    // 亮度调整 (美白)
    if (u_brightness != 0.0) {
        color.rgb += u_brightness * 0.3;
    }
    if (u_contrast != 0.0)
    {
         // 对比度调整
        color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;
    }
    if (u_saturation != 0.0)
    {
        // 饱和度调整
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.y *= (1.0 + u_saturation);
        color.rgb = hsv2rgb(hsv);
            
    }

    if (u_warmth != 0.0)
    {

            // 暖色调调整
            color.r += u_warmth * 0.1;
            color.g += u_warmth * 0.05;
    }        
    // 确保颜色在有效范围内
    color.rgb = clamp(color.rgb, 0.0, 1.0);
    gl_FragColor = color;     
} 