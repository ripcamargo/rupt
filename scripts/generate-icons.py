"""
Simple script to generate Chrome Extension icons from SVG
Requires: pip install cairosvg pillow
"""

import os
from cairosvg import svg2png
from PIL import Image
from io import BytesIO

# Sizes needed for Chrome extension
SIZES = [16, 32, 48, 128]

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, 'extension', 'icons')
SVG_FILE = os.path.join(ICONS_DIR, 'icon.svg')

def generate_icons():
    """Generate PNG icons from SVG in multiple sizes"""
    
    if not os.path.exists(SVG_FILE):
        print(f"❌ Error: {SVG_FILE} not found!")
        return
    
    print(f"📦 Generating icons from {SVG_FILE}\n")
    
    for size in SIZES:
        output_file = os.path.join(ICONS_DIR, f'icon{size}.png')
        
        try:
            # Convert SVG to PNG with specified size
            svg2png(
                url=SVG_FILE,
                write_to=output_file,
                output_width=size,
                output_height=size,
                dpi=96
            )
            print(f"✓ Created icon{size}.png ({size}x{size})")
            
        except Exception as e:
            print(f"❌ Error creating icon{size}.png: {e}")
    
    print("\n✅ Icon generation complete!")
    print(f"📂 Icons saved to: {ICONS_DIR}")
    print("\nNext steps:")
    print("  1. Run: npm run build:extension")
    print("  2. Load extension-dist folder in Chrome")

if __name__ == '__main__':
    try:
        import cairosvg
        import PIL
        generate_icons()
    except ImportError:
        print("❌ Required packages not found!")
        print("\nInstall with:")
        print("  pip install cairosvg pillow")
        print("\nOr use online converter:")
        print("  https://www.aconvert.com/image/svg-to-png/")
