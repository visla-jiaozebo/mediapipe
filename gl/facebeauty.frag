precision highp float;

varying vec2 v_texCoord; 
uniform sampler2D u_texture;
uniform sampler2D u_texture_b;
uniform sampler2D u_texture_d;

uniform sampler2D lookUpGray;
uniform sampler2D lookUpOrigin;
uniform sampler2D lookUpSkin;
uniform sampler2D lookUpCustom;

uniform float sharpen;
uniform float blurAlpha;
uniform float whiten;

uniform float u_smoothingLevel; // [0.0, 1.0] 

//  美白，对比度，饱和度，暖色调
uniform float u_brightness;  // 美白强度 [-1.0, 1.0]
uniform float u_contrast;    // 对比度 [-1.0, 1.0]
uniform float u_saturation;  // 饱和度 [-1.0, 1.0]
uniform float u_warmth;      // 暖色调 [-1.0, 1.0] 


varying vec4 textureShift_1;
varying vec4 textureShift_2;
varying vec4 textureShift_3;
varying vec4 textureShift_4;


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

vec4 faceSmooth(vec2 v_texCoord) {
    vec4 iColor = texture2D(u_texture, v_texCoord);
    vec4 meanColor = texture2D(u_texture_b, v_texCoord);
    vec4 varColor = texture2D(u_texture_d, v_texCoord);

    vec3 color = iColor.rgb;
    float theta = 0.1;
    float p = clamp((min(iColor.r, meanColor.r - 0.1) - 0.2) * 4.0, 0.0, 1.0);
    float meanVar = (varColor.r + varColor.g + varColor.b) / 3.0;
    float kMin;
    vec3 resultColor;
    kMin = (1.0 - meanVar / (meanVar + theta)) * p * u_smoothingLevel;
    kMin = clamp(kMin, 0.0, 1.0);
    resultColor = mix(iColor.rgb, meanColor.rgb, kMin);

    vec3 sum = 0.25 * iColor.rgb;
    sum += 0.125 * texture2D(u_texture, textureShift_1.xy).rgb;
    sum += 0.125 * texture2D(u_texture, textureShift_1.zw).rgb;
    sum += 0.125 * texture2D(u_texture, textureShift_2.xy).rgb;
    sum += 0.125 * texture2D(u_texture, textureShift_2.zw).rgb;
    sum += 0.0625 * texture2D(u_texture, textureShift_3.xy).rgb;
    sum += 0.0625 * texture2D(u_texture, textureShift_3.zw).rgb;
    sum += 0.0625 * texture2D(u_texture, textureShift_4.xy).rgb;
    sum += 0.0625 * texture2D(u_texture, textureShift_4.zw).rgb;

    vec3 hPass = iColor.rgb - sum;
    color = resultColor + sharpen * hPass * 2.0;
    return vec4(color, iColor.a);
}

void main() {
    vec2 texCoord = v_texCoord;
    // if (u_hasFace == 1) {
    //     gl_FragColor = texture2D(u_texture_d, texCoord);
    //     return;
    // }
    
    // 磨皮处理
    vec4 color = texture2D(u_texture, texCoord);
    if(u_smoothingLevel > 0.0) {
        color = faceSmooth(texCoord);
        // color = mix(color, smoothedColor, u_smoothingLevel);
    }

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