Face Landmarks SDK (MediaPipe subset)
Contents:
  include/face_landmarks_api.h
  lib/ (static + shared libraries)
  graphs/ face_landmarks_desktop_live.pbtxt + binarypb
  xcframework/ (optional)

Link requirements:
  - Link the dylib or static library; you must also link its transitive dependencies (protobuf, absl, etc.) if using static.

Runtime:
  Provide the graph file path to FaceLandmarksApi::Initialize. Ensure current working directory is the SDK root (dist/face_landmarks_sdk) OR set FACE_LM_RESOURCES_ROOT env var to that path so models resolve.
