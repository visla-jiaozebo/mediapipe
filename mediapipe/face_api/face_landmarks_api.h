#ifndef MEDIAPIPE_FACE_API_FACE_LANDMARKS_API_H_
#define MEDIAPIPE_FACE_API_FACE_LANDMARKS_API_H_

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

// Internal Abseil and MediaPipe headers are intentionally not exposed to
// external consumers through this public header to keep dependency surface
// minimal. Implementation source includes the necessary framework headers.

namespace mediapipe {  // forward declarations and API live in mediapipe namespace
// Forward declare minimal internal types to reduce external includes.
class CalculatorGraph;
class OutputStreamPoller;

// Export macro for shared library symbol visibility.
#if !defined(FACE_LM_EXPORT)
#if defined(_WIN32)
#  if defined(FACE_LM_BUILD_DLL)
#    define FACE_LM_EXPORT __declspec(dllexport)
#  else
#    define FACE_LM_EXPORT __declspec(dllimport)
#  endif
#else
#  define FACE_LM_EXPORT __attribute__((visibility("default")))
#endif
#endif

// Simple POD for returning normalized landmark coordinates (0-1 range) and z.
struct FaceLm {
  float x = 0.f;
  float y = 0.f;
  float z = 0.f;
  float visibility = 0.f;  // 0 if not present.
};

// Lightweight status enum for API surface (maps internally to absl::Status).
enum class FaceLmStatusCode {
  kOk = 0,
  kNotInitialized = 1,
  kInitFailed = 2,
  kProcessFailed = 3,
};

struct FaceLmStatus {
  FaceLmStatusCode code = FaceLmStatusCode::kOk;
  std::string message;  // empty when code == kOk
  bool ok() const { return code == FaceLmStatusCode::kOk; }
};

// Lightweight pixel format enum for input frames.
enum class FaceLmPixelFormat {
  kRGBA,   // 4 channels, interleaved
};

// Simple view of an image buffer supplied by the caller. ONLY packed RGB
// (FaceLmPixelFormat::kRGB) is supported now. Data must remain valid until
// the packet has been fully processed (safest: until next call or Shutdown()).
// Stride must be width*3 or 0 (treated as tightly packed). No copy is made.
struct FaceLmImageView {
  const uint8_t* data = nullptr;
  int width = 0;
  int height = 0;
  int stride = 0;  // bytes per row; if 0, treated as tightly packed.
  FaceLmPixelFormat format = FaceLmPixelFormat::kRGBA;  // must be kRGB
};

class FACE_LM_EXPORT FaceLandmarksApi {
 public:
  FaceLandmarksApi();
  ~FaceLandmarksApi();

  FaceLandmarksApi(const FaceLandmarksApi&) = delete;
  FaceLandmarksApi& operator=(const FaceLandmarksApi&) = delete;

  // Initialize the graph from embedded or external pbtxt path.
  FaceLmStatus Initialize();
  // Process one frame (any supported format) and return landmarks for first face.
  FaceLmStatus ProcessFrame(const FaceLmImageView& frame, std::vector<FaceLm>& landmarks);
  void Shutdown();

  // Returns last non-OK status set by Initialize/ProcessFrame.
  FaceLmStatus last_status() const { return last_status_; }

 private:
  std::unique_ptr<CalculatorGraph> graph_;
  std::unique_ptr<OutputStreamPoller> landmarks_poller_;
  int64_t frame_timestamp_ = 0;
  FaceLmStatus last_status_{};
};

}  // namespace mediapipe

#endif  // MEDIAPIPE_FACE_API_FACE_LANDMARKS_API_H_
