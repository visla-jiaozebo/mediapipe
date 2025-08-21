cmake_minimum_required(VERSION 3.19)
project(standalone_face_landmarks LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# User sets FACE_LANDMARKS_SDK_ROOT to the dist/face_landmarks_sdk directory.
if(NOT DEFINED FACE_LANDMARKS_SDK_ROOT)
  message(FATAL_ERROR "Set -DFACE_LANDMARKS_SDK_ROOT=/path/to/dist/face_landmarks_sdk")
endif()

set(SDK_INCLUDE ${FACE_LANDMARKS_SDK_ROOT}/include)
set(SDK_LIB ${FACE_LANDMARKS_SDK_ROOT}/lib)
set(SDK_GRAPHS ${FACE_LANDMARKS_SDK_ROOT}/graphs)

find_library(FFMPEG_AVFORMAT avformat)
find_library(FFMPEG_AVCODEC avcodec)
find_library(FFMPEG_AVUTIL avutil)
find_library(FFMPEG_SWSCALE swscale)


find_path(FFMPEG_INCLUDE_DIR libavformat/avformat.h
  HINTS
    ${FFMPEG_ROOT}/include
    /opt/homebrew/include
    /usr/local/include
    /usr/include
)
if(NOT FFMPEG_AVFORMAT OR NOT FFMPEG_AVCODEC OR NOT FFMPEG_AVUTIL OR NOT FFMPEG_SWSCALE OR NOT FFMPEG_INCLUDE_DIR)
  message(FATAL_ERROR "Could not find FFmpeg (need libs avformat,avcodec,avutil,swscale and headers). Set FFMPEG_ROOT or adjust CMAKE_PREFIX_PATH.")
endif()

add_executable(face_landmarks_demo
  src/main.cpp
)

# Prefer shared library if present.
if(EXISTS ${SDK_LIB}/libface_landmarks_api_dylib.dylib)
  set(FACE_LM_LIB ${SDK_LIB}/libface_landmarks_api_dylib.dylib)
  set(FACE_LM_TYPE SHARED)
else()
  message(FATAL_ERROR "Could not find SDK library in ${SDK_LIB}")
endif()
add_library(face_landmarks_api ${FACE_LM_TYPE} IMPORTED GLOBAL)
# set the include path for face_landmarks_api as ${SDK_INCLUDE}

set_target_properties(face_landmarks_api PROPERTIES 
IMPORTED_LOCATION ${FACE_LM_LIB}
INTERFACE_INCLUDE_DIRECTORIES ${SDK_INCLUDE}
)


# include_directories(${SDK_INCLUDE})
include_directories(${FFMPEG_INCLUDE_DIR})

target_link_libraries(face_landmarks_demo PRIVATE face_landmarks_api
  ${FFMPEG_AVFORMAT} ${FFMPEG_AVCODEC} ${FFMPEG_AVUTIL} ${FFMPEG_SWSCALE} 
)


# Pass graph path as definition for convenience.
add_compile_definitions(FACE_LANDMARKS_GRAPH_PATH="${SDK_GRAPHS}/face_landmarks_desktop_live.pbtxt")

# Set rpath so the dylib beside the executable is found.
set_target_properties(face_landmarks_demo PROPERTIES INSTALL_RPATH "@loader_path" BUILD_RPATH ${SDK_LIB})

message(STATUS "Linking with ${FACE_LM_LIB}")
message(STATUS "Using FFmpeg include dir: ${FFMPEG_INCLUDE_DIR}")
