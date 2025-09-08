#### android
```bin/sh
bazel build -c opt --config=android_arm64 --strip always --define MEDIAPIPE_DISABLE_GPU=0 //mediapipe/tasks/c/vision/face_landmarker:libface_landmarker.so
```