    attribute vec4 a_position;
    attribute vec4 a_texCoord;
    // attribute vec4 a_texCoord2;

    varying vec2 v_texCoord;
    varying vec2 v_texCoord2;

    void main() {
      gl_Position = a_position;
      v_texCoord = a_texCoord.xy;
      v_texCoord2 = a_texCoord.xy;
    }