    attribute vec4 a_position;
     attribute vec4 a_texCoord;
     
     uniform float WO;    // 4/1000=0.004
     uniform float HO;   // 4/1500=0.00266667
     
     varying vec2 blurCoordinates[5];
     
     void main()
     {
        gl_Position = a_position;
        vec2 singleStepOffset = vec2(WO, HO);
        blurCoordinates[0] = a_texCoord.xy;
        blurCoordinates[1] = a_texCoord.xy + singleStepOffset * 1.500000;
        blurCoordinates[2] = a_texCoord.xy - singleStepOffset * 1.500000;
        blurCoordinates[3] = a_texCoord.xy + singleStepOffset * 3.500000;
        blurCoordinates[4] = a_texCoord.xy - singleStepOffset * 3.500000;
    }

