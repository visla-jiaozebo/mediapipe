import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import numpy as np
from matplotlib.widgets import Slider

try:
    # Try to load the actual mouth.png image
    img = mpimg.imread('/Users/visla/Downloads/forMediapipe/res/img/standard_face_704x704.png')
    # print the alpha channel nomalized to 0~1 of this image
    if img.shape[2] == 4:  # Check if the image has an alpha channel
        alpha_channel = img[:, :, 3]  # Normalize alpha channel to 0-1
        red_channel = img[:, :, 0]  # Normalize red channel to 0-1
        green_channel = img[:, :, 1]  # Normalize green channel to 0-1
        blue_channel = img[:, :, 2]  # Normalize blue channel to 0-1
        print("Alpha channel (normalized):", alpha_channel)
        print("Red channel (normalized):", red_channel)
        print("Green channel (normalized):", green_channel)
        print("Blue channel (normalized):", blue_channel)

    # Create figure and axis with space for slider
    fig, ax = plt.subplots(figsize=(12, 10), facecolor='black')
    plt.subplots_adjust(bottom=0.15)  # Make space for slider
    
    # Initial scale factor
    initial_scale = 1.0
    
    # Store original coordinates for scaling
    original_points = []
    point_objects = []
    text_objects = []
    
    # Function to get scaled extent for image
    def get_scaled_extent(scale):
        center_x, center_y = 0.5, 0.4  # Center point
        width, height = 0.7 * scale, 0.7 * scale
        left = center_x - width/2
        right = center_x + width/2
        bottom = center_y + height/2  
        top = center_y - height/2
        return [left, right, bottom, top]

    # Display the image with initial scale
    img_display = ax.imshow(img, extent=get_scaled_extent(initial_scale))

    coordinates_values = [
      0.302451, 0.384169, 0.302986, 0.409377, 0.304336, 0.434977, 0.306984,
      0.460683, 0.311010, 0.486447, 0.316537, 0.511947, 0.323069, 0.536942,
      0.331312, 0.561627, 0.342011, 0.585088, 0.355477, 0.607217, 0.371142,
      0.627774, 0.388459, 0.646991, 0.407041, 0.665229, 0.426325, 0.682694,
      0.447468, 0.697492, 0.471782, 0.707060, 0.500000, 0.709867, 0.528218,
      0.707060, 0.552532, 0.697492, 0.573675, 0.682694, 0.592959, 0.665229,
      0.611541, 0.646991, 0.628858, 0.627774, 0.644523, 0.607217, 0.657989,
      0.585088, 0.668688, 0.561627, 0.676931, 0.536942, 0.683463, 0.511947,
      0.688990, 0.486447, 0.693016, 0.460683, 0.695664, 0.434977, 0.697014,
      0.409377, 0.697549, 0.384169, 0.331655, 0.354725, 0.354609, 0.331785,
      0.387080, 0.325436, 0.420446, 0.330125, 0.452685, 0.339996, 0.547315,
      0.339996, 0.579554, 0.330125, 0.612920, 0.325436, 0.645391, 0.331785,
      0.668345, 0.354725, 0.500000, 0.405156, 0.500000, 0.442322, 0.500000,
      0.480116, 0.500000, 0.517378, 0.457729, 0.542442, 0.476911, 0.546376,
      0.500000, 0.550557, 0.523089, 0.546376, 0.542271, 0.542442, 0.366597,
      0.404028, 0.385132, 0.392425, 0.428177, 0.397495, 0.442446, 0.414082,
      0.422818, 0.419177, 0.382917, 0.415929, 0.557554, 0.414082, 0.571823,
      0.397495, 0.614868, 0.392425, 0.633403, 0.404028, 0.617083, 0.415929,
      0.577182, 0.419177, 0.360880, 0.349748, 0.391440, 0.348304, 0.421788,
      0.352051, 0.451601, 0.358026, 0.548399, 0.358026, 0.578212, 0.352051,
      0.608560, 0.348304, 0.639120, 0.349748, 0.407165, 0.390906, 0.402591,
      0.420584, 0.406113, 0.405280, 0.592835, 0.390906, 0.597409, 0.420584,
      0.593887, 0.405280, 0.471223, 0.409619, 0.528777, 0.409619, 0.455607,
      0.495169, 0.544393, 0.495169, 0.441855, 0.523363, 0.558145, 0.523363,
      0.426186, 0.593516, 0.453348, 0.586128, 0.481258, 0.582594, 0.500000,
      0.584476, 0.518742, 0.582594, 0.546652, 0.586128, 0.573814, 0.593516,
      0.556544, 0.620391, 0.531320, 0.639672, 0.500000, 0.644911, 0.468680,
      0.639672, 0.443456, 0.620391, 0.433718, 0.595595, 0.466898, 0.597025,
      0.500000, 0.599883, 0.533102, 0.597025, 0.566282, 0.595595, 0.534634,
      0.610720, 0.500000, 0.616173, 0.465366, 0.610720, 0.406113, 0.405280,
      0.593887, 0.405280, 0.500000, 0.608028, 0.389259, 0.336870, 0.610740,
      0.336870, 0.386071, 0.503558, 0.613928, 0.503558]
    
    all_face_coord_idx = [33, 34, 64, 64, 34, 65, 65, 34, 107, 107, 34, 35, 35, 36, 107, 107, 36,
      66, 66, 107, 65, 66, 36, 67, 67, 36, 37, 37, 67, 43,
      43, 38, 68, 68, 38, 39, 39, 68, 69, 39, 40, 108, 39, 108, 69, 69, 108, 70,
      70, 108, 41, 41, 108, 40, 41, 70, 71, 71, 41, 42,
      0, 33, 52, 33, 52, 64, 52, 64, 53, 64, 53, 65, 65, 53, 72, 65, 72, 66, 66,
      72, 54, 66, 54, 67, 54, 67, 55, 67, 55, 78, 67, 78, 43, 52, 53, 57, 53,
      72, 74, 53, 74, 57, 74, 57, 73, 72, 54, 104, 72, 104, 74, 74, 104, 73, 73,
      104, 56, 104, 56, 54, 54, 56, 55,
      68, 43, 79, 68, 79, 58, 68, 58, 59, 68, 59, 69, 69, 59, 75, 69, 75, 70,
      70, 75, 60, 70, 60, 71, 71, 60, 61, 71, 61, 42, 42, 61, 32, 61, 60, 62,
      60, 75, 77, 60, 77, 62, 77, 62, 76, 75, 77, 105, 77, 105, 76, 105, 76, 63,
      105, 63, 59, 105, 59, 75, 59, 63, 58,
      0, 52, 1, 1, 52, 2, 2, 52, 57, 2, 57, 3, 3, 57, 4, 4, 57, 109, 57, 109,
      74, 74, 109, 56, 56, 109, 80, 80, 109, 82, 82, 109, 7, 7, 109, 6, 6, 109,
      5, 5, 109, 4, 56, 80, 55, 55, 80, 78,
      32, 61, 31, 31, 61, 30, 30, 61, 62, 30, 62, 29, 29, 62, 28, 28, 62, 110,
      62, 110, 76, 76, 110, 63, 63, 110, 81, 81, 110, 83, 83, 110, 25, 25, 110,
      26, 26, 110, 27, 27, 110, 28, 63, 81, 58, 58, 81, 79,
      78, 43, 44, 43, 44, 79, 78, 44, 80, 79, 81, 44, 80, 44, 45, 44, 81, 45,
      80, 45, 46, 45, 81, 46, 80, 46, 82, 81, 46, 83, 82, 46, 47, 47, 46, 48,
      48, 46, 49, 49, 46, 50, 50, 46, 51, 51, 46, 83,
      7, 82, 84, 82, 84, 47, 84, 47, 85, 85, 47, 48, 48, 85, 86, 86, 48, 49, 49,
      86, 87, 49, 87, 88, 88, 49, 50, 88, 50, 89, 89, 50, 51, 89, 51, 90, 51,
      90, 83, 83, 90, 25,
      84, 85, 96, 96, 85, 97, 97, 85, 86, 86, 97, 98, 86, 98, 87, 87, 98, 88,
      88, 98, 99, 88, 99, 89, 89, 99, 100, 89, 100, 90,
      90, 100, 91, 100, 91, 101, 101, 91, 92, 101, 92, 102, 102, 92, 93, 102,
      93, 94, 102, 94, 103, 103, 94, 95, 103, 95, 96, 96, 95, 84,
      96, 97, 103, 97, 103, 106, 97, 106, 98, 106, 103, 102, 106, 102, 101, 106,
      101, 99, 106, 98, 99, 99, 101, 100,
      7, 84, 8, 8, 84, 9, 9, 84, 10, 10, 84, 95, 10, 95, 11, 11, 95, 12, 12, 95,
      94, 12, 94, 13, 13, 94, 14, 14, 94, 93, 14, 93, 15, 15, 93, 16, 16, 93,
      17, 17, 93, 18, 18, 93, 92, 18, 92, 19, 19, 92, 20, 20, 92, 91, 20, 91,
      21, 21, 91, 22, 22, 91, 90, 22, 90, 23, 23, 90, 24, 24, 90, 25]

    original_coords = []
    
    if True:      
        for idx in all_face_coord_idx:
            x, y = (coordinates_values[2*idx]), (coordinates_values[2*idx+1])
            print(f'{idx}:{x},{y}')
            
            # Store original coordinates
            original_coords.append((x, y))
            
            # Create point and text objects
            point = ax.plot(x, y, 'ko', markersize=4, markeredgecolor='green', markeredgewidth=1)[0]
            text = ax.annotate(f'{idx}', (x, y), xytext=(-4, -4), textcoords='offset points',
                              fontsize=12, color='red', weight='bold')
            
            point_objects.append(point)
            text_objects.append(text)
    
    # Create slider
    slider_ax = plt.axes((0.2, 0.05, 0.6, 0.03), facecolor='lightgray')
    scale_slider = Slider(slider_ax, 'Scale', 0.1, 3.0, valinit=initial_scale, valstep=0.1)
    
    # Update function for slider
    def update_scale(val):
        scale = scale_slider.val
        
        # Update image extent
        new_extent = get_scaled_extent(scale)
        img_display.set_extent(new_extent)
        
        # Update point positions (scale around center)
        center_x, center_y = 0.5, 0.4
        for i, (point, text) in enumerate(zip(point_objects, text_objects)):
            original_x, original_y = original_coords[i]
            
            # Scale coordinates around center
            scaled_x = center_x + (original_x - center_x) * scale
            scaled_y = center_y + (original_y - center_y) * scale
            
            # Update point position
            point.set_data([scaled_x], [scaled_y])
            
            # Update text position - use xy parameter to set the anchor point
            text.xy = (scaled_x, scaled_y)
        
        # Redraw
        fig.canvas.draw()
    
    # Connect slider to update function
    scale_slider.on_changed(update_scale)
        
    # for idx in lower_lip_coordinates_idx:
    #     x, y = coordinates_values[2*idx], coordinates_values[2*idx+1]
    #     print(f'{x}, {y}')
    #     ax.plot(x, y, 'ro', markersize=4, markeredgecolor='white', markeredgewidth=1)
    #     ax.annotate(f'{idx}', (x, y), xytext=(3, 3), textcoords='offset points',
    #                fontsize=4, color='white', weight='bold')
        
    # ax.plot(0.5,0.5,'ro', markersize=8, markeredgecolor='white', markeredgewidth=1)

    ax.set_xlim(0, 1)
    ax.set_ylim(1, 0)  # Flip Y to match image coordinates
    ax.set_title('Interactive Face Points with Scale Control', color='white')
    ax.set_facecolor('black')
    
    plt.tight_layout()
    plt.show()
    
except FileNotFoundError:
    print("mouth.png not found. Running coordinate visualization instead...")
    # Run the previous visualization script
    exec(open('visualize_lip_points.py').read())