import cv2
import numpy as np
import mediapipe as mp

# 初始化 MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True)

# 读取输入图像
image = cv2.imread("gl/standard_face.png")
h, w, _ = image.shape
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
# 检测面部关键点
results = face_mesh.process(image)
if results.multi_face_landmarks:
    for face_landmarks in results.multi_face_landmarks:
        # 提取嘴唇关键点坐标
        lips_points = []
        for idx in LIPS_OUTER + LIPS_INNER:
            landmark = face_landmarks.landmark[idx]
            x, y = int(landmark.x * w), int(landmark.y * h)
            lips_points.append([x, y])

        # 生成嘴唇多边形遮罩
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [np.array(lips_points)], 255)

        # 创建红色嘴唇图层（RGBA格式，透明背景）
        red_lips = np.zeros((h, w, 4), dtype=np.uint8)
        red_lips[mask == 255] = [0, 0, 255, 255]  # 纯红色（RGBA）

        # 保存为PNG（透明背景）
        cv2.imwrite("red_lips.png", red_lips)