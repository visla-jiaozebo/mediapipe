// Implementation relies on Abseil & MediaPipe, while the public header keeps
// a minimal surface without exposing Abseil types.
#include "mediapipe/face_api/face_landmarks_api.h"

#include <cassert>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "mediapipe/framework/calculator_graph.h"
#include "mediapipe/framework/formats/image_frame.h"
#include "mediapipe/framework/formats/landmark.pb.h"
#include "mediapipe/framework/port/parse_text_proto.h" // Provides ParseTextProtoOrDie

static const auto GRAPH = R"(# MediaPipe graph that performs face mesh with TensorFlow Lite on CPU.

# Input image. (ImageFrame)
input_stream: "input_video"

# Output image with rendered results. (ImageFrame)
output_stream: "output_video"
# Collection of detected/processed faces, each represented as a list of
# landmarks. (std::vector<NormalizedLandmarkList>)
output_stream: "multi_face_landmarks"

# Throttles the images flowing downstream for flow control. It passes through
# the very first incoming image unaltered, and waits for downstream nodes
# (calculators and subgraphs) in the graph to finish their tasks before it
# passes through another image. All images that come in while waiting are
# dropped, limiting the number of in-flight images in most part of the graph to
# 1. This prevents the downstream nodes from queuing up incoming images and data
# excessively, which leads to increased latency and memory usage, unwanted in
# real-time mobile applications. It also eliminates unnecessarily computation,
# e.g., the output produced by a node may get dropped downstream if the
# subsequent nodes are still busy processing previous inputs.
node {
  calculator: "FlowLimiterCalculator"
  input_stream: "input_video"
  input_stream: "FINISHED:output_video"
  input_stream_info: {
    tag_index: "FINISHED"
    back_edge: true
  }
  output_stream: "throttled_input_video"
}

# Defines side packets for further use in the graph.
node {
  calculator: "ConstantSidePacketCalculator"
  output_side_packet: "PACKET:0:num_faces"
  output_side_packet: "PACKET:1:with_attention"
  node_options: {
    [type.googleapis.com/mediapipe.ConstantSidePacketCalculatorOptions]: {
      packet { int_value: 1 }
      packet { bool_value: true }
    }
  }
}

# Subgraph that detects faces and corresponding landmarks.
node {
  calculator: "FaceLandmarkFrontCpu"
  input_stream: "IMAGE:throttled_input_video"
  input_side_packet: "NUM_FACES:num_faces"
  input_side_packet: "WITH_ATTENTION:with_attention"
  output_stream: "LANDMARKS:multi_face_landmarks"
  output_stream: "ROIS_FROM_LANDMARKS:face_rects_from_landmarks"
  output_stream: "DETECTIONS:face_detections"
  output_stream: "ROIS_FROM_DETECTIONS:face_rects_from_detections"
}

# Subgraph that renders face-landmark annotation onto the input image.
node {
  calculator: "FaceRendererCpu"
  input_stream: "IMAGE:throttled_input_video"
  input_stream: "LANDMARKS:multi_face_landmarks"
  input_stream: "NORM_RECTS:face_rects_from_landmarks"
  input_stream: "DETECTIONS:face_detections"
  output_stream: "IMAGE:output_video"
})";


namespace mediapipe {

FaceLandmarksApi::FaceLandmarksApi()
    : graph_(std::make_unique<CalculatorGraph>()) {}

FaceLandmarksApi::~FaceLandmarksApi() { Shutdown(); }

FaceLmStatus FaceLandmarksApi::Initialize() {
  assert(graph_ != nullptr && "Graph not initialized");
  // auto config = ParseTextProtoOrDie<CalculatorGraphConfig>(buffer.str());
  auto config = ParseTextProtoOrDie<CalculatorGraphConfig>(GRAPH);
  
  auto init_status = graph_->Initialize(config);
  if (!init_status.ok()) {
    last_status_ = {FaceLmStatusCode::kInitFailed,
                    std::string(init_status.message())};
    return last_status_;
  }
  auto poller_or = graph_->AddOutputStreamPoller("multi_face_landmarks");
  if (!poller_or.ok()) {
    last_status_ = {FaceLmStatusCode::kInitFailed,
                    std::string(poller_or.status().message())};
    return last_status_;
  }
  landmarks_poller_ =
      std::make_unique<OutputStreamPoller>(std::move(poller_or).value());
  auto run_status = graph_->StartRun({});
  if (!run_status.ok()) {
    last_status_ = {FaceLmStatusCode::kInitFailed,
                    std::string(run_status.message())};
    return last_status_;
  }
  last_status_ = {FaceLmStatusCode::kOk, ""};
  return last_status_;
}

FaceLmStatus FaceLandmarksApi::ProcessFrame(const FaceLmImageView &frame,
                                            std::vector<FaceLm> &landmarks) {
  if (!frame.data || frame.width <= 0 || frame.height <= 0) {
    last_status_ = {FaceLmStatusCode::kProcessFailed, "Invalid frame"};
    return last_status_;
  }
  if (frame.format != FaceLmPixelFormat::kRGBA) {
    last_status_ = {FaceLmStatusCode::kProcessFailed,
                    "Only kRGBA format supported (packed)"};
    return last_status_;
  }
  const int expected_stride = frame.width * 4;
  if (frame.stride != 0 && frame.stride != expected_stride) {
    last_status_ = {FaceLmStatusCode::kProcessFailed, "Unsupported stride"};
    return last_status_;
  }
  if (!graph_ || !landmarks_poller_) {
    last_status_ = {FaceLmStatusCode::kNotInitialized, "Not initialized"};
    return last_status_;
  }

  // Wrap caller memory (zero-copy). Caller must keep buffer alive until
  // consumed.
  auto no_op_deleter = [](uint8_t *) {};
  uint8_t *mutable_ptr = const_cast<uint8_t *>(frame.data);
  auto input_frame =
      std::make_unique<ImageFrame>(ImageFormat::SRGBA, frame.width, frame.height,
                                   expected_stride, mutable_ptr, no_op_deleter);

  Timestamp ts = Timestamp(frame_timestamp_++);
  auto add_status = graph_->AddPacketToInputStream(
      "input_video", Adopt(input_frame.release()).At(ts));
  if (!add_status.ok()) {
    last_status_ = {FaceLmStatusCode::kProcessFailed,
                    std::string(add_status.message())};
    return last_status_;
  }

  Packet packet;
  if (!landmarks_poller_->Next(&packet)) {
    landmarks.clear();
    last_status_ = {FaceLmStatusCode::kOk, ""};
    return last_status_;
  }

  const auto &multi_face_landmarks =
      packet.Get<std::vector<mediapipe::NormalizedLandmarkList>>();
  landmarks.clear();
  if (!multi_face_landmarks.empty()) {
    const auto &first = multi_face_landmarks[0];
    landmarks.reserve(first.landmark_size());
    for (const auto &lm : first.landmark()) {
      FaceLm out;
      out.x = lm.x();
      out.y = lm.y();
      out.z = lm.z();
      if (lm.has_visibility())
        out.visibility = lm.visibility();
      landmarks.push_back(out);
    }
  }
  last_status_ = {FaceLmStatusCode::kOk, ""};
  return last_status_;
}

void FaceLandmarksApi::Shutdown() {
  if (graph_) {
    graph_->CloseInputStream("input_video").IgnoreError();
    graph_->WaitUntilDone().IgnoreError();
  }
}

} // namespace mediapipe
