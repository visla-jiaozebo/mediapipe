// Simple standalone demo using FaceLandmarksApi without OpenCV.
// Uses FFmpeg (libavformat/libavcodec/libavutil) to load the first frame
// of a video or image file into an RGB buffer.
#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include <cstring>

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/pixfmt.h>
#include <libavutil/frame.h>
#include <libswscale/swscale.h>
}

#include "face_landmarks_api.h"

// #ifndef FACE_LANDMARKS_GRAPH_PATH
// #define FACE_LANDMARKS_GRAPH_PATH "face_landmarks_desktop_live.pbtxt"
// #endif

int main(int argc, char** argv) {
  std::cerr << "Starting main function..." << std::endl;
  
  if (argc < 3) {
    std::cerr << "Usage: " << argv[0] << " <graph_path> <image_path>\n";
    return 1;
  }
  std::string graph_path = argv[1];
  std::string path = argv[2];
  
  std::cerr << "About to initialize FFmpeg..." << std::endl;

  av_log_set_level(AV_LOG_ERROR);
  AVFormatContext* fmt_ctx = nullptr;
  if (avformat_open_input(&fmt_ctx, path.c_str(), nullptr, nullptr) < 0) {
    std::cerr << "Failed to open input: " << path << "\n";
    return 1;
  }
  if (avformat_find_stream_info(fmt_ctx, nullptr) < 0) {
    std::cerr << "Failed to find stream info\n";
    avformat_close_input(&fmt_ctx);
    return 1;
  }
  int video_stream_index = -1;
  for (unsigned i = 0; i < fmt_ctx->nb_streams; ++i) {
    if (fmt_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) { video_stream_index = i; break; }
  }
  if (video_stream_index < 0) {
    std::cerr << "No video stream found\n";
    avformat_close_input(&fmt_ctx);
    return 1;
  }
  AVStream* vstream = fmt_ctx->streams[video_stream_index];
  const AVCodec* codec = avcodec_find_decoder(vstream->codecpar->codec_id);
  if (!codec) { std::cerr << "Decoder not found\n"; avformat_close_input(&fmt_ctx); return 1; }
  AVCodecContext* codec_ctx = avcodec_alloc_context3(codec);
  avcodec_parameters_to_context(codec_ctx, vstream->codecpar);
  if (avcodec_open2(codec_ctx, codec, nullptr) < 0) { std::cerr << "Failed to open decoder\n"; avcodec_free_context(&codec_ctx); avformat_close_input(&fmt_ctx); return 1; }

  AVPacket* pkt = av_packet_alloc();
  AVFrame* frame = av_frame_alloc();
  AVFrame* rgb_frame = av_frame_alloc();
  int got = 0;
  int target_w = 0, target_h = 0;
  struct SwsContext* sws = nullptr;

  // We will output RGBA (AV_PIX_FMT_RGBA) directly into rgb_frame's own buffer.
  rgb_frame->format = AV_PIX_FMT_RGBA;
  rgb_frame->width = 0;  // set after first decoded frame
  rgb_frame->height = 0;

  while (av_read_frame(fmt_ctx, pkt) >= 0) {
    if (pkt->stream_index != video_stream_index) { av_packet_unref(pkt); continue; }
    if (avcodec_send_packet(codec_ctx, pkt) == 0) {
      int r = avcodec_receive_frame(codec_ctx, frame);
      if (r == 0) {
        target_w = frame->width; target_h = frame->height;
        if (rgb_frame->width == 0) {
          rgb_frame->width = target_w;
          rgb_frame->height = target_h;
          if (av_frame_get_buffer(rgb_frame, 1) < 0) { std::cerr << "av_frame_get_buffer failed\n"; break; }
        }
        sws = sws_getCachedContext(sws,
                                   frame->width, frame->height, (AVPixelFormat)frame->format,
                                   rgb_frame->width, rgb_frame->height, (AVPixelFormat)rgb_frame->format,
                                   SWS_BILINEAR, nullptr, nullptr, nullptr);
        if (!sws) { std::cerr << "sws_getCachedContext failed\n"; break; }
        sws_scale(sws, frame->data, frame->linesize, 0, frame->height,
                  rgb_frame->data, rgb_frame->linesize);
        got = 1;
        break;  // first frame only
      }
    }
    av_packet_unref(pkt);
  }
  av_packet_free(&pkt);
  av_frame_free(&frame);
  // Keep rgb_frame alive for zero-copy wrap below; cleanup after processing.
  if (sws) sws_freeContext(sws);
  avcodec_free_context(&codec_ctx);
  avformat_close_input(&fmt_ctx);

  if (!got) {
    std::cerr << "Failed to decode a frame from input\n";
    av_frame_free(&rgb_frame);
    return 1;
  }
  std::cout << "Decoded frame size: " << target_w << "x" << target_h << "\n";
  
  std::cerr << "About to create FaceLandmarksApi object..." << std::endl;
  mediapipe::FaceLandmarksApi api;
  std::cerr << "FaceLandmarksApi object created successfully" << std::endl;
  auto status = api.Initialize();
  if (!status.ok()) {
    std::cerr << "Init failed: " << status.message << "\n";
    av_frame_free(&rgb_frame);
    return 1;
  }

  std::vector<mediapipe::FaceLm> landmarks;
  mediapipe::FaceLmImageView view;
  view.data = rgb_frame->data[0];
   view.width = target_w;
   view.height = target_h;
   view.stride = rgb_frame->linesize[0];
   view.format = mediapipe::FaceLmPixelFormat::kRGBA;
  status = api.ProcessFrame(view, landmarks);
  if (!status.ok()) {
    std::cerr << "Process failed: " << status.message << "\n";
    av_frame_free(&rgb_frame);
    return 1;
  }

  std::cout << "Detected " << landmarks.size() << " landmarks\n";
  for (size_t i = 0; i < landmarks.size(); ++i) {
    const auto& lm = landmarks[i];
    // std::cout << i << ": x=" << lm.x << " y=" << lm.y << " z=" << lm.z << " vis=" << lm.visibility << "\n";
  }

  api.Shutdown();
  av_frame_free(&rgb_frame);
  
  
  return 0;
}
