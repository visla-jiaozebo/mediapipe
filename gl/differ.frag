     precision highp float;

     varying vec2 v_texCoord; 
     varying vec2 v_texCoord2;
    uniform sampler2D u_texture;
    uniform sampler2D u_texture2;
    uniform float delta;

    void main() {
      vec3 iColor = texture2D(u_texture, v_texCoord).rgb;
      vec3 meanColor = texture2D(u_texture2, v_texCoord2).rgb;
      vec3 diffColor = (iColor - meanColor) * delta;
      diffColor = min(diffColor * diffColor, 1.0);
      gl_FragColor = vec4(diffColor, 1.0);
    }