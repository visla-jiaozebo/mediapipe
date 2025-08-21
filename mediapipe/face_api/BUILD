
load("@rules_cc//cc:defs.bzl", "cc_library", "cc_shared_library", "cc_binary")

cc_library(
    name = "face_landmarks_api",
    srcs = ["face_landmarks_api.cc"],
    hdrs = ["face_landmarks_api.h"],
    visibility = ["//visibility:public"],
    # deps = [
    #     "//mediapipe/framework:calculator_framework",
    #     "//mediapipe/framework/formats:image_frame",
    #     "//mediapipe/framework/formats:landmark_cc_proto",
    #     "//mediapipe/framework/port:logging",
    #     "//mediapipe/framework/port:status",
    #     "//mediapipe/framework/port:parse_text_proto",
    #     "//mediapipe/framework/port:ret_check",
    #     # Graph calculators (flow limiter + face landmark subgraph) used at runtime.
    #     "//mediapipe/graphs/face_landmarks:desktop_live_calculators",
    #     "@com_google_absl//absl/status",
    # ],
# cc_library(
#     name = "desktop_live_calculators",
#     deps = [
#         "//mediapipe/calculators/core:constant_side_packet_calculator",
#         "//mediapipe/calculators/core:flow_limiter_calculator",
#         "//mediapipe/graphs/face_mesh/subgraphs:face_renderer_cpu",
#         "//mediapipe/modules/face_landmark:face_landmark_front_cpu",
#     ],
# )

# cc_library(
#     name = "demo_run_graph_main",
#     srcs = ["demo_run_graph_main.cc"],
#     deps = [
#         "//mediapipe/framework:calculator_framework",
#         "//mediapipe/framework/formats:image_frame",
#         "//mediapipe/framework/formats:image_frame_opencv",
#         "//mediapipe/framework/port:file_helpers",
#         "//mediapipe/framework/port:opencv_highgui",
#         "//mediapipe/framework/port:opencv_imgproc",
#         "//mediapipe/framework/port:opencv_video",
#         "//mediapipe/framework/port:parse_text_proto",
#         "//mediapipe/framework/port:status",
#         "//mediapipe/util:resource_util",
#         "@com_google_absl//absl/flags:flag",
#         "@com_google_absl//absl/flags:parse",
#         "@com_google_absl//absl/log:absl_log",
#     ],
# )
    deps = [
        "//mediapipe/calculators/core:constant_side_packet_calculator",
        "//mediapipe/calculators/core:flow_limiter_calculator",
        "//mediapipe/graphs/face_mesh/subgraphs:face_renderer_cpu",
        "//mediapipe/modules/face_landmark:face_landmark_front_cpu",
        "//mediapipe/framework:calculator_framework",
        "//mediapipe/framework/formats:image_frame",
        "//mediapipe/framework/formats:landmark_cc_proto",
        "//mediapipe/framework/port:parse_text_proto",
        "//mediapipe/framework/port:status",
    ],
)



cc_binary(
    name = "face_landmarks_api_bin",
    srcs = ["main.cpp"],
    deps = [
        ":face_landmarks_api",
        "@macos_ffmpeg//:libffmpeg",
    ],
    data = ["//mediapipe/modules/face_landmark:face_landmark_with_attention.tflite"],
    visibility = ["//visibility:public"],
    linkopts = [
        # "-Wl,-install_name,@rpath/libface_landmarks_api.dylib",
    ],
)

cc_shared_library(
    name = "face_landmarks_api_dylib",
    deps = [":face_landmarks_api"],
    visibility = ["//visibility:public"],
)