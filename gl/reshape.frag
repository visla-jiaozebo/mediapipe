     precision highp float;
     uniform sampler2D u_texture;
     varying vec2 blurCoordinates[5];
     
     void main()
     {
        vec4 sum = vec4(0.0);
        sum += texture2D(u_texture, blurCoordinates[0]) * 0.111111;
        sum += texture2D(u_texture, blurCoordinates[1]) * 0.222222;
        sum += texture2D(u_texture, blurCoordinates[2]) * 0.222222;
        sum += texture2D(u_texture, blurCoordinates[3]) * 0.222222;
        sum += texture2D(u_texture, blurCoordinates[4]) * 0.222222;
        gl_FragColor = sum;//texture2D(u_texture, blurCoordinates[0]);
     }