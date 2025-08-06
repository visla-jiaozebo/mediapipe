precision highp float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;

uniform float u_facePointsX[468]; // MediaPipe 468个关键点 X坐标
uniform float u_facePointsY[468]; // MediaPipe 468个关键点 Y坐标

    // 美颜参数
uniform float u_thinFaceDelta;   // 瘦脸强度 [0.0, 1.0]
uniform float u_bigEyeDelta;     // 大眼强度 [0.0, 1.0]

uniform float u_aspectRatio;

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
    // 瘦脸效果 - 使用更准确的MediaPipe关键点
vec2 thinFace(vec2 currentCoord) {

        // 使用MediaPipe Face Mesh标准的脸部轮廓关键点进行瘦脸
        // 基于FACEMESH_FACE_OVAL的正确关键点索引
        // 左脸颊轮廓关键点 (面部椭圆左侧)
        // vec2 leftCheek1 = vec2(u_facePointsX[162], u_facePointsY[162]);
    // vec4 leftCheek2 = vec4(u_facePointsX[127], u_facePointsY[127], u_facePointsX[6], u_facePointsY[6]);
     vec4 leftCheek3 = vec4(u_facePointsX[234], u_facePointsY[234], u_facePointsX[101], u_facePointsY[101]);
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

void main() {

     vec2 texCoord = v_texCoord;
     if(u_thinFaceDelta > 0.0) {
          texCoord = thinFace(texCoord);
          texCoord = clamp(texCoord, 0.0, 1.0);
     }

     if(u_bigEyeDelta > 0.0) {
          texCoord = bigEye(texCoord);
          texCoord = clamp(texCoord, 0.0, 1.0);
     }

     gl_FragColor = texture2D(u_texture, texCoord);
}