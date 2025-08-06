attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec2 a_lipCoord;

varying vec2 v_texCoord;
uniform float widthOffset;
uniform float heightOffset;

varying vec4 textureShift_1;
varying vec4 textureShift_2;
varying vec4 textureShift_3;
varying vec4 textureShift_4;


void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;

    textureShift_1 = vec4(a_texCoord + vec2(-widthOffset, 0.0), a_texCoord + vec2(widthOffset, 0.0));
    textureShift_2 = vec4(a_texCoord + vec2(0.0, -heightOffset), a_texCoord + vec2(0.0, heightOffset));
    textureShift_3 = vec4(a_texCoord + vec2(widthOffset, heightOffset), a_texCoord + vec2(-widthOffset, -heightOffset));
    textureShift_4 = vec4(a_texCoord + vec2(-widthOffset, heightOffset), a_texCoord + vec2(widthOffset, -heightOffset));
}  