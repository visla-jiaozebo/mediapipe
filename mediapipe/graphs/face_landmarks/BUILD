load("@rules_cc//cc:cc_library.bzl", "cc_library")
load("//mediapipe/framework/tool:mediapipe_graph.bzl", "mediapipe_binary_graph")

package(default_visibility = ["//visibility:public"])

cc_library(
    name = "desktop_live_calculators",
    deps = [
        "//mediapipe/calculators/core:flow_limiter_calculator",
        "//mediapipe/modules/face_landmark:face_landmark_front_cpu",
    ],
)

mediapipe_binary_graph(
    name = "face_landmarks_desktop_live_binary_graph",
    graph = "face_landmarks_desktop_live.pbtxt",
    output_name = "face_landmarks_desktop_live.binarypb",
    deps = [":desktop_live_calculators"],
)
