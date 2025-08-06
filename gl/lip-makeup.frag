precision highp float;

varying vec2 v_texCoord;
varying vec2 v_lipTexCoord;

uniform sampler2D u_texture;      // 原始图像
uniform sampler2D u_lipTexture;   // 唇膏纹理
uniform float u_lipIntensity;     // 唇膏强度
uniform int u_lipstickBlendMode;  // 混合模式

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

void main1() {
    // 从原始图像采样
    vec4 baseColor = texture2D(u_texture, v_texCoord);
    // baseColor = vec4(v_texCoord.x, v_texCoord.y, 0.0, 1.0); // 调试用，显示纹理坐标
    
    // 从唇膏纹理采样
    vec4 lipColor = texture2D(u_lipTexture, v_lipTexCoord) * u_lipIntensity;
    if (lipColor.a == 0.0) {
        gl_FragColor = baseColor;
        return;
    }
    // lipColor.a = 1.0; // 确保唇膏颜色的透明度为1.0
    // 固定唇膏颜色为红色
    // vec4 lipColor = vec4(1.0, 1.0, 0.0, 1.0); // 红色唇膏
    lipColor = vec4(clamp(lipColor.rgb * (1.0 / lipColor.a), 0.0, 1.0), lipColor.a);

    // 应用唇膏效果
    vec3 finalColor = applyLipMakeup(baseColor.rgb, lipColor.rgb, u_lipIntensity, u_lipstickBlendMode);
    
    // gl_FragColor = vec4(finalColor, baseColor.a);
    // gl_FragColor = baseColor;

    gl_FragColor =
          vec4(baseColor.rgb * (1.0 - lipColor.a) + finalColor.rgb * lipColor.a, 1.0);
}




 float blendHardLight(float base, float blend) {
      return blend < 0.5 ? (2.0 * base * blend)
                         : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
    }

    vec3 blendHardLight(vec3 base, vec3 blend) {
      return vec3(blendHardLight(base.r, blend.r),
                  blendHardLight(base.g, blend.g),
                  blendHardLight(base.b, blend.b));
    }

    float blendSoftLight(float base, float blend) {
      return (blend < 0.5) ? (base + (2.0 * blend - 1.0) * (base - base * base))
                           : (base + (2.0 * blend - 1.0) * (sqrt(base) - base));
    } vec3 blendSoftLight(vec3 base, vec3 blend) {
      return vec3(blendSoftLight(base.r, blend.r),
                  blendSoftLight(base.g, blend.g),
                  blendSoftLight(base.b, blend.b));
    }

    vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }

    float blendOverlay(float base, float blend) {
      return base < 0.5 ? (2.0 * base * blend)
                        : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
    } vec3 blendOverlay(vec3 base, vec3 blend) {
      return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g),
                  blendOverlay(base.b, blend.b));
    }

    vec3 blendFunc(vec3 base, vec3 blend, int blendMode) {
      if (blendMode == 0) {
        return blend;
      } else if (blendMode == 15) {
        return blendMultiply(base, blend);
      } else if (blendMode == 17) {
        return blendOverlay(base, blend);
      } else if (blendMode == 22) {
        return blendHardLight(base, blend);
      }
      return blend;
    }

    void main() {

    vec4 bgColor = texture2D(u_texture, v_texCoord);
    // baseColor = vec4(v_texCoord.x, v_texCoord.y, 0.0, 1.0); // 调试用，显示纹理坐标
    
    // 从唇膏纹理采样
    vec4 fgColor = texture2D(u_lipTexture, v_lipTexCoord);
    // fgColor = vec4(1.0, 0.0, 0.0, fgColor.a); // 固定唇膏颜色为红色
    float intensity = u_lipIntensity;
    int blendMode = u_lipstickBlendMode;

    //   vec4 fgColor = texture2D(inputImageTexture2, textureCoordinate);  // mouth
      fgColor = fgColor * intensity;
    //   vec4 bgColor = texture2D(inputImageTexture, textureCoordinate2);
      if (fgColor.a == 0.0) {
        gl_FragColor = bgColor;
        return;
      }

      vec3 color = blendFunc(bgColor.rgb,
                             clamp(fgColor.rgb * (1.0 / fgColor.a), 0.0, 1.0),
                             blendMode);
      //    color = color * intensity;
      gl_FragColor =
          vec4(bgColor.rgb * (1.0 - fgColor.a) + color.rgb * fgColor.a, 1.0);
    //   gl_FragColor = fgColor;//vec4(color,fgColor.a);
    }