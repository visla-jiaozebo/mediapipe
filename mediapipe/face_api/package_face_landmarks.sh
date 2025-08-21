#!/usr/bin/env bash

BUILD_FLAGS=( -c opt --define MEDIAPIPE_DISABLE_GPU=1 )
TARGET="//mediapipe/face_api:face_landmarks_api_bin"
TARGET_DYLIB="//mediapipe/face_api:face_landmarks_api_dylib"
PBTXT="/Users/visla/github/google/mediapipe/mediapipe/graphs/face_mesh/face_mesh_desktop_live.pbtxt"
DEMO_PNG="/Users/visla/Downloads/forMediapipe/dist/demo.png"

if [[ "${CLEAN:-0}" == 1 ]]; then
  echo "[INFO] Cleaning bazel output base..."
  bazel clean --expunge_async || true
fi

echo "[INFO] Building arm64 (static) libraries (min macOS ${MACOS_MIN_VER})..."
bazel build "${BUILD_FLAGS[@]}" --macos_cpus=arm64 "${TARGET}"
# bazel build -c opt --define MEDIAPIPE_DISABLE_GPU=1 --macos_cpus=arm64 --linkopt=-Wl,-install_name,@rpath/libface_landmarks_api_dylib.dylib //mediapipe/face_api:face_landmarks_api_dylib
bazel build "${BUILD_FLAGS[@]}" --macos_cpus=arm64 --linkopt=-Wl,-install_name,@rpath/libface_landmarks_api_dylib.dylib "${TARGET_DYLIB}"
# exit if build fails
if [[ $? -ne 0 ]]; then
  echo "[ERROR] Build failed"
  exit 1
fi
echo "[INFO] Prepare distribution directory..."


# Copy library
bazel cquery "${BUILD_FLAGS[@]}" --macos_cpus=arm64 "${TARGET}" --output=files
DYLIB_PATH="bazel-out/darwin_arm64-opt/bin/mediapipe/face_api/face_landmarks_api_bin"
echo "DYLIB_PATH: ${DYLIB_PATH}"

check_opencv_exists_in_rpath=$(otool -l "${DYLIB_PATH}" | grep -c "/Users/visla/github/opencv/dist/4.10.0/lib")
if [[ "${check_opencv_exists_in_rpath}" == 0 ]]; then
  install_name_tool -add_rpath /Users/visla/github/opencv/dist/4.10.0/lib "${DYLIB_PATH}"
  echo "[INFO] Added OpenCV rpath to ${DYLIB_PATH}"
fi

GLOG_logtostderr=1 GLOG_v=2 GLOG_vmodule=InferenceCalculator=2,face_landmark_front=2 $DYLIB_PATH $PBTXT $DEMO_PNG
