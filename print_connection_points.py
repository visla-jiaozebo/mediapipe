from face_mesh_connections import FACEMESH_LIPS
# print("FACEMESH_LIPS:", FACEMESH_LIPS)
for connection in FACEMESH_LIPS:
    start, end = connection
    print(f"{start},{end},")